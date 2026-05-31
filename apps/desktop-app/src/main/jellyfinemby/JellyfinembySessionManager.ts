import { ticksToMilliseconds } from "../jellyfinembyUtils.js";
import {
  JellyfinembyServerConfig,
  MediaServerPlaybackPayload,
  MediaServerSessionSummary,
  MediaServerSubtitleStream
} from "../types.js";
import { RawSessionRecord } from "./types.js";

export class JellyfinembySessionManager {
  private sessionIdPrefix: string;

  constructor(private config: JellyfinembyServerConfig) {
    this.sessionIdPrefix = `${config.id}:`;
  }

  updateConfig(nextConfig: JellyfinembyServerConfig) {
    this.config = nextConfig;
    this.sessionIdPrefix = `${nextConfig.id}:`;
  }

  toSessionSummary(record: RawSessionRecord): MediaServerSessionSummary | null {
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

    const mediaSourceIdFromPlayState = typeof playState?.MediaSourceId === "string" ? playState.MediaSourceId : null;
    const mediaSourceIdFromSources = (mediaSources[0]?.Id as string | undefined) ?? null;
    const resolvedMediaSourceId = mediaSourceIdFromPlayState ?? mediaSourceIdFromSources;

    const mediaSource = resolvedMediaSourceId
      ? mediaSources.find((source) => source?.Id === resolvedMediaSourceId) ?? mediaSources[0] ?? null
      : mediaSources[0] ?? null;

    const subtitleStreams = this.extractSubtitleStreams(mediaSource, nowPlayingItem);

    return {
      id: this.composeSessionId(rawId),
      serverConfigId: this.config.id,
      serverName: this.config.name,
      serverType: "jellyfinemby",
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

  toPlaybackPayload(summary: MediaServerSessionSummary): MediaServerPlaybackPayload {
    const positionMs = ticksToMilliseconds(summary.positionTicks);
    return {
      serverType: summary.serverType,
      sessionId: summary.id,
      itemName: summary.nowPlayingItemName ?? null,
      isPaused: summary.isPaused,
      playbackRate: summary.playbackRate || 1,
      positionMs,
      runTimeMs: ticksToMilliseconds(summary.runTimeTicks)
    };
  }

  extractSubtitleStreams(
    mediaSource: RawSessionRecord | null,
    nowPlayingItem: RawSessionRecord | null
  ): MediaServerSubtitleStream[] {
    return this.collectSubtitleStreams(mediaSource?.MediaStreams, nowPlayingItem?.MediaStreams);
  }

  private composeSessionId(sessionId: string): string {
    return `${this.sessionIdPrefix}${sessionId}`;
  }

  private collectSubtitleStreams(...collections: unknown[]): MediaServerSubtitleStream[] {
    const byIndex = new Map<number, MediaServerSubtitleStream>();
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

  private toSubtitleStream(stream: RawSessionRecord | null): MediaServerSubtitleStream | null {
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
}
