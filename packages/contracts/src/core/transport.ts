import type { LoopSession } from "./loop.js";

export type ControlAction = "seek" | "loop" | "stopLoop" | "pause" | "play";
export interface SeekCommandPayload {
  time: number;
}
export type LoopCommandPayload = LoopSession;

export interface PageUrlChangedPayload {
  pageUrl: string;
  title?: string;
}
