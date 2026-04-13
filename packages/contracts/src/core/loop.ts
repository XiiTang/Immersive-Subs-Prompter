export type LoopMode = "single" | "ab";
export type LoopOrigin = "single-loop" | "ab-loop";
export type LoopStatus = "running";
export type LoopBoundaryTransition = "none" | "loop-wrap";
export type ProgrammaticSeekReason = "none" | "manual-control" | "loop-wrap";

export interface LoopSession {
  mode: LoopMode;
  startMs: number;
  endMs: number;
  startCueIndex: number | null;
  endCueIndex: number | null;
  anchorCueIndex: number | null;
  origin: LoopOrigin;
}

export interface LoopSnapshot extends LoopSession {
  status: LoopStatus;
  boundaryTransition: LoopBoundaryTransition;
  programmaticSeekReason: ProgrammaticSeekReason;
}
