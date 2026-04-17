import { createLogger } from "../logger.js";
import { SubtitleCacheManager } from "../subtitleCacheManager.js";
import { JellyfinembyIdentity } from "../jellyfinembyUtils.js";
import { MediaServerConfig, MediaServerSessionSummary } from "../types.js";
import { SESSION_BURST_DURATION_MS } from "./constants.js";
import { JellyfinembySessionManager } from "./JellyfinembySessionManager.js";
import { JellyfinembySessionSubscription } from "./JellyfinembySessionSubscription.js";
import { JellyfinembySessionTracker } from "./JellyfinembySessionTracker.js";
import { JellyfinembySubtitleLoader } from "./JellyfinembySubtitleLoader.js";
import { JellyfinembyWebSocketTransport } from "./JellyfinembyWebSocketTransport.js";
import { ConnectionHooks } from "./types.js";
import WebSocket from "ws";

export class JellyfinembyConnection {
  private readonly log;
  private readonly sessionManager: JellyfinembySessionManager;
  private readonly subtitleLoader: JellyfinembySubtitleLoader;
  private readonly transport: JellyfinembyWebSocketTransport;
  private readonly subscription: JellyfinembySessionSubscription;
  private readonly tracker: JellyfinembySessionTracker;
  private disposed = false;

  constructor(
    private config: MediaServerConfig,
    private readonly identity: JellyfinembyIdentity,
    private readonly hooks: ConnectionHooks,
    cacheManager?: SubtitleCacheManager
  ) {
    this.log = createLogger(`jellyfinemby:${this.config.id}`);
    this.sessionManager = new JellyfinembySessionManager(this.config);
    this.subtitleLoader = new JellyfinembySubtitleLoader(
      this.config,
      this.identity,
      this.sessionManager,
      this.log,
      cacheManager
    );
    this.tracker = new JellyfinembySessionTracker(this.sessionManager, this.identity);
    this.transport = new JellyfinembyWebSocketTransport(this.config, this.identity, this.log, {
      onOpen: () => {
        this.hooks.onStatus({ connected: true, serverType: "jellyfinemby" });
        this.subscription.syncWithTransport();
      },
      onMessage: (raw) => this.handleSocketMessage(raw),
      onClose: () => {
        this.subscription.markTransportClosed();
        this.hooks.onStatus({ connected: false, serverType: "jellyfinemby" });
      },
      onError: (error) => {
        this.hooks.onError(error);
      }
    });
    this.subscription = new JellyfinembySessionSubscription(
      this.transport,
      this.log,
      () => this.config.name,
      () => this.transport.connect()
    );
  }

  start() {
    this.disposed = false;
    this.transport.reset();
    this.transport.connect();
  }

  dispose() {
    this.disposed = true;
    this.subscription.dispose();
    this.tracker.reset();
    this.subtitleLoader.resetState();
    this.transport.dispose();
  }

  updateConfig(nextConfig: MediaServerConfig) {
    this.config = nextConfig;
    this.sessionManager.updateConfig(nextConfig);
    this.subtitleLoader.updateConfig(nextConfig);
    this.transport.updateConfig(nextConfig);
  }

  getConfigSnapshot(): MediaServerConfig {
    return this.config;
  }

  requestSessionsBurst(reason = "manual", durationMs = SESSION_BURST_DURATION_MS) {
    this.subscription.requestBurst(reason, durationMs);
  }

  setContinuousSessionPolling(enabled: boolean) {
    this.subscription.setContinuous(enabled);
  }

  setActiveSession(sessionId: string | null) {
    const normalizedId =
      sessionId && sessionId.startsWith(this.sessionIdPrefix) ? sessionId : null;

    if (this.tracker.getActiveSessionId() === normalizedId) {
      const summary = normalizedId ? this.tracker.getSessionById(normalizedId) : null;
      if (summary) {
        this.emitPlayback(summary);
      } else {
        this.hooks.onPlayback({
          serverType: "jellyfinemby",
          sessionId: null,
          itemName: null,
          isPaused: true,
          playbackRate: 1,
          positionMs: null,
          runTimeMs: null
        });
      }
      return;
    }

    this.tracker.setActive(normalizedId);
    this.subtitleLoader.clearLastSubtitleItemKey();

    if (!normalizedId) {
      this.hooks.onSubtitles({ serverType: "jellyfinemby", sessionId: null, itemName: null, tracks: [] });
      this.hooks.onPlayback({
        serverType: "jellyfinemby",
        sessionId: null,
        itemName: null,
        isPaused: true,
        playbackRate: 1,
        positionMs: null,
        runTimeMs: null
      });
      return;
    }

    const summary = this.tracker.getSessionById(normalizedId);
    if (summary) {
      this.emitPlayback(summary);
      // Only try to load subtitles if there's actually a playing item
      if (summary.nowPlayingItemId) {
        void this.loadSubtitlesForSession(summary, true);
      } else {
        this.log.info(`[${this.config.name}] Selected session has no playing item, skipping subtitle load`, {
          sessionId: summary.id,
          deviceName: summary.deviceName,
          client: summary.client
        });
        this.hooks.onSubtitles({
          serverType: "jellyfinemby",
          sessionId: summary.id,
          itemName: null,
          tracks: []
        });
      }
    }
  }

  getCurrentSessions(): MediaServerSessionSummary[] {
    return this.tracker.getCurrentSessions();
  }

  private get sessionIdPrefix(): string {
    return `${this.config.id}:`;
  }

  private handleSocketMessage(raw: WebSocket.RawData) {
    let payload: { MessageType?: string; Data?: unknown } | null = null;
    try {
      payload = JSON.parse(raw.toString());
    } catch (error) {
      this.log.error("Failed to parse Jellyfinemby message", error);
      return;
    }
    const type = payload?.MessageType;
    if (!type) {
      return;
    }

    if (type === "Sessions") {
      this.processSessions(payload?.Data);
    } else if (type === "ForceKeepAlive") {
      this.transport.handleForceKeepAlive();
    }
  }

  private processSessions(data: unknown) {
    const updated = this.tracker.updateSessions(data);
    if (!updated) {
      return;
    }
    this.hooks.onSessions(updated);

    const activeSessionId = this.tracker.getActiveSessionId();
    if (!activeSessionId) {
      return;
    }

    const summary = this.tracker.getSessionById(activeSessionId);
    if (summary) {
      const { shouldSwitch, effectiveItemId } = this.tracker.determineEffectiveItem(summary);
      const reportedItemId = summary.nowPlayingItemId;

      // Emit playback using the effective (sticky) itemId
      // Only emit if the reported item matches our effective item
      if (reportedItemId === effectiveItemId) {
        // This is the active item, emit its playback state
        this.emitPlayback(summary);
      }

      // Only try to load subtitles if there's actually a playing item and we switched
      if (effectiveItemId && shouldSwitch) {
        void this.loadSubtitlesForSession(summary);
      } else if (!effectiveItemId) {
        this.hooks.onSubtitles({
          serverType: "jellyfinemby",
          sessionId: summary.id,
          itemName: null,
          tracks: []
        });
      }
    } else {
      this.tracker.clearActiveItemTracking();
      this.hooks.onPlayback({
        serverType: "jellyfinemby",
        sessionId: null,
        itemName: null,
        isPaused: true,
        playbackRate: 1,
        positionMs: null,
        runTimeMs: null
      });
    }
  }

  private emitPlayback(summary: MediaServerSessionSummary) {
    const payload = this.sessionManager.toPlaybackPayload(summary);
    this.hooks.onPlayback(payload);
  }

  private async loadSubtitlesForSession(summary: MediaServerSessionSummary, force = false) {
    const payload = await this.subtitleLoader.loadSubtitlesForSession(summary, force);
    if (payload) {
      this.hooks.onSubtitles(payload);
    }
  }
}
