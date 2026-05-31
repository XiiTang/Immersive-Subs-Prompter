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
  JellyfinembyServerConfig,
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
  private lastSubtitleRequestKey: string | null = null;
  private inFlightSubtitleItemKey: string | null = null;

  constructor(
    private config: JellyfinembyServerConfig,
    private readonly identity: JellyfinembyIdentity,
    private readonly sessionManager: JellyfinembySessionManager,
    private readonly log: Logger,
    private readonly cacheManager?: SubtitleCacheManager
  ) {}

  updateConfig(next: JellyfinembyServerConfig) {
    this.config = next;
  }

  resetState() {
    this.subtitleRequestToken += 1;
    this.lastSubtitleItemKey = null;
    this.lastSubtitleRequestKey = null;
    this.inFlightSubtitleItemKey = null;
  }

  clearSubtitleState() {
    this.subtitleRequestToken += 1;
    this.lastSubtitleItemKey = null;
    this.lastSubtitleRequestKey = null;
    this.inFlightSubtitleItemKey = null;
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
      this.lastSubtitleItemKey = null;
      this.inFlightSubtitleItemKey = null;
      return {
        serverType: "jellyfinemby",
        sessionId: summary.id,
        itemName: summary.nowPlayingItemName ?? null,
        tracks: []
      };
    }

    const knownSubtitleKey = this.buildSubtitleKey(summary.id, summary.nowPlayingItemId, summary.mediaSourceId);
    if (!force && knownSubtitleKey && this.lastSubtitleItemKey === knownSubtitleKey) {
      this.log.debug(
        `[${this.config.name}] Skipping subtitle refresh for session ${summary.id}, media unchanged (${summary.nowPlayingItemId})`
      );
      return null;
    }
    const requestKey = this.buildSubtitleRequestKey(summary.id, summary.nowPlayingItemId, summary.mediaSourceId);
    if (!force && requestKey && this.inFlightSubtitleItemKey === requestKey) {
      this.log.debug(
        `[${this.config.name}] Skipping subtitle refresh for session ${summary.id}, media already loading (${summary.nowPlayingItemId})`
      );
      return null;
    }
    if (!force && requestKey && this.lastSubtitleRequestKey === requestKey) {
      this.log.debug(
        `[${this.config.name}] Skipping subtitle refresh for session ${summary.id}, media unchanged (${summary.nowPlayingItemId})`
      );
      return null;
    }
    if (requestKey && this.lastSubtitleRequestKey !== requestKey && this.lastSubtitleItemKey !== requestKey) {
      this.lastSubtitleItemKey = null;
      this.lastSubtitleRequestKey = null;
    }

    const currentToken = ++this.subtitleRequestToken;
    this.inFlightSubtitleItemKey = requestKey;
    try {
      const resolvedStreams = await this.resolveSubtitleStreams(summary, this.config, true);
      if (currentToken !== this.subtitleRequestToken) {
        return null;
      }

      if (!resolvedStreams.streams.length) {
        this.log.info(
          `[${this.config.name}] No subtitle streams available for session ${summary.id} (${summary.nowPlayingItemName ?? "unknown"})`
        );
        this.lastSubtitleItemKey = null;
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
        this.lastSubtitleItemKey = null;
        return {
          serverType: "jellyfinemby",
          sessionId: summary.id,
          itemName: workingSummary.nowPlayingItemName ?? null,
          tracks: []
        };
      }

      const subtitleKey = this.buildSubtitleKey(
        workingSummary.id,
        workingSummary.nowPlayingItemId,
        workingSummary.mediaSourceId
      );
      if (!subtitleKey) {
        this.log.warn(`[${this.config.name}] Skipping Jellyfinemby subtitles due to missing subtitle key`, {
          sessionId: workingSummary.id,
          itemId: workingSummary.nowPlayingItemId,
          mediaSourceId: workingSummary.mediaSourceId
        });
        this.lastSubtitleItemKey = null;
        return {
          serverType: "jellyfinemby",
          sessionId: summary.id,
          itemName: workingSummary.nowPlayingItemName ?? null,
          tracks: []
        };
      }
      if (!force && this.lastSubtitleItemKey === subtitleKey) {
        this.lastSubtitleRequestKey = requestKey;
        this.log.debug(
          `[${this.config.name}] Skipping subtitle refresh for session ${workingSummary.id}, media unchanged (${workingSummary.nowPlayingItemId})`
        );
        return null;
      }

      this.log.info(
        `[${this.config.name}] Fetching ${workingSummary.subtitleStreams.length} subtitle stream(s) from session ${workingSummary.id} (${workingSummary.nowPlayingItemName ?? "unknown"})`
      );

      const tracks: SubtitleTrack[] = [];
      for (const stream of workingSummary.subtitleStreams) {
        try {
          const extension = this.getPreferredExtension(stream);
          const url = buildSubtitleUrl(this.config, workingSummary, stream, extension);
          const fallbackSourceFile = `${workingSummary.nowPlayingItemId ?? "item"}#${stream.index}.${extension}`;

          let content: string | null = null;
          if (this.cacheManager) {
            const cached = await this.cacheManager.get(url, "mediaserver");
            if (currentToken !== this.subtitleRequestToken) {
              return null;
            }
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
          if (currentToken !== this.subtitleRequestToken) {
            return null;
          }
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

      this.lastSubtitleItemKey = tracks.length ? subtitleKey : null;
      this.lastSubtitleRequestKey = tracks.length ? requestKey : null;
      return {
        serverType: "jellyfinemby",
        sessionId: workingSummary.id,
        itemName: workingSummary.nowPlayingItemName ?? null,
        tracks
      };
    } finally {
      if (this.inFlightSubtitleItemKey === requestKey) {
        this.inFlightSubtitleItemKey = null;
      }
    }
  }

  private async resolveSubtitleStreams(
    summary: MediaServerSessionSummary,
    config: JellyfinembyServerConfig,
    allowRefresh: boolean
  ): Promise<{ streams: MediaServerSubtitleStream[]; mediaSourceId: string | null }> {
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

        return this.resolveSubtitleStreams(
          {
            ...summary,
            subtitleStreams: metadata.subtitleStreams,
            mediaSourceId: metadata.mediaSourceId ?? summary.mediaSourceId
          },
          config,
          false
        );
      }
    }

    return {
      streams: summary.subtitleStreams,
      mediaSourceId: summary.mediaSourceId
    };
  }

  private async fetchNowPlayingMetadata(summary: MediaServerSessionSummary, config?: JellyfinembyServerConfig) {
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

      const mediaSourceIdFromSummary = summary.mediaSourceId;
      const mediaSourceIdFromSources = (mediaSources[0]?.Id as string | undefined) ?? null;
      const resolvedMediaSourceId = mediaSourceIdFromSummary ?? mediaSourceIdFromSources;

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

  private getPreferredExtension(stream: MediaServerSubtitleStream): string {
    return guessSubtitleFormatFromStream(stream);
  }

  private buildSubtitleKey(sessionId: string, itemId: string | null, mediaSourceId: string | null): string | null {
    if (!itemId || !mediaSourceId) {
      return null;
    }
    return `${sessionId}:${itemId}:${mediaSourceId}`;
  }

  private buildSubtitleRequestKey(sessionId: string, itemId: string | null, mediaSourceId: string | null): string | null {
    if (!itemId) {
      return null;
    }
    return `${sessionId}:${itemId}:${mediaSourceId ?? "pending-media-source"}`;
  }
}
