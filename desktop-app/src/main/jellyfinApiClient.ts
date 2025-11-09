import { createLogger } from "./logger.js";
import { JellyfinIdentity, createAuthHeaders, normalizeServerUrl } from "./jellyfinUtils.js";

const log = createLogger("jellyfin-api");

export interface JellyfinApiClientOptions {
  serverUrl: string;
  apiKey: string;
  identity: JellyfinIdentity;
  timeoutMs?: number;
}

export class JellyfinRequestError extends Error {
  public status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "JellyfinRequestError";
    this.status = status;
  }
}

interface JellyfinMediaStream {
  Index?: number;
  Type?: string;
  DisplayTitle?: string;
  Language?: string;
  IsExternal?: boolean;
  Codec?: string;
  IsTextSubtitleStream?: boolean;
  IsDefault?: boolean;
  IsForced?: boolean;
}

interface JellyfinMediaSource {
  Id?: string;
  Path?: string;
  Name?: string;
  RunTimeTicks?: number;
  MediaStreams?: JellyfinMediaStream[];
  Container?: string;
}

export interface JellyfinNowPlayingItem {
  Id: string;
  Name?: string;
  RunTimeTicks?: number;
  SeriesName?: string;
  SeasonName?: string;
  IndexNumber?: number;
  ParentIndexNumber?: number;
  Album?: string;
  Artists?: string[];
  Type?: string;
  MediaType?: string;
  MediaSources?: JellyfinMediaSource[];
  MediaStreams?: JellyfinMediaStream[];
}

export interface SubtitleStreamDescriptor {
  itemId: string;
  mediaSourceId: string;
  index: number;
  codec: string | null;
  language: string | null;
  displayTitle: string | null;
  isDefault: boolean;
  isForced: boolean;
}

const TICKS_PER_MILLISECOND = 10_000;

export class JellyfinApiClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly identity: JellyfinIdentity;
  private readonly timeoutMs: number;

  constructor(options: JellyfinApiClientOptions) {
    this.baseUrl = normalizeServerUrl(options.serverUrl);
    this.apiKey = options.apiKey;
    this.identity = options.identity;
    this.timeoutMs = options.timeoutMs ?? 15_000;
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  /**
   * Get full item details including media sources and subtitle streams
   */
  async getItem(itemId: string, signal?: AbortSignal): Promise<JellyfinNowPlayingItem | null> {
    if (!itemId) {
      return null;
    }

    try {
      const item = await this.getJson<JellyfinNowPlayingItem>(
        `/Items/${encodeURIComponent(itemId)}`,
        {},
        signal
      );
      return item ?? null;
    } catch (error) {
      log.error("Failed to fetch item", { itemId, error });
      return null;
    }
  }

  /**
   * Download subtitle content from Jellyfin
   */
  async getSubtitleContent(
    descriptor: SubtitleStreamDescriptor,
    format: 'srt' | 'vtt',
    signal?: AbortSignal
  ): Promise<string> {
    const { itemId, mediaSourceId, index } = descriptor;
    const extension = format === 'vtt' ? 'vtt' : 'srt';

    const url = this.buildUrl(
      `/Videos/${encodeURIComponent(itemId)}/${encodeURIComponent(mediaSourceId)}/Subtitles/${index}/Stream.${extension}`,
      { api_key: this.apiKey }
    );

    log.debug("Fetching subtitle stream", {
      itemId,
      mediaSourceId,
      index,
      format: extension,
    });

    const response = await this.performFetch(url, {
      method: "GET",
      headers: this.buildHeaders({
        Accept: "text/plain, text/vtt, application/octet-stream",
      }),
      signal,
    });

    return response.text();
  }

  /**
   * Seek to a specific position in a session
   */
  async seekToPosition(sessionId: string, positionMs: number): Promise<void> {
    if (!sessionId) {
      throw new Error("Session ID is required to seek playback.");
    }

    const normalizedMs = Number.isFinite(positionMs) ? Math.max(0, Math.floor(positionMs)) : 0;
    const seekPositionTicks = normalizedMs * TICKS_PER_MILLISECOND;

    const path = `/Sessions/${encodeURIComponent(sessionId)}/Playing/Seek`;
    const url = this.buildUrl(path, {
      seekPositionTicks,
    });

    await this.performFetch(url, {
      method: "POST",
      headers: this.buildHeaders(),
    });
  }

  private buildUrl(
    path: string,
    query?: Record<string, string | number | boolean | undefined>
  ): string {
    const url = new URL(path, this.baseUrl);
    if (query) {
      Object.entries(query).forEach(([key, value]) => {
        if (value === undefined || value === null) {
          return;
        }

        url.searchParams.set(key, String(value));
      });
    }

    return url.toString();
  }

  private async getJson<T>(
    path: string,
    query?: Record<string, string | number | boolean | undefined>,
    signal?: AbortSignal
  ): Promise<T> {
    const response = await this.performFetch(this.buildUrl(path, query), {
      method: "GET",
      headers: this.buildHeaders({
        Accept: "application/json",
      }),
      signal,
    });

    if (response.status === 204) {
      return {} as T;
    }

    return response.json() as Promise<T>;
  }

  private async performFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(input, {
        ...init,
        signal: init.signal ?? controller.signal,
      });

      if (!response.ok) {
        const message = `Jellyfin request failed (${response.status})`;
        log.error("Request error", {
          url: input,
          status: response.status,
          statusText: response.statusText,
        });
        throw new JellyfinRequestError(message, response.status);
      }

      return response;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        throw new Error("Request to Jellyfin timed out.");
      }

      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  private buildHeaders(additional?: Record<string, string>): HeadersInit {
    const headers: Record<string, string> = {
      ...createAuthHeaders(this.apiKey, this.identity),
    };

    if (additional) {
      Object.assign(headers, additional);
    }

    return headers;
  }
}

/**
 * Resolve the media source for an item
 */
export function resolveMediaSource(
  item: JellyfinNowPlayingItem | null | undefined,
  mediaSourceId?: string
): JellyfinMediaSource | null {
  if (!item) {
    return null;
  }

  const sources = item.MediaSources ?? [];
  if (mediaSourceId) {
    const match = sources.find((source) => source.Id === mediaSourceId);
    if (match) {
      return match;
    }
  }

  return sources[0] ?? null;
}

/**
 * Guess subtitle format from stream metadata
 */
export function guessSubtitleFormatFromStream(
  displayTitle?: string,
  codec?: string
): "srt" | "vtt" {
  const normalizedTitle = (displayTitle ?? "").toLowerCase();
  const normalizedCodec = (codec ?? "").toLowerCase();

  if (normalizedTitle.includes("vtt") || normalizedCodec.includes("vtt") || normalizedCodec.includes("webvtt")) {
    return "vtt";
  }

  return "srt";
}

/**
 * Check if a stream is a text subtitle stream
 */
export function isSubtitleStream(stream?: JellyfinMediaStream | null): boolean {
  if (!stream) {
    return false;
  }

  if (stream.IsTextSubtitleStream) {
    return true;
  }

  const type = stream.Type?.toLowerCase();
  return type === "subtitle" || type === "subtitles";
}

/**
 * Collect subtitle streams from multiple sources
 */
export function collectSubtitleStreams(
  ...collections: (JellyfinMediaStream[] | null | undefined)[]
): JellyfinMediaStream[] {
  const byIndex = new Map<number, JellyfinMediaStream>();

  collections.forEach((streams) => {
    streams?.forEach((stream) => {
      if (!isSubtitleStream(stream) || stream.Index === undefined || stream.Index === null) {
        return;
      }

      if (!byIndex.has(stream.Index)) {
        byIndex.set(stream.Index, stream);
      }
    });
  });

  return Array.from(byIndex.values()).sort((a, b) => (a.Index ?? 0) - (b.Index ?? 0));
}
