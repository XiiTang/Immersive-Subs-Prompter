import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TranscriptBlock } from "./types";

const pretextMocks = vi.hoisted(() => ({
  prepareWithSegments: vi.fn(),
  measureLineStats: vi.fn(),
  layoutNextLineRange: vi.fn(),
  materializeLineRange: vi.fn()
}));

vi.mock("@chenglou/pretext", () => pretextMocks);

import {
  createTranscriptPreparedTextCache,
  materializeTranscriptBlockLines,
  measureTranscriptLayout
} from "./pretextLayout";

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

type MockPrepared = {
  id: string;
  text: string;
};

function createPrepared(text: string): MockPrepared {
  return {
    id: text,
    text
  };
}

describe("transcript pretext layout", () => {
  const baseInput = {
    blocks,
    width: 180,
    primaryFontSize: 16,
    secondaryFontSize: 12,
    lineHeight: 1.5,
    primaryFontFamily: "Arial",
    secondaryFontFamily: "Georgia",
    primarySecondaryGap: 6,
    blockGap: 12,
    metaRowHeight: 18
  } as const;

  beforeEach(() => {
    pretextMocks.prepareWithSegments.mockReset();
    pretextMocks.measureLineStats.mockReset();
    pretextMocks.layoutNextLineRange.mockReset();
    pretextMocks.materializeLineRange.mockReset();

    pretextMocks.prepareWithSegments.mockImplementation((text: string) => createPrepared(text));
    pretextMocks.measureLineStats.mockImplementation((prepared: MockPrepared) => ({
      lineCount:
        prepared.text === "hello world"
          ? 1
          : prepared.text === "你好世界"
            ? 1
            : prepared.text === "another longer sentence for wrapping"
              ? 2
              : 1,
      maxLineWidth: prepared.text.length * 10
    }));
    pretextMocks.layoutNextLineRange.mockImplementation((prepared: MockPrepared, start?: { segmentIndex: number }) => {
      const linesByText: Record<string, Array<{ start: number; end: number }>> = {
        "hello world": [{ start: 0, end: 11 }],
        "你好世界": [{ start: 0, end: 4 }],
        "another longer sentence for wrapping": [
          { start: 0, end: 15 },
          { start: 15, end: 36 }
        ]
      };
      const ranges = linesByText[prepared.text] ?? [];
      const index = start?.segmentIndex ?? 0;
      const current = ranges[index];
      if (!current) {
        return null;
      }
      return {
        width: (current.end - current.start) * 10,
        start: { segmentIndex: index, graphemeIndex: 0 },
        end: { segmentIndex: index + 1, graphemeIndex: 0 }
      };
    });
    pretextMocks.materializeLineRange.mockImplementation((prepared: MockPrepared, range: { start: { segmentIndex: number } }) => {
      const textsByPrepared: Record<string, string[]> = {
        "hello world": ["hello world"],
        "你好世界": ["你好世界"],
        "another longer sentence for wrapping": ["another longer", " sentence for wrapping"]
      };
      const text = textsByPrepared[prepared.text]?.[range.start.segmentIndex] ?? "";
      return {
        text,
        width: text.length * 10,
        start: range.start,
        end: { segmentIndex: range.start.segmentIndex + 1, graphemeIndex: 0 }
      };
    });
  });

  it("measures block geometry without materializing line strings", () => {
    const layout = measureTranscriptLayout(baseInput);

    expect(layout.blocks).toHaveLength(2);
    expect(layout.blocks[0]).toMatchObject({
      blockId: "block-0",
      primaryLineCount: 1,
      secondaryLineCount: 1
    });
    expect(layout.blocks[1]).toMatchObject({
      blockId: "block-1",
      primaryLineCount: 2,
      secondaryLineCount: 0
    });
    expect(pretextMocks.materializeLineRange).not.toHaveBeenCalled();
  });

  it("prepares transcript text with pre-wrap and keep-all enabled", () => {
    measureTranscriptLayout(baseInput);

    expect(pretextMocks.prepareWithSegments).toHaveBeenCalledWith(
      "hello world",
      expect.any(String),
      { whiteSpace: "pre-wrap", wordBreak: "keep-all" }
    );
    expect(pretextMocks.prepareWithSegments).toHaveBeenCalledWith(
      "你好世界",
      expect.any(String),
      { whiteSpace: "pre-wrap", wordBreak: "keep-all" }
    );
  });

  it("prepares primary and secondary text with role-specific font strings", () => {
    measureTranscriptLayout(baseInput);

    expect(pretextMocks.prepareWithSegments).toHaveBeenCalledWith(
      "hello world",
      "560 16px Arial",
      { whiteSpace: "pre-wrap", wordBreak: "keep-all" }
    );
    expect(pretextMocks.prepareWithSegments).toHaveBeenCalledWith(
      "你好世界",
      "400 12px Georgia",
      { whiteSpace: "pre-wrap", wordBreak: "keep-all" }
    );
  });

  it("measures primary and secondary line heights from role-specific sizes", () => {
    const preparedTextCache = createTranscriptPreparedTextCache();
    const layout = measureTranscriptLayout({
      ...baseInput,
      preparedTextCache
    });

    expect(layout.blocks[0]!.primaryLineHeight).toBe(24);
    expect(layout.blocks[0]!.secondaryLineHeight).toBe(17.64);

    const lines = materializeTranscriptBlockLines({
      block: layout.blocks[0]!,
      width: baseInput.width,
      preparedTextCache
    });

    expect(lines[0]).toMatchObject({
      kind: "primary",
      height: 24,
      relativeTop: 18
    });
    expect(lines[1]).toMatchObject({
      kind: "secondary",
      height: 17.64,
      relativeTop: 48
    });
  });

  it("reuses caller-scoped prepared text across width-only relayouts", () => {
    const preparedTextCache = createTranscriptPreparedTextCache();

    measureTranscriptLayout({
      ...baseInput,
      width: 320,
      preparedTextCache
    });
    expect(preparedTextCache.size).toBe(3);

    measureTranscriptLayout({
      ...baseInput,
      width: 140,
      preparedTextCache
    });
    expect(preparedTextCache.size).toBe(3);
    expect(pretextMocks.prepareWithSegments).toHaveBeenCalledTimes(3);
  });

  it("materializes line strings only for the requested block", () => {
    const preparedTextCache = createTranscriptPreparedTextCache();
    const layout = measureTranscriptLayout({
      ...baseInput,
      preparedTextCache
    });

    const visibleBlockLines = materializeTranscriptBlockLines({
      block: layout.blocks[1]!,
      width: baseInput.width,
      preparedTextCache
    });

    expect(visibleBlockLines.map((line) => line.text)).toEqual([
      "another longer",
      " sentence for wrapping"
    ]);
    expect(pretextMocks.materializeLineRange).toHaveBeenCalledTimes(2);
    expect(pretextMocks.materializeLineRange).not.toHaveBeenCalledWith(
      expect.objectContaining({ text: "hello world" }),
      expect.anything()
    );
  });

  it("preserves explicit cue line breaks in materialized lines", () => {
    pretextMocks.prepareWithSegments.mockImplementation((text: string) => createPrepared(text));
    pretextMocks.measureLineStats.mockImplementation(() => ({
      lineCount: 2,
      maxLineWidth: 90
    }));
    pretextMocks.layoutNextLineRange.mockImplementation((_prepared: MockPrepared, start?: { segmentIndex: number }) => {
      const index = start?.segmentIndex ?? 0;
      if (index > 1) {
        return null;
      }
      return {
        width: 90,
        start: { segmentIndex: index, graphemeIndex: 0 },
        end: { segmentIndex: index + 1, graphemeIndex: 0 }
      };
    });
    pretextMocks.materializeLineRange.mockImplementation((_prepared: MockPrepared, range: { start: { segmentIndex: number } }) => ({
      text: range.start.segmentIndex === 0 ? "first line" : "second line",
      width: 90,
      start: range.start,
      end: { segmentIndex: range.start.segmentIndex + 1, graphemeIndex: 0 }
    }));

    const preparedTextCache = createTranscriptPreparedTextCache();
    const layout = measureTranscriptLayout({
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
      preparedTextCache
    });

    const lines = materializeTranscriptBlockLines({
      block: layout.blocks[0]!,
      width: 500,
      preparedTextCache
    });

    expect(lines.map((line) => line.text)).toEqual(["first line", "second line"]);
  });
});
