import { describe, expect, it } from "vitest";
import type { TranscriptLayoutResult, TranscriptViewportAnchor } from "./types";
import { projectTranscriptViewport, resolveTranscriptViewportAnchor } from "./projectTranscriptViewport";

const layout: TranscriptLayoutResult = {
  totalHeight: 320,
  blocks: [
    {
      blockId: "block-0",
      start: 0,
      end: 1000,
      top: 0,
      height: 48
    },
    {
      blockId: "block-1",
      start: 1000,
      end: 2000,
      top: 96,
      height: 48
    },
    {
      blockId: "block-2",
      start: 2000,
      end: 3000,
      top: 192,
      height: 48
    }
  ]
};

describe("resolveTranscriptViewportAnchor", () => {
  it("falls back to the active playback block when no explicit anchor is provided", () => {
    const anchor = resolveTranscriptViewportAnchor({
      layout,
      currentTime: 1500,
      previousAnchor: null,
      reason: "playback-follow"
    });

    expect(anchor).toMatchObject({
      blockId: "block-1",
      reason: "playback-follow",
      anchorBias: 0.5
    });
  });

  it("keeps playback-follow on the current playback block even when a loop anchor is provided", () => {
    const anchor = resolveTranscriptViewportAnchor({
      layout,
      currentTime: 1980,
      previousAnchor: null,
      reason: "playback-follow"
    });

    expect(anchor).toMatchObject({
      blockId: "block-1",
      reason: "playback-follow",
      anchorBias: 0.5
    });
  });

  it("reuses the previous anchor for non-playback reprojection", () => {
    const anchor = resolveTranscriptViewportAnchor({
      layout,
      currentTime: 2500,
      previousAnchor: {
        blockId: "block-1",
        reason: "seek-recenter",
        anchorBias: 0.5
      },
      reason: "resize-reproject"
    });

    expect(anchor).toEqual({
      blockId: "block-1",
      reason: "resize-reproject",
      anchorBias: 0.5
    });
  });
});

describe("projectTranscriptViewport", () => {
  it("reprojects an explicit seek anchor without consulting playback time", () => {
    const anchor: TranscriptViewportAnchor = {
      blockId: "block-1",
      reason: "seek-recenter",
      anchorBias: 0.5
    };

    const projection = projectTranscriptViewport({
      layout,
      anchor,
      viewportHeight: 160,
      followRatio: 0.4
    });

    expect(projection.activeBlockId).toBe("block-1");
    expect(projection.activeBlockIndex).toBe(1);
    expect(projection.targetScrollTop).toBe(56);
  });

  it("supports arbitrary block IDs when the transcript surface is reused", () => {
    const arbitraryLayout = {
      ...layout,
      blocks: layout.blocks.map((block, index) => ({
        ...block,
        blockId: index === 1 ? "preview-active" : `preview-${index}`
      }))
    };

    const projection = projectTranscriptViewport({
      layout: arbitraryLayout,
      anchor: {
        blockId: "preview-active",
        reason: "playback-follow",
        anchorBias: 0.5
      },
      viewportHeight: 160,
      followRatio: 0.4
    });

    expect(projection.activeBlockId).toBe("preview-active");
    expect(projection.activeBlockIndex).toBe(1);
    expect(projection.targetScrollTop).toBe(56);
  });

  it("returns no active block when the anchor is absent", () => {
    const projection = projectTranscriptViewport({
      layout,
      anchor: null,
      viewportHeight: 160,
      followRatio: 0.4
    });

    expect(projection.activeBlockId).toBeNull();
    expect(projection.activeBlockIndex).toBe(-1);
    expect(projection.targetScrollTop).toBeNull();
  });

  it("drops invalid anchors that no longer exist in layout", () => {
    const projection = projectTranscriptViewport({
      layout,
      anchor: {
        blockId: "missing",
        reason: "resize-reproject",
        anchorBias: 0.5
      },
      viewportHeight: 160,
      followRatio: 0.4
    });

    expect(projection.activeBlockId).toBeNull();
    expect(projection.targetScrollTop).toBeNull();
  });

  it("clamps the first block to the top of the reading surface", () => {
    const projection = projectTranscriptViewport({
      layout,
      anchor: {
        blockId: "block-0",
        reason: "playback-follow",
        anchorBias: 0.5
      },
      viewportHeight: 160,
      followRatio: 0.5
    });

    expect(projection.targetScrollTop).toBe(0);
  });

  it("can keep playback highlighting on one block while following a different fixed anchor", () => {
    const projection = projectTranscriptViewport({
      layout,
      anchor: {
        blockId: "block-1",
        reason: "playback-follow",
        anchorBias: 0.5
      },
      activeBlockId: "block-2",
      viewportHeight: 160,
      followRatio: 0.4
    });

    expect(projection.activeBlockId).toBe("block-2");
    expect(projection.activeBlockIndex).toBe(2);
    expect(projection.targetScrollTop).toBe(56);
  });
});
