import { app } from "electron";
import { createHash, randomUUID } from "crypto";
import os from "os";
import WebSocket from "ws";
import { createLogger } from "./logger.js";
import { parseSubtitle } from "./subtitleParser.js";
import { SubtitleCacheManager } from "./subtitleCacheManager.js";
import {
  buildSubtitleUrl,
  buildWebSocketUrl,
  createAuthHeaders,
  JellyfinIdentity,
  normalizeServerUrl,
  ticksToMilliseconds,
  guessSubtitleFormatFromStream
} from "./jellyfinUtils.js";
import {
  JellyfinPlaybackPayload,
  JellyfinSessionSummary,
  JellyfinSettings,
  JellyfinConfig,
  JellyfinStatusPayload,
  JellyfinSubtitlesPayload,
  JellyfinSubtitleStream,
  SubtitleTrack
} from "./types.js";

const SESSION_POLL_CONFIG = "0,2000";
const SESSION_BURST_DURATION_MS = 10_000;
const RECONNECT_DELAY_MS = 5_000;
const KEEP_ALIVE_INTERVAL_MS = 30_000;
const CLIENT_NAME = "Immersive Subs Prompter";
const DEFAULT_DEVICE_NAME = "Immersive Subs Prompter Desktop";
const FALLBACK_VERSION = "0.1.0";

type JellyfinEventMap = {
  status: JellyfinStatusPayload;
  sessions: JellyfinSessionSummary[];
  playback: JellyfinPlaybackPayload;
  subtitles: JellyfinSubtitlesPayload;
  error: Error;
};

type JellyfinEventName = keyof JellyfinEventMap;
type JellyfinListener<K extends JellyfinEventName> = (payload: JellyfinEventMap[K]) => void;

function createListenerMap(): { [K in JellyfinEventName]: Set<JellyfinListener<K>> } {
  return {
    status: new Set(),
    sessions: new Set(),
    playback: new Set(),
    subtitles: new Set(),
    error: new Set()
  };
}

type RawSessionRecord = Record<string, unknown>;

type SettingsProvider = () => JellyfinSettings;

type SessionSubscriptionMode = "idle" | "burst" | "continuous";

type ConnectionHooks = {
  onStatus: (payload: JellyfinStatusPayload) => void;
  onSessions: (sessions: JellyfinSessionSummary[]) => void;
  onPlayback: (payload: JellyfinPlaybackPayload) => void;
  onSubtitles: (payload: JellyfinSubtitlesPayload) => void;
  onError: (error: Error) => void;
};

class JellyfinConnection {
  private socket: WebSocket | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private keepAliveTimer: NodeJS.Timeout | null = null;
  private sessionSubscriptionMode: SessionSubscriptionMode = "idle";
  private sessionStreamActive = false;
  private sessionBurstTimer: NodeJS.Timeout | null = null;
  private pendingBurstDuration: number | null = null;
  private sessions = new Map<string, JellyfinSessionSummary>();
  private activeSessionId: string | null = null;
  private subtitleRequestToken = 0;
  private lastSubtitleItemKey: string | null = null;
  private lastActiveSessionItemId: string | null = null;
  // Track position for each itemId separately to detect real activity
  private itemPositionHistory = new Map<string, number>();
  private readonly log: ReturnType<typeof createLogger>;
  private readonly sessionIdPrefix: string;
  private disposed = false;

  constructor(
    private config: JellyfinConfig,
    private readonly identity: JellyfinIdentity,
    private readonly hooks: ConnectionHooks,
    private readonly cacheManager?: SubtitleCacheManager
  ) {
    this.log = createLogger(`jellyfin:${config.id}`);
    this.sessionIdPrefix = `${config.id}:`;
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
    this.subtitleRequestToken = 0;
    this.lastSubtitleItemKey = null;
    this.lastActiveSessionItemId = null;
    this.itemPositionHistory.clear();
    this.disconnect();
  }

  updateConfig(nextConfig: JellyfinConfig) {
    this.config = nextConfig;
  }

  getConfigSnapshot(): JellyfinConfig {
    return this.config;
  }

  requestSessionsBurst(reason = "manual", durationMs = SESSION_BURST_DURATION_MS) {
    if (this.sessionSubscriptionMode === "continuous") {
      this.log.debug(
        `[${this.config.name}] Skipping session burst request (${reason}): continuous polling active`
      );
      return;
    }

    this.log.debug(`[${this.config.name}] Requesting Jellyfin session burst (${reason}) for ${durationMs}ms`);
    this.setSessionSubscriptionMode("burst");
    this.scheduleBurstStop(durationMs);
  }

  setContinuousSessionPolling(enabled: boolean) {
    if (enabled) {
      if (this.sessionSubscriptionMode === "continuous") {
        return;
      }
      this.log.info(`[${this.config.name}] Enabling continuous Jellyfin session polling`);
      this.clearBurstTimer();
      this.setSessionSubscriptionMode("continuous");
      return;
    }

    if (this.sessionSubscriptionMode === "continuous") {
      this.log.info(`[${this.config.name}] Disabling continuous Jellyfin session polling`);
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
    this.lastSubtitleItemKey = null;
    this.lastActiveSessionItemId = null;
    this.itemPositionHistory.clear();

    if (!normalizedId) {
      this.hooks.onSubtitles({ sessionId: null, itemName: null, tracks: [] });
      this.hooks.onPlayback({
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
          sessionId: summary.id,
          itemName: null,
          tracks: []
        });
      }
    }
  }

  getCurrentSessions(): JellyfinSessionSummary[] {
    return Array.from(this.sessions.values());
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
        this.log.debug("Jellyfin session burst window elapsed, stopping session polling");
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
      this.log.debug("Deferring Jellyfin SessionsStart until WebSocket is ready");
      return;
    }

    this.log.debug("Starting Jellyfin session polling");
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
      this.log.debug("Stopping Jellyfin session polling");
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
      this.log.warn(`[${this.config.name}] Jellyfin server URL or API key missing, skipping connection`);
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
      this.log.info(`[${this.config.name}] Connecting to Jellyfin WebSocket ${wsUrl.toString()}`);
      this.socket = new WebSocket(wsUrl.toString(), { headers });
    } catch (error) {
      this.log.error(`[${this.config.name}] Failed to create Jellyfin WebSocket`, error);
      this.scheduleReconnect();
      return;
    }

    this.socket.on("open", () => {
      this.log.info(`[${this.config.name}] Jellyfin WebSocket connected`);
      this.hooks.onStatus({ connected: true });
      this.startKeepAlive();
      this.syncSessionSubscriptionState();
    });
    this.socket.on("message", (raw) => this.handleSocketMessage(raw));
    this.socket.on("close", () => {
      this.log.warn(`[${this.config.name}] Jellyfin WebSocket closed`);
      this.socket = null;
      this.sessionStreamActive = false;
      this.stopKeepAlive();
      this.hooks.onStatus({ connected: false });
      this.scheduleReconnect();
    });
    this.socket.on("error", (error) => {
      this.log.error(`[${this.config.name}] Jellyfin WebSocket error`, error);
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
      this.log.error("Failed to parse Jellyfin message", error);
      return;
    }
    const type = payload?.MessageType;
    if (!type) {
      return;
    }

    if (type === "Sessions") {
      this.processSessions(payload.Data);
    } else if (type === "ForceKeepAlive") {
      this.log.debug("Received ForceKeepAlive, replying with KeepAlive");
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
      this.log.error("Failed to send Jellyfin message", error);
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
    
    const nextSessions = new Map<string, JellyfinSessionSummary>();
    for (const record of data as RawSessionRecord[]) {
      // Skip our own session - we don't want to monitor ourselves
      const deviceId = (record as any)?.DeviceId;
      if (typeof deviceId === "string" && deviceId === this.identity.deviceId) {
        continue;
      }
      
      const summary = this.toSessionSummary(record);
      if (!summary) {
        continue;
      }
      
      nextSessions.set(summary.id, summary);
    }
    this.sessions = nextSessions;
    this.log.info(`[${this.config.name}] Received ${this.sessions.size} Jellyfin session(s)`);
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
            sessionId: summary.id,
            itemName: null,
            tracks: []
          });
        }
      } else {
        this.lastActiveSessionItemId = null;
        this.itemPositionHistory.clear();
        this.hooks.onPlayback({
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

  private toSessionSummary(record: RawSessionRecord): JellyfinSessionSummary | null {
    if (!record || typeof record !== "object") {
      return null;
    }
    const rawId = typeof record.Id === "string" ? record.Id : null;
    if (!rawId) {
      return null;
    }

    const playState: Record<string, unknown> = (record as any).PlayState ?? {};
    const nowPlayingItem: Record<string, unknown> | null = (record as any).NowPlayingItem ?? null;
    const mediaSources = (nowPlayingItem?.MediaSources as RawSessionRecord[] | undefined) ?? [];
    
    // Extract mediaSourceId directly from PlayState first, then fallback to MediaSources
    const mediaSourceIdFromPlayState = typeof playState?.MediaSourceId === "string" ? playState.MediaSourceId : null;
    const mediaSourceIdFromSources = (mediaSources[0]?.Id as string | undefined) ?? null;
    const resolvedMediaSourceId = mediaSourceIdFromPlayState ?? mediaSourceIdFromSources;
    
    // Find the matching media source
    const mediaSource = resolvedMediaSourceId
      ? mediaSources.find((source) => source?.Id === resolvedMediaSourceId) ?? mediaSources[0] ?? null
      : mediaSources[0] ?? null;
    
    const subtitleStreams = this.extractSubtitleStreams(mediaSource, nowPlayingItem);

    return {
      id: this.composeSessionId(rawId),
      serverConfigId: this.config.id,
      serverName: this.config.name,
      deviceName: typeof record.DeviceName === "string" ? record.DeviceName : null,
      client: typeof record.Client === "string" ? record.Client : null,
      userName: typeof record.UserName === "string" ? record.UserName : null,
      nowPlayingItemId: typeof nowPlayingItem?.Id === "string" ? nowPlayingItem.Id : null,
      nowPlayingItemName: typeof nowPlayingItem?.Name === "string" ? nowPlayingItem.Name : null,
      mediaSourceId: resolvedMediaSourceId,
      runTimeTicks: typeof nowPlayingItem?.RunTimeTicks === "number" ? nowPlayingItem.RunTimeTicks : null,
      positionTicks: typeof playState?.PositionTicks === "number" ? playState.PositionTicks : null,
      isPaused: Boolean(playState?.IsPaused),
      playbackRate: typeof playState?.PlaybackRate === "number" ? playState.PlaybackRate : 1,
      subtitleStreams
    };
  }

  private composeSessionId(sessionId: string): string {
    return `${this.config.id}:${sessionId}`;
  }

  private extractSubtitleStreams(
    mediaSource: RawSessionRecord | null,
    nowPlayingItem: RawSessionRecord | null
  ): JellyfinSubtitleStream[] {
    return this.collectSubtitleStreams(mediaSource?.MediaStreams, nowPlayingItem?.MediaStreams);
  }

  private collectSubtitleStreams(...collections: unknown[]): JellyfinSubtitleStream[] {
    const byIndex = new Map<number, JellyfinSubtitleStream>();
    for (const streams of collections) {
      if (!Array.isArray(streams)) {
        continue;
      }
      for (const stream of streams as RawSessionRecord[]) {
        const normalized = this.toSubtitleStream(stream);
        if (!normalized) {
          continue;
        }
        if (!byIndex.has(normalized.index)) {
          byIndex.set(normalized.index, normalized);
        }
      }
    }
    return Array.from(byIndex.values()).sort((a, b) => a.index - b.index);
  }

  private toSubtitleStream(stream: RawSessionRecord | null): JellyfinSubtitleStream | null {
    if (!stream || typeof stream !== "object") {
      return null;
    }
    const type = typeof stream.Type === "string" ? stream.Type.toLowerCase() : "";
    const isText = stream.IsTextSubtitleStream === true || type === "subtitle" || type === "subtitles";
    if (!isText) {
      return null;
    }
    const index = typeof stream.Index === "number" ? stream.Index : null;
    if (index === null) {
      return null;
    }
    return {
      index,
      codec: typeof stream.Codec === "string" ? stream.Codec : null,
      language: typeof stream.Language === "string" ? stream.Language : null,
      displayTitle: typeof stream.DisplayTitle === "string" ? stream.DisplayTitle : null,
      isDefault: Boolean(stream.IsDefault),
      isForced: Boolean(stream.IsForced),
      isText: stream.IsTextSubtitleStream === true
    };
  }

  private emitPlayback(summary: JellyfinSessionSummary) {
    const positionMs = ticksToMilliseconds(summary.positionTicks);
    this.hooks.onPlayback({
      sessionId: summary.id,
      itemName: summary.nowPlayingItemName ?? null,
      isPaused: summary.isPaused,
      playbackRate: summary.playbackRate || 1,
      positionMs,
      runTimeMs: ticksToMilliseconds(summary.runTimeTicks)
    });
  }

  private async loadSubtitlesForSession(summary: JellyfinSessionSummary, force = false) {
    if (!this.config.serverUrl || !this.config.apiKey) {
      this.log.warn(`[${this.config.name}] Skipping Jellyfin subtitles due to missing server configuration`, {
        serverUrl: this.config.serverUrl,
        hasApiKey: Boolean(this.config.apiKey)
      });
      this.hooks.onSubtitles({
        sessionId: summary.id,
        itemName: summary.nowPlayingItemName ?? null,
        tracks: []
      });
      return;
    }

    if (!summary.nowPlayingItemId) {
      this.log.warn(`[${this.config.name}] Skipping Jellyfin subtitles due to missing item ID`, {
        sessionId: summary.id
      });
      this.hooks.onSubtitles({
        sessionId: summary.id,
        itemName: summary.nowPlayingItemName ?? null,
        tracks: []
      });
      return;
    }

    const resolvedStreams = await this.resolveSubtitleStreams(summary, this.config, true);
    
    if (!resolvedStreams.streams.length) {
      this.log.info(
        `[${this.config.name}] No subtitle streams available for session ${summary.id} (${summary.nowPlayingItemName ?? "unknown"})`
      );
      this.hooks.onSubtitles({
        sessionId: summary.id,
        itemName: summary.nowPlayingItemName ?? null,
        tracks: []
      });
      return;
    }

    const workingSummary: JellyfinSessionSummary = {
      ...summary,
      mediaSourceId: resolvedStreams.mediaSourceId ?? summary.mediaSourceId,
      subtitleStreams: resolvedStreams.streams
    };

    if (!workingSummary.mediaSourceId) {
      this.log.warn(`[${this.config.name}] Skipping Jellyfin subtitles due to missing media source ID`, {
        itemId: workingSummary.nowPlayingItemId
      });
      this.hooks.onSubtitles({
        sessionId: summary.id,
        itemName: workingSummary.nowPlayingItemName ?? null,
        tracks: []
      });
      return;
    }

    const subtitleKey = `${workingSummary.id}:${workingSummary.nowPlayingItemId}:${workingSummary.mediaSourceId}`;
    if (!force && this.lastSubtitleItemKey === subtitleKey) {
      this.log.debug(
        `[${this.config.name}] Skipping subtitle refresh for session ${workingSummary.id}, media unchanged (${workingSummary.nowPlayingItemId})`
      );
      return;
    }
    
    this.lastSubtitleItemKey = subtitleKey;

    const currentToken = ++this.subtitleRequestToken;
    this.log.info(
      `[${this.config.name}] Fetching ${workingSummary.subtitleStreams.length} subtitle stream(s) from session ${workingSummary.id} (${workingSummary.nowPlayingItemName ?? "unknown"})`
    );

    const tracks: SubtitleTrack[] = [];
    for (const stream of workingSummary.subtitleStreams) {
      try {
        const extension = this.getPreferredExtension(stream);
        const url = buildSubtitleUrl(this.config, workingSummary, stream, extension);
        
        // Check cache first
        let content: string | null = null;
        if (this.cacheManager) {
          const cached = await this.cacheManager.get(url, "jellyfin");
          if (cached && cached.tracks.length > 0) {
            const cachedTrack = cached.tracks[0];
            tracks.push({
              id: `${workingSummary.id}:${stream.index}`,
              language: stream.language ?? "unknown",
              label: this.formatTrackLabel(stream),
              sourceFile: `${workingSummary.nowPlayingItemId ?? "item"}#${stream.index}.${extension}`,
              cues: cachedTrack.cues,
              isAutoGenerated: false
            });
            this.log.debug(`[${this.config.name}] Cache hit for subtitle stream #${stream.index}`);
            continue;
          }
        }
        
        this.log.info(
          `[${this.config.name}] Downloading subtitle stream #${stream.index} (${stream.language ?? "unknown"}) as .${extension}`
        );
        const response = await fetch(url, {
          headers: {
            Accept: "text/vtt, text/plain, application/octet-stream",
            ...createAuthHeaders(this.config.apiKey, this.identity)
          }
        });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        content = await response.text();
        const cues = parseSubtitle(content, extension);
        if (!cues.length) {
          this.log.warn(`[${this.config.name}] Parsed subtitle stream #${stream.index} but found no cues`);
          continue;
        }
        
        const track = {
          id: `${workingSummary.id}:${stream.index}`,
          language: stream.language ?? "unknown",
          label: this.formatTrackLabel(stream),
          sourceFile: `${workingSummary.nowPlayingItemId ?? "item"}#${stream.index}.${extension}`,
          cues,
          isAutoGenerated: false
        };
        tracks.push(track);
        
        if (this.cacheManager && content) {
          await this.cacheManager.set(url, "jellyfin", { tracks: [track] });
        }
      } catch (error) {
        this.log.warn(`[${this.config.name}] Failed to fetch Jellyfin subtitle stream`, {
          sessionId: workingSummary.id,
          streamIndex: stream.index,
          error
        });
      }
    }

    if (currentToken !== this.subtitleRequestToken) {
      return;
    }

    this.hooks.onSubtitles({
      sessionId: workingSummary.id,
      itemName: workingSummary.nowPlayingItemName ?? null,
      tracks
    });
  }

  /**
   * Resolve subtitle streams with recursive retry mechanism
   * Migrated from jellyfin-desktop-client for robust metadata fetching
   * 
   * @param summary - Current session summary
   * @param config - Active Jellyfin configuration
   * @param allowRefresh - Whether to allow API refresh on missing data
   * @returns Object containing resolved streams and mediaSourceId
   */
  private async resolveSubtitleStreams(
    summary: JellyfinSessionSummary,
    config: JellyfinConfig,
    allowRefresh: boolean
  ): Promise<{ streams: JellyfinSubtitleStream[]; mediaSourceId: string | null }> {
    // 1. First, try to use streams from session
    if (summary.subtitleStreams.length > 0 && summary.mediaSourceId) {
      this.log.debug("Using subtitle streams from session", {
        sessionId: summary.id,
        streamCount: summary.subtitleStreams.length,
        mediaSourceId: summary.mediaSourceId
      });
      return {
        streams: summary.subtitleStreams,
        mediaSourceId: summary.mediaSourceId
      };
    }

    // 2. If streams are missing and refresh is allowed, fetch from API
    if (allowRefresh && summary.nowPlayingItemId) {
      this.log.info("Subtitle metadata missing from session, fetching from Jellyfin API", {
        sessionId: summary.id,
        itemId: summary.nowPlayingItemId,
        hasMediaSourceId: Boolean(summary.mediaSourceId),
        currentStreamCount: summary.subtitleStreams.length
      });

      const metadata = await this.fetchNowPlayingMetadata(summary, config);
      if (metadata && (metadata.subtitleStreams.length > 0 || metadata.mediaSourceId)) {
        this.log.info("Successfully fetched subtitle metadata from API", {
          sessionId: summary.id,
          streamCount: metadata.subtitleStreams.length,
          mediaSourceId: metadata.mediaSourceId
        });
        
        // Recursively call with allowRefresh=false to avoid infinite loop
        return this.resolveSubtitleStreams(
          {
            ...summary,
            subtitleStreams: metadata.subtitleStreams,
            mediaSourceId: metadata.mediaSourceId ?? summary.mediaSourceId
          },
          config,
          false // Prevent infinite recursion
        );
      }
    }

    // 3. Fallback: return what we have (may be empty)
    return {
      streams: summary.subtitleStreams,
      mediaSourceId: summary.mediaSourceId
    };
  }

  private async refreshSubtitleMetadata(summary: JellyfinSessionSummary): Promise<JellyfinSessionSummary | null> {
    const metadata = await this.fetchNowPlayingMetadata(summary);
    if (!metadata) {
      return null;
    }
    const subtitleStreams = metadata.subtitleStreams.length ? metadata.subtitleStreams : summary.subtitleStreams;
    const mediaSourceId = metadata.mediaSourceId ?? summary.mediaSourceId;
    const itemName = metadata.itemName ?? summary.nowPlayingItemName;
    if (!mediaSourceId && !subtitleStreams.length) {
      return null;
    }
    return {
      ...summary,
      mediaSourceId: mediaSourceId ?? null,
      nowPlayingItemName: itemName ?? null,
      subtitleStreams
    };
  }

  private async fetchNowPlayingMetadata(summary: JellyfinSessionSummary, config?: JellyfinConfig) {
    const activeConfig = config ?? this.config;
    if (!activeConfig.serverUrl || !activeConfig.apiKey || !summary.nowPlayingItemId) {
      return null;
    }
    try {
      const normalized = normalizeServerUrl(activeConfig.serverUrl);
      const url = new URL(`${normalized}/Items/${summary.nowPlayingItemId}`);
      url.searchParams.set("api_key", activeConfig.apiKey);
      const response = await fetch(url.toString(), {
        headers: {
          Accept: "application/json",
          ...createAuthHeaders(activeConfig.apiKey, this.identity)
        }
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const item = await response.json();
      const mediaSources = Array.isArray(item?.MediaSources) ? (item.MediaSources as RawSessionRecord[]) : [];
      
      // Use mediaSourceId from summary first, then fallback to first source
      const mediaSourceIdFromSummary = summary.mediaSourceId;
      const mediaSourceIdFromSources = (mediaSources[0]?.Id as string | undefined) ?? null;
      const resolvedMediaSourceId = mediaSourceIdFromSummary ?? mediaSourceIdFromSources;
      
      // Find matching media source
      const mediaSource = resolvedMediaSourceId
        ? mediaSources.find((source) => source?.Id === resolvedMediaSourceId) ?? mediaSources[0] ?? null
        : mediaSources[0] ?? null;
      
      const subtitleStreams = this.extractSubtitleStreams(mediaSource, item);
      const itemName = typeof item?.Name === "string" ? item.Name : null;
      
      return {
        subtitleStreams,
        mediaSourceId: resolvedMediaSourceId,
        itemName
      };
    } catch (error) {
      this.log.warn("Failed to refresh Jellyfin item metadata", {
        sessionId: summary.id,
        itemId: summary.nowPlayingItemId,
        error
      });
      return null;
    }
  }

  /**
   * Get preferred subtitle extension with intelligent format detection
   * Enhanced version using guessSubtitleFormatFromStream from jellyfin-desktop-client
   */
  private getPreferredExtension(stream: JellyfinSubtitleStream): string {
    return guessSubtitleFormatFromStream(stream);
  }

  private formatTrackLabel(stream: JellyfinSubtitleStream): string {
    const parts: string[] = [];
    if (stream.displayTitle) {
      parts.push(stream.displayTitle);
    } else if (stream.language) {
      parts.push(stream.language);
    } else {
      parts.push(`Subtitle #${stream.index}`);
    }
    if (stream.codec) {
      parts.push(stream.codec.toUpperCase());
    }
    if (stream.isForced) {
      parts.push("Forced");
    }
    if (stream.isDefault) {
      parts.push("Default");
    }
    return parts.join(" · ");
  }
}

export class JellyfinSubtitleService {
  private readonly log = createLogger("jellyfin");
  private readonly listeners = createListenerMap();
  private readonly identity = createJellyfinIdentity();
  private settings: JellyfinSettings;
  private connections = new Map<string, JellyfinConnection>();
  private connectionStatuses = new Map<string, boolean>();
  private sessionsByConfig = new Map<string, JellyfinSessionSummary[]>();
  private sessions = new Map<string, JellyfinSessionSummary>();
  private activeSessionId: string | null = null;
  private continuousSessionPolling = false;

  constructor(
    private readonly settingsProvider: SettingsProvider,
    private readonly cacheManager?: SubtitleCacheManager
  ) {
    this.settings = this.settingsProvider();
  }

  on<K extends JellyfinEventName>(event: K, listener: JellyfinListener<K>) {
    this.listeners[event].add(listener as JellyfinListener<any>);
    return () => this.listeners[event].delete(listener as JellyfinListener<any>);
  }

  start() {
    this.applySettings(this.settingsProvider());
    if (this.settings.enabled) {
      this.requestSessionsBurst("startup");
    }
  }

  refresh() {
    this.applySettings(this.settingsProvider());
    if (this.settings.enabled) {
      this.requestSessionsBurst("settings-refresh");
    }
  }

  requestSessionsBurst(reason = "manual", durationMs = SESSION_BURST_DURATION_MS) {
    if (!this.settings.enabled) {
      return;
    }
    if (!this.connections.size) {
      this.log.debug(`Skipping Jellyfin session burst (${reason}): no active connections`);
      return;
    }
    for (const connection of this.connections.values()) {
      connection.requestSessionsBurst(reason, durationMs);
    }
  }

  setContinuousSessionPolling(enabled: boolean) {
    if (!this.settings.enabled && enabled) {
      this.log.debug("Ignoring continuous polling request: Jellyfin disabled");
      return;
    }
    this.continuousSessionPolling = enabled;
    for (const connection of this.connections.values()) {
      connection.setContinuousSessionPolling(enabled);
    }
  }

  setActiveSession(sessionId: string | null) {
    if (!this.settings.enabled) {
      sessionId = null;
    }
    if (!sessionId) {
      this.activeSessionId = null;
      for (const connection of this.connections.values()) {
        connection.setActiveSession(null);
      }
      return;
    }
    const configId = this.extractConfigId(sessionId);
    if (!configId) {
      this.log.warn(`Invalid Jellyfin session identifier ${sessionId}, clearing selection`);
      this.setActiveSession(null);
      return;
    }
    const target = this.connections.get(configId);
    if (!target) {
      this.log.warn(`No Jellyfin connection for session ${sessionId}, clearing selection`);
      this.setActiveSession(null);
      return;
    }
    this.activeSessionId = sessionId;
    for (const [id, connection] of this.connections.entries()) {
      connection.setActiveSession(id === configId ? sessionId : null);
    }
  }

  getCurrentSessions(): JellyfinSessionSummary[] {
    return Array.from(this.sessions.values());
  }

  private applySettings(next: JellyfinSettings) {
    this.settings = next;
    if (!next.enabled) {
      this.teardownAllConnections();
      this.emit("status", { connected: false });
      this.emit("sessions", []);
      this.activeSessionId = null;
      return;
    }
    this.syncConnections();
  }

  private syncConnections() {
    const enabledConfigs = new Map(
      this.settings.configs.filter((config) => config.enabled).map((config) => [config.id, config])
    );

    for (const [configId, connection] of Array.from(this.connections.entries())) {
      const nextConfig = enabledConfigs.get(configId);
      if (!nextConfig) {
        this.disposeConnection(configId, connection);
        continue;
      }
      const currentConfig = connection.getConfigSnapshot();
      const requiresRestart =
        currentConfig.serverUrl !== nextConfig.serverUrl ||
        currentConfig.apiKey !== nextConfig.apiKey ||
        currentConfig.webSocketPath !== nextConfig.webSocketPath;
      if (requiresRestart) {
        this.disposeConnection(configId, connection);
        this.createConnection(nextConfig);
      } else {
        connection.updateConfig(nextConfig);
      }
      enabledConfigs.delete(configId);
    }

    for (const config of enabledConfigs.values()) {
      this.createConnection(config);
    }
  }

  private createConnection(config: JellyfinConfig) {
    const hooks: ConnectionHooks = {
      onStatus: (payload) => this.handleConnectionStatus(config.id, payload),
      onSessions: (sessions) => this.handleConnectionSessions(config.id, sessions),
      onPlayback: (payload) => this.emit("playback", payload),
      onSubtitles: (payload) => this.emit("subtitles", payload),
      onError: (error) => this.emit("error", error)
    };
    const connection = new JellyfinConnection(config, this.identity, hooks, this.cacheManager);
    this.connections.set(config.id, connection);
    connection.start();
    connection.setContinuousSessionPolling(this.continuousSessionPolling);
    if (this.activeSessionId && this.extractConfigId(this.activeSessionId) === config.id) {
      connection.setActiveSession(this.activeSessionId);
    }
  }

  private disposeConnection(configId: string, connection: JellyfinConnection) {
    connection.setActiveSession(null);
    connection.dispose();
    this.connections.delete(configId);
    this.connectionStatuses.delete(configId);
    if (this.activeSessionId && this.extractConfigId(this.activeSessionId) === configId) {
      this.activeSessionId = null;
    }
    this.handleConnectionSessions(configId, []);
    this.emitAggregatedStatus();
  }

  private teardownAllConnections() {
    for (const [configId, connection] of this.connections.entries()) {
      connection.setActiveSession(null);
      connection.dispose();
      this.handleConnectionSessions(configId, []);
    }
    this.connections.clear();
    this.connectionStatuses.clear();
    this.sessionsByConfig.clear();
    this.sessions.clear();
    this.activeSessionId = null;
  }

  private handleConnectionStatus(configId: string, payload: JellyfinStatusPayload) {
    this.connectionStatuses.set(configId, payload.connected);
    this.emitAggregatedStatus();
  }

  private emitAggregatedStatus() {
    const anyConnected =
      this.settings.enabled && Array.from(this.connectionStatuses.values()).some(Boolean);
    this.emit("status", { connected: anyConnected });
  }

  private handleConnectionSessions(configId: string, sessions: JellyfinSessionSummary[]) {
    const previous = this.sessionsByConfig.get(configId) ?? [];
    for (const summary of previous) {
      this.sessions.delete(summary.id);
    }
    this.sessionsByConfig.set(configId, sessions);
    for (const summary of sessions) {
      this.sessions.set(summary.id, summary);
    }
    this.emit("sessions", Array.from(this.sessions.values()));
  }

  private extractConfigId(globalSessionId: string): string | null {
    const separator = globalSessionId.indexOf(":");
    if (separator === -1) {
      return null;
    }
    return globalSessionId.slice(0, separator);
  }

  private emit<K extends JellyfinEventName>(event: K, payload: JellyfinEventMap[K]) {
    for (const listener of this.listeners[event]) {
      try {
        listener(payload);
      } catch (error) {
        this.log.error(`Error in Jellyfin listener for ${String(event)}`, error);
      }
    }
  }
}

function createJellyfinIdentity(): JellyfinIdentity {
  return {
    clientName: CLIENT_NAME,
    deviceName: deriveDeviceName(),
    deviceId: deriveDeviceId(),
    version: getClientVersion()
  };
}

function deriveDeviceName(): string {
  try {
    const hostname = os.hostname();
    if (hostname && hostname.trim().length) {
      return hostname.trim();
    }
  } catch {
    // ignore
  }
  return DEFAULT_DEVICE_NAME;
}

function deriveDeviceId(): string {
  try {
    const hostname = os.hostname();
    const username = (() => {
      try {
        return os.userInfo().username;
      } catch {
        return "user";
      }
    })();
    const seed = `${hostname ?? DEFAULT_DEVICE_NAME}:${username}`;
    return createHash("sha1").update(seed).digest("hex");
  } catch {
    return randomUUID().replace(/-/g, "");
  }
}

function getClientVersion(): string {
  try {
    return app?.getVersion?.() ?? FALLBACK_VERSION;
  } catch {
    return FALLBACK_VERSION;
  }
}
