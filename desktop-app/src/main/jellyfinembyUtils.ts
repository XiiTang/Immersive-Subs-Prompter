import { MediaServerSessionSummary, MediaServerConfig, MediaServerSubtitleStream } from "./types.js";

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

export interface JellyfinembyIdentity {
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

export function buildWebSocketUrl(config: MediaServerConfig): string {
  if (!config.serverUrl) {
    throw new Error("Missing jellyfinemby server URL");
  }
  const normalized = normalizeServerUrl(config.serverUrl);
  const url = new URL(normalized || config.serverUrl);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = resolveWebSocketPath(config.webSocketPath);
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

export function pickSubtitleExtension(stream: MediaServerSubtitleStream): string {
  if (!stream.codec) {
    return "vtt";
  }
  const key = stream.codec.toLowerCase();
  return CODEC_EXTENSION_MAP[key] ?? key.split(/[^a-z0-9]/i).pop()?.toLowerCase() ?? "vtt";
}

/**
 * Intelligently guess subtitle format from stream metadata
 * Migrated from jellyfinemby-desktop-client for better format detection
 * 
 * @param stream - The jellyfinemby subtitle stream
 * @returns 'srt' or 'vtt' format identifier
 */
export function guessSubtitleFormatFromStream(stream: MediaServerSubtitleStream): 'srt' | 'vtt' {
  const normalizedTitle = (stream.displayTitle ?? '').toLowerCase();
  const normalizedCodec = (stream.codec ?? '').toLowerCase();

  // Check display title first (more explicit)
  if (normalizedTitle.includes('vtt') || normalizedTitle.includes('webvtt')) {
    return 'vtt';
  }
  
  // Check codec
  if (normalizedCodec.includes('vtt') || normalizedCodec.includes('webvtt')) {
    return 'vtt';
  }
  
  if (normalizedCodec.includes('srt') || normalizedCodec.includes('subrip')) {
    return 'srt';
  }

  // Default to SRT for most subtitle formats
  return 'srt';
}

export function buildSubtitleUrl(
  config: MediaServerConfig,
  session: MediaServerSessionSummary,
  stream: MediaServerSubtitleStream,
  extensionOverride?: string
): string {
  if (!config.serverUrl) {
    throw new Error("Missing jellyfinemby server URL");
  }
  if (!config.apiKey) {
    throw new Error("Missing jellyfinemby API key");
  }
  if (!session.nowPlayingItemId || !session.mediaSourceId) {
    throw new Error("Session is missing media identifiers");
  }
  const extension = extensionOverride ?? pickSubtitleExtension(stream);
  const normalized = normalizeServerUrl(config.serverUrl);
  const url = new URL(
    `${normalized}/Videos/${session.nowPlayingItemId}/${session.mediaSourceId}/Subtitles/${stream.index}/Stream.${extension}`
  );
  url.searchParams.set("api_key", config.apiKey);
  return url.toString();
}

export function buildAuthorizationHeader(identity: JellyfinembyIdentity, apiKey: string): string {
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

export function createAuthHeaders(apiKey: string | null | undefined, identity?: JellyfinembyIdentity) {
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
