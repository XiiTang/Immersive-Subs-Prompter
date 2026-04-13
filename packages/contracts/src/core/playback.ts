import type { LoopSnapshot } from "./loop.js";

export interface PlaybackSnapshot {
  playbackRate: number;
  currentTime: number;
  duration: number | null;
  paused: boolean;
  muted: boolean;
  volume: number;
  readyState: number;
  updatedAt: number;
  loop: LoopSnapshot | null;
}
