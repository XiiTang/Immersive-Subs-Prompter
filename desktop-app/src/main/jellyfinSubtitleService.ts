import { app } from "electron";
import { createHash, randomUUID } from "crypto";
import os from "os";
import WebSocket from "ws";
import { createLogger } from "./logger.js";
import { parseSubtitle } from "./subtitleParser.js";
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
const RECONNECT_DELAY_MS = 5_000;
const KEEP_ALIVE_INTERVAL_MS = 30_000;
const CLIENT_NAME = "Universal Subtitle Plugin";
const DEFAULT_DEVICE_NAME = "Universal Subtitle Desktop";
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

export class JellyfinSubtitleService {
  private socket: WebSocket | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private keepAliveTimer: NodeJS.Timeout | null = null;
  private readonly log = createLogger("jellyfin");
  private readonly listeners = createListenerMap();
  private sessions = new Map<string, JellyfinSessionSummary>();
  private activeSessionId: string | null = null;
  private subtitleRequestToken = 0;
  private lastSubtitleItemKey: string | null = null;
  private lastActiveSessionItemId: string | null = null;
  private readonly identity = createJellyfinIdentity();
  private settings: JellyfinSettings;

  constructor(private readonly settingsProvider: SettingsProvider) {
    this.settings = this.settingsProvider();
  }

  private getActiveConfig(): JellyfinConfig | null {
    if (!this.settings.activeConfigId) {
      return null;
    }
    return this.settings.configs.find(c => c.id === this.settings.activeConfigId) ?? null;
  }

  on<K extends JellyfinEventName>(event: K, listener: JellyfinListener<K>) {
    this.listeners[event].add(listener as JellyfinListener<any>);
    return () => this.listeners[event].delete(listener as JellyfinListener<any>);
  }

  start() {
    this.applySettings(this.settingsProvider());
  }

  refresh() {
    this.applySettings(this.settingsProvider());
  }

  setActiveSession(sessionId: string | null) {
    if (this.activeSessionId === sessionId) {
      const summary = sessionId ? this.sessions.get(sessionId) ?? null : null;
      if (summary) {
        this.emitPlayback(summary);
      } else {
        this.emit("playback", {
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

    this.activeSessionId = sessionId;
    this.lastSubtitleItemKey = null;
    this.lastActiveSessionItemId = null;

    if (!sessionId) {
      this.emit("subtitles", { sessionId: null, itemName: null, tracks: [] });
      this.emit("playback", {
        sessionId: null,
        itemName: null,
        isPaused: true,
        playbackRate: 1,
        positionMs: null,
        runTimeMs: null
      });
      return;
    }

    const summary = this.sessions.get(sessionId);
    if (summary) {
      this.emitPlayback(summary);
      // Only try to load subtitles if there's actually a playing item
      if (summary.nowPlayingItemId) {
        void this.loadSubtitlesForSession(summary, true);
      } else {
        this.log.info("Selected session has no playing item, skipping subtitle load", {
          sessionId: summary.id,
          deviceName: summary.deviceName,
          client: summary.client
        });
        this.emit("subtitles", {
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

  private emit<K extends JellyfinEventName>(event: K, payload: JellyfinEventMap[K]) {
    for (const listener of this.listeners[event]) {
      try {
        listener(payload);
      } catch (error) {
        this.log.error(`Error in Jellyfin listener for ${String(event)}`, error);
      }
    }
  }

  private applySettings(next: JellyfinSettings) {
    this.settings = next;
    if (!this.settings.enabled) {
      this.disconnect();
      this.sessions.clear();
      this.emit("status", { connected: false });
      return;
    }
    this.connect();
  }

  private connect() {
    if (this.socket || this.reconnectTimer) {
      return;
    }
    
    const activeConfig = this.getActiveConfig();
    if (!activeConfig || !activeConfig.serverUrl || !activeConfig.apiKey) {
      this.log.warn("Jellyfin server URL or API key missing, skipping connection");
      return;
    }

    try {
      const wsUrl = new URL(buildWebSocketUrl(activeConfig));
      wsUrl.searchParams.set("api_key", activeConfig.apiKey);
      wsUrl.searchParams.set("deviceId", this.identity.deviceId);
      wsUrl.searchParams.set("client", this.identity.clientName);
      wsUrl.searchParams.set("deviceName", this.identity.deviceName);
      wsUrl.searchParams.set("version", this.identity.version);
      const headers = {
        ...createAuthHeaders(activeConfig.apiKey, this.identity)
      };
      this.log.info(`Connecting to Jellyfin WebSocket ${wsUrl.toString()}`);
      this.socket = new WebSocket(wsUrl.toString(), { headers });
    } catch (error) {
      this.log.error("Failed to create Jellyfin WebSocket", error);
      this.scheduleReconnect();
      return;
    }

    this.socket.on("open", () => {
      this.log.info("Jellyfin WebSocket connected");
      this.emit("status", { connected: true });
      this.startKeepAlive();
      this.sendMessage({
        MessageType: "SessionsStart",
        Data: SESSION_POLL_CONFIG
      });
    });
    this.socket.on("message", (raw) => this.handleSocketMessage(raw));
    this.socket.on("close", () => {
      this.log.warn("Jellyfin WebSocket closed");
      this.socket = null;
      this.stopKeepAlive();
      this.emit("status", { connected: false });
      this.scheduleReconnect();
    });
    this.socket.on("error", (error) => {
      this.log.error("Jellyfin WebSocket error", error);
      this.emit("error", error instanceof Error ? error : new Error(String(error)));
    });
  }

  private disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.stopKeepAlive();
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
    if (!this.settings.enabled || this.reconnectTimer) {
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

    this.log.info(`Jellyfin WS message: ${type}`);
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
      // Debug log to see raw session data
      this.log.debug("Processing session record", {
        sessionId: (record as any)?.Id,
        deviceId: (record as any)?.DeviceId,
        client: (record as any)?.Client,
        hasNowPlayingItem: Boolean((record as any)?.NowPlayingItem),
        nowPlayingItemId: (record as any)?.NowPlayingItem?.Id,
        hasPlayState: Boolean((record as any)?.PlayState),
        mediaSourceId: (record as any)?.PlayState?.MediaSourceId
      });
      
      // Skip our own session - we don't want to monitor ourselves
      const deviceId = (record as any)?.DeviceId;
      if (typeof deviceId === "string" && deviceId === this.identity.deviceId) {
        this.log.debug("Skipping own session", {
          sessionId: (record as any)?.Id,
          deviceId,
          client: (record as any)?.Client
        });
        continue;
      }
      
      const summary = this.toSessionSummary(record);
      if (!summary) {
        continue;
      }
      
      // Debug log to see processed summary
      this.log.debug("Processed session summary", {
        sessionId: summary.id,
        itemId: summary.nowPlayingItemId,
        mediaSourceId: summary.mediaSourceId,
        subtitleStreamsCount: summary.subtitleStreams.length
      });
      
      nextSessions.set(summary.id, summary);
    }
    this.sessions = nextSessions;
    this.log.info(`Received ${this.sessions.size} Jellyfin session(s)`);
    this.emit("sessions", Array.from(this.sessions.values()));

    if (this.activeSessionId) {
      const summary = this.sessions.get(this.activeSessionId);
      if (summary) {
        this.emitPlayback(summary);
        
        const currentItemId = summary.nowPlayingItemId;
        const itemIdChanged = this.lastActiveSessionItemId !== currentItemId;
        
        // Update tracked item ID
        this.lastActiveSessionItemId = currentItemId;
        
        // Only try to load subtitles if there's actually a playing item
        if (currentItemId) {
          // Load subtitles if item changed from null to a value, or if force refresh
          if (itemIdChanged && this.lastActiveSessionItemId !== null) {
            this.log.info("Active session now has playing item, loading subtitles", {
              sessionId: summary.id,
              itemId: currentItemId,
              itemName: summary.nowPlayingItemName
            });
          }
          void this.loadSubtitlesForSession(summary);
        } else {
          if (itemIdChanged) {
            this.log.info("Active session has no playing item", {
              sessionId: summary.id,
              deviceName: summary.deviceName,
              client: summary.client
            });
          }
          this.emit("subtitles", {
            sessionId: summary.id,
            itemName: null,
            tracks: []
          });
        }
      } else {
        this.lastActiveSessionItemId = null;
        this.emit("playback", {
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
    const id = typeof record.Id === "string" ? record.Id : null;
    if (!id) {
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
      id,
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
    this.emit("playback", {
      sessionId: summary.id,
      itemName: summary.nowPlayingItemName ?? null,
      isPaused: summary.isPaused,
      playbackRate: summary.playbackRate || 1,
      positionMs: ticksToMilliseconds(summary.positionTicks),
      runTimeMs: ticksToMilliseconds(summary.runTimeTicks)
    });
  }

  private async loadSubtitlesForSession(summary: JellyfinSessionSummary, force = false) {
    const activeConfig = this.getActiveConfig();
    if (!activeConfig || !activeConfig.serverUrl || !activeConfig.apiKey) {
      this.log.warn("Skipping Jellyfin subtitles due to missing server configuration", {
        serverUrl: activeConfig?.serverUrl,
        hasApiKey: Boolean(activeConfig?.apiKey)
      });
      this.emit("subtitles", {
        sessionId: summary.id,
        itemName: summary.nowPlayingItemName ?? null,
        tracks: []
      });
      return;
    }

    if (!summary.nowPlayingItemId) {
      this.log.warn("Skipping Jellyfin subtitles due to missing item ID", {
        sessionId: summary.id
      });
      this.emit("subtitles", {
        sessionId: summary.id,
        itemName: summary.nowPlayingItemName ?? null,
        tracks: []
      });
      return;
    }

    // Enhanced metadata resolution with recursive retry (migrated from jellyfin-desktop-client)
    const resolvedStreams = await this.resolveSubtitleStreams(summary, activeConfig, true);
    
    if (!resolvedStreams.streams.length) {
      this.log.info(
        `No subtitle streams available for Jellyfin session ${summary.id} (${summary.nowPlayingItemName ?? "unknown"})`
      );
      this.emit("subtitles", {
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
      this.log.warn("Skipping Jellyfin subtitles due to missing media source ID", {
        itemId: workingSummary.nowPlayingItemId
      });
      this.emit("subtitles", {
        sessionId: summary.id,
        itemName: workingSummary.nowPlayingItemName ?? null,
        tracks: []
      });
      return;
    }

    const subtitleKey = `${workingSummary.id}:${workingSummary.nowPlayingItemId}:${workingSummary.mediaSourceId}`;
    if (!force && this.lastSubtitleItemKey === subtitleKey) {
      this.log.debug(
        `Skipping subtitle refresh for session ${workingSummary.id}, media unchanged (${workingSummary.nowPlayingItemId})`
      );
      return;
    }
    this.lastSubtitleItemKey = subtitleKey;

    const currentToken = ++this.subtitleRequestToken;
    this.log.info(
      `Fetching ${workingSummary.subtitleStreams.length} subtitle stream(s) from Jellyfin session ${workingSummary.id} (${workingSummary.nowPlayingItemName ?? "unknown"})`
    );

    const tracks: SubtitleTrack[] = [];
    for (const stream of workingSummary.subtitleStreams) {
      try {
        const extension = this.getPreferredExtension(stream);
        const url = buildSubtitleUrl(activeConfig, workingSummary, stream, extension);
        this.log.info(
          `Downloading Jellyfin subtitle stream #${stream.index} (${stream.language ?? "unknown"}) as .${extension}`
        );
        const response = await fetch(url, {
          headers: {
            Accept: "text/vtt, text/plain, application/octet-stream",
            ...createAuthHeaders(activeConfig.apiKey, this.identity)
          }
        });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const content = await response.text();
        const cues = parseSubtitle(content, extension);
        if (!cues.length) {
          this.log.warn(`Parsed subtitle stream #${stream.index} but found no cues`);
          continue;
        }
        tracks.push({
          id: `${workingSummary.id}:${stream.index}`,
          language: stream.language ?? "unknown",
          label: this.formatTrackLabel(stream),
          sourceFile: `${workingSummary.nowPlayingItemId ?? "item"}#${stream.index}.${extension}`,
          cues,
          isAutoGenerated: false
        });
      } catch (error) {
        this.log.warn("Failed to fetch Jellyfin subtitle stream", {
          sessionId: workingSummary.id,
          streamIndex: stream.index,
          error
        });
      }
    }

    if (currentToken !== this.subtitleRequestToken) {
      return;
    }

    this.emit("subtitles", {
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
    const activeConfig = config ?? this.getActiveConfig();
    if (!activeConfig || !activeConfig.serverUrl || !activeConfig.apiKey || !summary.nowPlayingItemId) {
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
