import { describe, expect, it } from "vitest";
import type { SubtitleCue } from "../../../../main/types";
import { buildTranscriptBlocks } from "./buildTranscriptBlocks";

function cue(start: number, end: number, text: string): SubtitleCue {
  return { start, end, text };
}

describe("buildTranscriptBlocks", () => {
  it("builds primary-only reading blocks", () => {
    const blocks = buildTranscriptBlocks({
      primaryCues: [cue(0, 1000, "hello"), cue(1000, 2000, "world")],
      secondaryCues: []
    });

    expect(blocks).toEqual([
      {
        id: "block-0",
        start: 0,
        end: 1000,
        primaryText: "hello",
        secondaryText: null,
        sourceCueRefs: { primaryCueIndex: 0, secondaryCueIndex: null }
      },
      {
        id: "block-1",
        start: 1000,
        end: 2000,
        primaryText: "world",
        secondaryText: null,
        sourceCueRefs: { primaryCueIndex: 1, secondaryCueIndex: null }
      }
    ]);
  });

  it("aligns secondary text by best overlap", () => {
    const blocks = buildTranscriptBlocks({
      primaryCues: [cue(0, 1000, "hello world")],
      secondaryCues: [cue(100, 900, "你好世界")]
    });

    expect(blocks[0]?.secondaryText).toBe("你好世界");
    expect(blocks[0]?.sourceCueRefs.secondaryCueIndex).toBe(0);
  });

  it("drops empty primary text blocks", () => {
    const blocks = buildTranscriptBlocks({
      primaryCues: [cue(0, 1000, "   "), cue(1000, 2000, "kept")],
      secondaryCues: [cue(1000, 2000, "保留")]
    });

    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.primaryText).toBe("kept");
  });
});
