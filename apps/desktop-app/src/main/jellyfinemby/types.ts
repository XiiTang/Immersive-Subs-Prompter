import {
  MediaServerPlaybackPayload,
  MediaServerSessionSummary,
  MediaServerSettings,
  MediaServerConfig,
  MediaServerStatusPayload,
  MediaServerSubtitlesPayload
} from "../types.js";

export type JellyfinembyEventMap = {
  status: MediaServerStatusPayload;
  sessions: MediaServerSessionSummary[];
  playback: MediaServerPlaybackPayload;
  subtitles: MediaServerSubtitlesPayload;
  error: Error;
};

export type JellyfinembyEventName = keyof JellyfinembyEventMap;
export type JellyfinembyListener<K extends JellyfinembyEventName> = (payload: JellyfinembyEventMap[K]) => void;

export type RawSessionRecord = Record<string, unknown>;

export type SettingsProvider = () => MediaServerSettings;

export type SessionSubscriptionMode = "idle" | "burst" | "continuous";

export type ConnectionHooks = {
  onStatus: (payload: MediaServerStatusPayload) => void;
  onSessions: (sessions: MediaServerSessionSummary[]) => void;
  onPlayback: (payload: MediaServerPlaybackPayload) => void;
  onSubtitles: (payload: MediaServerSubtitlesPayload) => void;
  onError: (error: Error) => void;
};
