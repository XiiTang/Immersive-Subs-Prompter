# Pretext Transcript Virtualization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the transcript surface to use anchor-based viewport reprojection and block-level virtualized rendering on top of the existing `pretext` layout pipeline.

**Architecture:** Keep full-range `pretext` layout as the geometry source of truth, then split projection into two pure steps: anchor reprojection and block-window projection. Wire explicit seek requests from `SubtitleView.vue` into `TranscriptSurface.vue`, make selection/manual-pause state yield to explicit seek, and render only the projected block window while preserving block-level cue interactions.

**Tech Stack:** Vue 3, TypeScript, Pinia, Electron renderer, `@chenglou/pretext`, Vitest, Vue Test Utils, jsdom

## Implementation Status

- Status: implemented on `2026-04-10` in the current branch.
- Execution notes: followed this plan directly without subagents or a git worktree because the user explicitly requested in-place edits on the current branch.
- Execution notes: commit steps below were intentionally skipped; the changes were left uncommitted in the working tree.
- Verification: `npm --prefix desktop-app run test:renderer` passed with `10` files and `51` tests green.
- Verification: `npm --prefix desktop-app run build:renderer` passed.
- Verification note: `npx vue-tsc --project tsconfig.renderer.json --noEmit` was attempted, but the installed `vue-tsc` crashed before checking project types with `Search string not found: "/supportedTSExtensions = .*(?=;)/"`.

---

## File Structure

### New Files

- `desktop-app/src/renderer/components/subtitle/transcript/projectTranscriptWindow.ts`
  Purpose: Compute the visible block window from layout geometry, viewport scroll position, viewport height, and overscan.
- `desktop-app/src/renderer/components/subtitle/transcript/projectTranscriptWindow.test.ts`
  Purpose: Unit tests for block-window projection and overscan behavior.

### Modified Files

- `desktop-app/src/renderer/components/subtitle/transcript/types.ts`
  Purpose: Extend transcript layout and viewport types with anchor metadata, relative line offsets, seek requests, and window-projection outputs.
- `desktop-app/src/renderer/components/subtitle/transcript/pretextLayout.ts`
  Purpose: Enrich block and line layout metadata without changing `pretext` ownership of geometry.
- `desktop-app/src/renderer/components/subtitle/transcript/pretextLayout.test.ts`
  Purpose: Lock in the new metadata contract.
- `desktop-app/src/renderer/components/subtitle/transcript/projectTranscriptViewport.ts`
  Purpose: Replace the current active-block-center projection with anchor-driven reprojection.
- `desktop-app/src/renderer/components/subtitle/transcript/projectTranscriptViewport.test.ts`
  Purpose: Verify playback-follow, seek-recenter, resize-reproject, and fallback anchor behavior.
- `desktop-app/src/renderer/components/subtitle/composables/useTranscriptSelection.ts`
  Purpose: Add an explicit “resume now / clear pause” path for user-driven seek.
- `desktop-app/src/renderer/components/subtitle/TranscriptSurface.vue`
  Purpose: Consume the new projection outputs, track viewport scroll state, and render only the projected block slice.
- `desktop-app/src/renderer/components/subtitle/TranscriptSurface.test.ts`
  Purpose: Verify windowed rendering, seek override, resize reprojection, and remount-safe interaction semantics.
- `desktop-app/src/renderer/components/subtitle/SubtitleView.vue`
  Purpose: Emit explicit seek requests into the transcript surface for slider seeks and cue-based seeks.

## Task 1: Extend Transcript Geometry Metadata

**Files:**
- Modify: `desktop-app/src/renderer/components/subtitle/transcript/types.ts`
- Modify: `desktop-app/src/renderer/components/subtitle/transcript/pretextLayout.ts`
- Test: `desktop-app/src/renderer/components/subtitle/transcript/pretextLayout.test.ts`

- [x] **Step 1: Write the failing layout-metadata tests**

Add these assertions to `desktop-app/src/renderer/components/subtitle/transcript/pretextLayout.test.ts`:

```ts
  it("records block-relative line offsets for future line-aware projection", () => {
    const layout = layoutTranscriptBlocks({
      blocks,
      width: 180,
      fontSize: 16,
      lineHeight: 1.5,
      fontFamily: "Arial",
      primarySecondaryGap: 6,
      blockGap: 12
    });

    expect(layout.lines[0]).toMatchObject({
      blockId: "block-0",
      relativeTop: expect.any(Number)
    });
    expect(layout.lines[0]!.relativeTop).toBeGreaterThanOrEqual(0);
  });

```

- [x] **Step 2: Run the layout test file and confirm it fails on missing metadata**

Run: `npm --prefix desktop-app run test:renderer -- pretextLayout`

Expected: FAIL with TypeScript or matcher errors because `relativeTop` is not defined yet.

- [x] **Step 3: Extend the shared layout types**

Update `desktop-app/src/renderer/components/subtitle/transcript/types.ts` to add the new metadata:

```ts
export type TranscriptLayoutLine = {
  key: string;
  blockId: string;
  kind: TranscriptLayoutLineKind;
  text: string;
  top: number;
  height: number;
  relativeTop: number;
};
```

- [x] **Step 4: Populate the metadata in `layoutTranscriptBlocks`**

Update `desktop-app/src/renderer/components/subtitle/transcript/pretextLayout.ts` so every emitted line and block carries the new metadata:

```ts
      lines.push({
        key: `${block.id}-primary-${lineIndex}`,
        blockId: block.id,
        kind: "primary",
        text: line.text,
        top,
        height: primaryLinePixelHeight,
        relativeTop: top - blockTop
      });
```

Apply the same `relativeTop` field to secondary lines.

- [x] **Step 5: Re-run the layout test file**

Run: `npm --prefix desktop-app run test:renderer -- pretextLayout`

Expected: PASS with the new metadata assertions and all existing layout tests still green.

- [ ] **Step 6: Commit (intentionally skipped per user instruction)**

```bash
git add desktop-app/src/renderer/components/subtitle/transcript/types.ts \
  desktop-app/src/renderer/components/subtitle/transcript/pretextLayout.ts \
  desktop-app/src/renderer/components/subtitle/transcript/pretextLayout.test.ts
git commit -m "feat: add transcript layout anchor metadata"
```

## Task 2: Add Anchor Reprojection And Window Projection

**Files:**
- Modify: `desktop-app/src/renderer/components/subtitle/transcript/types.ts`
- Modify: `desktop-app/src/renderer/components/subtitle/transcript/projectTranscriptViewport.ts`
- Test: `desktop-app/src/renderer/components/subtitle/transcript/projectTranscriptViewport.test.ts`
- Create: `desktop-app/src/renderer/components/subtitle/transcript/projectTranscriptWindow.ts`
- Test: `desktop-app/src/renderer/components/subtitle/transcript/projectTranscriptWindow.test.ts`

- [x] **Step 1: Write the failing pure-projection tests**

Replace the current focus of `desktop-app/src/renderer/components/subtitle/transcript/projectTranscriptViewport.test.ts` with anchor-aware tests like these:

```ts
import type { TranscriptViewportAnchor } from "./types";

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
  expect(projection.targetScrollTop).toBe(56);
});

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
```

Create `desktop-app/src/renderer/components/subtitle/transcript/projectTranscriptWindow.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { projectTranscriptWindow } from "./projectTranscriptWindow";
import type { TranscriptLayoutResult } from "./types";

const layout: TranscriptLayoutResult = {
  totalHeight: 480,
  lines: [],
  blocks: [
    { blockId: "block-0", start: 0, end: 1000, top: 0, height: 80, lineStart: 0, lineCount: 0 },
    { blockId: "block-1", start: 1000, end: 2000, top: 96, height: 80, lineStart: 0, lineCount: 0 },
    { blockId: "block-2", start: 2000, end: 3000, top: 192, height: 80, lineStart: 0, lineCount: 0 },
    { blockId: "block-3", start: 3000, end: 4000, top: 288, height: 80, lineStart: 0, lineCount: 0 }
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
```

- [x] **Step 2: Run the projection tests and confirm they fail**

Run: `npm --prefix desktop-app run test:renderer -- projectTranscriptViewport projectTranscriptWindow`

Expected: FAIL because `TranscriptViewportAnchor`, `resolveTranscriptViewportAnchor`, and `projectTranscriptWindow` do not exist yet, and `projectTranscriptViewport` still expects `currentTime`.

- [x] **Step 3: Add the new viewport and window types**

Extend `desktop-app/src/renderer/components/subtitle/transcript/types.ts` with:

```ts
export type TranscriptViewportAnchorReason =
  | "playback-follow"
  | "seek-recenter"
  | "resize-reproject"
  | "resume-follow";

export type TranscriptViewportAnchor = {
  blockId: string;
  reason: TranscriptViewportAnchorReason;
  anchorBias: number;
};

export type TranscriptWindowProjection = {
  startIndex: number;
  endIndex: number;
};

export type TranscriptViewportProjection = {
  activeBlockId: string | null;
  activeBlockIndex: number;
  focusOffset: number;
  targetScrollTop: number | null;
};
```

- [x] **Step 4: Refactor viewport projection around anchors**

Update `desktop-app/src/renderer/components/subtitle/transcript/projectTranscriptViewport.ts` to export both anchor resolution and projection:

```ts
export function resolveTranscriptViewportAnchor({
  layout,
  currentTime,
  previousAnchor,
  reason
}: ResolveTranscriptViewportAnchorInput): TranscriptViewportAnchor | null {
  if (previousAnchor) {
    const anchorIndex = layout.blocks.findIndex((block) => block.blockId === previousAnchor.blockId);
    if (anchorIndex !== -1 && reason !== "playback-follow") {
      return previousAnchor.reason === reason ? previousAnchor : { ...previousAnchor, reason };
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
  followRatio
}: ProjectTranscriptViewportInput): TranscriptViewportProjection {
  if (!anchor) {
    return {
      activeBlockId: null,
      activeBlockIndex: -1,
      focusOffset: Math.max(viewportHeight, 1) * Math.max(0, Math.min(1, followRatio)),
      targetScrollTop: null
    };
  }

  const activeBlockIndex = layout.blocks.findIndex((block) => block.blockId === anchor.blockId);
  if (activeBlockIndex === -1) {
    return {
      activeBlockId: null,
      activeBlockIndex: -1,
      focusOffset: Math.max(viewportHeight, 1) * Math.max(0, Math.min(1, followRatio)),
      targetScrollTop: null
    };
  }

  const safeViewportHeight = Math.max(viewportHeight, 1);
  const focusOffset = safeViewportHeight * Math.max(0, Math.min(1, followRatio));
  const activeBlock = layout.blocks[activeBlockIndex]!;
  const anchorOffset = activeBlock.height * anchor.anchorBias;
  const maxScrollTop = Math.max(layout.totalHeight - safeViewportHeight, 0);

  return {
    activeBlockId: activeBlock.blockId,
    activeBlockIndex,
    focusOffset,
    targetScrollTop: Math.max(0, Math.min(activeBlock.top + anchorOffset - focusOffset, maxScrollTop))
  };
}
```

- [x] **Step 5: Implement block-window projection**

Create `desktop-app/src/renderer/components/subtitle/transcript/projectTranscriptWindow.ts`:

```ts
import type { TranscriptLayoutResult, TranscriptWindowProjection } from "./types";

type ProjectTranscriptWindowInput = {
  layout: TranscriptLayoutResult;
  scrollTop: number;
  viewportHeight: number;
  overscanPx: number;
};

export function projectTranscriptWindow({
  layout,
  scrollTop,
  viewportHeight,
  overscanPx
}: ProjectTranscriptWindowInput): TranscriptWindowProjection {
  const minTop = Math.max(scrollTop - Math.max(overscanPx, 0), 0);
  const maxBottom = scrollTop + Math.max(viewportHeight, 1) + Math.max(overscanPx, 0);

  let startIndex = 0;
  while (startIndex < layout.blocks.length && layout.blocks[startIndex]!.top + layout.blocks[startIndex]!.height < minTop) {
    startIndex += 1;
  }

  let endIndex = startIndex;
  while (endIndex < layout.blocks.length && layout.blocks[endIndex]!.top <= maxBottom) {
    endIndex += 1;
  }

  return {
    startIndex,
    endIndex
  };
}
```

- [x] **Step 6: Re-run the projection tests**

Run: `npm --prefix desktop-app run test:renderer -- projectTranscriptViewport projectTranscriptWindow`

Expected: PASS with anchor reprojection and overscan window behavior covered.

- [ ] **Step 7: Commit (intentionally skipped per user instruction)**

```bash
git add desktop-app/src/renderer/components/subtitle/transcript/types.ts \
  desktop-app/src/renderer/components/subtitle/transcript/projectTranscriptViewport.ts \
  desktop-app/src/renderer/components/subtitle/transcript/projectTranscriptViewport.test.ts \
  desktop-app/src/renderer/components/subtitle/transcript/projectTranscriptWindow.ts \
  desktop-app/src/renderer/components/subtitle/transcript/projectTranscriptWindow.test.ts
git commit -m "feat: add transcript anchor and window projection"
```

## Task 3: Add Explicit Seek Requests And Pause Override Hooks

**Files:**
- Modify: `desktop-app/src/renderer/components/subtitle/transcript/types.ts`
- Modify: `desktop-app/src/renderer/components/subtitle/composables/useTranscriptSelection.ts`
- Modify: `desktop-app/src/renderer/components/subtitle/SubtitleView.vue`
- Test: `desktop-app/src/renderer/components/subtitle/TranscriptSurface.test.ts`

- [x] **Step 1: Write the failing seek-override component test**

Add this test to `desktop-app/src/renderer/components/subtitle/TranscriptSurface.test.ts`:

```ts
  it("reclaims the focus band for an explicit seek even when selection pause is active", async () => {
    const wrapper = mount(TranscriptSurface, {
      attachTo: document.body,
      props: {
        blocks,
        currentTime: 300,
        loopCueIndex: null,
        abLoopStartCueIndex: null,
        subtitlePanelStyle: {},
        fontFamily: "Arial",
        fontSize: 16,
        lineHeight: 1.5,
        primarySecondaryGap: 6,
        blockGap: 12,
        primaryColor: "#fff",
        secondaryColor: "#ccc",
        activePrimaryColor: "#ff0",
        activeSecondaryColor: "#ee0",
        autoScrollDelayMs: 10,
        scrollPositionRatio: 0.4,
        seekRequest: { token: 1, time: 1300 }
      }
    });

    const viewport = wrapper.get(".transcript-surface__viewport").element;
    vi.spyOn(window, "getSelection").mockReturnValue({
      isCollapsed: false,
      anchorNode: viewport,
      focusNode: viewport
    } as unknown as Selection);
    document.dispatchEvent(new Event("selectionchange"));
    await nextTick();

    await wrapper.setProps({
      currentTime: 1300,
      seekRequest: { token: 2, time: 1300 }
    });
    await nextTick();

    expect(wrapper.get('[data-testid="transcript-surface"]').attributes("data-selection-paused")).toBe("false");
  });
```

- [x] **Step 2: Run the component test and confirm it fails**

Run: `npm --prefix desktop-app run test:renderer -- TranscriptSurface`

Expected: FAIL because `seekRequest` is not a prop and there is no selection-reset path.

- [x] **Step 3: Add seek-request and pause-control types**

Extend `desktop-app/src/renderer/components/subtitle/transcript/types.ts` with:

```ts
export type TranscriptSeekRequest = {
  token: number;
  time: number;
};
```

- [x] **Step 4: Expose an explicit resume path from `useTranscriptSelection`**

Update `desktop-app/src/renderer/components/subtitle/composables/useTranscriptSelection.ts` to return a pause-clearing helper for explicit seek without replaying the normal resume scroll:

```ts
  function clearAutoFollowPause() {
    clearResumeTimer();
    isSelectionPaused.value = false;
    isAutoFollowPaused.value = false;
    isPointerDown.value = false;
  }

  return {
    isSelectionPaused,
    isAutoFollowPaused,
    clearAutoFollowPause
  };
```

- [x] **Step 5: Emit explicit seek requests from `SubtitleView.vue`**

In `desktop-app/src/renderer/components/subtitle/SubtitleView.vue`, add:

```ts
const seekRequestToken = ref(0);
const seekRequest = ref<TranscriptSeekRequest | null>(null);

function issueSeekRequest(time: number) {
  seekRequestToken.value += 1;
  seekRequest.value = {
    token: seekRequestToken.value,
    time
  };
}
```

Call `issueSeekRequest(time)` inside `handleSeek(time)` and `issueSeekRequest(cue.start)` inside `seekToCue(index)`, then pass the prop through:

```vue
    <TranscriptSurface
      :blocks="transcriptBlocks"
      :current-time="displayedPlaybackTime"
      :seek-request="seekRequest"
```

- [x] **Step 6: Re-run the component test file**

Run: `npm --prefix desktop-app run test:renderer -- TranscriptSurface`

Expected: still FAIL, but now only because `TranscriptSurface.vue` has not consumed `seekRequest` yet.

- [ ] **Step 7: Commit (intentionally skipped per user instruction)**

```bash
git add desktop-app/src/renderer/components/subtitle/transcript/types.ts \
  desktop-app/src/renderer/components/subtitle/composables/useTranscriptSelection.ts \
  desktop-app/src/renderer/components/subtitle/SubtitleView.vue \
  desktop-app/src/renderer/components/subtitle/TranscriptSurface.test.ts
git commit -m "feat: add explicit transcript seek requests"
```

## Task 4: Window The Transcript Surface And Reproject On Resize/Seek

**Files:**
- Modify: `desktop-app/src/renderer/components/subtitle/TranscriptSurface.vue`
- Modify: `desktop-app/src/renderer/components/subtitle/TranscriptSurface.test.ts`

- [x] **Step 1: Add failing windowing and resize-reprojection tests**

Add these tests to `desktop-app/src/renderer/components/subtitle/TranscriptSurface.test.ts`:

```ts
  it("renders only the projected block window instead of every block", async () => {
    const manyBlocks = Array.from({ length: 40 }, (_, index) => ({
      id: `block-${index}`,
      start: index * 1000,
      end: (index + 1) * 1000,
      primaryText: `block ${index} text that wraps enough to produce height`,
      secondaryText: null,
      sourceCueRefs: { primaryCueIndex: index, secondaryCueIndex: null }
    }));

    const wrapper = mount(TranscriptSurface, {
      attachTo: document.body,
      props: {
        blocks: manyBlocks,
        currentTime: 0,
        loopCueIndex: null,
        abLoopStartCueIndex: null,
        subtitlePanelStyle: {},
        fontFamily: "Arial",
        fontSize: 16,
        lineHeight: 1.5,
        primarySecondaryGap: 6,
        blockGap: 12,
        primaryColor: "#fff",
        secondaryColor: "#ccc",
        activePrimaryColor: "#ff0",
        activeSecondaryColor: "#ee0",
        autoScrollDelayMs: 10,
        scrollPositionRatio: 0.4,
        seekRequest: null
      }
    });

    await nextTick();
    await nextTick();

    expect(wrapper.findAll(".transcript-block").length).toBeLessThan(manyBlocks.length);
  });

  it("reprojects the latest anchor on resize instead of preserving stale scrollTop", async () => {
    const wrapper = mount(TranscriptSurface, {
      attachTo: document.body,
      props: {
        blocks,
        currentTime: 1300,
        loopCueIndex: null,
        abLoopStartCueIndex: null,
        subtitlePanelStyle: {},
        fontFamily: "Arial",
        fontSize: 16,
        lineHeight: 1.5,
        primarySecondaryGap: 6,
        blockGap: 12,
        primaryColor: "#fff",
        secondaryColor: "#ccc",
        activePrimaryColor: "#ff0",
        activeSecondaryColor: "#ee0",
        autoScrollDelayMs: 10,
        scrollPositionRatio: 0.4,
        seekRequest: null
      }
    });

    const viewport = wrapper.get(".transcript-surface__viewport").element as HTMLElement;
    const scrollTo = vi.spyOn(viewport, "scrollTo").mockImplementation(() => {});

    window.dispatchEvent(new Event("resize"));
    await nextTick();
    await nextTick();

    expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ behavior: "auto" }));
  });
```

- [x] **Step 2: Run the component test file and confirm the new tests fail**

Run: `npm --prefix desktop-app run test:renderer -- TranscriptSurface`

Expected: FAIL because `TranscriptSurface.vue` still renders all blocks and resize still uses the old implicit projection flow.

- [x] **Step 3: Refactor `TranscriptSurface.vue` to own anchor state and window state**

Update the component props and state in `desktop-app/src/renderer/components/subtitle/TranscriptSurface.vue`:

```ts
import { projectTranscriptWindow } from "./transcript/projectTranscriptWindow";
import type {
  TranscriptBlock as TranscriptBlockModel,
  TranscriptSeekRequest,
  TranscriptViewportAnchor
} from "./transcript/types";

const props = defineProps<{
  blocks: TranscriptBlockModel[];
  currentTime: number | null;
  seekRequest: TranscriptSeekRequest | null;
  // existing props stay unchanged
}>();

const lastAnchor = ref<TranscriptViewportAnchor | null>(null);
const viewportScrollTop = ref(0);
const WINDOW_OVERSCAN_PX = 240;
```

Replace the old `projection` computed with the new anchor-first flow:

```ts
watch(
  () => props.currentTime,
  (currentTime) => {
    lastAnchor.value = resolveTranscriptViewportAnchor({
      layout: layout.value,
      currentTime,
      previousAnchor: lastAnchor.value,
      reason: "playback-follow"
    });
  },
  { immediate: true }
);

watch(
  () => props.seekRequest?.token,
  () => {
    if (!props.seekRequest) {
      return;
    }

    clearAutoFollowPause();
    lastAnchor.value = resolveTranscriptViewportAnchor({
      layout: layout.value,
      currentTime: props.seekRequest.time,
      previousAnchor: null,
      reason: "seek-recenter"
    });
    scrollToProjectedPosition("auto");
  }
);

const projection = computed(() =>
  projectTranscriptViewport({
    layout: layout.value,
    anchor: lastAnchor.value,
    viewportHeight: viewportHeight.value,
    followRatio: props.scrollPositionRatio
  })
);

const windowProjection = computed(() =>
  projectTranscriptWindow({
    layout: layout.value,
    scrollTop: viewportScrollTop.value,
    viewportHeight: viewportHeight.value,
    overscanPx: WINDOW_OVERSCAN_PX
  })
);
```

- [x] **Step 4: Slice rendered blocks to the projected window**

Replace the current `renderedBlocks` computed with:

```ts
const renderedBlocks = computed(() =>
  layout.value.blocks
    .slice(windowProjection.value.startIndex, windowProjection.value.endIndex)
    .map((layoutBlock) => ({
      block: blockById.value.get(layoutBlock.blockId)!,
      style: {
        top: `${layoutBlock.top}px`,
        height: `${layoutBlock.height}px`
      },
      lines: layout.value.lines
        .slice(layoutBlock.lineStart, layoutBlock.lineStart + layoutBlock.lineCount)
        .map((line) => ({
          ...line,
          top: line.relativeTop
        }))
    }))
);
```

Track scroll position on the viewport:

```ts
function handleViewportScroll() {
  const viewport = viewportRef.value;
  if (!viewport) {
    return;
  }
  viewportScrollTop.value = viewport.scrollTop;
}
```

and bind it:

```vue
    <div class="transcript-surface__viewport" ref="viewportRef" @scroll="handleViewportScroll">
```

- [x] **Step 5: Make resize and resume use explicit anchor reprojection**

Adjust the selection hook usage and resize handler:

```ts
const { isSelectionPaused, isAutoFollowPaused, clearAutoFollowPause } = useTranscriptSelection({
  rootEl: viewportRef,
  autoScrollDelayMs: computed(() => props.autoScrollDelayMs),
  onResume: () => {
    syncViewportMetrics();
    lastAnchor.value = resolveTranscriptViewportAnchor({
      layout: layout.value,
      currentTime: props.currentTime,
      previousAnchor: lastAnchor.value,
      reason: "resume-follow"
    });
    scrollToProjectedPosition("smooth");
  }
});

function handleResize() {
  syncViewportMetrics();
  lastAnchor.value = resolveTranscriptViewportAnchor({
    layout: layout.value,
    currentTime: props.currentTime,
    previousAnchor: lastAnchor.value,
    reason: "resize-reproject"
  });
  scrollToProjectedPosition("auto");
}
```

Do not modify `useTranscriptAutoFollow.ts` in this task. The existing duplicate-target guard is sufficient once `TranscriptSurface.vue` starts feeding it anchor-projected `targetScrollTop` values.

- [x] **Step 6: Run the full transcript-surface test file**

Run: `npm --prefix desktop-app run test:renderer -- TranscriptSurface`

Expected: PASS with the new windowing, explicit seek override, and resize reprojection behavior covered, plus all existing interaction tests still green.

- [x] **Step 7: Run the focused transcript test suite**

Run: `npm --prefix desktop-app run test:renderer -- transcript`

Expected: PASS with `pretextLayout`, `projectTranscriptViewport`, and `projectTranscriptWindow` all green.

- [ ] **Step 8: Commit (intentionally skipped per user instruction)**

```bash
git add desktop-app/src/renderer/components/subtitle/TranscriptSurface.vue \
  desktop-app/src/renderer/components/subtitle/TranscriptSurface.test.ts
git commit -m "feat: virtualize transcript surface rendering"
```

## Self-Review Checklist

- Spec coverage:
  - Full deterministic layout retained: Task 1
  - Unified anchor reprojection for playback/seek/resize/resume: Tasks 2 and 4
  - Block-window virtualization: Tasks 2 and 4
  - Explicit seek overrides paused selection/manual state: Tasks 3 and 4
- Placeholder scan:
  - No `TODO`, `TBD`, “handle later”, or “similar to above” language remains.
- Type consistency:
  - `relativeTop`, `TranscriptViewportAnchor`, `TranscriptWindowProjection`, and `TranscriptSeekRequest` are defined before later tasks consume them.
