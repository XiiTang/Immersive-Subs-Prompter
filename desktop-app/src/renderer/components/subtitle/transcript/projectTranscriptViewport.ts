import type {
  TranscriptLayoutBlock,
  TranscriptLayoutResult,
  TranscriptViewportAnchor,
  TranscriptViewportAnchorReason,
  TranscriptViewportProjection
} from "./types";

type ResolveTranscriptViewportAnchorInput = {
  layout: TranscriptLayoutResult;
  currentTime: number | null;
  previousAnchor: TranscriptViewportAnchor | null;
  reason: TranscriptViewportAnchorReason;
  loopAnchorBlockId?: string | null;
};

type ProjectTranscriptViewportInput = {
  layout: TranscriptLayoutResult;
  anchor: TranscriptViewportAnchor | null;
  viewportHeight: number;
  followRatio: number;
  activeBlockId?: string | null;
};

function findActiveBlockIndex(blocks: readonly TranscriptLayoutBlock[], currentTime: number): number {
  let lo = 0;
  let hi = blocks.length - 1;
  let candidate = -1;

  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    if (blocks[mid]!.start <= currentTime) {
      candidate = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  if (candidate === -1) return -1;

  const block = blocks[candidate]!;
  const isLastBlock = candidate === blocks.length - 1;
  return (isLastBlock ? currentTime <= block.end : currentTime < block.end) ? candidate : -1;
}

function findBlockIndexById(blocks: readonly TranscriptLayoutBlock[], blockId: string): number {
  for (let i = 0; i < blocks.length; i += 1) {
    if (blocks[i]!.blockId === blockId) {
      return i;
    }
  }
  return -1;
}

export function resolveTranscriptViewportAnchor({
  layout,
  currentTime,
  previousAnchor,
  reason,
  loopAnchorBlockId = null
}: ResolveTranscriptViewportAnchorInput): TranscriptViewportAnchor | null {
  // For non-playback reasons (resize, seek), reuse the previous anchor if it's still valid.
  // For playback-follow (including resume after pause), always re-derive from currentTime
  // so the anchor tracks the current playback position.
  if (previousAnchor && reason !== "playback-follow") {
    const anchorIndex = findBlockIndexById(layout.blocks, previousAnchor.blockId);
    if (anchorIndex !== -1) {
      return previousAnchor.reason === reason ? previousAnchor : { ...previousAnchor, reason };
    }
  }

  if (reason === "playback-follow" && loopAnchorBlockId) {
    const loopAnchorIndex = findBlockIndexById(layout.blocks, loopAnchorBlockId);
    if (loopAnchorIndex !== -1) {
      return {
        blockId: layout.blocks[loopAnchorIndex]!.blockId,
        reason,
        anchorBias: 0.5
      };
    }
  }

  const activeBlockIndex =
    currentTime === null ? -1 : findActiveBlockIndex(layout.blocks, currentTime);
  if (activeBlockIndex === -1) {
    return null;
  }

  return {
    blockId: layout.blocks[activeBlockIndex]!.blockId,
    reason,
    anchorBias: 0.5
  };
}

export function projectTranscriptViewport({
  layout,
  anchor,
  viewportHeight,
  followRatio,
  activeBlockId = null
}: ProjectTranscriptViewportInput): TranscriptViewportProjection {
  const safeViewportHeight = Math.max(viewportHeight, 1);
  const clampedFollowRatio = Math.max(0, Math.min(1, followRatio));
  const focusOffset = safeViewportHeight * clampedFollowRatio;

  if (!anchor) {
    return {
      activeBlockId: null,
      activeBlockIndex: -1,
      focusOffset,
      targetScrollTop: null
    };
  }

  const activeBlockIndex = findBlockIndexById(layout.blocks, anchor.blockId);
  if (activeBlockIndex === -1) {
    return {
      activeBlockId: null,
      activeBlockIndex: -1,
      focusOffset,
      targetScrollTop: null
    };
  }

  const activeBlock = layout.blocks[activeBlockIndex]!;
  const maxScrollTop = Math.max(layout.totalHeight - safeViewportHeight, 0);
  const anchorOffset = activeBlock.height * Math.max(0, Math.min(1, anchor.anchorBias));
  const targetScrollTop = Math.max(
    0,
    Math.min(activeBlock.top + anchorOffset - focusOffset, maxScrollTop)
  );
  const projectedActiveBlockId = activeBlockId ?? activeBlock.blockId;
  const projectedActiveBlockIndex =
    projectedActiveBlockId === activeBlock.blockId
      ? activeBlockIndex
      : findBlockIndexById(layout.blocks, projectedActiveBlockId);

  return {
    activeBlockId: projectedActiveBlockIndex === -1 ? null : projectedActiveBlockId,
    activeBlockIndex: projectedActiveBlockIndex,
    focusOffset,
    targetScrollTop
  };
}
