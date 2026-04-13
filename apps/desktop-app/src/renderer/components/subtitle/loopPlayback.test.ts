import { describe, expect, it } from "vitest";
import { keepTimeInsideLoopWindow } from "./loopPlayback";

describe("keepTimeInsideLoopWindow", () => {
  it("clamps single-cue loop playback inside the cue boundary", () => {
    expect(
      keepTimeInsideLoopWindow({
        time: 1010,
        start: 0,
        end: 1000,
        mode: "single"
      })
    ).toBe(999);
  });

  it("wraps A-B loop playback back to A instead of freezing at B", () => {
    expect(
      keepTimeInsideLoopWindow({
        time: 4200,
        start: 1000,
        end: 4000,
        mode: "ab"
      })
    ).toBe(1200);
  });

  it("keeps in-range A-B playback time unchanged", () => {
    expect(
      keepTimeInsideLoopWindow({
        time: 2300,
        start: 1000,
        end: 4000,
        mode: "ab"
      })
    ).toBe(2300);
  });
});
