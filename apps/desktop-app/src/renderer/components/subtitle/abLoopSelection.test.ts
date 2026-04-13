import { describe, expect, it } from "vitest";
import {
  createAbLoopSelectionState,
  getAbLoopLabel,
  selectAbLoopCue
} from "./abLoopSelection";

describe("abLoopSelection", () => {
  const cues = [
    { start: 1000, end: 2000 },
    { start: 2000, end: 3000 },
    { start: 3000, end: 4000 },
    { start: 4000, end: 5000 }
  ];
  const getCueBoundary = (cueIndex: number) => cues[cueIndex] ?? null;

  it("shows AB for every cue before selection starts", () => {
    const state = createAbLoopSelectionState();

    expect(getAbLoopLabel(state, 0)).toBe("AB");
    expect(getAbLoopLabel(state, 2)).toBe("AB");
  });

  it("keeps only the anchor cue on A after the first click", () => {
    const result = selectAbLoopCue(createAbLoopSelectionState(), 2, getCueBoundary);

    expect(result.state).toEqual({ kind: "selecting-second", anchorCueIndex: 2 });
    expect(getAbLoopLabel(result.state, 2)).toBe("A");
    expect(getAbLoopLabel(result.state, 1)).toBe("AB");
  });

  it("orders the final A and B labels by cue time instead of click order", () => {
    const selecting = selectAbLoopCue(createAbLoopSelectionState(), 3, getCueBoundary).state;
    const result = selectAbLoopCue(selecting, 1, getCueBoundary);

    expect(result.state).toEqual({
      kind: "active",
      startCueIndex: 1,
      endCueIndex: 3
    });
    expect(getAbLoopLabel(result.state, 1)).toBe("A");
    expect(getAbLoopLabel(result.state, 3)).toBe("B");
    expect(result.loop).toEqual({
      mode: "ab",
      startMs: 2000,
      endMs: 5000,
      startCueIndex: 1,
      endCueIndex: 3,
      anchorCueIndex: 3,
      origin: "ab-loop"
    });
  });

  it("cancels the pending selection when the anchor cue is clicked again", () => {
    const selecting = selectAbLoopCue(createAbLoopSelectionState(), 1, getCueBoundary).state;
    const result = selectAbLoopCue(selecting, 1, getCueBoundary);

    expect(result.state).toEqual({ kind: "idle" });
    expect(result.loop).toBe(null);
  });
});
