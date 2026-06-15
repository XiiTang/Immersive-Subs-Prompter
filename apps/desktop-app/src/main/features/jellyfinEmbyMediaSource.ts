import type {
  JellyfinEmbyFeatureSettings,
  JellyfinEmbyServerConfig,
  MediaServerSessionSummary,
  MediaServerSubtitleStream,
  SubtitleCue,
  SubtitleTrack
} from "../types.js";
import type { MediaSourceAdapterEvent, MediaSourceRuntime } from "../mediaSources/mediaSourceTypes.js";

type FetchLike = typeof fetch;

export interface JellyfinEmbyMediaSourceOptions {
  getSettings: () => JellyfinEmbyFeatureSettings;
  fetch?: FetchLike;
}

const SESSION_REFRESH_MS = 2000;

type NormalizedServer = JellyfinEmbyServerConfig & { serverUrl: string };

export class JellyfinEmbyMediaSource implements MediaSourceRuntime {
  readonly sourceId = "jellyfinEmby" as const;
  private readonly fetchImpl: FetchLike;
  private readonly sessionsByServer = new Map<string, MediaServerSessionSummary[]>();
  private readonly lastFetchByServer = new Map<string, number>();

  constructor(private readonly options: JellyfinEmbyMediaSourceOptions) {
    this.fetchImpl = options.fetch ?? fetch;
  }

  async handleConnectionMessage(message: unknown): Promise<MediaSourceAdapterEvent[] | undefined> {
    const settings = this.options.getSettings();
    if (!settings.enabled) {
      return undefined;
    }
    if (!message || typeof message !== "object" || Array.isArray(message)) {
      return undefined;
    }
    const envelope = message as Record<string, unknown>;
    if (envelope.type !== "video-context" && envelope.type !== "time-update" && envelope.type !== "playback-rate") {
      return undefined;
    }
    const servers = parseServers(settings.config);
    if (!servers.length) {
      return undefined;
    }
    const payload = getPayload(envelope);
    const urls = [payload.pageUrl, payload.videoSrc].filter(Boolean);
    const server = findServer(servers, urls);
    if (!server) {
      return undefined;
    }

    const itemId = extractItemId(payload);
    const sessions = await this.getSessions(server, envelope.type === "video-context");
    const selected = selectSession(sessions, itemId);
    const events: MediaSourceAdapterEvent[] = [{ type: "sessionsChanged", sessions }];

    if (envelope.type !== "video-context") {
      if (selected) {
        events.push(sessionPlaybackEvent(selected));
      }
      return events;
    }

    const pageUrl = text(payload.pageUrl);
    const videoSrc = text(payload.videoSrc);
    events.unshift({
      type: "sourceMatched",
      tabId: typeof envelope.tabId === "number" ? envelope.tabId : 0,
      pageUrl,
      videoUrl: pageUrl ?? videoSrc,
      title: text(payload.title) ?? selected?.nowPlayingItemName ?? null,
      site: "jellyfinemby",
      selectedSessionId: selected?.id ?? null
    });

    if (selected) {
      events.push(sessionPlaybackEvent(selected));
      events.push({
        type: "subtitleTracksLoaded",
        sessionId: selected.id,
        tracks: await this.loadSubtitleTracks(server, selected)
      });
    } else {
      events.push({ type: "subtitleTracksLoaded", sessionId: null, tracks: [] });
    }
    return events;
  }

  async handleSettingsUpdated(): Promise<void> {
    this.clearState();
  }

  async stop(): Promise<void> {
    this.clearState();
  }

  private async getSessions(server: NormalizedServer, forceRefresh: boolean): Promise<MediaServerSessionSummary[]> {
    const lastFetch = this.lastFetchByServer.get(server.id) ?? 0;
    const cached = this.sessionsByServer.get(server.id);
    if (!forceRefresh && cached && Date.now() - lastFetch < SESSION_REFRESH_MS) {
      return cached;
    }
    const sessions = await fetchSessions(this.fetchImpl, server);
    this.sessionsByServer.set(server.id, sessions);
    this.lastFetchByServer.set(server.id, Date.now());
    return sessions;
  }

  private async loadSubtitleTracks(server: NormalizedServer, session: MediaServerSessionSummary): Promise<SubtitleTrack[]> {
    if (!session.nowPlayingItemId) {
      return [];
    }
    const metadata = await resolveSubtitleMetadata(this.fetchImpl, server, session);
    const workingSession: MediaServerSessionSummary = {
      ...session,
      mediaSourceId: metadata.mediaSourceId,
      nowPlayingItemName: metadata.itemName
    };
    if (!workingSession.mediaSourceId || !metadata.streams.length) {
      return [];
    }

    const tracks: SubtitleTrack[] = [];
    for (const stream of metadata.streams) {
      const extension = subtitleExtension(stream);
      const response = await this.fetchImpl(buildSubtitleUrl(server, workingSession, stream, extension), {
        headers: {
          Accept: "text/vtt, text/plain, application/octet-stream",
          ...createAuthHeaders(server)
        }
      });
      if (!response.ok) {
        throw new Error(formatSubtitleRequestError(response));
      }
      const cues = parseSubtitle(await response.text(), extension);
      if (cues.length) {
        tracks.push({
          id: `${workingSession.id}:${stream.index}`,
          sourceFile: stream.displayTitle ?? `${workingSession.nowPlayingItemId}#${stream.index}.${extension}`,
          cues
        });
      }
    }
    return tracks;
  }

  private clearState(): void {
    this.sessionsByServer.clear();
    this.lastFetchByServer.clear();
  }
}

function formatSubtitleRequestError(response: Response): string {
  const statusText = "statusText" in response && typeof response.statusText === "string"
    ? response.statusText.trim()
    : "";
  return `Jellyfin / Emby subtitle request failed: HTTP ${response.status}${statusText ? ` ${statusText}` : ""}`;
}

function getPayload(envelope: Record<string, unknown>): Record<string, unknown> {
  const payload = envelope.payload;
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    return payload as Record<string, unknown>;
  }
  return envelope;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function requireObject(value: unknown, context: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${context} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function requireStringValue(source: Record<string, unknown>, key: string, context: string): string {
  if (typeof source[key] !== "string") {
    throw new Error(`${context} must include string ${key}.`);
  }
  return source[key].trim();
}

function requireBooleanValue(source: Record<string, unknown>, key: string, context: string): boolean {
  if (typeof source[key] !== "boolean") {
    throw new Error(`${context} must include boolean ${key}.`);
  }
  return source[key];
}

function normalizeBaseUrl(url: string): string | null {
  if (!URL.canParse(url)) {
    return null;
  }
  const parsed = new URL(url);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return null;
  }
  parsed.pathname = parsed.pathname.replace(/\/+$/, "");
  parsed.search = "";
  parsed.hash = "";
  return parsed.toString().replace(/\/+$/, "");
}

function normalizeServer(row: unknown, index: number): NormalizedServer | null {
  const source = requireObject(row, `Jellyfin / Emby server ${index + 1}`);
  const enabled = requireBooleanValue(source, "enabled", `Jellyfin / Emby server ${index + 1}`);
  if (!enabled) {
    return null;
  }
  const serverUrl = requireStringValue(source, "serverUrl", `Jellyfin / Emby server ${index + 1}`);
  if (!serverUrl) {
    return null;
  }
  const normalizedServerUrl = normalizeBaseUrl(serverUrl);
  if (!normalizedServerUrl) {
    return null;
  }
  const apiKey = requireStringValue(source, "apiKey", `Jellyfin / Emby server ${index + 1}`);
  if (!apiKey) {
    return null;
  }
  return {
    id: requireStringValue(source, "id", `Jellyfin / Emby server ${index + 1}`),
    name: requireStringValue(source, "name", `Jellyfin / Emby server ${index + 1}`),
    serverUrl: normalizedServerUrl,
    apiKey,
    enabled
  };
}

function parseServers(config: JellyfinEmbyFeatureSettings["config"]): NormalizedServer[] {
  if (config.servers === undefined) {
    return [];
  }
  if (!Array.isArray(config.servers)) {
    throw new Error("Jellyfin / Emby servers must be configured with a server list.");
  }
  return config.servers
    .map((server, index) => normalizeServer(server, index))
    .filter((server): server is NormalizedServer => Boolean(server));
}

function parseOptionalUrl(value: unknown): URL | null {
  const raw = text(value);
  if (!raw) {
    return null;
  }
  const candidate = raw.startsWith("blob:") ? raw.slice("blob:".length) : raw;
  return URL.canParse(candidate) ? new URL(candidate) : null;
}

function findServer(servers: NormalizedServer[], urls: unknown[]): NormalizedServer | null {
  for (const server of servers) {
    const base = new URL(server.serverUrl);
    const matched = urls.some((url) => {
      const parsed = parseOptionalUrl(url);
      return parsed && parsed.host === base.host;
    });
    if (matched) {
      return server;
    }
  }
  return null;
}

function extractItemId(payload: Record<string, unknown>): string | null {
  const candidates = [payload.pageUrl, payload.videoSrc].filter(Boolean).map(String);
  for (const value of candidates) {
    const parsed = parseOptionalUrl(value);
    if (!parsed) {
      continue;
    }
    const itemId = extractItemIdFromUrl(parsed);
    if (itemId) {
      return itemId;
    }
  }
  return null;
}

function extractItemIdFromUrl(parsed: URL): string | null {
  return (
    extractItemIdFromSearch(parsed.searchParams) ??
    extractItemIdFromPath(parsed.pathname) ??
    extractItemIdFromHash(parsed.hash)
  );
}

function extractItemIdFromSearch(searchParams: URLSearchParams): string | null {
  return searchParams.get("id") || searchParams.get("itemId");
}

function extractItemIdFromPath(pathname: string): string | null {
  const match = pathname.match(/\/(?:Items|items|Videos|videos|item|details)\/([A-Za-z0-9_-]+)/i);
  return match?.[1] ?? null;
}

function extractItemIdFromHash(hash: string): string | null {
  const fragment = hash.replace(/^#/, "").replace(/^!/, "");
  if (!fragment) {
    return null;
  }
  const pathLike = fragment.startsWith("/") ? fragment : `/${fragment}`;
  if (!URL.canParse(pathLike, "https://hash.local")) {
    return null;
  }
  const parsed = new URL(pathLike, "https://hash.local");
  return extractItemIdFromSearch(parsed.searchParams) ?? extractItemIdFromPath(parsed.pathname);
}

function createAuthHeaders(server: NormalizedServer): Record<string, string> {
  return server.apiKey ? { "X-Emby-Token": server.apiKey } : {};
}

async function fetchJson(fetchImpl: FetchLike, url: string, server: NormalizedServer): Promise<unknown> {
  const response = await fetchImpl(url, {
    headers: { Accept: "application/json", ...createAuthHeaders(server) }
  });
  if (!response.ok) {
    throw new Error(`Jellyfin / Emby request failed: HTTP ${response.status}`);
  }
  return response.json();
}

function toSubtitleStream(stream: unknown): MediaServerSubtitleStream | null {
  if (!stream || typeof stream !== "object") {
    return null;
  }
  const record = stream as Record<string, unknown>;
  const type = text(record.Type)?.toLowerCase() ?? "";
  const isText = record.IsTextSubtitleStream === true || type === "subtitle" || type === "subtitles";
  if (!isText || typeof record.Index !== "number") {
    return null;
  }
  return {
    index: record.Index,
    codec: text(record.Codec),
    language: text(record.Language),
    displayTitle: text(record.DisplayTitle),
    isDefault: Boolean(record.IsDefault),
    isForced: Boolean(record.IsForced),
    isText: record.IsTextSubtitleStream === true
  };
}

function collectSubtitleStreams(...collections: unknown[]): MediaServerSubtitleStream[] {
  const byIndex = new Map<number, MediaServerSubtitleStream>();
  for (const streams of collections) {
    if (!Array.isArray(streams)) {
      continue;
    }
    for (const stream of streams) {
      const normalized = toSubtitleStream(stream);
      if (normalized && !byIndex.has(normalized.index)) {
        byIndex.set(normalized.index, normalized);
      }
    }
  }
  return Array.from(byIndex.values()).sort((a, b) => a.index - b.index);
}

function extractSubtitleStreams(mediaSource: unknown, item: unknown): MediaServerSubtitleStream[] {
  const source = mediaSource && typeof mediaSource === "object" ? mediaSource as Record<string, unknown> : null;
  const itemRecord = item && typeof item === "object" ? item as Record<string, unknown> : null;
  return collectSubtitleStreams(source?.MediaStreams, itemRecord?.MediaStreams);
}

function toSessionSummary(server: NormalizedServer, row: unknown): MediaServerSessionSummary | null {
  if (!row || typeof row !== "object" || !text((row as Record<string, unknown>).Id)) {
    return null;
  }
  const record = row as Record<string, unknown>;
  const nowPlayingItem = record.NowPlayingItem && typeof record.NowPlayingItem === "object"
    ? record.NowPlayingItem as Record<string, unknown>
    : null;
  const playState = record.PlayState && typeof record.PlayState === "object"
    ? record.PlayState as Record<string, unknown>
    : {};
  const mediaSources = Array.isArray(nowPlayingItem?.MediaSources) ? nowPlayingItem.MediaSources : [];
  const mediaSourceId = text(playState.MediaSourceId) ?? text((mediaSources[0] as Record<string, unknown> | undefined)?.Id);
  const mediaSource = mediaSourceId
    ? mediaSources.find((source) => (source as Record<string, unknown> | undefined)?.Id === mediaSourceId) ?? mediaSources[0] ?? null
    : mediaSources[0] ?? null;
  return {
    id: `${server.id}:${text(record.Id)}`,
    serverConfigId: server.id,
    serverName: server.name || server.serverUrl,
    serverType: "jellyfinemby",
    deviceName: text(record.DeviceName),
    client: text(record.Client),
    userName: text(record.UserName),
    nowPlayingItemId: text(nowPlayingItem?.Id),
    nowPlayingItemName: text(nowPlayingItem?.Name),
    mediaSourceId,
    runTimeTicks: typeof nowPlayingItem?.RunTimeTicks === "number" ? nowPlayingItem.RunTimeTicks : null,
    positionTicks: typeof playState.PositionTicks === "number" ? playState.PositionTicks : null,
    isPaused: Boolean(playState.IsPaused),
    playbackRate: typeof playState.PlaybackRate === "number" ? playState.PlaybackRate : 1,
    subtitleStreams: extractSubtitleStreams(mediaSource, nowPlayingItem)
  };
}

async function fetchSessions(fetchImpl: FetchLike, server: NormalizedServer): Promise<MediaServerSessionSummary[]> {
  if (!server.apiKey) {
    return [];
  }
  const url = new URL(`${server.serverUrl}/Sessions`);
  url.searchParams.set("api_key", server.apiKey);
  const rows = await fetchJson(fetchImpl, url.toString(), server);
  return Array.isArray(rows)
    ? rows.map((row) => toSessionSummary(server, row)).filter((session): session is MediaServerSessionSummary => Boolean(session))
    : [];
}

async function fetchItemMetadata(
  fetchImpl: FetchLike,
  server: NormalizedServer,
  session: MediaServerSessionSummary
): Promise<unknown> {
  if (!session.nowPlayingItemId) {
    return null;
  }
  const url = new URL(`${server.serverUrl}/Items/${session.nowPlayingItemId}`);
  url.searchParams.set("api_key", server.apiKey);
  return fetchJson(fetchImpl, url.toString(), server);
}

async function resolveSubtitleMetadata(
  fetchImpl: FetchLike,
  server: NormalizedServer,
  session: MediaServerSessionSummary
): Promise<{
  mediaSourceId: string | null;
  streams: MediaServerSubtitleStream[];
  itemName: string | null;
}> {
  if (session.subtitleStreams.length && session.mediaSourceId) {
    return {
      mediaSourceId: session.mediaSourceId,
      streams: session.subtitleStreams,
      itemName: session.nowPlayingItemName
    };
  }

  const item = await fetchItemMetadata(fetchImpl, server, session);
  if (!item || typeof item !== "object") {
    return { mediaSourceId: session.mediaSourceId, streams: session.subtitleStreams, itemName: session.nowPlayingItemName };
  }
  const record = item as Record<string, unknown>;
  const mediaSources = Array.isArray(record.MediaSources) ? record.MediaSources : [];
  const mediaSourceId = session.mediaSourceId ?? text((mediaSources[0] as Record<string, unknown> | undefined)?.Id);
  const mediaSource = mediaSourceId
    ? mediaSources.find((source) => (source as Record<string, unknown> | undefined)?.Id === mediaSourceId) ?? mediaSources[0] ?? null
    : mediaSources[0] ?? null;
  return {
    mediaSourceId,
    streams: extractSubtitleStreams(mediaSource, item),
    itemName: text(record.Name) ?? session.nowPlayingItemName
  };
}

function subtitleExtension(stream: MediaServerSubtitleStream): "srt" | "vtt" {
  const title = (stream.displayTitle ?? "").toLowerCase();
  const codec = (stream.codec ?? "").toLowerCase();
  if (title.includes("vtt") || title.includes("webvtt") || codec.includes("vtt") || codec.includes("webvtt")) {
    return "vtt";
  }
  return "srt";
}

function buildSubtitleUrl(
  server: NormalizedServer,
  session: MediaServerSessionSummary,
  stream: MediaServerSubtitleStream,
  extension: "srt" | "vtt"
): string {
  const url = new URL(
    `${server.serverUrl}/Videos/${session.nowPlayingItemId}/${session.mediaSourceId}/Subtitles/${stream.index}/Stream.${extension}`
  );
  url.searchParams.set("api_key", server.apiKey);
  return url.toString();
}

function parseTimestamp(value: string): number {
  const match = value.replace(/,/g, ".").match(/(?:(\d+):)?(\d{2}):(\d{2}(?:\.\d+)?)/);
  if (!match) {
    return Number.NaN;
  }
  return ((match[1] ? Number(match[1]) : 0) * 3600 + Number(match[2]) * 60 + Number(match[3])) * 1000;
}

function cleanSubtitleText(value: string): string {
  return value
    .replace(/<\/?[^>]+>/g, "")
    .replace(/\{\\[^}]*\}/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&apos;/gi, "'")
    .trim();
}

function parseSrt(content: string): SubtitleCue[] {
  return content
    .replace(/\ufeff|\r/g, "")
    .split(/\n\s*\n/)
    .flatMap((block) => {
      const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
      if (!lines.length) {
        return [];
      }
      const timingIndex = /^\d+$/.test(lines[0] ?? "") ? 1 : 0;
      const match = lines[timingIndex]?.match(/(.+?)\s+-->\s+(.+)/);
      if (!match) {
        return [];
      }
      const start = parseTimestamp(match[1] ?? "");
      const end = parseTimestamp(match[2] ?? "");
      const textValue = cleanSubtitleText(lines.slice(timingIndex + 1).join("\n"));
      return Number.isNaN(start) || Number.isNaN(end) || !textValue ? [] : [{ start, end, text: textValue }];
    });
}

function parseVtt(content: string): SubtitleCue[] {
  const lines = content.replace(/\ufeff|\r/g, "").split("\n");
  const cues: SubtitleCue[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]?.trim() ?? "";
    if (!line.includes("-->")) {
      continue;
    }
    const [startRaw, endRaw] = line.split("-->");
    const start = parseTimestamp(startRaw ?? "");
    const end = parseTimestamp(endRaw ?? "");
    const textLines: string[] = [];
    index += 1;
    while (index < lines.length && lines[index]?.trim()) {
      textLines.push(lines[index] ?? "");
      index += 1;
    }
    const textValue = cleanSubtitleText(textLines.join("\n"));
    if (!Number.isNaN(start) && !Number.isNaN(end) && textValue) {
      cues.push({ start, end, text: textValue });
    }
  }
  return cues;
}

function parseSubtitle(content: string, extension: "srt" | "vtt"): SubtitleCue[] {
  return extension === "vtt" ? parseVtt(content) : parseSrt(content);
}

function selectSession(sessions: MediaServerSessionSummary[], itemId: string | null): MediaServerSessionSummary | null {
  return itemId ? sessions.find((session) => session.nowPlayingItemId === itemId) ?? null : sessions[0] ?? null;
}

function sessionPlaybackEvent(session: MediaServerSessionSummary): MediaSourceAdapterEvent {
  return {
    type: "playbackSnapshot",
    sessionId: session.id,
    positionMs: session.positionTicks ? Math.round(session.positionTicks / 10000) : null,
    durationMs: session.runTimeTicks ? Math.round(session.runTimeTicks / 10000) : null,
    playbackRate: session.playbackRate ?? 1,
    paused: session.isPaused
  };
}
