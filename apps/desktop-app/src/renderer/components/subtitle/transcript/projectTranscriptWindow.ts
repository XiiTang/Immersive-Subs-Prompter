import type { TranscriptLayoutResult, TranscriptWindowProjection } from "./types";

type ProjectTranscriptWindowInput = {
  layout: TranscriptLayoutResult;
  scrollTop: number;
  viewportHeight: number;
  overscanPx: number;
};

function lowerBound(blocks: TranscriptLayoutResult["blocks"], targetBottom: number): number {
  let lo = 0;
  let hi = blocks.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (blocks[mid]!.top + blocks[mid]!.height < targetBottom) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }
  return lo;
}

function upperBound(blocks: TranscriptLayoutResult["blocks"], targetTop: number): number {
  let lo = 0;
  let hi = blocks.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (blocks[mid]!.top <= targetTop) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }
  return lo;
}

export function projectTranscriptWindow({
  layout,
  scrollTop,
  viewportHeight,
  overscanPx
}: ProjectTranscriptWindowInput): TranscriptWindowProjection {
  const minTop = Math.max(scrollTop - Math.max(overscanPx, 0), 0);
  const maxBottom = scrollTop + Math.max(viewportHeight, 1) + Math.max(overscanPx, 0);

  const startIndex = lowerBound(layout.blocks, minTop);
  const endIndex = upperBound(layout.blocks, maxBottom);

  return {
    startIndex,
    endIndex
  };
}
