import type { createLogger } from "../logger.js";
import { parseSubtitle } from "../subtitleParser.js";
import { SubtitleCacheManager } from "../subtitleCacheManager.js";
import {
  buildSubtitleUrl,
  createAuthHeaders,
  JellyfinembyIdentity,
  normalizeServerUrl,
  guessSubtitleFormatFromStream
} from "../jellyfinembyUtils.js";
import {
  MediaServerConfig,
  MediaServerSessionSummary,
  MediaServerSubtitleStream,
  MediaServerSubtitlesPayload,
  SubtitleTrack
} from "../types.js";
import { JellyfinembySessionManager } from "./JellyfinembySessionManager.js";
import { RawSessionRecord } from "./types.js";

type Logger = ReturnType<typeof createLogger>;

export class JellyfinembySubtitleLoader {
  private subtitleRequestToken = 0;
  private lastSubtitleItemKey: string | null = null;

  constructor(
    private config: MediaServerConfig,
    private readonly identity: JellyfinembyIdentity,
    private readonly sessionManager: JellyfinembySessionManager,
    private readonly log: Logger,
    private readonly cacheManager?: SubtitleCacheManager
  ) {}

  updateConfig(next: MediaServerConfig) {
    this.config = next;
  }

  resetState() {
    this.subtitleRequestToken = 0;
    this.lastSubtitleItemKey = null;
  }

  clearLastSubtitleItemKey() {
    this.lastSubtitleItemKey = null;
  }

  async loadSubtitlesForSession(
    summary: MediaServerSessionSummary,
    force = false
  ): Promise<MediaServerSubtitlesPayload | null> {
    if (!this.config.serverUrl || !this.config.apiKey) {
      this.log.warn(`[${this.config.name}] Skipping Jellyfinemby subtitles due to missing server configuration`, {
        serverUrl: this.config.serverUrl,
        hasApiKey: Boolean(this.config.apiKey)
      });
      return {
        serverType: "jellyfinemby",
        sessionId: summary.id,
        itemName: summary.nowPlayingItemName ?? null,
        tracks: []
      };
    }

    if (!summary.nowPlayingItemId) {
      this.log.warn(`[${this.config.name}] Skipping Jellyfinemby subtitles due to missing item ID`, {
        sessionId: summary.id
      });
      return {
        serverType: "jellyfinemby",
        sessionId: summary.id,
        itemName: summary.nowPlayingItemName ?? null,
        tracks: []
      };
    }

    const resolvedStreams = await this.resolveSubtitleStreams(summary, this.config, true);

    if (!resolvedStreams.streams.length) {
      this.log.info(
        `[${this.config.name}] No subtitle streams available for session ${summary.id} (${summary.nowPlayingItemName ?? "unknown"})`
      );
      return {
        serverType: "jellyfinemby",
        sessionId: summary.id,
        itemName: summary.nowPlayingItemName ?? null,
        tracks: []
      };
    }

    const workingSummary: MediaServerSessionSummary = {
      ...summary,
      mediaSourceId: resolvedStreams.mediaSourceId ?? summary.mediaSourceId,
      subtitleStreams: resolvedStreams.streams
    };

    if (!workingSummary.mediaSourceId) {
      this.log.warn(`[${this.config.name}] Skipping Jellyfinemby subtitles due to missing media source ID`, {
        itemId: workingSummary.nowPlayingItemId
      });
      return {
        serverType: "jellyfinemby",
        sessionId: summary.id,
        itemName: workingSummary.nowPlayingItemName ?? null,
        tracks: []
      };
    }

    const subtitleKey = `${workingSummary.id}:${workingSummary.nowPlayingItemId}:${workingSummary.mediaSourceId}`;
    if (!force && this.lastSubtitleItemKey === subtitleKey) {
      this.log.debug(
        `[${this.config.name}] Skipping subtitle refresh for session ${workingSummary.id}, media unchanged (${workingSummary.nowPlayingItemId})`
      );
      return null;
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
        const fallbackSourceFile = `${workingSummary.nowPlayingItemId ?? "item"}#${stream.index}.${extension}`;

        // Check cache first
        let content: string | null = null;
        if (this.cacheManager) {
          const cached = await this.cacheManager.get(url, "mediaserver");
          if (cached && cached.tracks.length > 0) {
            const cachedTrack = cached.tracks[0];
            const sourceFile = stream.displayTitle ?? cachedTrack.sourceFile ?? fallbackSourceFile;
            tracks.push({
              id: `${workingSummary.id}:${stream.index}`,
              sourceFile,
              cues: cachedTrack.cues
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
          sourceFile: stream.displayTitle ?? fallbackSourceFile,
          cues
        };
        tracks.push(track);

        if (this.cacheManager && content) {
          await this.cacheManager.set(url, "mediaserver", { tracks: [track] });
        }
      } catch (error) {
        this.log.warn(`[${this.config.name}] Failed to fetch Jellyfinemby subtitle stream`, {
          sessionId: workingSummary.id,
          streamIndex: stream.index,
          error
        });
      }
    }

    if (currentToken !== this.subtitleRequestToken) {
      return null;
    }

    return {
      serverType: "jellyfinemby",
      sessionId: workingSummary.id,
      itemName: workingSummary.nowPlayingItemName ?? null,
      tracks
    };
  }

  /**
   * Resolve subtitle streams with recursive retry mechanism
   * Migrated from jellyfinemby-desktop-client for robust metadata fetching
   * 
   * @param summary - Current session summary
   * @param config - Active Jellyfinemby configuration
   * @param allowRefresh - Whether to allow API refresh on missing data
   * @returns Object containing resolved streams and mediaSourceId
   */
  private async resolveSubtitleStreams(
    summary: MediaServerSessionSummary,
    config: MediaServerConfig,
    allowRefresh: boolean
  ): Promise<{ streams: MediaServerSubtitleStream[]; mediaSourceId: string | null }> {
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
      this.log.info("Subtitle metadata missing from session, fetching from Jellyfinemby API", {
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

  private async fetchNowPlayingMetadata(summary: MediaServerSessionSummary, config?: MediaServerConfig) {
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

      const subtitleStreams = this.sessionManager.extractSubtitleStreams(mediaSource, item);
      const itemName = typeof item?.Name === "string" ? item.Name : null;

      return {
        subtitleStreams,
        mediaSourceId: resolvedMediaSourceId,
        itemName
      };
    } catch (error) {
      this.log.warn("Failed to refresh Jellyfinemby item metadata", {
        sessionId: summary.id,
        itemId: summary.nowPlayingItemId,
        error
      });
      return null;
    }
  }

  /**
   * Get preferred subtitle extension with intelligent format detection
   * Enhanced version using guessSubtitleFormatFromStream from jellyfinemby-desktop-client
   */
  private getPreferredExtension(stream: MediaServerSubtitleStream): string {
    return guessSubtitleFormatFromStream(stream);
  }
}
