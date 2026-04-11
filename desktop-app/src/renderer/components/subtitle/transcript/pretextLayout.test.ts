import { describe, expect, it } from "vitest";
import type { TranscriptBlock } from "./types";
import { createTranscriptPreparedTextCache, layoutTranscriptBlocks } from "./pretextLayout";

const blocks: TranscriptBlock[] = [
  {
    id: "block-0",
    start: 0,
    end: 1000,
    primaryText: "hello world",
    secondaryText: "你好世界",
    sourceCueRefs: { primaryCueIndex: 0, secondaryCueIndex: 0 }
  },
  {
    id: "block-1",
    start: 1000,
    end: 2000,
    primaryText: "another longer sentence for wrapping",
    secondaryText: null,
    sourceCueRefs: { primaryCueIndex: 1, secondaryCueIndex: null }
  }
];

describe("layoutTranscriptBlocks", () => {
  const baseInput = {
    blocks,
    width: 180,
    fontSize: 16,
    lineHeight: 1.5,
    fontFamily: "Arial",
    primarySecondaryGap: 6,
    blockGap: 12,
    metaRowHeight: 18,
    metaRowGap: 6
  } as const;

  it("produces block geometry with line counts and lineStart", () => {
    const layout = layoutTranscriptBlocks(baseInput);

    expect(layout.blocks).toHaveLength(2);
    expect(layout.blocks[0]?.lineCount).toBeGreaterThan(0);
    expect(layout.blocks[0]?.blockId).toBe("block-0");
    expect(layout.blocks[0]?.lineStart).toBe(0);
    expect(layout.blocks[1]?.blockId).toBe("block-1");
    expect(layout.blocks[1]?.lineStart).toBe(layout.blocks[0]!.lineCount);
  });

  it("relayouts at a narrower width without rebuilding block ownership", () => {
    const wide = layoutTranscriptBlocks({
      ...baseInput,
      width: 320,
    });
    const narrow = layoutTranscriptBlocks({
      ...baseInput,
      width: 140,
    });

    expect(narrow.blocks[1]!.lineCount).toBeGreaterThanOrEqual(wide.blocks[1]!.lineCount);
    expect(narrow.blocks.map((block) => block.blockId)).toEqual(wide.blocks.map((block) => block.blockId));
  });

  it("uses the configured primary-secondary gap in block geometry", () => {
    const compact = layoutTranscriptBlocks({
      ...baseInput,
      primarySecondaryGap: 2,
    });
    const loose = layoutTranscriptBlocks({
      ...baseInput,
      primarySecondaryGap: 12,
    });

    expect(loose.blocks[0]!.height).toBeGreaterThan(compact.blocks[0]!.height);
  });

  it("reuses caller-scoped prepared text across width-only relayouts", () => {
    const preparedTextCache = createTranscriptPreparedTextCache();

    layoutTranscriptBlocks({
      ...baseInput,
      width: 320,
      preparedTextCache
    });
    expect(preparedTextCache.size).toBe(3);

    layoutTranscriptBlocks({
      ...baseInput,
      width: 140,
      preparedTextCache
    });
    expect(preparedTextCache.size).toBe(3);
  });

  it("keeps prepared text caches isolated by caller", () => {
    const firstCache = createTranscriptPreparedTextCache();
    const secondCache = createTranscriptPreparedTextCache();

    layoutTranscriptBlocks({
      ...baseInput,
      preparedTextCache: firstCache
    });

    expect(firstCache.size).toBe(3);
    expect(secondCache.size).toBe(0);
  });

  it("maps each rendered line back to its owning block", () => {
    const layout = layoutTranscriptBlocks(baseInput);

    const block0 = layout.blocks[0]!;
    const block0Lines = layout.lines.slice(block0.lineStart, block0.lineStart + block0.lineCount);
    expect(block0Lines.length).toBeGreaterThan(0);
    expect(block0Lines.every((line) => line.blockId === "block-0")).toBe(true);
  });

  it("uses a smaller geometry for secondary lines", () => {
    const layout = layoutTranscriptBlocks(baseInput);

    const block0 = layout.blocks[0]!;
    const block0Lines = layout.lines.slice(block0.lineStart, block0.lineStart + block0.lineCount);
    const primaryLine = block0Lines.find((line) => line.kind === "primary");
    const secondaryLine = block0Lines.find((line) => line.kind === "secondary");

    expect(primaryLine).toBeDefined();
    expect(secondaryLine).toBeDefined();
    expect(secondaryLine!.height).toBeLessThan(primaryLine!.height);
  });

  it("records block-relative line offsets", () => {
    const layout = layoutTranscriptBlocks(baseInput);

    expect(layout.lines[0]).toMatchObject({
      blockId: "block-0",
      relativeTop: expect.any(Number)
    });
    expect(layout.lines[0]!.relativeTop).toBe(24);
  });

  it("adds fixed meta row geometry before text lines", () => {
    const layout = layoutTranscriptBlocks(baseInput);

    expect(layout.blocks[0]!.height).toBeGreaterThan(24);
    expect(layout.lines[0]!.relativeTop).toBe(24);
  });

  it("keeps line offsets stable when only interaction visibility would change", () => {
    const first = layoutTranscriptBlocks(baseInput);
    const second = layoutTranscriptBlocks(baseInput);

    expect(second.blocks).toEqual(first.blocks);
    expect(second.lines.map((line) => line.relativeTop)).toEqual(first.lines.map((line) => line.relativeTop));
  });

  it("preserves explicit cue line breaks in pretext layout", () => {
    const layout = layoutTranscriptBlocks({
      ...baseInput,
      blocks: [
        {
          id: "block-breaks",
          start: 0,
          end: 1000,
          primaryText: "first line\nsecond line",
          secondaryText: null,
          sourceCueRefs: { primaryCueIndex: 0, secondaryCueIndex: null }
        }
      ],
      width: 500,
    });

    const primaryLines = layout.lines.filter((line) => line.kind === "primary");
    expect(primaryLines).toHaveLength(2);
    expect(primaryLines.map((line) => line.text)).toEqual(["first line", "second line"]);
  });

  it("reflows to fewer lines at wider widths", () => {
    const narrow = layoutTranscriptBlocks({
      ...baseInput,
      blocks: [blocks[1]!],
      width: 140,
    });
    const wide = layoutTranscriptBlocks({
      ...baseInput,
      blocks: [blocks[1]!],
      width: 320,
    });

    expect(narrow.lines.length).toBeGreaterThan(wide.lines.length);
  });

  it("produces consistent lineStart + lineCount covering all lines", () => {
    const layout = layoutTranscriptBlocks(baseInput);

    let expectedLineStart = 0;
    for (const block of layout.blocks) {
      expect(block.lineStart).toBe(expectedLineStart);
      expectedLineStart += block.lineCount;
    }
    expect(expectedLineStart).toBe(layout.lines.length);
  });
});
