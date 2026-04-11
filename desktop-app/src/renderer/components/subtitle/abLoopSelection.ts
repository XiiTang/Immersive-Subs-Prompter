import type { LoopSession, VideoControlCommand } from "../../../main/types.js";

export type AbLoopSelectionState =
  | { kind: "idle" }
  | { kind: "selecting-second"; anchorCueIndex: number }
  | { kind: "active"; startCueIndex: number; endCueIndex: number };

type CueBoundary = {
  start: number;
  end: number;
};

type GetCueBoundary = (cueIndex: number) => CueBoundary | null;

type AbLoopSelectionResult = {
  state: AbLoopSelectionState;
  loop: Extract<VideoControlCommand, { type: "loop" }>["loop"] | null;
};

export function createAbLoopSelectionState(): AbLoopSelectionState {
  return { kind: "idle" };
}

export function deriveAbLoopSelectionState(loop: LoopSession | null): AbLoopSelectionState {
  if (loop?.mode === "ab" && loop.startCueIndex !== null && loop.endCueIndex !== null) {
    return {
      kind: "active",
      startCueIndex: loop.startCueIndex,
      endCueIndex: loop.endCueIndex
    };
  }

  return createAbLoopSelectionState();
}

export function getAbLoopLabel(state: AbLoopSelectionState, cueIndex: number): "AB" | "A" | "B" {
  if (state.kind === "selecting-second") {
    return state.anchorCueIndex === cueIndex ? "A" : "AB";
  }

  if (state.kind === "active") {
    if (state.startCueIndex === cueIndex) {
      return "A";
    }
    if (state.endCueIndex === cueIndex) {
      return "B";
    }
  }

  return "AB";
}

export function selectAbLoopCue(
  state: AbLoopSelectionState,
  cueIndex: number,
  getCueBoundary: GetCueBoundary
): AbLoopSelectionResult {
  const cue = getCueBoundary(cueIndex);
  if (!cue) {
    return { state, loop: null };
  }

  if (state.kind !== "selecting-second") {
    return {
      state: { kind: "selecting-second", anchorCueIndex: cueIndex },
      loop: null
    };
  }

  if (state.anchorCueIndex === cueIndex) {
    return {
      state: createAbLoopSelectionState(),
      loop: null
    };
  }

  const anchorCue = getCueBoundary(state.anchorCueIndex);
  if (!anchorCue) {
    return {
      state: createAbLoopSelectionState(),
      loop: null
    };
  }

  const startCueIndex = cue.start < anchorCue.start ? cueIndex : state.anchorCueIndex;
  const endCueIndex = startCueIndex === cueIndex ? state.anchorCueIndex : cueIndex;
  const startCue = startCueIndex === cueIndex ? cue : anchorCue;
  const endCue = endCueIndex === cueIndex ? cue : anchorCue;

  return {
    state: {
      kind: "active",
      startCueIndex,
      endCueIndex
    },
    loop: {
      mode: "ab",
      startMs: startCue.start,
      endMs: endCue.end,
      startCueIndex,
      endCueIndex,
      anchorCueIndex: state.anchorCueIndex,
      origin: "ab-loop"
    }
  };
}
