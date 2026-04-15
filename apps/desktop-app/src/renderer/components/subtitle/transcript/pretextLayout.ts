import {
  layoutNextLineRange,
  materializeLineRange,
  measureLineStats,
  prepareWithSegments,
  type LayoutCursor,
  type PreparedTextWithSegments
} from "@chenglou/pretext";
import type {
  TranscriptBlock,
  TranscriptLayoutBlock,
  TranscriptLayoutLine,
  TranscriptLayoutResult,
  TranscriptPreparedTextKey
} from "./types";

type LayoutTranscriptBlocksInput = {
  blocks: TranscriptBlock[];
  width: number;
  fontSize: number;
  lineHeight: number;
  fontFamily: string;
  primarySecondaryGap: number;
  blockGap: number;
  metaRowHeight: number;
  preparedTextCache?: TranscriptPreparedTextCache;
};

type MaterializeTranscriptBlockLinesInput = {
  block: TranscriptLayoutBlock;
  width: number;
  preparedTextCache: TranscriptPreparedTextCache;
};

const SECONDARY_FONT_SIZE_OFFSET = 1;
const SECONDARY_LINE_HEIGHT_RATIO = 0.98;
const PRIMARY_FONT_WEIGHT = 560;
const SECONDARY_FONT_WEIGHT = 400;
const LINE_LAYOUT_START: LayoutCursor = {
  segmentIndex: 0,
  graphemeIndex: 0
};

export type TranscriptPreparedTextCache = Map<TranscriptPreparedTextKey, PreparedTextWithSegments>;

export function createTranscriptPreparedTextCache(): TranscriptPreparedTextCache {
  return new Map<TranscriptPreparedTextKey, PreparedTextWithSegments>();
}

function createFont(fontSize: number, fontFamily: string, fontWeight: number): string {
  return `${fontWeight} ${fontSize}px ${fontFamily}`;
}

function cloneCursor(cursor: LayoutCursor): LayoutCursor {
  return {
    segmentIndex: cursor.segmentIndex,
    graphemeIndex: cursor.graphemeIndex
  };
}

function getPreparedTextKey(text: string, font: string) {
  return `${font}\u0000${text}`;
}

function getPreparedText(
  text: string,
  font: string,
  preparedTextCache: TranscriptPreparedTextCache
): { key: TranscriptPreparedTextKey; prepared: PreparedTextWithSegments } {
  const key = getPreparedTextKey(text, font);
  const cached = preparedTextCache.get(key);
  if (cached) {
    return { key, prepared: cached };
  }

  const prepared = prepareWithSegments(text, font, {
    whiteSpace: "pre-wrap",
    wordBreak: "keep-all"
  });
  preparedTextCache.set(key, prepared);
  return { key, prepared };
}

function computeFontParams(fontSize: number, lineHeight: number, fontFamily: string) {
  const primaryLinePixelHeight = fontSize * lineHeight;
  const secondaryFontSize = Math.max(fontSize - SECONDARY_FONT_SIZE_OFFSET, 1);
  const secondaryLinePixelHeight = secondaryFontSize * lineHeight * SECONDARY_LINE_HEIGHT_RATIO;
  const primaryFont = createFont(fontSize, fontFamily, PRIMARY_FONT_WEIGHT);
  const secondaryFont = createFont(secondaryFontSize, fontFamily, SECONDARY_FONT_WEIGHT);
  return { primaryLinePixelHeight, secondaryLinePixelHeight, primaryFont, secondaryFont };
}

function countPreparedLines(prepared: PreparedTextWithSegments, width: number) {
  const { lineCount } = measureLineStats(prepared, Math.max(width, 1));
  return lineCount;
}

function materializePreparedLines(
  prepared: PreparedTextWithSegments,
  width: number,
  lineHeightPx: number,
  blockId: string,
  kind: TranscriptLayoutLine["kind"],
  baseTop: number,
  blockTop: number
): TranscriptLayoutLine[] {
  const lines: TranscriptLayoutLine[] = [];
  const safeWidth = Math.max(width, 1);
  let cursor = cloneCursor(LINE_LAYOUT_START);
  let lineIndex = 0;

  while (true) {
    const range = layoutNextLineRange(prepared, cursor, safeWidth);
    if (range === null) {
      break;
    }

    const line = materializeLineRange(prepared, range);
    const lineTop = baseTop + lineIndex * lineHeightPx;
    lines.push({
      key: `${blockId}-${kind}-${lineIndex}`,
      blockId,
      kind,
      text: line.text,
      top: lineTop,
      height: lineHeightPx,
      relativeTop: lineTop - blockTop
    });
    cursor = cloneCursor(range.end);
    lineIndex += 1;
  }

  return lines;
}

export function measureTranscriptLayout({
  blocks,
  width,
  fontSize,
  lineHeight,
  fontFamily,
  primarySecondaryGap,
  blockGap,
  metaRowHeight,
  preparedTextCache
}: LayoutTranscriptBlocksInput): TranscriptLayoutResult {
  const scopedPreparedTextCache = preparedTextCache ?? createTranscriptPreparedTextCache();
  const safeWidth = Math.max(width, 1);
  const { primaryLinePixelHeight, secondaryLinePixelHeight, primaryFont, secondaryFont } =
    computeFontParams(fontSize, lineHeight, fontFamily);
  const safeBlockGap = Math.max(blockGap, 0);
  const secondaryGap = Math.max(primarySecondaryGap, 0);
  const safeMetaRowHeight = Math.max(metaRowHeight, 0);
  const layoutBlocks: TranscriptLayoutBlock[] = [];
  let top = 0;
  let nextLineStart = 0;

  blocks.forEach((block) => {
    const blockTop = top;
    const textTop = blockTop + safeMetaRowHeight;
    const primaryPrepared = getPreparedText(block.primaryText, primaryFont, scopedPreparedTextCache);
    const primaryLineCount = countPreparedLines(primaryPrepared.prepared, safeWidth);
    let blockHeight = safeMetaRowHeight + primaryLineCount * primaryLinePixelHeight;
    let secondaryPreparedKey: TranscriptPreparedTextKey | null = null;
    let secondaryLineCount = 0;

    if (block.secondaryText) {
      const secondaryPrepared = getPreparedText(block.secondaryText, secondaryFont, scopedPreparedTextCache);
      secondaryPreparedKey = secondaryPrepared.key;
      secondaryLineCount = countPreparedLines(secondaryPrepared.prepared, safeWidth);
      if (secondaryLineCount > 0) {
        blockHeight += secondaryGap + secondaryLineCount * secondaryLinePixelHeight;
      }
    }

    layoutBlocks.push({
      blockId: block.id,
      start: block.start,
      end: block.end,
      top: blockTop,
      height: blockHeight,
      lineStart: nextLineStart,
      lineCount: primaryLineCount + secondaryLineCount,
      primaryLineCount,
      secondaryLineCount,
      primaryLineHeight: primaryLinePixelHeight,
      secondaryLineHeight: secondaryLinePixelHeight,
      metaRowHeight: safeMetaRowHeight,
      primarySecondaryGap: secondaryLineCount > 0 ? secondaryGap : 0,
      primaryPreparedTextKey: primaryPrepared.key,
      secondaryPreparedTextKey: secondaryPreparedKey
    });

    nextLineStart += primaryLineCount + secondaryLineCount;
    top = textTop + primaryLineCount * primaryLinePixelHeight;
    if (secondaryLineCount > 0) {
      top += secondaryGap + secondaryLineCount * secondaryLinePixelHeight;
    }
    top += safeBlockGap;
  });

  return {
    totalHeight: Math.max(top - (blocks.length > 0 ? safeBlockGap : 0), 0),
    blocks: layoutBlocks
  };
}

export function materializeTranscriptBlockLines({
  block,
  width,
  preparedTextCache
}: MaterializeTranscriptBlockLinesInput): TranscriptLayoutLine[] {
  const primaryPrepared = preparedTextCache.get(block.primaryPreparedTextKey);
  if (!primaryPrepared) {
    throw new Error(`Missing prepared transcript text for key ${block.primaryPreparedTextKey}`);
  }

  const lines = materializePreparedLines(
    primaryPrepared,
    width,
    block.primaryLineHeight,
    block.blockId,
    "primary",
    block.top + block.metaRowHeight,
    block.top
  );

  const primaryHeight = block.primaryLineCount * block.primaryLineHeight;
  if (block.secondaryPreparedTextKey && block.secondaryLineCount > 0) {
    const secondaryPrepared = preparedTextCache.get(block.secondaryPreparedTextKey);
    if (!secondaryPrepared) {
      throw new Error(`Missing prepared transcript text for key ${block.secondaryPreparedTextKey}`);
    }

    const secondaryTop =
      block.top +
      block.metaRowHeight +
      primaryHeight +
      block.primarySecondaryGap;

    return [
      ...lines,
      ...materializePreparedLines(
        secondaryPrepared,
        width,
        block.secondaryLineHeight,
        block.blockId,
        "secondary",
        secondaryTop,
        block.top
      )
    ];
  }

  return lines;
}
