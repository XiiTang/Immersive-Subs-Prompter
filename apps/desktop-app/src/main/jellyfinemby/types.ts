import {
  JellyfinembyServerConfig,
  MediaServerPlaybackPayload,
  MediaServerSessionSummary,
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

export type JellyfinembyRuntimeSettings = {
  enabled: boolean;
  servers: JellyfinembyServerConfig[];
};

export type JellyfinembyTabContext = {
  itemId: string | null;
  sessionId: string | null;
  serverConfigId: string | null;
};

export function getJellyfinembyTabContext(
  tabContexts: ReadonlyMap<number, JellyfinembyTabContext>,
  tabId: number | null
): JellyfinembyTabContext | null {
  return tabId === null ? null : tabContexts.get(tabId) ?? null;
}

export function updateJellyfinembyTabContext(
  tabContexts: Map<number, JellyfinembyTabContext>,
  tabId: number,
  updates: Partial<JellyfinembyTabContext>
): JellyfinembyTabContext {
  const next = {
    itemId: null,
    sessionId: null,
    serverConfigId: null,
    ...tabContexts.get(tabId),
    ...updates
  };
  tabContexts.set(tabId, next);
  return next;
}

export type SettingsProvider = () => JellyfinembyRuntimeSettings;

export type SessionSubscriptionMode = "idle" | "burst" | "continuous";

export type ConnectionHooks = {
  onStatus: (payload: MediaServerStatusPayload) => void;
  onSessions: (sessions: MediaServerSessionSummary[]) => void;
  onPlayback: (payload: MediaServerPlaybackPayload) => void;
  onSubtitles: (payload: MediaServerSubtitlesPayload) => void;
  onError: (error: Error) => void;
};
