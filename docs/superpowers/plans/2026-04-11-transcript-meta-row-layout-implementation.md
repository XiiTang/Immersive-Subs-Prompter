# Transcript Meta Row Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the floating cue-action rail with a fixed-height meta row inside each transcript block while keeping block geometry stable for virtualization and viewport reprojection.

**Architecture:** Keep `pretext` responsible for text measurement only, and extend the outer layout step to prepend fixed chrome height to every block. Render a permanent block-internal meta row in `TranscriptBlock.vue`, switch cue-action visibility from conditional mount to stateful presentation, and delete the old floating-rail styles and tests instead of preserving compatibility branches.

**Tech Stack:** Vue 3, TypeScript, Electron renderer, `@chenglou/pretext`, Vitest, Vue Test Utils, jsdom

---

## File Structure

### Modified Files

- `desktop-app/src/renderer/components/subtitle/transcript/pretextLayout.ts`
  Purpose: accept fixed meta row geometry and emit block heights / line offsets that include it.
- `desktop-app/src/renderer/components/subtitle/transcript/pretextLayout.test.ts`
  Purpose: lock in the fixed meta row geometry contract and remove the old “no reserved header space” assumption.
- `desktop-app/src/renderer/components/subtitle/TranscriptBlock.vue`
  Purpose: render a permanent block-internal meta row and expose state via classes / data attributes instead of floating positioning.
- `desktop-app/src/renderer/components/subtitle/CueAnchorRail.vue`
  Purpose: become a pure meta-row content component that is always mounted when its parent block is mounted.
- `desktop-app/src/renderer/components/subtitle/TranscriptBlock.test.ts`
  Purpose: verify permanent meta row rendering, state transitions, and event separation; remove floating-rail assertions.
- `desktop-app/src/renderer/components/subtitle/TranscriptSurface.vue`
  Purpose: pass fixed meta row geometry into layout, keep virtualization block-based, and preserve interaction behavior with the new block structure.
- `desktop-app/src/renderer/components/subtitle/TranscriptSurface.test.ts`
  Purpose: verify line offsets, initial layout, and stable projection behavior after the geometry change.
- `desktop-app/src/renderer/style.css`
  Purpose: replace floating-rail CSS with block-internal meta row styling and quiet/active/focus visual states.

### No New Runtime Files

- The implementation replaces the existing layout model directly.
- Do not add feature flags, migration helpers, compatibility adapters, or duplicate component paths.

## Task 1: Add Fixed Meta Row Geometry To Layout

**Files:**
- Modify: `desktop-app/src/renderer/components/subtitle/transcript/pretextLayout.ts`
- Test: `desktop-app/src/renderer/components/subtitle/transcript/pretextLayout.test.ts`

- [ ] **Step 1: Write the failing layout tests for fixed meta row geometry**

Add these tests to `desktop-app/src/renderer/components/subtitle/transcript/pretextLayout.test.ts`:

```ts
  it("adds fixed meta row geometry before text lines", () => {
    const layout = layoutTranscriptBlocks({
      blocks,
      width: 180,
      fontSize: 16,
      lineHeight: 1.5,
      fontFamily: "Arial",
      primarySecondaryGap: 6,
      blockGap: 12,
      metaRowHeight: 18,
      metaRowGap: 6
    });

    expect(layout.blocks[0]!.height).toBeGreaterThan(18 + 6);
    expect(layout.lines[0]!.relativeTop).toBe(24);
  });

  it("keeps line offsets stable when only interaction visibility would change", () => {
    const first = layoutTranscriptBlocks({
      blocks,
      width: 180,
      fontSize: 16,
      lineHeight: 1.5,
      fontFamily: "Arial",
      primarySecondaryGap: 6,
      blockGap: 12,
      metaRowHeight: 18,
      metaRowGap: 6
    });
    const second = layoutTranscriptBlocks({
      blocks,
      width: 180,
      fontSize: 16,
      lineHeight: 1.5,
      fontFamily: "Arial",
      primarySecondaryGap: 6,
      blockGap: 12,
      metaRowHeight: 18,
      metaRowGap: 6
    });

    expect(second.blocks).toEqual(first.blocks);
    expect(second.lines.map((line) => line.relativeTop)).toEqual(first.lines.map((line) => line.relativeTop));
  });
```

- [ ] **Step 2: Run the layout tests and confirm the new assertions fail**

Run: `npm --prefix desktop-app run test:renderer -- pretextLayout`

Expected: FAIL because `metaRowHeight` and `metaRowGap` are not accepted yet, and `relativeTop` still starts at `0` for the first line.

- [ ] **Step 3: Extend the layout input with fixed chrome geometry**

Update `desktop-app/src/renderer/components/subtitle/transcript/pretextLayout.ts`:

```ts
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
```

Use fixed offsets when computing block geometry:

```ts
  const safeMetaRowHeight = Math.max(metaRowHeight, 0);
  const safeMetaRowGap = Math.max(metaRowGap, 0);

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
```

Apply the same offset to secondary lines so all emitted `relativeTop` values are block-relative, not text-body-relative.

- [ ] **Step 4: Re-run the layout tests**

Run: `npm --prefix desktop-app run test:renderer -- pretextLayout`

Expected: PASS with the new fixed-geometry assertions and all existing layout tests still green.

- [ ] **Step 5: Commit**

```bash
git add desktop-app/src/renderer/components/subtitle/transcript/pretextLayout.ts \
  desktop-app/src/renderer/components/subtitle/transcript/pretextLayout.test.ts
git commit -m "feat: add fixed transcript meta row geometry"
```

## Task 2: Replace Floating Rail Markup With A Permanent Meta Row

**Files:**
- Modify: `desktop-app/src/renderer/components/subtitle/TranscriptBlock.vue`
- Modify: `desktop-app/src/renderer/components/subtitle/CueAnchorRail.vue`
- Modify: `desktop-app/src/renderer/style.css`
- Test: `desktop-app/src/renderer/components/subtitle/TranscriptBlock.test.ts`

- [ ] **Step 1: Rewrite the block component tests to target the new structure**

Replace the floating-rail assertions in `desktop-app/src/renderer/components/subtitle/TranscriptBlock.test.ts` with tests like these:

```ts
  it("always renders a block-internal meta row", () => {
    const wrapper = mount(TranscriptBlock, {
      props: {
        blockId: "block-0",
        start: 0,
        end: 1000,
        lines: [{ key: "line-0", kind: "primary", text: "hello world", style: lineStyle(24, 24) }],
        isActive: false,
        isLooping: false,
        isAbLoopStart: false,
        abLoopPending: false,
        showSelectionActions: false
      }
    });

    expect(wrapper.get('[data-testid="transcript-meta-row"]').exists()).toBe(true);
    expect(wrapper.get('[data-testid="transcript-cue-actions"]').exists()).toBe(true);
    expect(wrapper.get('[data-testid="transcript-meta-row"]').attributes("data-meta-state")).toBe("quiet");
  });

  it("does not change line positioning when the block enters hover state", async () => {
    const wrapper = mount(TranscriptBlock, {
      props: {
        blockId: "block-1",
        start: 1000,
        end: 2000,
        lines: [{ key: "line-0", kind: "primary", text: "next line", style: lineStyle(24, 24) }],
        isActive: false,
        isLooping: false,
        isAbLoopStart: false,
        abLoopPending: false,
        showSelectionActions: false
      }
    });

    const before = wrapper.get(".transcript-block__line").attributes("style");
    await wrapper.get("article").trigger("mouseenter");
    const after = wrapper.get(".transcript-block__line").attributes("style");

    expect(wrapper.get('[data-testid="transcript-meta-row"]').attributes("data-meta-state")).toBe("hover");
    expect(after).toBe(before);
  });
```

Delete tests that assert:

- cue actions are mounted only on hover
- cue actions sit above the block via `bottom: 100%`
- z-index is required to keep a floating overlay clickable

- [ ] **Step 2: Run the block component tests and confirm they fail**

Run: `npm --prefix desktop-app run test:renderer -- TranscriptBlock`

Expected: FAIL because the block still conditionally mounts the rail and still uses floating styles.

- [ ] **Step 3: Make the meta row permanent in `TranscriptBlock.vue`**

Update `desktop-app/src/renderer/components/subtitle/TranscriptBlock.vue` to render a dedicated meta row before the text body:

```vue
  <article
    class="transcript-block"
    :class="{ 'transcript-block--active': isActive, 'transcript-block--looping': isLooping }"
    :data-transcript-block-id="blockId"
    @mouseenter="hovered = true"
    @mouseleave="hovered = false"
    @focusin="focusedWithin = true"
    @focusout="focusedWithin = false"
    @click="$emit('play')"
  >
    <div class="transcript-block__body" data-testid="transcript-block-body">
      <div
        class="transcript-block__meta-row"
        data-testid="transcript-meta-row"
        :data-meta-state="metaRowState"
      >
        <CueAnchorRail
          :state="metaRowState"
          :start="start"
          :end="end"
          :ab-label="abLoopPending ? 'B' : 'A'"
          :is-looping="isLooping"
          :is-ab-loop-start="isAbLoopStart"
          @play="$emit('play')"
          @loop="$emit('loop')"
          @loop-range="$emit('loop-range')"
        />
      </div>
      <div class="transcript-block__text">
```

Add explicit state priority:

```ts
const focusedWithin = ref(false);

const metaRowState = computed(() => {
  if (props.isAbLoopStart) return "ab-pending";
  if (props.isLooping) return "looping";
  if (props.showSelectionActions) return "selection";
  if (focusedWithin.value) return "focus-within";
  if (props.isActive) return "active";
  if (hovered.value) return "hover";
  return "quiet";
});
```

- [ ] **Step 4: Remove floating-rail behavior from `CueAnchorRail.vue`**

Update `desktop-app/src/renderer/components/subtitle/CueAnchorRail.vue` so it always renders its root and accepts a `state` prop instead of a `visible` prop:

```vue
  <div
    class="transcript-block__cue-actions"
    data-testid="transcript-cue-actions"
    :data-state="state"
  >
```

```ts
const props = defineProps<{
  state: "quiet" | "hover" | "active" | "selection" | "looping" | "ab-pending" | "focus-within";
  start: number;
  end: number;
  abLabel: "A" | "B";
  isLooping: boolean;
  isAbLoopStart: boolean;
}>();
```

- [ ] **Step 5: Replace the old CSS with block-internal meta row styling**

Update `desktop-app/src/renderer/style.css` by deleting the floating rail rules and replacing them with fixed block-internal styles:

```css
.transcript-block__body {
  position: relative;
  width: 100%;
  height: 100%;
}

.transcript-block__meta-row {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 18px;
  display: flex;
  align-items: center;
}

.transcript-block__cue-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  min-height: 18px;
  font-size: 11px;
  color: #a1a1aa;
  opacity: 0.42;
  pointer-events: none;
  transition: opacity 0.18s ease, color 0.18s ease, transform 0.18s ease;
}

.transcript-block__meta-row[data-meta-state="hover"] .transcript-block__cue-actions,
.transcript-block__meta-row[data-meta-state="active"] .transcript-block__cue-actions,
.transcript-block__meta-row[data-meta-state="selection"] .transcript-block__cue-actions,
.transcript-block__meta-row[data-meta-state="looping"] .transcript-block__cue-actions,
.transcript-block__meta-row[data-meta-state="ab-pending"] .transcript-block__cue-actions,
.transcript-block__meta-row[data-meta-state="focus-within"] .transcript-block__cue-actions {
  opacity: 1;
  pointer-events: auto;
}
```

Keep only stateful visual transitions. Do not reintroduce `bottom: 100%`, overlay z-index hacks, or conditional layout-bearing display rules.

- [ ] **Step 6: Re-run the block tests**

Run: `npm --prefix desktop-app run test:renderer -- TranscriptBlock`

Expected: PASS with the new meta row tests and no remaining floating-rail assertions.

- [ ] **Step 7: Commit**

```bash
git add desktop-app/src/renderer/components/subtitle/TranscriptBlock.vue \
  desktop-app/src/renderer/components/subtitle/CueAnchorRail.vue \
  desktop-app/src/renderer/components/subtitle/TranscriptBlock.test.ts \
  desktop-app/src/renderer/style.css
git commit -m "feat: move transcript cue actions into block meta row"
```

## Task 3: Wire The New Geometry Through TranscriptSurface

**Files:**
- Modify: `desktop-app/src/renderer/components/subtitle/TranscriptSurface.vue`
- Test: `desktop-app/src/renderer/components/subtitle/TranscriptSurface.test.ts`

- [ ] **Step 1: Rewrite the surface tests around reserved meta row geometry**

Replace the old hidden-header assertion in `desktop-app/src/renderer/components/subtitle/TranscriptSurface.test.ts` with:

```ts
  it("reserves fixed meta row space before the first transcript line", async () => {
    const wrapper = mount(TranscriptSurface, {
      attachTo: document.body,
      props: {
        blocks: [
          {
            id: "block-0",
            start: 0,
            end: 1000,
            primaryText: "hello world",
            secondaryText: null,
            sourceCueRefs: { primaryCueIndex: 0, secondaryCueIndex: null }
          }
        ],
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
        autoScrollDelayMs: 500,
        scrollPositionRatio: 0.4
      }
    });

    await nextTick();
    await nextTick();

    expect(wrapper.get('[data-testid="transcript-meta-row"]').exists()).toBe(true);
    expect(wrapper.get(".transcript-block__line").attributes("style")).toContain("top: 24px;");
  });
```

Add a behavior test that geometry stays stable while state changes:

```ts
  it("keeps rendered block heights stable when cue actions become visible", async () => {
    const wrapper = mount(TranscriptSurface, { /* same props as above */ });
    await nextTick();
    await nextTick();

    const block = wrapper.get('[data-transcript-block-id="block-0"]');
    const before = block.attributes("style");
    await block.trigger("mouseenter");
    const after = block.attributes("style");

    expect(after).toBe(before);
  });
```

- [ ] **Step 2: Run the surface tests and confirm they fail**

Run: `npm --prefix desktop-app run test:renderer -- TranscriptSurface`

Expected: FAIL because the current surface still emits line top `0px` for the first line and the block component still uses the floating rail semantics.

- [ ] **Step 3: Pass fixed meta row geometry from `TranscriptSurface.vue` into layout**

Update `desktop-app/src/renderer/components/subtitle/TranscriptSurface.vue`:

```ts
const META_ROW_HEIGHT = 18;
const META_ROW_GAP = 6;

const layout = computed(() =>
  layoutTranscriptBlocks({
    blocks: props.blocks,
    width: surfaceWidth.value,
    fontSize: props.fontSize,
    lineHeight: props.lineHeight,
    fontFamily: props.fontFamily,
    primarySecondaryGap: props.primarySecondaryGap,
    blockGap: props.blockGap,
    metaRowHeight: META_ROW_HEIGHT,
    metaRowGap: META_ROW_GAP,
    preparedTextCache
  })
);
```

Do not branch this on hover, active state, or feature flags. The fixed geometry is unconditional.

- [ ] **Step 4: Preserve virtualization and projection behavior without special cases**

Keep the existing rendered-block mapping, but verify it still consumes `layoutBlock.height` and line `relativeTop` directly:

```ts
      return {
        block,
        style: {
          top: `${layoutBlock.top}px`,
          height: `${layoutBlock.height}px`
        },
        lines
      };
```

Do not introduce:

- alternate render paths for quiet vs active blocks
- separate block heights for hidden vs visible cue actions
- follow / seek exceptions for the new meta row

- [ ] **Step 5: Re-run the surface tests**

Run: `npm --prefix desktop-app run test:renderer -- TranscriptSurface`

Expected: PASS with the new reserved-space assertions and existing projection / virtualization tests still green.

- [ ] **Step 6: Commit**

```bash
git add desktop-app/src/renderer/components/subtitle/TranscriptSurface.vue \
  desktop-app/src/renderer/components/subtitle/TranscriptSurface.test.ts
git commit -m "feat: apply fixed meta row geometry to transcript surface"
```

## Task 4: Remove Obsolete Assumptions And Run Full Renderer Verification

**Files:**
- Modify: `desktop-app/src/renderer/components/subtitle/TranscriptBlock.test.ts`
- Modify: `desktop-app/src/renderer/components/subtitle/TranscriptSurface.test.ts`
- Modify: `desktop-app/src/renderer/components/subtitle/transcript/pretextLayout.test.ts`

- [ ] **Step 1: Delete leftover assertions that encode the old floating rail model**

Remove any remaining checks for:

```ts
expect(cueActionsStyle).toContain("bottom: 100%;");
expect(wrapper.find('[data-testid="transcript-cue-actions"]').exists()).toBe(false);
expect(wrapper.get(".transcript-block__line").attributes("style")).toContain("top: 0px;");
```

After removal, keep only assertions that validate:

- fixed meta row presence
- stable line offsets
- stable block geometry
- event separation
- loop / A-B / selection visibility states

- [ ] **Step 2: Run the focused renderer tests together**

Run: `npm --prefix desktop-app run test:renderer -- pretextLayout TranscriptBlock TranscriptSurface`

Expected: PASS with all updated transcript layout and component tests green.

- [ ] **Step 3: Run the full renderer suite**

Run: `npm --prefix desktop-app run test:renderer`

Expected: PASS with the full renderer test suite green and no regressions outside the transcript files.

- [ ] **Step 4: Run the renderer build**

Run: `npm --prefix desktop-app run build:renderer`

Expected: PASS with a successful Vite renderer build.

- [ ] **Step 5: Commit**

```bash
git add desktop-app/src/renderer/components/subtitle/TranscriptBlock.test.ts \
  desktop-app/src/renderer/components/subtitle/TranscriptSurface.test.ts \
  desktop-app/src/renderer/components/subtitle/transcript/pretextLayout.test.ts
git commit -m "test: remove floating transcript rail assumptions"
```

## Self-Review

- Spec coverage: this plan covers geometry changes in `pretextLayout.ts`, permanent meta row rendering in `TranscriptBlock.vue` / `CueAnchorRail.vue`, CSS replacement in `style.css`, block-level virtualization continuity in `TranscriptSurface.vue`, and explicit deletion of floating-rail tests and obsolete assumptions.
- Placeholder scan: no `TODO`, `TBD`, “handle appropriately”, or “similar to task N” placeholders remain.
- Type consistency: `metaRowHeight`, `metaRowGap`, and `metaRowState` are used consistently across layout, component, CSS, and tests; no old `visible` prop remains in the target component contract.
