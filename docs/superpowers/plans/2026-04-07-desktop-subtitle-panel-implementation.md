# Desktop Subtitle Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the desktop subtitle cue list with a `pretext`-driven continuous transcript reader that keeps cue actions as lightweight anchors.

**Architecture:** Build a new renderer-side transcript pipeline in three layers: transcript model, `pretext` layout model, and viewport projection. Integrate the new reading surface into `SubtitleView.vue`, preserve the existing top control area and existing panel-level status behavior, and delete the old cue-row-dominant rendering path instead of keeping a compatibility bridge.

**Implementation note:** The transcript surface should render the full reading flow. Do not trim DOM rendering to an active-playback window, and do not add a permanent focus-band overlay element. The focus band is a follow target for scroll positioning, not a standing translucent rectangle.

**Implementation note:** Subtitle font selection must use one curated named-font list shared by renderer settings and `pretext` layout. Do not allow arbitrary font-family input, and do not split measurement fonts from rendered fonts.

**Implementation note:** Do not keep a separate subtitle line-spacing setting for transcript blocks. Block-to-block spacing is derived from transcript typography; user-configurable spacing is limited to line height and primary-secondary gap.

**Implementation note:** The control cap overlays the reading surface. Control-cap height changes must not shift or resize the transcript surface.

**Tech Stack:** Vue 3, Pinia, TypeScript, Electron renderer, `@chenglou/pretext`, Vitest, Vue Test Utils, jsdom

---

## File Structure

### New Files

- `desktop-app/vitest.config.ts`
  Purpose: Vitest config for renderer-side unit/component tests.
- `desktop-app/src/renderer/components/subtitle/transcript/types.ts`
  Purpose: Shared transcript model and layout types.
- `desktop-app/src/renderer/components/subtitle/transcript/buildTranscriptBlocks.ts`
  Purpose: Convert selected subtitle tracks into reading blocks with cue refs.
- `desktop-app/src/renderer/components/subtitle/transcript/buildTranscriptBlocks.test.ts`
  Purpose: Unit tests for reading-block generation.
- `desktop-app/src/renderer/components/subtitle/transcript/pretextLayout.ts`
  Purpose: Prepare and layout transcript blocks with `pretext`.
- `desktop-app/src/renderer/components/subtitle/transcript/pretextLayout.test.ts`
  Purpose: Unit tests for line ownership and width-driven relayout.
- `desktop-app/src/renderer/components/subtitle/transcript/projectTranscriptViewport.ts`
  Purpose: Compute active block, visible range, and focus-band projection.
- `desktop-app/src/renderer/components/subtitle/transcript/projectTranscriptViewport.test.ts`
  Purpose: Unit tests for active-block mapping and viewport projection.
- `desktop-app/src/renderer/components/subtitle/composables/useTranscriptSelection.ts`
  Purpose: Pause and resume auto-follow around text selection and manual scrolling.
- `desktop-app/src/renderer/components/subtitle/composables/useTranscriptAutoFollow.ts`
  Purpose: Focus-band follow behavior for the new transcript surface.
- `desktop-app/src/renderer/components/subtitle/TranscriptSurface.vue`
  Purpose: Main continuous reading surface.
- `desktop-app/src/renderer/components/subtitle/TranscriptBlock.vue`
  Purpose: Render one reading block with primary/secondary text and activity styling.
- `desktop-app/src/renderer/components/subtitle/CueAnchorRail.vue`
  Purpose: Render lightweight cue actions for active or hovered blocks.
- `desktop-app/src/renderer/components/subtitle/TranscriptSurface.test.ts`
  Purpose: Component tests for seek, loop, A-B, and selection/follow interaction.

### Modified Files

- `desktop-app/package.json`
  Purpose: Add `@chenglou/pretext` and test scripts/dev dependencies.
- `desktop-app/src/renderer/stores/desktop.ts`
  Purpose: Expose transcript-ready getters and stop centering renderer state around `CombinedCue[]`.
- `desktop-app/src/renderer/components/subtitle/SubtitleView.vue`
  Purpose: Replace `SubtitleScrollSection` usage with `TranscriptSurface`.
- `desktop-app/src/renderer/style.css`
  Purpose: Add transcript-reader styles and remove old cue-list styles.

### Deleted Files

- `desktop-app/src/renderer/components/subtitle/SubtitleScrollSection.vue`
- `desktop-app/src/renderer/components/subtitle/SubtitleItem.vue`
- `desktop-app/src/renderer/components/subtitle/composables/useAutoScroll.ts`

Delete these only after the new transcript surface is wired and tested.

## Task 1: Add Test And Layout Dependencies

**Files:**
- Modify: `desktop-app/package.json`
- Create: `desktop-app/vitest.config.ts`

- [ ] **Step 1: Write the failing config file import test**

Create `desktop-app/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import vue from "@vitejs/plugin-vue";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url))
    }
  },
  test: {
    environment: "jsdom",
    globals: true,
    include: ["src/renderer/**/*.test.ts"]
  }
});
```

- [ ] **Step 2: Update `desktop-app/package.json` with missing test and layout dependencies**

Replace the relevant parts of `desktop-app/package.json` with:

```json
{
  "scripts": {
    "build": "npm run clean && npm run build:main && npm run build:preload && npm run build:renderer",
    "build:main": "tsc --project tsconfig.json",
    "build:preload": "tsc --project tsconfig.preload.json",
    "build:renderer": "vite build",
    "dev:renderer": "vite dev",
    "test:renderer": "vitest run",
    "test:renderer:watch": "vitest",
    "start": "npm run build && electron ."
  },
  "dependencies": {
    "@chenglou/pretext": "^0.0.0",
    "pinia": "^2.1.7",
    "vue": "^3.4.21"
  },
  "devDependencies": {
    "@vue/test-utils": "^2.4.6",
    "jsdom": "^24.1.0",
    "vitest": "^2.1.1"
  }
}
```

Keep the existing unrelated dependencies in place.

- [ ] **Step 3: Install dependencies and verify Vitest boots**

Run: `npm --prefix desktop-app install`

Expected: install completes and updates `package-lock.json` without script errors.

- [ ] **Step 4: Run the empty renderer test suite**

Run: `npm --prefix desktop-app run test:renderer`

Expected: PASS with output indicating no test files were found yet, or zero tests executed successfully.

- [ ] **Step 5: Commit**

```bash
git add desktop-app/package.json desktop-app/package-lock.json desktop-app/vitest.config.ts
git commit -m "test: add renderer vitest setup"
```

## Task 2: Build The Transcript Model

**Files:**
- Create: `desktop-app/src/renderer/components/subtitle/transcript/types.ts`
- Create: `desktop-app/src/renderer/components/subtitle/transcript/buildTranscriptBlocks.ts`
- Test: `desktop-app/src/renderer/components/subtitle/transcript/buildTranscriptBlocks.test.ts`

- [ ] **Step 1: Write the failing transcript-model tests**

Create `desktop-app/src/renderer/components/subtitle/transcript/buildTranscriptBlocks.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildTranscriptBlocks } from "./buildTranscriptBlocks";
import type { SubtitleCue } from "../../../../main/types";

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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix desktop-app run test:renderer -- buildTranscriptBlocks`

Expected: FAIL with module-not-found errors for `buildTranscriptBlocks` and shared types.

- [ ] **Step 3: Write minimal transcript model implementation**

Create `desktop-app/src/renderer/components/subtitle/transcript/types.ts`:

```ts
export type TranscriptCueRefs = {
  primaryCueIndex: number;
  secondaryCueIndex: number | null;
};

export type TranscriptBlock = {
  id: string;
  start: number;
  end: number;
  primaryText: string;
  secondaryText: string | null;
  sourceCueRefs: TranscriptCueRefs;
};

export type BuildTranscriptBlocksInput = {
  primaryCues: Array<{ start: number; end: number; text: string }>;
  secondaryCues: Array<{ start: number; end: number; text: string }>;
};
```

Create `desktop-app/src/renderer/components/subtitle/transcript/buildTranscriptBlocks.ts`:

```ts
import type { BuildTranscriptBlocksInput, TranscriptBlock } from "./types";

function normalizeText(text: string): string {
  return text.trim();
}

function getOverlap(startA: number, endA: number, startB: number, endB: number): number {
  return Math.min(endA, endB) - Math.max(startA, startB);
}

export function buildTranscriptBlocks({
  primaryCues,
  secondaryCues
}: BuildTranscriptBlocksInput): TranscriptBlock[] {
  const blocks: TranscriptBlock[] = [];
  let secondaryStartIndex = 0;

  for (let primaryCueIndex = 0; primaryCueIndex < primaryCues.length; primaryCueIndex += 1) {
    const primary = primaryCues[primaryCueIndex]!;
    const primaryText = normalizeText(primary.text);
    if (!primaryText) continue;

    while (
      secondaryStartIndex < secondaryCues.length &&
      secondaryCues[secondaryStartIndex]!.end < primary.start
    ) {
      secondaryStartIndex += 1;
    }

    let bestSecondaryIndex: number | null = null;
    let bestOverlap = -1;

    for (let i = secondaryStartIndex; i < secondaryCues.length; i += 1) {
      const candidate = secondaryCues[i]!;
      if (candidate.start > primary.end) break;
      const overlap = getOverlap(primary.start, primary.end, candidate.start, candidate.end);
      if (overlap >= 0 && overlap >= bestOverlap) {
        bestOverlap = overlap;
        bestSecondaryIndex = i;
      }
    }

    blocks.push({
      id: `block-${blocks.length}`,
      start: primary.start,
      end: primary.end,
      primaryText,
      secondaryText:
        bestSecondaryIndex === null ? null : normalizeText(secondaryCues[bestSecondaryIndex]!.text) || null,
      sourceCueRefs: {
        primaryCueIndex,
        secondaryCueIndex: bestSecondaryIndex
      }
    });
  }

  return blocks;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix desktop-app run test:renderer -- buildTranscriptBlocks`

Expected: PASS with 3 tests passing.

- [ ] **Step 5: Commit**

```bash
git add desktop-app/src/renderer/components/subtitle/transcript/types.ts \
  desktop-app/src/renderer/components/subtitle/transcript/buildTranscriptBlocks.ts \
  desktop-app/src/renderer/components/subtitle/transcript/buildTranscriptBlocks.test.ts
git commit -m "feat: add transcript block model"
```

## Task 3: Add The Pretext Layout Model

**Files:**
- Modify: `desktop-app/src/renderer/components/subtitle/transcript/types.ts`
- Create: `desktop-app/src/renderer/components/subtitle/transcript/pretextLayout.ts`
- Test: `desktop-app/src/renderer/components/subtitle/transcript/pretextLayout.test.ts`

- [ ] **Step 1: Write the failing layout-model tests**

Create `desktop-app/src/renderer/components/subtitle/transcript/pretextLayout.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createTranscriptLayout } from "./pretextLayout";
import type { TranscriptBlock } from "./types";

const blocks: TranscriptBlock[] = [
  {
    id: "block-0",
    start: 0,
    end: 1200,
    primaryText: "A long primary line that should wrap when width is narrow.",
    secondaryText: "A shorter translation.",
    sourceCueRefs: { primaryCueIndex: 0, secondaryCueIndex: 0 }
  }
];

describe("createTranscriptLayout", () => {
  it("returns line ownership for primary and secondary text", () => {
    const result = createTranscriptLayout(blocks, {
      width: 220,
      primaryFont: '500 18px "Helvetica Neue"',
      secondaryFont: '400 16px "Helvetica Neue"',
      primaryLineHeight: 28,
      secondaryLineHeight: 24,
      blockGap: 12,
      secondaryGap: 6
    });

    expect(result.blocks).toHaveLength(1);
    expect(result.blocks[0]?.lines.length).toBeGreaterThan(1);
    expect(result.blocks[0]?.lines.some(line => line.tier === "secondary")).toBe(true);
  });

  it("reflows to fewer lines at wider widths", () => {
    const narrow = createTranscriptLayout(blocks, {
      width: 180,
      primaryFont: '500 18px "Helvetica Neue"',
      secondaryFont: '400 16px "Helvetica Neue"',
      primaryLineHeight: 28,
      secondaryLineHeight: 24,
      blockGap: 12,
      secondaryGap: 6
    });
    const wide = createTranscriptLayout(blocks, {
      width: 420,
      primaryFont: '500 18px "Helvetica Neue"',
      secondaryFont: '400 16px "Helvetica Neue"',
      primaryLineHeight: 28,
      secondaryLineHeight: 24,
      blockGap: 12,
      secondaryGap: 6
    });

    expect(narrow.blocks[0]!.lines.length).toBeGreaterThan(wide.blocks[0]!.lines.length);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix desktop-app run test:renderer -- pretextLayout`

Expected: FAIL with missing export `createTranscriptLayout`.

- [ ] **Step 3: Write minimal `pretext` layout implementation**

Append to `desktop-app/src/renderer/components/subtitle/transcript/types.ts`:

```ts
export type TranscriptLine = {
  blockId: string;
  tier: "primary" | "secondary";
  text: string;
  width: number;
  top: number;
  height: number;
};

export type TranscriptBlockLayout = {
  block: TranscriptBlock;
  top: number;
  height: number;
  lines: TranscriptLine[];
};

export type TranscriptLayout = {
  width: number;
  totalHeight: number;
  blocks: TranscriptBlockLayout[];
};
```

Create `desktop-app/src/renderer/components/subtitle/transcript/pretextLayout.ts`:

```ts
import { layoutWithLines, prepareWithSegments } from "@chenglou/pretext";
import type { TranscriptBlock, TranscriptBlockLayout, TranscriptLayout, TranscriptLine } from "./types";

type LayoutOptions = {
  width: number;
  primaryFont: string;
  secondaryFont: string;
  primaryLineHeight: number;
  secondaryLineHeight: number;
  blockGap: number;
  secondaryGap: number;
};

function createLines(
  block: TranscriptBlock,
  tier: "primary" | "secondary",
  text: string,
  font: string,
  lineHeight: number,
  startTop: number,
  width: number
): { lines: TranscriptLine[]; nextTop: number } {
  const prepared = prepareWithSegments(text, font);
  const layout = layoutWithLines(prepared, width, lineHeight);
  const lines = layout.lines.map((line, index) => ({
    blockId: block.id,
    tier,
    text: line.text,
    width: line.width,
    top: startTop + index * lineHeight,
    height: lineHeight
  }));
  return { lines, nextTop: startTop + layout.height };
}

export function createTranscriptLayout(
  blocks: TranscriptBlock[],
  options: LayoutOptions
): TranscriptLayout {
  const layouts: TranscriptBlockLayout[] = [];
  let currentTop = 0;

  for (const block of blocks) {
    const blockTop = currentTop;
    const primary = createLines(
      block,
      "primary",
      block.primaryText,
      options.primaryFont,
      options.primaryLineHeight,
      currentTop,
      options.width
    );

    currentTop = primary.nextTop;
    let lines = [...primary.lines];

    if (block.secondaryText) {
      currentTop += options.secondaryGap;
      const secondary = createLines(
        block,
        "secondary",
        block.secondaryText,
        options.secondaryFont,
        options.secondaryLineHeight,
        currentTop,
        options.width
      );
      lines = [...lines, ...secondary.lines];
      currentTop = secondary.nextTop;
    }

    layouts.push({
      block,
      top: blockTop,
      height: currentTop - blockTop,
      lines
    });

    currentTop += options.blockGap;
  }

  return {
    width: options.width,
    totalHeight: Math.max(0, currentTop - options.blockGap),
    blocks: layouts
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix desktop-app run test:renderer -- pretextLayout`

Expected: PASS with 2 tests passing.

- [ ] **Step 5: Commit**

```bash
git add desktop-app/src/renderer/components/subtitle/transcript/types.ts \
  desktop-app/src/renderer/components/subtitle/transcript/pretextLayout.ts \
  desktop-app/src/renderer/components/subtitle/transcript/pretextLayout.test.ts
git commit -m "feat: add pretext transcript layout model"
```

## Task 4: Add Viewport Projection And Focus-Band Follow

**Files:**
- Modify: `desktop-app/src/renderer/components/subtitle/transcript/types.ts`
- Create: `desktop-app/src/renderer/components/subtitle/transcript/projectTranscriptViewport.ts`
- Create: `desktop-app/src/renderer/components/subtitle/transcript/projectTranscriptViewport.test.ts`
- Create: `desktop-app/src/renderer/components/subtitle/composables/useTranscriptSelection.ts`
- Create: `desktop-app/src/renderer/components/subtitle/composables/useTranscriptAutoFollow.ts`

- [ ] **Step 1: Write the failing viewport tests**

Create `desktop-app/src/renderer/components/subtitle/transcript/projectTranscriptViewport.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { projectTranscriptViewport } from "./projectTranscriptViewport";
import type { TranscriptLayout } from "./types";

const layout: TranscriptLayout = {
  width: 320,
  totalHeight: 240,
  blocks: [
    {
      block: {
        id: "block-0",
        start: 0,
        end: 1000,
        primaryText: "one",
        secondaryText: null,
        sourceCueRefs: { primaryCueIndex: 0, secondaryCueIndex: null }
      },
      top: 0,
      height: 60,
      lines: []
    },
    {
      block: {
        id: "block-1",
        start: 1000,
        end: 2000,
        primaryText: "two",
        secondaryText: null,
        sourceCueRefs: { primaryCueIndex: 1, secondaryCueIndex: null }
      },
      top: 80,
      height: 60,
      lines: []
    }
  ]
};

describe("projectTranscriptViewport", () => {
  it("maps playback time to the active block", () => {
    const projection = projectTranscriptViewport(layout, {
      currentTime: 1500,
      viewportHeight: 180,
      focusRatio: 0.38,
      contextBlockCount: 1
    });

    expect(projection.activeBlockId).toBe("block-1");
    expect(projection.scrollTop).toBeGreaterThanOrEqual(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix desktop-app run test:renderer -- projectTranscriptViewport`

Expected: FAIL with missing module or export.

- [ ] **Step 3: Write minimal projection and follow utilities**

Append to `desktop-app/src/renderer/components/subtitle/transcript/types.ts`:

```ts
export type TranscriptViewportProjection = {
  activeBlockId: string | null;
  visibleBlockIds: string[];
  scrollTop: number;
};
```

Create `desktop-app/src/renderer/components/subtitle/transcript/projectTranscriptViewport.ts`:

```ts
import type { TranscriptLayout, TranscriptViewportProjection } from "./types";

type ProjectionOptions = {
  currentTime: number | null;
  viewportHeight: number;
  focusRatio: number;
  contextBlockCount: number;
};

export function projectTranscriptViewport(
  layout: TranscriptLayout,
  options: ProjectionOptions
): TranscriptViewportProjection {
  const activeBlock =
    options.currentTime === null
      ? null
      : layout.blocks.find(block => options.currentTime! >= block.block.start && options.currentTime! <= block.block.end) ?? null;

  const activeIndex = activeBlock ? layout.blocks.findIndex(block => block.block.id === activeBlock.block.id) : -1;
  const startIndex = activeIndex === -1 ? 0 : Math.max(0, activeIndex - options.contextBlockCount);
  const endIndex =
    activeIndex === -1
      ? Math.min(layout.blocks.length, options.contextBlockCount * 2 + 1)
      : Math.min(layout.blocks.length, activeIndex + options.contextBlockCount + 1);

  const scrollTop =
    activeBlock === null
      ? 0
      : Math.max(
          0,
          activeBlock.top - options.viewportHeight * options.focusRatio + activeBlock.height / 2
        );

  return {
    activeBlockId: activeBlock?.block.id ?? null,
    visibleBlockIds: layout.blocks.slice(startIndex, endIndex).map(block => block.block.id),
    scrollTop
  };
}
```

Create `desktop-app/src/renderer/components/subtitle/composables/useTranscriptSelection.ts`:

```ts
import { onBeforeUnmount, onMounted, ref } from "vue";

export function useTranscriptSelection(containerRef: { value: HTMLElement | null }) {
  const hasSelection = ref(false);

  function updateSelectionState() {
    const selection = window.getSelection();
    const container = containerRef.value;
    hasSelection.value = Boolean(
      selection &&
      container &&
      !selection.isCollapsed &&
      (container.contains(selection.anchorNode) || container.contains(selection.focusNode))
    );
  }

  onMounted(() => document.addEventListener("selectionchange", updateSelectionState));
  onBeforeUnmount(() => document.removeEventListener("selectionchange", updateSelectionState));

  return { hasSelection };
}
```

Create `desktop-app/src/renderer/components/subtitle/composables/useTranscriptAutoFollow.ts`:

```ts
import { nextTick, watch } from "vue";
import type { Ref } from "vue";

export function useTranscriptAutoFollow(
  scrollRef: Ref<HTMLElement | null>,
  scrollTop: Ref<number>,
  hasSelection: Ref<boolean>
) {
  watch(
    [scrollTop, hasSelection],
    async ([nextScrollTop, selectionActive]) => {
      if (selectionActive) return;
      await nextTick();
      scrollRef.value?.scrollTo({ top: nextScrollTop, behavior: "smooth" });
    },
    { immediate: true }
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix desktop-app run test:renderer -- projectTranscriptViewport`

Expected: PASS with 1 test passing.

- [ ] **Step 5: Commit**

```bash
git add desktop-app/src/renderer/components/subtitle/transcript/types.ts \
  desktop-app/src/renderer/components/subtitle/transcript/projectTranscriptViewport.ts \
  desktop-app/src/renderer/components/subtitle/transcript/projectTranscriptViewport.test.ts \
  desktop-app/src/renderer/components/subtitle/composables/useTranscriptSelection.ts \
  desktop-app/src/renderer/components/subtitle/composables/useTranscriptAutoFollow.ts
git commit -m "feat: add transcript viewport projection"
```

## Task 5: Replace The Cue List With The Transcript Surface

**Files:**
- Create: `desktop-app/src/renderer/components/subtitle/CueAnchorRail.vue`
- Create: `desktop-app/src/renderer/components/subtitle/TranscriptBlock.vue`
- Create: `desktop-app/src/renderer/components/subtitle/TranscriptSurface.vue`
- Modify: `desktop-app/src/renderer/components/subtitle/SubtitleView.vue`
- Modify: `desktop-app/src/renderer/stores/desktop.ts`
- Test: `desktop-app/src/renderer/components/subtitle/TranscriptSurface.test.ts`

- [ ] **Step 1: Write the failing transcript-surface component tests**

Create `desktop-app/src/renderer/components/subtitle/TranscriptSurface.test.ts`:

```ts
import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import TranscriptSurface from "./TranscriptSurface.vue";
import type { TranscriptBlock } from "./transcript/types";

const blocks: TranscriptBlock[] = [
  {
    id: "block-0",
    start: 0,
    end: 1000,
    primaryText: "Hello world",
    secondaryText: "你好，世界",
    sourceCueRefs: { primaryCueIndex: 0, secondaryCueIndex: 0 }
  }
];

describe("TranscriptSurface", () => {
  it("emits seek when a block is clicked", async () => {
    const wrapper = mount(TranscriptSurface, {
      props: {
        blocks,
        currentTime: 500,
        panelStyle: {},
        typography: {
          primaryFont: '500 18px "Helvetica Neue"',
          secondaryFont: '400 16px "Helvetica Neue"',
          primaryLineHeight: 28,
          secondaryLineHeight: 24,
          blockGap: 12,
          secondaryGap: 6,
          focusRatio: 0.38,
          contextBlockCount: 2
        }
      }
    });

    await wrapper.find("[data-block-id='block-0']").trigger("click");
    expect(wrapper.emitted("seek-block")?.[0]).toEqual([0]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix desktop-app run test:renderer -- TranscriptSurface`

Expected: FAIL with missing component files and missing props/types.

- [ ] **Step 3: Add minimal store getter and transcript surface components**

Append to `desktop-app/src/renderer/stores/desktop.ts` getters:

```ts
    transcriptSource(state) {
      return {
        primaryCues: state.desktopState?.primarySubtitles?.cues ?? [],
        secondaryCues: state.desktopState?.secondarySubtitles?.cues ?? []
      };
    },
```

Create `desktop-app/src/renderer/components/subtitle/CueAnchorRail.vue`:

```vue
<template>
  <div class="transcript-block__cue-actions">
    <span>{{ timeLabel }}</span>
    <button type="button" @click="$emit('seek')">▶</button>
    <button type="button" @click="$emit('ab')">{{ abLabel }}</button>
    <button type="button" @click="$emit('loop')">↻</button>
  </div>
</template>

<script setup lang="ts">
defineProps<{ abLabel: "A" | "B" }>();
defineEmits<{ (e: "seek"): void; (e: "loop"): void; (e: "ab"): void }>();
</script>
```

Create `desktop-app/src/renderer/components/subtitle/TranscriptBlock.vue`:

```vue
<template>
  <article
    class="transcript-block"
    :class="{ 'transcript-block--active': isActive }"
    :data-block-id="block.id"
    @click="$emit('seek')"
  >
    <CueAnchorRail
      :visible="showAnchors"
      :ab-label="abLabel"
      :time-label="timeLabel"
      @seek.stop="$emit('seek')"
      @loop.stop="$emit('loop')"
      @ab.stop="$emit('ab')"
    />
    <div class="transcript-block__primary">{{ block.primaryText }}</div>
    <div v-if="block.secondaryText" class="transcript-block__secondary">{{ block.secondaryText }}</div>
  </article>
</template>

<script setup lang="ts">
import CueAnchorRail from "./CueAnchorRail.vue";
import type { TranscriptBlock as TranscriptBlockModel } from "./transcript/types";

defineProps<{
  block: TranscriptBlockModel;
  isActive: boolean;
  showAnchors: boolean;
  abLabel: "A" | "B";
}>();

defineEmits<{ (e: "seek"): void; (e: "loop"): void; (e: "ab"): void }>();
</script>
```

Create `desktop-app/src/renderer/components/subtitle/TranscriptSurface.vue`:

```vue
<template>
  <section class="transcript-surface" :style="panelStyle" ref="scrollRef">
    <TranscriptBlock
      v-for="block in blocks"
      :key="block.id"
      :block="block"
      :is-active="block.id === activeBlockId"
      :show-anchors="block.id === activeBlockId"
      :ab-label="abStartBlockId === null || abStartBlockId === block.id ? 'A' : 'B'"
      @seek="$emit('seek-block', block.start)"
      @loop="$emit('loop-block', block.id)"
      @ab="$emit('ab-block', block.id)"
    />
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import TranscriptBlock from "./TranscriptBlock.vue";
import { projectTranscriptViewport } from "./transcript/projectTranscriptViewport";
import { createTranscriptLayout } from "./transcript/pretextLayout";
import { useTranscriptSelection } from "./composables/useTranscriptSelection";
import { useTranscriptAutoFollow } from "./composables/useTranscriptAutoFollow";
import type { TranscriptBlock as TranscriptBlockModel } from "./transcript/types";

const props = defineProps<{
  blocks: TranscriptBlockModel[];
  currentTime: number | null;
  panelStyle: Record<string, string>;
  typography: {
    primaryFont: string;
    secondaryFont: string;
    primaryLineHeight: number;
    secondaryLineHeight: number;
    blockGap: number;
    secondaryGap: number;
    focusRatio: number;
    contextBlockCount: number;
  };
  abStartBlockId?: string | null;
}>();

defineEmits<{
  (e: "seek-block", start: number): void;
  (e: "loop-block", blockId: string): void;
  (e: "ab-block", blockId: string): void;
}>();

const scrollRef = ref<HTMLElement | null>(null);
const layout = computed(() =>
  createTranscriptLayout(props.blocks, {
    width: 480,
    primaryFont: props.typography.primaryFont,
    secondaryFont: props.typography.secondaryFont,
    primaryLineHeight: props.typography.primaryLineHeight,
    secondaryLineHeight: props.typography.secondaryLineHeight,
    blockGap: props.typography.blockGap,
    secondaryGap: props.typography.secondaryGap
  })
);
const projection = computed(() =>
  projectTranscriptViewport(layout.value, {
    currentTime: props.currentTime,
    viewportHeight: 600,
    focusRatio: props.typography.focusRatio,
    contextBlockCount: props.typography.contextBlockCount
  })
);
const activeBlockId = computed(() => projection.value.activeBlockId);
const { hasSelection } = useTranscriptSelection(scrollRef);
const projectedScrollTop = computed(() => projection.value.scrollTop);
useTranscriptAutoFollow(scrollRef, projectedScrollTop, hasSelection);
</script>
```

Modify the `SubtitleView.vue` template block:

```vue
    <TranscriptSurface
      :blocks="transcriptBlocks"
      :current-time="displayedPlaybackTime"
      :panel-style="subtitlePanelStyle"
      :typography="transcriptTypography"
      :ab-start-block-id="abStartBlockId"
      @seek-block="seekToBlockStart"
      @loop-block="toggleLoopBlock"
      @ab-block="handleAbLoopBlock"
    />
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix desktop-app run test:renderer -- TranscriptSurface`

Expected: PASS with 1 component test passing.

- [ ] **Step 5: Commit**

```bash
git add desktop-app/src/renderer/stores/desktop.ts \
  desktop-app/src/renderer/components/subtitle/CueAnchorRail.vue \
  desktop-app/src/renderer/components/subtitle/TranscriptBlock.vue \
  desktop-app/src/renderer/components/subtitle/TranscriptSurface.vue \
  desktop-app/src/renderer/components/subtitle/TranscriptSurface.test.ts \
  desktop-app/src/renderer/components/subtitle/SubtitleView.vue
git commit -m "feat: replace cue list with transcript surface"
```

## Task 6: Remove The Old Cue-List Path And Finish Reader Styling

**Files:**
- Delete: `desktop-app/src/renderer/components/subtitle/SubtitleScrollSection.vue`
- Delete: `desktop-app/src/renderer/components/subtitle/SubtitleItem.vue`
- Delete: `desktop-app/src/renderer/components/subtitle/composables/useAutoScroll.ts`
- Modify: `desktop-app/src/renderer/style.css`
- Modify: `desktop-app/src/renderer/components/subtitle/SubtitleView.vue`

- [ ] **Step 1: Write the failing integration assertions**

Extend `desktop-app/src/renderer/components/subtitle/TranscriptSurface.test.ts` with:

```ts
  it("does not render legacy cue list classes", () => {
    const wrapper = mount(TranscriptSurface, {
      props: {
        blocks,
        currentTime: 500,
        panelStyle: {},
        typography: {
          primaryFont: '500 18px "Helvetica Neue"',
          secondaryFont: '400 16px "Helvetica Neue"',
          primaryLineHeight: 28,
          secondaryLineHeight: 24,
          blockGap: 12,
          secondaryGap: 6,
          focusRatio: 0.38,
          contextBlockCount: 2
        }
      }
    });

    expect(wrapper.find(".subtitle-list").exists()).toBe(false);
    expect(wrapper.find(".subtitle-item").exists()).toBe(false);
  });
```

- [ ] **Step 2: Run test to verify it fails if legacy classes remain**

Run: `npm --prefix desktop-app run test:renderer -- TranscriptSurface`

Expected: FAIL while `SubtitleView.vue` or styles still assume legacy list structure.

- [ ] **Step 3: Delete legacy files and replace CSS with reader styles**

Replace the old cue-list CSS block in `desktop-app/src/renderer/style.css` with:

```css
.transcript-surface {
  position: absolute;
  inset: 0;
  overflow-y: auto;
  padding: calc(var(--header-height) + 132px) 24px 32px;
  background: rgba(18, 18, 18, var(--panel-opacity-factor));
  user-select: text;
}

.transcript-block {
  position: relative;
  padding: 8px 0 18px 40px;
  color: var(--subtitle-primary-text-color, #f5f5f5);
  opacity: 0.52;
  transition: opacity 0.18s ease, color 0.18s ease, transform 0.18s ease;
}

.transcript-block--active {
  opacity: 1;
  transform: translateX(0);
  color: var(--subtitle-active-primary-text-color, #fff8dc);
}

.transcript-block__primary {
  font-family: var(--subtitle-font-family);
  font-size: var(--subtitle-font-size);
  line-height: var(--subtitle-line-height, 1.45);
}

.transcript-block__secondary {
  margin-top: var(--subtitle-primary-secondary-gap, 3px);
  font-family: var(--subtitle-font-family);
  font-size: calc(var(--subtitle-font-size) - 1px);
  line-height: var(--subtitle-line-height, 1.45);
  color: var(--subtitle-secondary-text-color, #c7d2fe);
}

.cue-anchor-rail {
  position: absolute;
  left: 0;
  top: 8px;
  display: inline-flex;
  gap: 6px;
}
```

Delete:

```text
desktop-app/src/renderer/components/subtitle/SubtitleScrollSection.vue
desktop-app/src/renderer/components/subtitle/SubtitleItem.vue
desktop-app/src/renderer/components/subtitle/composables/useAutoScroll.ts
```

Remove the last legacy imports/usages from `desktop-app/src/renderer/components/subtitle/SubtitleView.vue`.

- [ ] **Step 4: Run the full renderer test suite**

Run: `npm --prefix desktop-app run test:renderer`

Expected: PASS with all transcript model, layout, viewport, and component tests passing.

- [ ] **Step 5: Commit**

```bash
git add desktop-app/src/renderer/style.css \
  desktop-app/src/renderer/components/subtitle/SubtitleView.vue \
  desktop-app/src/renderer/components/subtitle/TranscriptSurface.test.ts
git add -u desktop-app/src/renderer/components/subtitle desktop-app/src/renderer/components/subtitle/composables
git commit -m "refactor: remove legacy subtitle cue list"
```

## Task 7: Verify The App Build And Document The New Rendering Path

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Write the failing documentation delta**

Append this section to `README.md` near desktop-app renderer notes:

```md
### Desktop Subtitle Reader

The desktop subtitle panel is rendered as a continuous transcript reader rather than a cue list. Layout is computed in the renderer with `@chenglou/pretext`, and cue actions are exposed as lightweight anchors on active or hovered transcript blocks.
```

- [ ] **Step 2: Run the desktop build**

Run: `npm --prefix desktop-app run build`

Expected: PASS with TypeScript and Vite build completion.

- [ ] **Step 3: Run the renderer tests again after the build**

Run: `npm --prefix desktop-app run test:renderer`

Expected: PASS with the same passing test count as Task 6.

- [ ] **Step 4: Review changed files before final commit**

Run: `git diff --stat HEAD~1..HEAD && git status --short`

Expected: only plan-intended source, style, and docs changes; no legacy transcript-list files remain tracked.

- [ ] **Step 5: Commit**

```bash
git add README.md
git commit -m "docs: describe transcript reader architecture"
```

## Self-Review

### Spec Coverage Check

- Continuous reading flow: covered by Tasks 3, 4, 5, and 6.
- Cue anchor layer: covered by Task 5.
- No item-list-dominant UI: enforced by Tasks 5 and 6.
- `pretext` as primary layout engine: covered by Task 3.
- Stable focus-band auto-follow: covered by Task 4.
- Same error-handling strength only: preserved by not adding any fallback tasks and by reusing existing panel state behavior in Task 5.
- Same testing scope only: covered by model/layout/viewport/component tests only; no parity/fallback suites are added.

### Placeholder Scan

This plan contains no `TBD`, `TODO`, “implement later”, or “handle edge cases” placeholders. Each task names concrete files, commands, and code.

### Type Consistency Check

Shared names are kept consistent throughout the plan:

- `TranscriptBlock`
- `TranscriptLayout`
- `TranscriptViewportProjection`
- `createTranscriptLayout`
- `projectTranscriptViewport`
- `TranscriptSurface`

No later task renames these interfaces or function names.
