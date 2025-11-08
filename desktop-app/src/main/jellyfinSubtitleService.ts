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
  ticksToMilliseconds
} from "./jellyfinUtils.js";
import {
  JellyfinPlaybackPayload,
  JellyfinSessionSummary,
  JellyfinSettings,
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
  private readonly identity = createJellyfinIdentity();
  private settings: JellyfinSettings;

  constructor(private readonly settingsProvider: SettingsProvider) {
    this.settings = this.settingsProvider();
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
      void this.loadSubtitlesForSession(summary, true);
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
    if (!this.settings.serverUrl || !this.settings.apiKey) {
      this.log.warn("Jellyfin server URL or API key missing, skipping connection");
      return;
    }

    try {
      const wsUrl = new URL(buildWebSocketUrl(this.settings));
      wsUrl.searchParams.set("api_key", this.settings.apiKey);
      wsUrl.searchParams.set("deviceId", this.identity.deviceId);
      wsUrl.searchParams.set("client", this.identity.clientName);
      wsUrl.searchParams.set("deviceName", this.identity.deviceName);
      wsUrl.searchParams.set("version", this.identity.version);
      const headers = {
        ...createAuthHeaders(this.settings.apiKey, this.identity)
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
      const summary = this.toSessionSummary(record);
      if (!summary) {
        continue;
      }
      nextSessions.set(summary.id, summary);
    }
    this.sessions = nextSessions;
    this.log.info(`Received ${this.sessions.size} Jellyfin session(s)`);
    this.emit("sessions", Array.from(this.sessions.values()));

    if (this.activeSessionId) {
      const summary = this.sessions.get(this.activeSessionId);
      if (summary) {
        this.emitPlayback(summary);
        void this.loadSubtitlesForSession(summary);
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
    const preferredSourceId =
      (typeof playState?.MediaSourceId === "string" ? playState.MediaSourceId : null) ??
      (mediaSources[0]?.Id as string | undefined) ??
      null;
    const mediaSource =
      mediaSources.find((source) => source?.Id === preferredSourceId) ??
      mediaSources[0] ??
      null;
    const subtitleStreams = this.extractSubtitleStreams(mediaSource, nowPlayingItem);
    const resolvedMediaSourceId =
      typeof preferredSourceId === "string"
        ? preferredSourceId
        : typeof mediaSource?.Id === "string"
          ? mediaSource.Id
          : null;

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
    if (!this.settings.serverUrl || !this.settings.apiKey) {
      this.log.warn("Skipping Jellyfin subtitles due to missing identifiers", {
        serverUrl: this.settings.serverUrl,
        hasApiKey: Boolean(this.settings.apiKey),
        mediaSourceId: summary.mediaSourceId,
        itemId: summary.nowPlayingItemId
      });
      this.emit("subtitles", {
        sessionId: summary.id,
        itemName: summary.nowPlayingItemName ?? null,
        tracks: []
      });
      return;
    }

    let workingSummary = summary;
    if ((!summary.mediaSourceId || !summary.subtitleStreams.length) && summary.nowPlayingItemId) {
      const refreshed = await this.refreshSubtitleMetadata(summary);
      if (refreshed) {
        workingSummary = refreshed;
        this.sessions.set(summary.id, refreshed);
      }
    }

    if (!workingSummary.mediaSourceId || !workingSummary.nowPlayingItemId) {
      this.log.warn("Skipping Jellyfin subtitles due to missing identifiers", {
        serverUrl: this.settings.serverUrl,
        hasApiKey: Boolean(this.settings.apiKey),
        mediaSourceId: workingSummary.mediaSourceId,
        itemId: workingSummary.nowPlayingItemId
      });
      this.emit("subtitles", {
        sessionId: summary.id,
        itemName: workingSummary.nowPlayingItemName ?? null,
        tracks: []
      });
      return;
    }

    if (!workingSummary.subtitleStreams.length) {
      this.log.info(
        `No subtitle streams exposed by Jellyfin session ${workingSummary.id} (${workingSummary.nowPlayingItemName ?? "unknown"})`
      );
      this.emit("subtitles", {
        sessionId: workingSummary.id,
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
        const url = buildSubtitleUrl(this.settings, workingSummary, stream, extension);
        this.log.info(
          `Downloading Jellyfin subtitle stream #${stream.index} (${stream.language ?? "unknown"}) as .${extension}`
        );
        const response = await fetch(url, {
          headers: {
            Accept: "text/vtt, application/octet-stream",
            ...createAuthHeaders(this.settings.apiKey, this.identity)
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

  private async fetchNowPlayingMetadata(summary: JellyfinSessionSummary) {
    if (!this.settings.serverUrl || !this.settings.apiKey || !summary.nowPlayingItemId) {
      return null;
    }
    try {
      const normalized = normalizeServerUrl(this.settings.serverUrl);
      const url = new URL(`${normalized}/Items/${summary.nowPlayingItemId}`);
      url.searchParams.set("api_key", this.settings.apiKey);
      const response = await fetch(url.toString(), {
        headers: {
          Accept: "application/json",
          ...createAuthHeaders(this.settings.apiKey, this.identity)
        }
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const item = await response.json();
      const mediaSources = Array.isArray(item?.MediaSources) ? (item.MediaSources as RawSessionRecord[]) : [];
      const preferredId = summary.mediaSourceId ?? (mediaSources[0]?.Id as string | undefined) ?? null;
      const mediaSource =
        mediaSources.find((source) => source?.Id === preferredId) ??
        mediaSources[0] ??
        null;
      const subtitleStreams = this.extractSubtitleStreams(mediaSource, item);
      const mediaSourceId =
        typeof (summary.mediaSourceId ?? mediaSource?.Id) === "string"
          ? (summary.mediaSourceId ?? (mediaSource?.Id as string))
          : null;
      const itemName = typeof item?.Name === "string" ? item.Name : null;
      return {
        subtitleStreams,
        mediaSourceId,
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

  private getPreferredExtension(stream: JellyfinSubtitleStream): string {
    const codec = stream.codec?.toLowerCase() ?? "";
    if (codec.includes("srt") || codec.includes("subrip")) {
      return "srt";
    }
    return "vtt";
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
