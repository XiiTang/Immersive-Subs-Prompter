import type { LoopMode, PlaybackLoop } from "../../../main/types";

type KeepTimeInsideLoopWindowInput = {
  time: number;
  start: number;
  end: number;
  mode: "single" | "ab";
};

export type LoopWindow = {
  mode: LoopMode;
  start: number;
  end: number;
};

export function getLoopWindow(loop: PlaybackLoop | null): LoopWindow | null {
  if (!loop || !Number.isFinite(loop.startMs) || !Number.isFinite(loop.endMs) || loop.endMs <= loop.startMs) {
    return null;
  }

  return {
    mode: loop.mode,
    start: loop.startMs,
    end: loop.endMs
  };
}

export function getSingleLoopCueIndex(loop: PlaybackLoop | null): number | null {
  if (loop?.mode !== "single") {
    return null;
  }

  return loop.startCueIndex;
}

export function getLoopWrapCueIndex(loop: PlaybackLoop | null): number | null {
  if (loop?.mode !== "ab" || loop.boundaryTransition !== "loop-wrap") {
    return null;
  }

  return loop.startCueIndex;
}

export function keepTimeInsideLoopWindow({
  time,
  start,
  end,
  mode
}: KeepTimeInsideLoopWindowInput): number {
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return time;
  }

  if (mode === "single") {
    return Math.max(start, Math.min(time, Math.max(start, end - 1)));
  }

  if (time < start) {
    return start;
  }

  if (time < end) {
    return time;
  }

  const duration = end - start;
  const wrappedOffset = (time - start) % duration;
  return start + wrappedOffset;
}
