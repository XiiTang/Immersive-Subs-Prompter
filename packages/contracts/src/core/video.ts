import type { PlaybackSnapshot } from "./playback.js";

export type VideoSite = "youtube" | "bilibili" | "douyin" | "unknown";

export interface VideoStateSnapshot extends PlaybackSnapshot {
  pageUrl: string;
  site: VideoSite;
  videoSrc: string | null;
  videoWidth: number | null;
  videoHeight: number | null;
  pictureInPicture: boolean;
  title: string;
}
