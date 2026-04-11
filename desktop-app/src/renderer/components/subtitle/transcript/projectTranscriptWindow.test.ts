import { describe, expect, it } from "vitest";
import { projectTranscriptWindow } from "./projectTranscriptWindow";
import type { TranscriptLayoutResult } from "./types";

const layout: TranscriptLayoutResult = {
  totalHeight: 480,
  lines: [],
  blocks: [
    {
      blockId: "block-0",
      start: 0,
      end: 1000,
      top: 0,
      height: 80,
      lineStart: 0,
      lineCount: 0
    },
    {
      blockId: "block-1",
      start: 1000,
      end: 2000,
      top: 96,
      height: 80,
      lineStart: 0,
      lineCount: 0
    },
    {
      blockId: "block-2",
      start: 2000,
      end: 3000,
      top: 192,
      height: 80,
      lineStart: 0,
      lineCount: 0
    },
    {
      blockId: "block-3",
      start: 3000,
      end: 4000,
      top: 288,
      height: 80,
      lineStart: 0,
      lineCount: 0
    }
  ]
};

describe("projectTranscriptWindow", () => {
  it("expands the visible window using pixel overscan", () => {
    const windowProjection = projectTranscriptWindow({
      layout,
      scrollTop: 110,
      viewportHeight: 100,
      overscanPx: 60
    });

    expect(windowProjection.startIndex).toBe(0);
    expect(windowProjection.endIndex).toBe(3);
  });
});
