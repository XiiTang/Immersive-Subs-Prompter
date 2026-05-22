# Frontend UI Convergence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task in the current branch. Do not use subagents. Do not use worktrees. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Converge every frontend surface into one modern, minimal, solid-color, line-based UI across desktop, official plugin settings, controls, word lookup chrome, and the extension popup.

**Architecture:** Keep the existing theme runtime and settings model, then harden the visual system so all surfaces consume one token set and one primitive family. Remove feature-specific visual languages from active styling instead of adding compatibility aliases or transitional class layers.

**Tech Stack:** Electron, Vue 3, Pinia, TypeScript, Vite, Vitest, browser-mode Vitest, Chrome extension APIs, CSS custom properties.

---

## Source Documents

- Spec: `docs/superpowers/specs/2026-05-22-frontend-ui-convergence-design.md`
- Existing first-pass plan: `docs/superpowers/plans/2026-05-22-frontend-ui-refactor.md`

## Execution Constraints

- Implement directly in the current branch.
- Do not use subagents.
- Do not use worktrees.
- Do not add compatibility, migration, old-data, old-code, or legacy-class bridge logic.
- Do not modify transcript body components: `TranscriptSurface.vue`, `TranscriptBlock.vue`, or `apps/desktop-app/src/renderer/components/subtitle/transcript/*`.
- Do not explain implementation progress in product docs. Only document final state when docs need updates.

## Final File Structure

Desktop visual system:

- Modify: `apps/desktop-app/src/renderer/style.css`
- Create: `apps/desktop-app/src/renderer/styleConvergence.test.ts`
- Modify: `apps/desktop-app/src/renderer/components/ui/index.ts`
- Modify: `apps/desktop-app/src/renderer/components/ui/UiComponents.test.ts`
- Create: `apps/desktop-app/src/renderer/components/ui/UiSegmentedControl.vue`
- Create: `apps/desktop-app/src/renderer/components/ui/UiProgress.vue`
- Modify: `apps/desktop-app/src/renderer/shared/iconDefs.ts`
- Create: `apps/desktop-app/src/renderer/components/icons/IconChevronDown.vue`
- Create: `apps/desktop-app/src/renderer/components/icons/IconChevronUp.vue`
- Create: `apps/desktop-app/src/renderer/components/icons/IconFullscreen.vue`
- Create: `apps/desktop-app/src/renderer/components/icons/IconLock.vue`
- Create: `apps/desktop-app/src/renderer/components/icons/IconPause.vue`
- Create: `apps/desktop-app/src/renderer/components/icons/IconPin.vue`
- Create: `apps/desktop-app/src/renderer/components/icons/IconPlay.vue`
- Create: `apps/desktop-app/src/renderer/components/icons/IconSettings.vue`

Desktop settings and official plugin settings:

- Modify: `apps/desktop-app/src/renderer/components/settings/SettingsAppearance.vue`
- Modify: `apps/desktop-app/src/renderer/components/settings/SettingsCache.vue`
- Modify: `apps/desktop-app/src/renderer/components/settings/SettingsGlobal.vue`
- Modify: `apps/desktop-app/src/renderer/components/settings/SettingsMediaServer.vue`
- Modify: `apps/desktop-app/src/renderer/components/settings/SettingsPlugins.vue`
- Modify: `apps/desktop-app/src/renderer/components/settings/SettingsProfiles.vue`
- Modify: `apps/desktop-app/src/renderer/components/settings/SettingsTranscription.vue`
- Modify: `apps/desktop-app/src/renderer/components/settings/SettingsWindowShell.vue`
- Modify: `apps/desktop-app/src/renderer/components/settings/SettingsWordLookup.vue`
- Modify: `apps/desktop-app/src/renderer/components/settings/profiles/ColorSchemeGrid.vue`
- Modify: `apps/desktop-app/src/renderer/components/settings/profiles/PriorityEditor.vue`
- Modify: `apps/desktop-app/src/renderer/components/settings/profiles/ProfileList.vue`
- Modify: `apps/desktop-app/src/renderer/components/settings/profiles/ProfileUrlRules.vue`
- Modify: `apps/desktop-app/src/renderer/components/settings/profiles/SubtitleStyleFields.vue`
- Modify: `apps/desktop-app/src/renderer/components/settings/transcription/FasterWhisperBinariesCard.vue`
- Modify: `apps/desktop-app/src/renderer/components/settings/transcription/FasterWhisperModelsCard.vue`
- Modify: `apps/desktop-app/src/renderer/components/settings/transcription/FasterWhisperRuntimeCard.vue`
- Modify: `apps/desktop-app/src/renderer/components/settings/transcription/TranscriptionConfigList.vue`
- Modify: `apps/desktop-app/src/renderer/components/settings/transcription/WhisperApiForm.vue`

Desktop controls and word lookup chrome:

- Modify: `apps/desktop-app/src/renderer/components/top-panel/TopControlPanel.vue`
- Modify: `apps/desktop-app/src/renderer/components/subtitle/PlaybackControls.vue`
- Modify: `apps/desktop-app/src/renderer/components/subtitle/StatusBanner.vue`
- Modify: `apps/desktop-app/src/renderer/components/subtitle/TrackSelector.vue`
- Modify: `apps/desktop-app/src/renderer/components/subtitle/TranscriptionControls.vue`
- Modify: `apps/desktop-app/src/renderer/components/subtitle/WordLookupWindow.vue`

Extension popup:

- Modify: `apps/extension/popup.html`
- Modify: `apps/extension/popup.css`
- Modify: `apps/extension/src/popup.ts`
- Create: `apps/extension/src/popup-style.test.ts`

Verification docs:

- Modify: `docs/superpowers/plans/2026-05-22-frontend-ui-convergence.md`

---

### Task 1: Lock The Token Contract And CSS Guardrails

**Files:**
- Modify: `apps/desktop-app/src/renderer/style.css`
- Create: `apps/desktop-app/src/renderer/styleConvergence.test.ts`
- Modify: `apps/extension/popup.css`
- Create: `apps/extension/src/popup-style.test.ts`

- [ ] **Step 1: Add desktop CSS convergence tests**

Create `apps/desktop-app/src/renderer/styleConvergence.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const stylePath = fileURLToPath(new URL("./style.css", import.meta.url));
const css = readFileSync(stylePath, "utf8");

function stripTranscriptBodyStyles(input: string): string {
  return input
    .replace(/\.transcript-surface[\s\S]*?(?=\n\.[a-zA-Z]|\n@media|\n$)/g, "")
    .replace(/\.transcript-block[\s\S]*?(?=\n\.[a-zA-Z]|\n@media|\n$)/g, "");
}

const activeCss = stripTranscriptBodyStyles(css);

describe("desktop CSS convergence", () => {
  it("keeps active chrome free of decorative effects", () => {
    expect(activeCss).not.toMatch(/box-shadow\s*:/);
    expect(activeCss).not.toMatch(/linear-gradient|radial-gradient|backdrop-filter|filter:\s*blur/i);
    expect(activeCss).not.toMatch(/color-mix\(/);
    expect(activeCss).not.toMatch(/rgba\(/);
  });

  it("does not keep feature-specific visual systems active", () => {
    expect(activeCss).not.toMatch(/\.fw-/);
    expect(activeCss).not.toMatch(/\.plugin-card/);
    expect(activeCss).not.toMatch(/\.settings-action-btn/);
    expect(activeCss).not.toMatch(/\.btn-primary|\.btn-secondary|\.settings-surface/);
  });

  it("uses the agreed semantic color tokens", () => {
    for (const token of [
      "--ui-bg",
      "--ui-surface",
      "--ui-surface-muted",
      "--ui-text",
      "--ui-text-muted",
      "--ui-border",
      "--ui-accent",
      "--ui-success",
      "--ui-warning",
      "--ui-danger",
      "--ui-info"
    ]) {
      expect(css).toContain(token);
    }
    expect(css).not.toContain("--ui-accent-soft");
    expect(css).not.toContain("--ui-control-bg");
  });
});
```

- [ ] **Step 2: Add extension CSS convergence tests**

Create `apps/extension/src/popup-style.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const popupCssPath = fileURLToPath(new URL("../popup.css", import.meta.url));
const popupHtmlPath = fileURLToPath(new URL("../popup.html", import.meta.url));
const css = readFileSync(popupCssPath, "utf8");
const html = readFileSync(popupHtmlPath, "utf8");

describe("extension popup visual convergence", () => {
  it("does not use decorative effects", () => {
    expect(css).not.toMatch(/box-shadow\s*:/);
    expect(css).not.toMatch(/linear-gradient|radial-gradient|backdrop-filter|filter:\s*blur/i);
    expect(css).not.toMatch(/color-mix\(/);
    expect(css).not.toMatch(/rgba\(/);
  });

  it("does not use legacy popup visual class families", () => {
    expect(css).not.toMatch(/\.usp-/);
    expect(css).not.toMatch(/\.media-card|\.server-card/);
    expect(css).not.toMatch(/pill/i);
    expect(html).not.toMatch(/usp-|media-card|server-card/);
  });

  it("uses the agreed semantic color tokens", () => {
    for (const token of [
      "--ui-bg",
      "--ui-surface",
      "--ui-surface-muted",
      "--ui-text",
      "--ui-text-muted",
      "--ui-border",
      "--ui-accent",
      "--ui-success",
      "--ui-warning",
      "--ui-danger",
      "--ui-info"
    ]) {
      expect(css).toContain(token);
    }
    expect(css).not.toContain("--ui-accent-soft");
  });
});
```

- [ ] **Step 3: Run the new guardrail tests and confirm they fail on the current UI**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app vitest run src/renderer/styleConvergence.test.ts
pnpm --filter @immersive-subs/extension vitest run src/popup-style.test.ts
```

Expected: both commands fail because current active CSS still contains `box-shadow`, `rgba(...)`, `color-mix`, `fw-*`, `plugin-card`, `usp-*`, `media-card`, or `server-card`.

- [ ] **Step 4: Normalize desktop and extension tokens**

In `apps/desktop-app/src/renderer/style.css` and `apps/extension/popup.css`, keep this exact active color-token family in both light and dark roots:

```css
--ui-bg
--ui-surface
--ui-surface-muted
--ui-text
--ui-text-muted
--ui-border
--ui-accent
--ui-success
--ui-warning
--ui-danger
--ui-info
```

Use solid color values for these tokens. Remove active styling that depends on `--ui-accent-soft`, `--ui-control-bg`, `rgba(...)`, `color-mix(...)`, gradients, blur, glow, or shadows outside transcript-body CSS.

- [ ] **Step 5: Run guardrail tests and keep them passing**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app vitest run src/renderer/styleConvergence.test.ts
pnpm --filter @immersive-subs/extension vitest run src/popup-style.test.ts
```

Expected: PASS.

---

### Task 2: Complete The Shared Desktop Primitive Set

**Files:**
- Create: `apps/desktop-app/src/renderer/components/ui/UiSegmentedControl.vue`
- Create: `apps/desktop-app/src/renderer/components/ui/UiProgress.vue`
- Modify: `apps/desktop-app/src/renderer/components/ui/index.ts`
- Modify: `apps/desktop-app/src/renderer/components/ui/UiComponents.test.ts`
- Modify: `apps/desktop-app/src/renderer/style.css`

- [ ] **Step 1: Add primitive tests**

Append to `apps/desktop-app/src/renderer/components/ui/UiComponents.test.ts`:

```ts
  it("renders segmented controls and emits selected values", async () => {
    const segmented = mount(UiSegmentedControl, {
      props: {
        modelValue: "system",
        label: "Theme",
        options: [
          { value: "system", label: "System" },
          { value: "light", label: "Light" },
          { value: "dark", label: "Dark" }
        ]
      }
    });

    expect(segmented.attributes("role")).toBe("radiogroup");
    expect(segmented.find('[aria-checked="true"]').text()).toBe("System");
    await segmented.findAll("button")[1]?.trigger("click");
    expect(segmented.emitted("update:modelValue")?.[0]).toEqual(["light"]);
  });

  it("renders progress with an accessible numeric value", () => {
    const progress = mount(UiProgress, {
      props: { value: 42, label: "Download progress" }
    });

    expect(progress.attributes("role")).toBe("progressbar");
    expect(progress.attributes("aria-valuenow")).toBe("42");
    expect(progress.get(".ui-progress__bar").attributes("style")).toContain("42%");
  });
```

Also add `UiProgress` and `UiSegmentedControl` to the import list at the top of the same file.

- [ ] **Step 2: Create `UiSegmentedControl.vue`**

Create `apps/desktop-app/src/renderer/components/ui/UiSegmentedControl.vue`:

```vue
<template>
  <div class="ui-segmented" role="radiogroup" :aria-label="label">
    <button
      v-for="option in options"
      :key="option.value"
      type="button"
      class="ui-segmented__item"
      :class="{ 'is-selected': modelValue === option.value }"
      role="radio"
      :aria-checked="modelValue === option.value"
      :disabled="option.disabled"
      @click="$emit('update:modelValue', option.value)"
    >
      {{ option.label }}
    </button>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  modelValue: string;
  label: string;
  options: Array<{ value: string; label: string; disabled?: boolean }>;
}>();

defineEmits<{
  (event: "update:modelValue", value: string): void;
}>();
</script>
```

- [ ] **Step 3: Create `UiProgress.vue`**

Create `apps/desktop-app/src/renderer/components/ui/UiProgress.vue`:

```vue
<template>
  <div
    class="ui-progress"
    role="progressbar"
    :aria-label="label"
    aria-valuemin="0"
    aria-valuemax="100"
    :aria-valuenow="boundedValue"
  >
    <div class="ui-progress__bar" :style="{ width: `${boundedValue}%` }" />
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
  value: number;
  label: string;
}>();

const boundedValue = computed(() => Math.max(0, Math.min(100, Math.round(props.value))));
</script>
```

- [ ] **Step 4: Export the primitives**

Add these exports to `apps/desktop-app/src/renderer/components/ui/index.ts`:

```ts
export { default as UiProgress } from "./UiProgress.vue";
export { default as UiSegmentedControl } from "./UiSegmentedControl.vue";
```

- [ ] **Step 5: Style the new primitives through existing token roles**

In `apps/desktop-app/src/renderer/style.css`, keep segmented control styling under `.ui-segmented` and add:

```css
.ui-progress {
  width: 100%;
  height: 6px;
  border-radius: var(--ui-radius-sm);
  background: var(--ui-surface-muted);
  overflow: hidden;
}

.ui-progress__bar {
  height: 100%;
  background: var(--ui-accent);
}
```

- [ ] **Step 6: Run primitive tests**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app vitest run src/renderer/components/ui/UiComponents.test.ts
```

Expected: PASS.

---

### Task 3: Replace Text And Emoji Icons With One Line Icon Set

**Files:**
- Modify: `apps/desktop-app/src/renderer/shared/iconDefs.ts`
- Create: `apps/desktop-app/src/renderer/components/icons/IconChevronDown.vue`
- Create: `apps/desktop-app/src/renderer/components/icons/IconChevronUp.vue`
- Create: `apps/desktop-app/src/renderer/components/icons/IconFullscreen.vue`
- Create: `apps/desktop-app/src/renderer/components/icons/IconLock.vue`
- Create: `apps/desktop-app/src/renderer/components/icons/IconPause.vue`
- Create: `apps/desktop-app/src/renderer/components/icons/IconPin.vue`
- Create: `apps/desktop-app/src/renderer/components/icons/IconPlay.vue`
- Create: `apps/desktop-app/src/renderer/components/icons/IconSettings.vue`
- Modify: `apps/desktop-app/src/renderer/components/icons/index.ts`
- Modify: `apps/desktop-app/src/renderer/components/top-panel/TopControlPanel.vue`
- Modify: `apps/desktop-app/src/renderer/components/subtitle/PlaybackControls.vue`

- [ ] **Step 1: Add icon definitions**

Add line-icon definitions to `apps/desktop-app/src/renderer/shared/iconDefs.ts` for:

```ts
export const ICON_CHEVRON_DOWN: IconDefinition = {
  viewBox: "0 0 16 16",
  segments: [{ tag: "path", attrs: { d: "M4.5 6.5 8 10l3.5-3.5" } }]
};

export const ICON_CHEVRON_UP: IconDefinition = {
  viewBox: "0 0 16 16",
  segments: [{ tag: "path", attrs: { d: "M4.5 9.5 8 6l3.5 3.5" } }]
};

export const ICON_FULLSCREEN: IconDefinition = {
  viewBox: "0 0 16 16",
  segments: [
    { tag: "path", attrs: { d: "M5.5 2.5h-3v3" } },
    { tag: "path", attrs: { d: "M10.5 2.5h3v3" } },
    { tag: "path", attrs: { d: "M13.5 10.5v3h-3" } },
    { tag: "path", attrs: { d: "M2.5 10.5v3h3" } }
  ]
};

export const ICON_LOCK: IconDefinition = {
  viewBox: "0 0 16 16",
  segments: [
    { tag: "path", attrs: { d: "M4.5 7.5h7v5h-7z" } },
    { tag: "path", attrs: { d: "M5.75 7.5v-2.25a2.25 2.25 0 0 1 4.5 0V7.5" } }
  ]
};

export const ICON_PAUSE: IconDefinition = {
  viewBox: "0 0 16 16",
  segments: [
    { tag: "line", attrs: { x1: 6, y1: 4, x2: 6, y2: 12 } },
    { tag: "line", attrs: { x1: 10, y1: 4, x2: 10, y2: 12 } }
  ]
};

export const ICON_PIN: IconDefinition = {
  viewBox: "0 0 16 16",
  segments: [
    { tag: "path", attrs: { d: "M5 2.5h6l-1.5 4 2 2-3 3-2-2-4 1.5 1.5-4-2-2 3-3Z" } },
    { tag: "line", attrs: { x1: 7.5, y1: 10.5, x2: 4, y2: 14 } }
  ]
};

export const ICON_PLAY: IconDefinition = {
  viewBox: "0 0 16 16",
  segments: [{ tag: "path", attrs: { d: "M5.5 3.5v9l7-4.5-7-4.5Z" } }]
};

export const ICON_SETTINGS: IconDefinition = {
  viewBox: "0 0 16 16",
  segments: [
    { tag: "line", attrs: { x1: 3, y1: 4.5, x2: 13, y2: 4.5 } },
    { tag: "circle", attrs: { cx: 6, cy: 4.5, r: 1.2 } },
    { tag: "line", attrs: { x1: 3, y1: 8, x2: 13, y2: 8 } },
    { tag: "circle", attrs: { cx: 10, cy: 8, r: 1.2 } },
    { tag: "line", attrs: { x1: 3, y1: 11.5, x2: 13, y2: 11.5 } },
    { tag: "circle", attrs: { cx: 7.5, cy: 11.5, r: 1.2 } }
  ]
};
```

Use the existing `IconDefinition` shape and `ICON_STROKE_PROPS`.

- [ ] **Step 2: Create Vue icon components**

For each new icon component, follow the existing `IconAdd.vue` pattern:

```vue
<template>
  <svg
    class="icon"
    :class="[sizeClass]"
    xmlns="http://www.w3.org/2000/svg"
    :viewBox="ICON_PLAY.viewBox"
    v-bind="ICON_STROKE_PROPS"
    aria-hidden="true"
  >
    <component
      v-for="(segment, index) in ICON_PLAY.segments"
      :is="segment.tag"
      :key="index"
      v-bind="segment.attrs"
    />
  </svg>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { ICON_PLAY, ICON_STROKE_PROPS } from "../../shared/iconDefs";

const { size = "md" } = defineProps<{
  size?: "sm" | "md" | "lg";
}>();

const sizeClass = computed(() => `icon--${size}`);
</script>
```

Use the matching `ICON_*` import in each component.

- [ ] **Step 3: Export new icon components**

Add exports to `apps/desktop-app/src/renderer/components/icons/index.ts`:

```ts
export { default as IconChevronDown } from "./IconChevronDown.vue";
export { default as IconChevronUp } from "./IconChevronUp.vue";
export { default as IconFullscreen } from "./IconFullscreen.vue";
export { default as IconLock } from "./IconLock.vue";
export { default as IconPause } from "./IconPause.vue";
export { default as IconPin } from "./IconPin.vue";
export { default as IconPlay } from "./IconPlay.vue";
export { default as IconSettings } from "./IconSettings.vue";
```

- [ ] **Step 4: Use icons in top panel and playback controls**

Update `TopControlPanel.vue` and `PlaybackControls.vue` so icon-only controls render line icon components instead of text or emoji:

```vue
<IconPin v-if="alwaysOnTop === 'off'" size="md" />
<IconPin v-else-if="alwaysOnTop === 'floating'" size="md" />
<IconLock v-else size="md" />
<IconFullscreen size="md" />
<IconSettings size="md" />
<IconPause v-if="isPlaying" size="md" />
<IconPlay v-else size="md" />
<IconChevronUp v-if="autoHideEnabled" size="md" />
<IconChevronDown v-else size="md" />
```

Keep the existing accessible labels and pressed states.

- [ ] **Step 5: Run control tests**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app vitest run src/renderer/components/top-panel/TopControlPanel.test.ts src/renderer/components/subtitle/SubtitleView.browser.test.ts
```

Expected: PASS.

---

### Task 4: Converge Desktop Settings And Official Plugin Settings

**Files:**
- Modify: `apps/desktop-app/src/renderer/components/settings/SettingsAppearance.vue`
- Modify: `apps/desktop-app/src/renderer/components/settings/SettingsCache.vue`
- Modify: `apps/desktop-app/src/renderer/components/settings/SettingsGlobal.vue`
- Modify: `apps/desktop-app/src/renderer/components/settings/SettingsMediaServer.vue`
- Modify: `apps/desktop-app/src/renderer/components/settings/SettingsPlugins.vue`
- Modify: `apps/desktop-app/src/renderer/components/settings/SettingsProfiles.vue`
- Modify: `apps/desktop-app/src/renderer/components/settings/SettingsTranscription.vue`
- Modify: `apps/desktop-app/src/renderer/components/settings/SettingsWordLookup.vue`
- Modify: `apps/desktop-app/src/renderer/components/settings/profiles/ColorSchemeGrid.vue`
- Modify: `apps/desktop-app/src/renderer/components/settings/profiles/PriorityEditor.vue`
- Modify: `apps/desktop-app/src/renderer/components/settings/profiles/ProfileList.vue`
- Modify: `apps/desktop-app/src/renderer/components/settings/profiles/ProfileUrlRules.vue`
- Modify: `apps/desktop-app/src/renderer/components/settings/profiles/SubtitleStyleFields.vue`
- Modify: `apps/desktop-app/src/renderer/components/settings/transcription/FasterWhisperBinariesCard.vue`
- Modify: `apps/desktop-app/src/renderer/components/settings/transcription/FasterWhisperModelsCard.vue`
- Modify: `apps/desktop-app/src/renderer/components/settings/transcription/FasterWhisperRuntimeCard.vue`
- Modify: `apps/desktop-app/src/renderer/components/settings/transcription/TranscriptionConfigList.vue`
- Modify: `apps/desktop-app/src/renderer/components/settings/transcription/WhisperApiForm.vue`
- Modify: `apps/desktop-app/src/renderer/style.css`

- [ ] **Step 1: Use `UiSegmentedControl` for appearance**

Update `SettingsAppearance.vue` so the theme selector uses `UiSegmentedControl`:

```vue
<UiSegmentedControl
  v-model="appearanceTheme"
  :label="t('appearance-theme-label', 'Theme')"
  :options="themeOptions"
/>
```

Import `UiSegmentedControl` from `../ui`.

- [ ] **Step 2: Make repeated records use `UiListItem` only**

For profiles, plugin catalog entries, transcription configs, media servers, URL rules, priority rows, cache stats, and model/runtime rows:

```vue
<UiListItem as="button" :selected="isSelected">
  <div class="ui-list-item__main">
    <div class="ui-list-item__title-row">
      <span class="ui-list-item__title">{{ recordTitle }}</span>
      <UiBadge>{{ recordStatus }}</UiBadge>
    </div>
    <p class="ui-list-item__description">{{ recordDescription }}</p>
  </div>
</UiListItem>
```

Use feature classes only for layout hooks when needed. Do not use feature classes to define colors, borders, shadows, typography, badges, buttons, or status states.

- [ ] **Step 3: Make Faster-Whisper native to the host UI**

Replace `fw-*` visual classes in Faster-Whisper templates with shared primitive structure:

```vue
<section class="ui-group">
  <header class="ui-group__header">
    <h3 class="ui-group__title">{{ groupTitle }}</h3>
  </header>
  <div class="ui-group__body">
    <UiField id="faster-whisper-field" :label="fieldLabel">
      <UiInput v-model="fieldValue" />
    </UiField>
  </div>
</section>
```

Use `UiBadge` for CPU/GPU/model states, `UiProgress` for downloads, `UiField` for paths and config controls, `UiButton`/`UiIconButton` for actions, and `.settings-grid` or `.settings-row` layout classes for placement.

- [ ] **Step 4: Remove feature-specific settings visual CSS**

From `apps/desktop-app/src/renderer/style.css`, remove active visual styling for:

```css
.fw-*
.plugin-card*
.settings-action-btn*
.mediaserver-config-list__item
.transcription-config-list__item
.transcription-config-list__badge
.transcription-config-list__pill
.cache-status-item
```

Keep layout-only classes when they do not set color, background, border, box-shadow, typography, badge style, or button style.

- [ ] **Step 5: Run settings tests**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app vitest run \
  src/renderer/components/settings/SettingsWindowShell.test.ts \
  src/renderer/components/settings/SettingsWindowShell.browser.test.ts \
  src/renderer/components/settings/SettingsCache.test.ts \
  src/renderer/components/settings/SettingsMediaServer.test.ts \
  src/renderer/components/settings/SettingsPlugins.test.ts \
  src/renderer/components/settings/SettingsProfiles.browser.test.ts
```

Expected: PASS.

---

### Task 5: Converge Top Controls, Subtitle Controls, And Word Lookup Chrome

**Files:**
- Modify: `apps/desktop-app/src/renderer/components/top-panel/TopControlPanel.vue`
- Modify: `apps/desktop-app/src/renderer/components/subtitle/PlaybackControls.vue`
- Modify: `apps/desktop-app/src/renderer/components/subtitle/StatusBanner.vue`
- Modify: `apps/desktop-app/src/renderer/components/subtitle/TrackSelector.vue`
- Modify: `apps/desktop-app/src/renderer/components/subtitle/TranscriptionControls.vue`
- Modify: `apps/desktop-app/src/renderer/components/subtitle/WordLookupWindow.vue`
- Modify: `apps/desktop-app/src/renderer/style.css`

- [ ] **Step 1: Make top panel chrome solid and token-driven**

In `style.css`, make `.top-control-panel__surface`, header, controls, sliders, status rows, and playback rows use only:

```css
background: var(--ui-surface);
border: 1px solid var(--ui-border);
color: var(--ui-text);
color: var(--ui-text-muted);
color: var(--ui-accent);
```

Do not use `rgba(...)`, `color-mix(...)`, shadow, glow, gradient, or `--panel-opacity-factor` for control chrome. Keep `--panel-opacity-factor` only where transcript body styling already depends on it.

- [ ] **Step 2: Use shared controls for all subtitle controls**

Keep `TrackSelector` on `UiSelect`, `TranscriptionControls` on `UiSelect`/`UiButton`, `PlaybackControls` on `UiIconButton`, and `StatusBanner` on one shared banner style:

```css
.status-banner {
  margin: 0;
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius-sm);
  background: var(--ui-surface-muted);
  color: var(--ui-text-muted);
}
```

Use status modifier classes only to change text color to `--ui-info`, `--ui-warning`, `--ui-danger`, or `--ui-success`.

- [ ] **Step 3: Make progress sliders plain line controls**

Style `.playback-slider` and `.header-slider` as flat line controls with token colors. Do not use gradient fills. If progress indication remains necessary, use the native range thumb and a single solid accent track.

- [ ] **Step 4: Tokenize word lookup chrome only**

For `.word-lookup-popover`, `.word-lookup-window`, resize handles, scrollbars, links, code, quotes, and tables, use shared tokens. Do not change transcript token selection, cue projection, transcript block layout, or transcript scrolling.

- [ ] **Step 5: Run control and word lookup tests**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app vitest run \
  src/renderer/components/top-panel/TopControlPanel.test.ts \
  src/renderer/components/subtitle/WordLookupWindow.test.ts \
  src/renderer/components/subtitle/SubtitleView.browser.test.ts \
  src/renderer/components/subtitle/TranscriptSurface.browser.test.ts \
  src/renderer/components/subtitle/TranscriptBlock.test.ts
```

Expected: PASS. Transcript tests must continue to pass without modifying transcript body files.

---

### Task 6: Converge The Extension Popup

**Files:**
- Modify: `apps/extension/popup.html`
- Modify: `apps/extension/popup.css`
- Modify: `apps/extension/src/popup.ts`
- Modify: `apps/extension/src/popup-style.test.ts`

- [ ] **Step 1: Rename active visual classes to generic popup primitives**

In `popup.html`, replace visual class families as follows:

```text
usp-header -> popup-header
usp-header__meta -> popup-header__meta
usp-header__actions -> popup-header__actions
usp-icon-button -> popup-icon-button
usp-status -> popup-status
usp-main -> popup-main
media-card -> media-row
media-card__* -> media-row__*
server-card -> popup-section
server-card__* -> popup-section__*
```

Keep storage keys, port names, and protocol identifiers unchanged because they are not visual classes.

- [ ] **Step 2: Update `popup.ts` selectors and generated markup**

Update DOM creation and query selectors to the new class names:

```ts
card.className = "popup-section";
header.className = "popup-section__header";
title.className = "popup-section__title";
subtitle.className = "popup-section__subtitle";
const titleEl = clone.querySelector(".media-row__title") as HTMLElement | null;
const statusEl = clone.querySelector(".media-row__status") as HTMLElement | null;
const progressBar = clone.querySelector(".media-row__progress-bar") as HTMLElement | null;
```

- [ ] **Step 3: Make popup rows flat and line-based**

In `popup.css`, style popup headers, media rows, server rows, blacklist rows, appearance options, inputs, buttons, badges, statuses, and progress bars using the same token roles as desktop:

```css
border: 1px solid var(--ui-border);
background: var(--ui-surface);
background: var(--ui-surface-muted);
color: var(--ui-text);
color: var(--ui-text-muted);
color: var(--ui-accent);
```

Do not use shadows, gradients, transparent decorative fills, pill buttons, `usp-*` class names, `media-card`, or `server-card`.

- [ ] **Step 4: Keep appearance behavior independent**

Keep `apps/extension/src/shared/appearance.ts` unchanged unless tests show a direct issue. The popup remains independent from desktop appearance settings and still supports `system`, `light`, and `dark`.

- [ ] **Step 5: Run extension tests and build**

Run:

```bash
pnpm --filter @immersive-subs/extension test
pnpm --filter @immersive-subs/extension build
```

Expected: PASS.

---

### Task 7: Final CSS Cleanup, Test Run, And Documentation Status

**Files:**
- Modify: `apps/desktop-app/src/renderer/style.css`
- Modify: `apps/extension/popup.css`
- Modify: `docs/superpowers/plans/2026-05-22-frontend-ui-convergence.md`

- [ ] **Step 1: Run explicit legacy visual scans**

Run:

```bash
rg -n "box-shadow|linear-gradient|radial-gradient|backdrop-filter|filter:\\s*blur|color-mix\\(|rgba\\(" apps/desktop-app/src/renderer/style.css apps/extension/popup.css
rg -n "\\.fw-|\\.plugin-card|settings-action-btn|btn-primary|btn-secondary|settings-surface|usp-|media-card|server-card|pill" apps/desktop-app/src/renderer apps/extension/popup.css apps/extension/popup.html apps/extension/src
```

Expected:

- No matches for decorative effects in active chrome, settings, plugin settings, controls, word lookup chrome, or extension popup.
- Matches under transcript body CSS are allowed only for unchanged transcript body styling.
- Matches in protocol constants such as `usp-video-channel` are allowed because they are not UI classes.

- [ ] **Step 2: Run desktop verification**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app test:renderer
pnpm --filter @immersive-subs/desktop-app typecheck
```

Expected: PASS.

- [ ] **Step 3: Run extension verification**

Run:

```bash
pnpm --filter @immersive-subs/extension test
pnpm --filter @immersive-subs/extension build
```

Expected: PASS.

- [ ] **Step 4: Record final implementation status in this plan**

After implementation and verification, add an `Implementation Result` section near the top of this file with:

```markdown
## Implementation Result

Executed inline in the current branch. No subagents, no worktree, no compatibility layer, no migration layer.

Final state:

- Desktop and extension active UI styles use the same semantic token family.
- Settings, plugin settings, repeated rows, controls, banners, progress, and popup records use shared primitive styling.
- Faster-Whisper, plugin catalog, media server, popup media, and popup connection UIs no longer expose separate visual systems.
- Transcript body files remain unchanged.
- Verification commands passed:
  - `pnpm --filter @immersive-subs/desktop-app test:renderer`
  - `pnpm --filter @immersive-subs/desktop-app typecheck`
  - `pnpm --filter @immersive-subs/extension test`
  - `pnpm --filter @immersive-subs/extension build`
```

- [ ] **Step 5: Commit the implementation**

Only after all verification commands pass, commit the changed files:

```bash
git status --short
git add apps/desktop-app/src/renderer apps/extension docs/superpowers/plans/2026-05-22-frontend-ui-convergence.md
git commit -m "refactor: converge frontend ui styling"
```

Expected: one implementation commit containing the convergence refactor and this plan status update.
