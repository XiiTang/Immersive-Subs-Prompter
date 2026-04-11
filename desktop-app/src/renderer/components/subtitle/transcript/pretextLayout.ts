import { layoutWithLines, prepareWithSegments } from "@chenglou/pretext";
import type { TranscriptBlock, TranscriptLayoutBlock, TranscriptLayoutLine, TranscriptLayoutResult } from "./types";

type LayoutTranscriptBlocksInput = {
  blocks: TranscriptBlock[];
  width: number;
  fontSize: number;
  lineHeight: number;
  fontFamily: string;
  primarySecondaryGap: number;
  blockGap: number;
  metaRowHeight: number;
  metaRowGap: number;
  preparedTextCache?: TranscriptPreparedTextCache;
};

const SECONDARY_FONT_SIZE_OFFSET = 1;
const SECONDARY_LINE_HEIGHT_RATIO = 0.98;
const PRIMARY_FONT_WEIGHT = 560;
const SECONDARY_FONT_WEIGHT = 400;

export type TranscriptPreparedTextCache = Map<string, ReturnType<typeof prepareWithSegments>>;

export function createTranscriptPreparedTextCache(): TranscriptPreparedTextCache {
  return new Map<string, ReturnType<typeof prepareWithSegments>>();
}

function createFont(fontSize: number, fontFamily: string, fontWeight: number): string {
  return `${fontWeight} ${fontSize}px ${fontFamily}`;
}

function getPreparedText(text: string, font: string, preparedTextCache: TranscriptPreparedTextCache) {
  const cacheKey = `${font}\u0000${text}`;
  const cached = preparedTextCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const prepared = prepareWithSegments(text, font, { whiteSpace: "pre-wrap" });
  preparedTextCache.set(cacheKey, prepared);
  return prepared;
}

function computeFontParams(fontSize: number, lineHeight: number, fontFamily: string) {
  const primaryLinePixelHeight = fontSize * lineHeight;
  const secondaryFontSize = Math.max(fontSize - SECONDARY_FONT_SIZE_OFFSET, 1);
  const secondaryLinePixelHeight = secondaryFontSize * lineHeight * SECONDARY_LINE_HEIGHT_RATIO;
  const primaryFont = createFont(fontSize, fontFamily, PRIMARY_FONT_WEIGHT);
  const secondaryFont = createFont(secondaryFontSize, fontFamily, SECONDARY_FONT_WEIGHT);
  return { primaryLinePixelHeight, secondaryFontSize, secondaryLinePixelHeight, primaryFont, secondaryFont };
}

export function layoutTranscriptBlocks({
  blocks,
  width,
  fontSize,
  lineHeight,
  fontFamily,
  primarySecondaryGap,
  blockGap,
  metaRowHeight,
  metaRowGap,
  preparedTextCache
}: LayoutTranscriptBlocksInput): TranscriptLayoutResult {
  const scopedPreparedTextCache = preparedTextCache ?? createTranscriptPreparedTextCache();
  const safeWidth = Math.max(width, 1);
  const { primaryLinePixelHeight, secondaryLinePixelHeight, primaryFont, secondaryFont } =
    computeFontParams(fontSize, lineHeight, fontFamily);
  const safeBlockGap = Math.max(blockGap, 0);
  const secondaryGap = Math.max(primarySecondaryGap, 0);
  const safeMetaRowHeight = Math.max(metaRowHeight, 0);
  const safeMetaRowGap = Math.max(metaRowGap, 0);
  const layoutBlocks: TranscriptLayoutBlock[] = [];
  const layoutLines: TranscriptLayoutLine[] = [];
  let top = 0;

  blocks.forEach((block) => {
    const blockTop = top;
    const lineStart = layoutLines.length;
    const textTop = blockTop + safeMetaRowHeight + safeMetaRowGap;

    const primaryResult = layoutWithLines(
      getPreparedText(block.primaryText, primaryFont, scopedPreparedTextCache),
      safeWidth,
      primaryLinePixelHeight
    );
    primaryResult.lines.forEach((line, lineIndex) => {
      const lineTop = textTop + lineIndex * primaryLinePixelHeight;
      layoutLines.push({
        key: `${block.id}-primary-${lineIndex}`,
        blockId: block.id,
        kind: "primary",
        text: line.text,
        top: lineTop,
        height: primaryLinePixelHeight,
        relativeTop: lineTop - blockTop
      });
    });
    top = textTop + primaryResult.height;

    if (block.secondaryText) {
      top += secondaryGap;
      const secondaryResult = layoutWithLines(
        getPreparedText(block.secondaryText, secondaryFont, scopedPreparedTextCache),
        safeWidth,
        secondaryLinePixelHeight
      );
      secondaryResult.lines.forEach((line, lineIndex) => {
        const lineTop = top + lineIndex * secondaryLinePixelHeight;
        layoutLines.push({
          key: `${block.id}-secondary-${lineIndex}`,
          blockId: block.id,
          kind: "secondary",
          text: line.text,
          top: lineTop,
          height: secondaryLinePixelHeight,
          relativeTop: lineTop - blockTop
        });
      });
      top += secondaryResult.height;
    }

    layoutBlocks.push({
      blockId: block.id,
      start: block.start,
      end: block.end,
      top: blockTop,
      height: top - blockTop,
      lineStart,
      lineCount: layoutLines.length - lineStart
    });
    top += safeBlockGap;
  });

  return {
    totalHeight: Math.max(top - (blocks.length > 0 ? safeBlockGap : 0), 0),
    blocks: layoutBlocks,
    lines: layoutLines
  };
}
