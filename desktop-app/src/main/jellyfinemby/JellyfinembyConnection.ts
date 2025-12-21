import WebSocket from "ws";
import { createLogger } from "../logger.js";
import { SubtitleCacheManager } from "../subtitleCacheManager.js";
import { buildWebSocketUrl, createAuthHeaders, JellyfinembyIdentity } from "../jellyfinembyUtils.js";
import { MediaServerConfig, MediaServerSessionSummary } from "../types.js";
import {
  KEEP_ALIVE_INTERVAL_MS,
  RECONNECT_DELAY_MS,
  SESSION_BURST_DURATION_MS,
  SESSION_POLL_CONFIG
} from "./constants.js";
import { JellyfinembySessionManager } from "./JellyfinembySessionManager.js";
import { JellyfinembySubtitleLoader } from "./JellyfinembySubtitleLoader.js";
import { ConnectionHooks, RawSessionRecord, SessionSubscriptionMode } from "./types.js";

export class JellyfinembyConnection {
  private socket: WebSocket | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private keepAliveTimer: NodeJS.Timeout | null = null;
  private sessionSubscriptionMode: SessionSubscriptionMode = "idle";
  private sessionStreamActive = false;
  private sessionBurstTimer: NodeJS.Timeout | null = null;
  private pendingBurstDuration: number | null = null;
  private sessions = new Map<string, MediaServerSessionSummary>();
  private activeSessionId: string | null = null;
  private lastActiveSessionItemId: string | null = null;
  // Track position for each itemId separately to detect real activity
  private itemPositionHistory = new Map<string, number>();
  private readonly log = createLogger(`jellyfinemby:${this.config.id}`);
  private readonly sessionManager: JellyfinembySessionManager;
  private readonly subtitleLoader: JellyfinembySubtitleLoader;
  private disposed = false;

  constructor(
    private config: MediaServerConfig,
    private readonly identity: JellyfinembyIdentity,
    private readonly hooks: ConnectionHooks,
    cacheManager?: SubtitleCacheManager
  ) {
    this.sessionManager = new JellyfinembySessionManager(this.config);
    this.subtitleLoader = new JellyfinembySubtitleLoader(this.config, this.identity, this.sessionManager, this.log, cacheManager);
  }

  start() {
    this.disposed = false;
    this.connect();
  }

  dispose() {
    this.disposed = true;
    this.setSessionSubscriptionMode("idle");
    this.clearBurstTimer();
    this.sessions.clear();
    this.activeSessionId = null;
    this.lastActiveSessionItemId = null;
    this.itemPositionHistory.clear();
    this.subtitleLoader.resetState();
    this.disconnect();
  }

  updateConfig(nextConfig: MediaServerConfig) {
    this.config = nextConfig;
    this.sessionManager.updateConfig(nextConfig);
    this.subtitleLoader.updateConfig(nextConfig);
  }

  getConfigSnapshot(): MediaServerConfig {
    return this.config;
  }

  requestSessionsBurst(reason = "manual", durationMs = SESSION_BURST_DURATION_MS) {
    if (this.sessionSubscriptionMode === "continuous") {
      this.log.debug(
        `[${this.config.name}] Skipping session burst request (${reason}): continuous polling active`
      );
      return;
    }

    this.log.debug(`[${this.config.name}] Requesting Jellyfinemby session burst (${reason}) for ${durationMs}ms`);
    this.setSessionSubscriptionMode("burst");
    this.scheduleBurstStop(durationMs);
  }

  setContinuousSessionPolling(enabled: boolean) {
    if (enabled) {
      if (this.sessionSubscriptionMode === "continuous") {
        return;
      }
      this.log.info(`[${this.config.name}] Enabling continuous Jellyfinemby session polling`);
      this.clearBurstTimer();
      this.setSessionSubscriptionMode("continuous");
      return;
    }

    if (this.sessionSubscriptionMode === "continuous") {
      this.log.info(`[${this.config.name}] Disabling continuous Jellyfinemby session polling`);
      this.setSessionSubscriptionMode("idle");
    }
  }

  setActiveSession(sessionId: string | null) {
    const normalizedId =
      sessionId && sessionId.startsWith(this.sessionIdPrefix) ? sessionId : null;

    if (this.activeSessionId === normalizedId) {
      const summary = normalizedId ? this.sessions.get(normalizedId) ?? null : null;
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

    this.activeSessionId = normalizedId;
    this.lastActiveSessionItemId = null;
    this.itemPositionHistory.clear();
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

    const summary = this.sessions.get(normalizedId);
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
    return Array.from(this.sessions.values());
  }

  private get sessionIdPrefix(): string {
    return `${this.config.id}:`;
  }

  private setSessionSubscriptionMode(mode: SessionSubscriptionMode) {
    if (this.sessionSubscriptionMode === mode) {
      return;
    }

    this.sessionSubscriptionMode = mode;
    if (mode !== "burst") {
      this.pendingBurstDuration = null;
    }
    if (mode === "idle") {
      this.clearBurstTimer();
      this.stopSessionStream();
      return;
    }

    if (mode === "continuous") {
      this.clearBurstTimer();
    }

    this.startSessionStream();
  }

  private scheduleBurstStop(durationMs: number) {
    if (!this.sessionStreamActive) {
      this.pendingBurstDuration = durationMs;
      return;
    }

    this.pendingBurstDuration = null;
    this.clearBurstTimer();
    this.sessionBurstTimer = setTimeout(() => {
      this.sessionBurstTimer = null;
      if (this.sessionSubscriptionMode === "burst") {
        this.log.debug("Jellyfinemby session burst window elapsed, stopping session polling");
        this.setSessionSubscriptionMode("idle");
      }
    }, durationMs);
  }

  private clearBurstTimer() {
    if (this.sessionBurstTimer) {
      clearTimeout(this.sessionBurstTimer);
      this.sessionBurstTimer = null;
    }
  }

  private startSessionStream() {
    if (this.sessionStreamActive) {
      return;
    }

    this.connect();
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      this.log.debug("Deferring Jellyfinemby SessionsStart until WebSocket is ready");
      return;
    }

    this.log.debug("Starting Jellyfinemby session polling");
    this.sendMessage({
      MessageType: "SessionsStart",
      Data: SESSION_POLL_CONFIG
    });
    this.sessionStreamActive = true;

    if (this.sessionSubscriptionMode === "burst" && this.pendingBurstDuration !== null) {
      const duration = this.pendingBurstDuration;
      // scheduleBurstStop will clear pendingBurstDuration when the timer starts
      this.scheduleBurstStop(duration);
    }
  }

  private stopSessionStream() {
    if (!this.sessionStreamActive) {
      return;
    }

    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.log.debug("Stopping Jellyfinemby session polling");
      this.sendMessage({ MessageType: "SessionsStop" });
    }
    this.sessionStreamActive = false;
  }

  private syncSessionSubscriptionState() {
    if (this.sessionSubscriptionMode === "idle") {
      this.stopSessionStream();
    } else {
      this.startSessionStream();
    }
  }

  private connect() {
    if (this.socket || this.reconnectTimer || this.disposed) {
      return;
    }

    if (!this.config.serverUrl || !this.config.apiKey) {
      this.log.warn(`[${this.config.name}] Jellyfinemby server URL or API key missing, skipping connection`);
      return;
    }

    try {
      const wsUrl = new URL(buildWebSocketUrl(this.config));
      wsUrl.searchParams.set("api_key", this.config.apiKey);
      wsUrl.searchParams.set("deviceId", this.identity.deviceId);
      wsUrl.searchParams.set("client", this.identity.clientName);
      wsUrl.searchParams.set("deviceName", this.identity.deviceName);
      wsUrl.searchParams.set("version", this.identity.version);
      const headers = {
        ...createAuthHeaders(this.config.apiKey, this.identity)
      };
      this.log.info(`[${this.config.name}] Connecting to Jellyfinemby WebSocket ${wsUrl.toString()}`);
      this.socket = new WebSocket(wsUrl.toString(), { headers });
    } catch (error) {
      this.log.error(`[${this.config.name}] Failed to create Jellyfinemby WebSocket`, error);
      this.scheduleReconnect();
      return;
    }

    this.socket.on("open", () => {
      this.log.info(`[${this.config.name}] Jellyfinemby WebSocket connected`);
      this.hooks.onStatus({ connected: true, serverType: "jellyfinemby" });
      this.startKeepAlive();
      this.syncSessionSubscriptionState();
    });
    this.socket.on("message", (raw) => this.handleSocketMessage(raw));
    this.socket.on("close", () => {
      this.log.warn(`[${this.config.name}] Jellyfinemby WebSocket closed`);
      this.stopKeepAlive();
      this.socket = null;
      this.sessionStreamActive = false;
      this.hooks.onStatus({ connected: false, serverType: "jellyfinemby" });
      this.scheduleReconnect();
    });
    this.socket.on("error", (error) => {
      this.log.error(`[${this.config.name}] Jellyfinemby WebSocket error`, error);
      this.hooks.onError(error instanceof Error ? error : new Error(String(error)));
    });
  }

  private disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.stopKeepAlive();
    this.sessionStreamActive = false;
    if (this.socket) {
      try {
        this.socket.close();
      } catch {
        // ignore
      }
      this.socket = null;
    }
  }

  private scheduleReconnect() {
    if (this.disposed || this.reconnectTimer) {
      return;
    }
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, RECONNECT_DELAY_MS);
  }

  private handleSocketMessage(raw: WebSocket.RawData) {
    let payload: any;
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
      this.processSessions(payload.Data);
    } else if (type === "ForceKeepAlive") {
      this.sendKeepAlive();
    }
  }

  private sendMessage(message: unknown) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return;
    }
    try {
      this.socket.send(JSON.stringify(message));
    } catch (error) {
      this.log.error("Failed to send Jellyfinemby message", error);
    }
  }

  private sendKeepAlive() {
    this.sendMessage({ MessageType: "KeepAlive" });
  }

  private startKeepAlive() {
    this.stopKeepAlive();
    this.keepAliveTimer = setInterval(() => this.sendKeepAlive(), KEEP_ALIVE_INTERVAL_MS);
  }

  private stopKeepAlive() {
    if (this.keepAliveTimer) {
      clearInterval(this.keepAliveTimer);
      this.keepAliveTimer = null;
    }
  }

  private processSessions(data: unknown) {
    if (!Array.isArray(data)) {
      return;
    }

    const nextSessions = new Map<string, MediaServerSessionSummary>();
    for (const record of data as RawSessionRecord[]) {
      // Skip our own session - we don't want to monitor ourselves
      const deviceId = (record as any)?.DeviceId;
      if (typeof deviceId === "string" && deviceId === this.identity.deviceId) {
        continue;
      }

      const summary = this.sessionManager.toSessionSummary(record);
      if (!summary) {
        continue;
      }

      nextSessions.set(summary.id, summary);
    }
    this.sessions = nextSessions;
    this.hooks.onSessions(Array.from(this.sessions.values()));

    if (this.activeSessionId) {
      const summary = this.sessions.get(this.activeSessionId);
      if (summary) {
        const reportedItemId = summary.nowPlayingItemId;
        const reportedPositionTicks = summary.positionTicks;

        // Determine if we should switch to the reported itemId
        let shouldSwitchItem = false;

        if (!this.lastActiveSessionItemId) {
          // No previous item, accept the reported one
          shouldSwitchItem = true;
        } else if (reportedItemId === this.lastActiveSessionItemId) {
          // Same item, no switch needed, just update position
          shouldSwitchItem = false;
          if (reportedItemId && reportedPositionTicks !== null) {
            this.itemPositionHistory.set(reportedItemId, reportedPositionTicks);
          }
        } else if (!reportedItemId) {
          // No item being reported
          shouldSwitchItem = false;
        } else {
          // Different itemId reported - check if it's actually active
          const lastKnownPosition = this.itemPositionHistory.get(reportedItemId) ?? null;
          const positionChanged = lastKnownPosition !== null &&
            reportedPositionTicks !== null &&
            reportedPositionTicks !== lastKnownPosition;

          const isPlaying = !summary.isPaused;

          // Only switch if the new item shows signs of activity:
          // 1. Position has changed from its own last known position (indicates playback progress or user seeking)
          // 2. OR the item is actively playing
          if (positionChanged || isPlaying) {
            shouldSwitchItem = true;
          }
        }

        // Use the sticky itemId for playback emission
        const effectiveItemId = shouldSwitchItem ? reportedItemId : this.lastActiveSessionItemId;

        // Update tracking if we switched
        if (shouldSwitchItem && reportedItemId) {
          this.lastActiveSessionItemId = reportedItemId;
          if (reportedPositionTicks !== null) {
            this.itemPositionHistory.set(reportedItemId, reportedPositionTicks);
          }
        }

        // Emit playback using the effective (sticky) itemId
        // Only emit if the reported item matches our effective item
        if (reportedItemId === effectiveItemId) {
          // This is the active item, emit its playback state
          this.emitPlayback(summary);
        }

        // Only try to load subtitles if there's actually a playing item and we switched
        if (effectiveItemId && shouldSwitchItem) {
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
        this.lastActiveSessionItemId = null;
        this.itemPositionHistory.clear();
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
