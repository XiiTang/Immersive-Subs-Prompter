import { JellyfinSessionSummary, JellyfinSettings, JellyfinSubtitleStream } from "./types.js";

const TICKS_PER_MILLISECOND = 10_000;
const DEFAULT_WS_PATH = "/socket";
const CODEC_EXTENSION_MAP: Record<string, string> = {
  ass: "ass",
  ssa: "ssa",
  subrip: "srt",
  srt: "srt",
  webvtt: "vtt",
  vtt: "vtt",
  dfxp: "dfxp",
  smi: "smi",
  sami: "smi"
};

export interface JellyfinIdentity {
  clientName: string;
  deviceName: string;
  deviceId: string;
  version: string;
}

export function normalizeServerUrl(input: string | null | undefined): string {
  if (!input) {
    return "";
  }
  try {
    const url = new URL(input);
    url.pathname = url.pathname.replace(/\/+$/, "");
    return url.toString().replace(/\/+$/, "");
  } catch {
    return input.trim().replace(/\/+$/, "");
  }
}

export function resolveWebSocketPath(path?: string | null): string {
  if (!path) {
    return DEFAULT_WS_PATH;
  }
  return path.startsWith("/") ? path : `/${path}`;
}

export function buildWebSocketUrl(settings: JellyfinSettings): string {
  if (!settings.serverUrl) {
    throw new Error("Missing Jellyfin server URL");
  }
  const normalized = normalizeServerUrl(settings.serverUrl);
  const url = new URL(normalized || settings.serverUrl);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = resolveWebSocketPath(settings.webSocketPath);
  return url.toString();
}

export function ticksToMilliseconds(ticks: number | null | undefined): number | null {
  if (typeof ticks !== "number" || Number.isNaN(ticks)) {
    return null;
  }
  return Math.floor(ticks / TICKS_PER_MILLISECOND);
}

export function ticksToSeconds(ticks: number | null | undefined): number | null {
  const ms = ticksToMilliseconds(ticks);
  if (ms === null) {
    return null;
  }
  return ms / 1000;
}

export function pickSubtitleExtension(stream: JellyfinSubtitleStream): string {
  if (!stream.codec) {
    return "vtt";
  }
  const key = stream.codec.toLowerCase();
  return CODEC_EXTENSION_MAP[key] ?? key.split(/[^a-z0-9]/i).pop()?.toLowerCase() ?? "vtt";
}

export function buildSubtitleUrl(
  settings: JellyfinSettings,
  session: JellyfinSessionSummary,
  stream: JellyfinSubtitleStream,
  extensionOverride?: string
): string {
  if (!settings.serverUrl) {
    throw new Error("Missing Jellyfin server URL");
  }
  if (!settings.apiKey) {
    throw new Error("Missing Jellyfin API key");
  }
  if (!session.nowPlayingItemId || !session.mediaSourceId) {
    throw new Error("Session is missing media identifiers");
  }
  const extension = extensionOverride ?? pickSubtitleExtension(stream);
  const normalized = normalizeServerUrl(settings.serverUrl);
  const url = new URL(
    `${normalized}/Videos/${session.nowPlayingItemId}/${session.mediaSourceId}/Subtitles/${stream.index}/Stream.${extension}`
  );
  url.searchParams.set("api_key", settings.apiKey);
  return url.toString();
}

export function buildAuthorizationHeader(identity: JellyfinIdentity, apiKey: string): string {
  const escapeValue = (value: string): string => value.replace(/"/g, '\\"');
  const segments = [
    `MediaBrowser Client="${escapeValue(identity.clientName)}"`,
    `Device="${escapeValue(identity.deviceName)}"`,
    `DeviceId="${escapeValue(identity.deviceId)}"`,
    `Version="${escapeValue(identity.version)}"`,
    `Token="${escapeValue(apiKey)}"`
  ];
  return segments.join(", ");
}

export function createAuthHeaders(apiKey: string | null | undefined, identity?: JellyfinIdentity) {
  if (!apiKey) {
    return {};
  }
  const headers: Record<string, string> = {
    "X-Emby-Token": apiKey
  };
  if (identity) {
    headers["X-Emby-Authorization"] = buildAuthorizationHeader(identity, apiKey);
  }
  return headers;
}
