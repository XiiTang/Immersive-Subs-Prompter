import type { MediaServerSessionSummary, SubtitleTrack } from "../types.js";

export type MediaSourceAdapterEvent =
  | {
      type: "sourceMatched";
      tabId: number;
      pageUrl: string | null;
      videoUrl: string | null;
      title: string | null;
      site: string | null;
      selectedSessionId?: string | null;
    }
  | {
      type: "sessionsChanged";
      sessions: MediaServerSessionSummary[];
    }
  | {
      type: "subtitleTracksLoaded";
      sessionId: string | null;
      tracks: SubtitleTrack[];
    }
  | {
      type: "playbackSnapshot";
      sessionId: string | null;
      positionMs: number | null;
      durationMs: number | null;
      playbackRate: number;
      paused: boolean;
    }
  | { type: "sourceDisconnected" }
  | { type: "error"; message: string };

export interface MediaSourceRuntime {
  sourceId: "jellyfinEmby";
  handleConnectionMessage?(message: unknown): Promise<unknown>;
  handleSettingsUpdated?(): Promise<void>;
  stop?(): Promise<void>;
}
