# Open Source UI Library Final Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the desktop app's ad hoc non-transcript UI styling with a project-owned shadcn-vue/Reka-inspired primitive layer while preserving existing behavior.

**Architecture:** Keep feature components wired to the existing Pinia, IPC, plugin, transcription, media server, and subtitle-control flows. Contain `reka-ui`, `lucide-vue-next`, and shadcn-vue-derived structure inside local `components/ui` and `components/icons` boundaries. Convert desktop settings, official plugin settings, top controls, subtitle-panel controls, and word lookup chrome to shared primitives without changing transcript body components.

**Tech Stack:** Electron, Vue 3.5, TypeScript, Pinia, Vite, Vitest jsdom/browser projects, `reka-ui@2.9.7`, `lucide-vue-next@1.0.0`, CSS custom properties.

---

## Source Documents

- Spec: `docs/superpowers/specs/2026-05-22-open-source-ui-library-final-design.md`
- Existing convergence spec: `docs/superpowers/specs/2026-05-22-frontend-ui-convergence-design.md`
- Existing convergence plan: `docs/superpowers/plans/2026-05-22-frontend-ui-convergence.md`

## Scope Check

This is one connected desktop UI system. It does not need separate plans because each task builds toward the same local primitive boundary and all in-scope surfaces depend on that boundary.

Excluded from this plan:

- Browser extension popup.
- Transcript body files: `apps/desktop-app/src/renderer/components/subtitle/TranscriptSurface.vue`, `apps/desktop-app/src/renderer/components/subtitle/TranscriptBlock.vue`, and `apps/desktop-app/src/renderer/components/subtitle/transcript/*`.
- Store shape, IPC payloads, plugin manifest contracts, subtitle parsing, media server logic, transcription logic, word lookup data loading, and window-management logic.
- Compatibility layers, migration paths, legacy-class aliases, and old data compatibility.

## Local References To Inspect

Use these exact local paths during implementation:

- shadcn-vue: `/Users/cq-laptop/Projects/referrence projects/shadcn-vue`
- Reka UI: `/Users/cq-laptop/Projects/referrence projects/reka-ui`
- Lucide icons: `/Users/cq-laptop/Projects/referrence projects/lucide`
- shadcn upstream UI reference: `/Users/cq-laptop/Projects/referrence projects/ui`

Important reference files:

- `/Users/cq-laptop/Projects/referrence projects/shadcn-vue/apps/v4/styles/reka-sera/ui/button/Button.vue`
- `/Users/cq-laptop/Projects/referrence projects/shadcn-vue/apps/v4/styles/reka-sera/ui/select/*`
- `/Users/cq-laptop/Projects/referrence projects/shadcn-vue/apps/v4/styles/reka-sera/ui/tooltip/*`
- `/Users/cq-laptop/Projects/referrence projects/reka-ui/packages/core/src/Select/*`
- `/Users/cq-laptop/Projects/referrence projects/reka-ui/packages/core/src/Switch/*`
- `/Users/cq-laptop/Projects/referrence projects/reka-ui/packages/core/src/Tooltip/*`
- `/Users/cq-laptop/Projects/referrence projects/reka-ui/packages/core/src/Popover/*`
- `/Users/cq-laptop/Projects/referrence projects/lucide/icons/*.svg`
- `/Users/cq-laptop/Projects/referrence projects/ui/apps/v4/styles/radix-sera/ui/*.tsx`

## Target File Structure

Dependencies:

- Modify: `apps/desktop-app/package.json`
- Modify: `pnpm-lock.yaml`

UI boundary tests:

- Create: `apps/desktop-app/src/renderer/uiLibraryBoundary.test.ts`
- Modify: `apps/desktop-app/src/renderer/styleConvergence.test.ts`
- Modify: `apps/desktop-app/src/renderer/components/ui/UiComponents.test.ts`

UI primitive layer:

- Modify: `apps/desktop-app/src/renderer/components/ui/UiButton.vue`
- Modify: `apps/desktop-app/src/renderer/components/ui/UiIconButton.vue`
- Modify: `apps/desktop-app/src/renderer/components/ui/UiInput.vue`
- Modify: `apps/desktop-app/src/renderer/components/ui/UiTextarea.vue`
- Modify: `apps/desktop-app/src/renderer/components/ui/UiSelect.vue`
- Modify: `apps/desktop-app/src/renderer/components/ui/UiSwitch.vue`
- Modify: `apps/desktop-app/src/renderer/components/ui/UiSegmentedControl.vue`
- Modify: `apps/desktop-app/src/renderer/components/ui/UiProgress.vue`
- Modify: `apps/desktop-app/src/renderer/components/ui/UiField.vue`
- Modify: `apps/desktop-app/src/renderer/components/ui/UiListItem.vue`
- Modify: `apps/desktop-app/src/renderer/components/ui/UiSection.vue`
- Modify: `apps/desktop-app/src/renderer/components/ui/UiBadge.vue`
- Modify: `apps/desktop-app/src/renderer/components/ui/UiStatus.vue`
- Create: `apps/desktop-app/src/renderer/components/ui/UiSlider.vue`
- Create: `apps/desktop-app/src/renderer/components/ui/UiTooltip.vue`
- Create: `apps/desktop-app/src/renderer/components/ui/UiPopover.vue`
- Create: `apps/desktop-app/src/renderer/components/ui/UiSeparator.vue`
- Modify: `apps/desktop-app/src/renderer/components/ui/index.ts`

Icon layer:

- Create: `apps/desktop-app/src/renderer/components/icons/iconSizing.ts`
- Modify: `apps/desktop-app/src/renderer/components/icons/IconAdd.vue`
- Modify: `apps/desktop-app/src/renderer/components/icons/IconCheck.vue`
- Modify: `apps/desktop-app/src/renderer/components/icons/IconChevronDown.vue`
- Modify: `apps/desktop-app/src/renderer/components/icons/IconChevronUp.vue`
- Modify: `apps/desktop-app/src/renderer/components/icons/IconDelete.vue`
- Modify: `apps/desktop-app/src/renderer/components/icons/IconFolder.vue`
- Modify: `apps/desktop-app/src/renderer/components/icons/IconFullscreen.vue`
- Modify: `apps/desktop-app/src/renderer/components/icons/IconLock.vue`
- Modify: `apps/desktop-app/src/renderer/components/icons/IconPause.vue`
- Modify: `apps/desktop-app/src/renderer/components/icons/IconPin.vue`
- Modify: `apps/desktop-app/src/renderer/components/icons/IconPlay.vue`
- Modify: `apps/desktop-app/src/renderer/components/icons/IconRefresh.vue`
- Modify: `apps/desktop-app/src/renderer/components/icons/IconSettings.vue`
- Modify: `apps/desktop-app/src/renderer/components/icons/index.ts`
- Delete after replacements are complete: `apps/desktop-app/src/renderer/shared/iconDefs.ts`

Visual system:

- Modify: `apps/desktop-app/src/renderer/style.css`

Settings and official plugin settings:

- Modify: `apps/desktop-app/src/renderer/components/settings/SettingsNav.vue`
- Modify: `apps/desktop-app/src/renderer/components/settings/SettingsGlobal.vue`
- Modify: `apps/desktop-app/src/renderer/components/settings/SettingsCache.vue`
- Modify: `apps/desktop-app/src/renderer/components/settings/SettingsPlugins.vue`
- Modify: `apps/desktop-app/src/renderer/components/settings/SettingsProfiles.vue`
- Modify: `apps/desktop-app/src/renderer/components/settings/SettingsTranscription.vue`
- Modify: `apps/desktop-app/src/renderer/components/settings/SettingsWordLookup.vue`
- Modify: `apps/desktop-app/src/renderer/components/settings/SettingsMediaServer.vue`
- Modify: `apps/desktop-app/src/renderer/components/settings/profiles/ColorSchemeGrid.vue`
- Modify: `apps/desktop-app/src/renderer/components/settings/profiles/ProfileList.vue`
- Modify: `apps/desktop-app/src/renderer/components/settings/profiles/ProfileUrlRules.vue`
- Modify: `apps/desktop-app/src/renderer/components/settings/profiles/PriorityEditor.vue`
- Modify: `apps/desktop-app/src/renderer/components/settings/profiles/SubtitleStyleFields.vue`
- Modify: `apps/desktop-app/src/renderer/components/settings/transcription/TranscriptionConfigList.vue`
- Modify: `apps/desktop-app/src/renderer/components/settings/transcription/WhisperApiForm.vue`
- Modify: `apps/desktop-app/src/renderer/components/settings/transcription/FasterWhisperRuntimeCard.vue`
- Modify: `apps/desktop-app/src/renderer/components/settings/transcription/FasterWhisperBinariesCard.vue`
- Modify: `apps/desktop-app/src/renderer/components/settings/transcription/FasterWhisperModelsCard.vue`

Top controls, subtitle-panel controls, and word lookup chrome:

- Modify: `apps/desktop-app/src/renderer/components/top-panel/TopControlPanel.vue`
- Modify: `apps/desktop-app/src/renderer/components/subtitle/PlaybackControls.vue`
- Modify: `apps/desktop-app/src/renderer/components/subtitle/TrackSelector.vue`
- Modify: `apps/desktop-app/src/renderer/components/subtitle/TranscriptionControls.vue`
- Modify: `apps/desktop-app/src/renderer/components/subtitle/StatusBanner.vue`
- Modify: `apps/desktop-app/src/renderer/components/subtitle/WordLookupWindow.vue`

Existing tests likely to update:

- Modify: `apps/desktop-app/src/renderer/components/top-panel/TopControlPanel.test.ts`
- Modify: `apps/desktop-app/src/renderer/components/settings/SettingsCache.test.ts`
- Modify: `apps/desktop-app/src/renderer/components/settings/SettingsMediaServer.test.ts`
- Modify: `apps/desktop-app/src/renderer/components/settings/SettingsPlugins.test.ts`
- Modify: `apps/desktop-app/src/renderer/components/settings/SettingsProfiles.browser.test.ts`
- Modify: `apps/desktop-app/src/renderer/components/settings/SettingsWindowShell.browser.test.ts`
- Modify: `apps/desktop-app/src/renderer/components/subtitle/SubtitleView.browser.test.ts`
- Modify: `apps/desktop-app/src/renderer/components/subtitle/WordLookupWindow.test.ts`

---

### Task 1: Add Dependencies And Lock The Boundary Tests

**Files:**
- Modify: `apps/desktop-app/package.json`
- Modify: `pnpm-lock.yaml`
- Create: `apps/desktop-app/src/renderer/uiLibraryBoundary.test.ts`

- [ ] **Step 1: Write the failing dependency and boundary test**

Create `apps/desktop-app/src/renderer/uiLibraryBoundary.test.ts`:

```ts
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const rendererRoot = join(process.cwd(), "src/renderer");
const uiRoot = join(rendererRoot, "components/ui");
const packageJsonPath = join(process.cwd(), "package.json");

const excludedPathFragments = [
  "components/ui/",
  "components/subtitle/TranscriptSurface.vue",
  "components/subtitle/TranscriptBlock.vue",
  "components/subtitle/transcript/"
];

function walkFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    const stats = statSync(path);
    if (stats.isDirectory()) {
      return walkFiles(path);
    }
    return /\.(ts|vue)$/.test(path) ? [path] : [];
  });
}

function normalize(path: string): string {
  return relative(rendererRoot, path).replaceAll("\\", "/");
}

describe("desktop UI library boundary", () => {
  it("declares the approved open-source UI dependencies", () => {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
      dependencies?: Record<string, string>;
    };

    expect(packageJson.dependencies?.["reka-ui"]).toBe("2.9.7");
    expect(packageJson.dependencies?.["lucide-vue-next"]).toBe("1.0.0");
  });

  it("keeps reka-ui imports inside the local UI primitive layer", () => {
    const offenders = walkFiles(rendererRoot)
      .filter((path) => {
        const rel = normalize(path);
        return !excludedPathFragments.some((fragment) => rel.startsWith(fragment) || rel === fragment);
      })
      .filter((path) => readFileSync(path, "utf8").includes("from \"reka-ui\""))
      .map(normalize);

    expect(offenders).toEqual([]);
    expect(existsSync(uiRoot)).toBe(true);
  });

  it("keeps shadcn-vue registry imports out of feature components", () => {
    const offenders = walkFiles(rendererRoot)
      .filter((path) => !normalize(path).startsWith("components/ui/"))
      .filter((path) => /shadcn-vue|registry\/.*ui/.test(readFileSync(path, "utf8")))
      .map(normalize);

    expect(offenders).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the focused test and verify the dependency assertion fails**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app vitest run --project jsdom src/renderer/uiLibraryBoundary.test.ts
```

Expected: FAIL with an assertion showing `expected undefined to be '2.9.7'` for `reka-ui`.

- [ ] **Step 3: Add the approved dependencies**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app add reka-ui@2.9.7 lucide-vue-next@1.0.0
```

Expected: `apps/desktop-app/package.json` contains:

```json
"dependencies": {
  "@immersive-subs/contracts": "workspace:*",
  "@immersive-subs/plugin-sdk": "workspace:*",
  "@chenglou/pretext": "0.0.7",
  "decompress": "4.2.1",
  "get-windows": "9.3.0",
  "iconv-lite": "0.7.2",
  "koffi": "2.16.2",
  "lucide-vue-next": "1.0.0",
  "pinia": "3.0.4",
  "reka-ui": "2.9.7",
  "vue": "3.5.34",
  "ws": "8.20.0"
}
```

- [ ] **Step 4: Run the boundary test and verify it passes**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app vitest run --project jsdom src/renderer/uiLibraryBoundary.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add apps/desktop-app/package.json pnpm-lock.yaml apps/desktop-app/src/renderer/uiLibraryBoundary.test.ts
git commit -m "test: lock desktop ui library boundary"
```

Expected: commit succeeds.

---

### Task 2: Define The Final UI Primitive API With Tests

**Files:**
- Modify: `apps/desktop-app/src/renderer/components/ui/UiComponents.test.ts`
- Modify: `apps/desktop-app/src/renderer/components/ui/index.ts`
- Create in Task 3: `apps/desktop-app/src/renderer/components/ui/UiSlider.vue`
- Create in Task 3: `apps/desktop-app/src/renderer/components/ui/UiTooltip.vue`
- Create in Task 3: `apps/desktop-app/src/renderer/components/ui/UiPopover.vue`
- Create in Task 3: `apps/desktop-app/src/renderer/components/ui/UiSeparator.vue`

- [ ] **Step 1: Extend the primitive tests**

Update the import list in `apps/desktop-app/src/renderer/components/ui/UiComponents.test.ts`:

```ts
import {
  UiBadge,
  UiButton,
  UiEmptyState,
  UiField,
  UiIconButton,
  UiInput,
  UiListItem,
  UiPopover,
  UiProgress,
  UiSection,
  UiSelect,
  UiSegmentedControl,
  UiSeparator,
  UiSlider,
  UiStatus,
  UiSwitch,
  UiTextarea,
  UiTooltip
} from "./index";
```

Replace the current `emits model updates from form controls` test with:

```ts
  it("emits model updates from form controls", async () => {
    const input = mount(UiInput, { props: { modelValue: "one" } });
    await input.get("input").setValue("two");
    expect(input.emitted("update:modelValue")?.[0]).toEqual(["two"]);

    const textarea = mount(UiTextarea, { props: { modelValue: "a" } });
    await textarea.get("textarea").setValue("b");
    expect(textarea.emitted("update:modelValue")?.[0]).toEqual(["b"]);

    const select = mount(UiSelect, {
      props: {
        modelValue: "dark",
        ariaLabel: "Theme",
        options: [
          { value: "system", label: "System" },
          { value: "dark", label: "Dark" }
        ]
      },
      attachTo: document.body
    });
    expect(select.find("select").exists()).toBe(false);
    expect(select.get('[role="combobox"]').attributes("aria-label")).toBe("Theme");
    await select.get('[role="combobox"]').trigger("click");
    const systemOption = document.body.querySelector('[data-value="system"]');
    expect(systemOption).toBeInstanceOf(HTMLElement);
    (systemOption as HTMLElement).click();
    expect(select.emitted("update:modelValue")?.[0]).toEqual(["system"]);

    const toggle = mount(UiSwitch, { props: { modelValue: false, label: "On" } });
    expect(toggle.find('input[type="checkbox"]').exists()).toBe(false);
    expect(toggle.get('[role="switch"]').attributes("aria-checked")).toBe("false");
    await toggle.get('[role="switch"]').trigger("click");
    expect(toggle.emitted("update:modelValue")?.[0]).toEqual([true]);
  });
```

Append these tests:

```ts
  it("renders slider with native event passthrough for playback scrubbing", async () => {
    const slider = mount(UiSlider, {
      props: {
        modelValue: 10,
        min: 0,
        max: 100,
        step: 1,
        label: "Playback position"
      }
    });

    const input = slider.get('input[type="range"]');
    expect(input.attributes("aria-label")).toBe("Playback position");
    await input.setValue("42");

    expect(slider.emitted("update:modelValue")?.[0]).toEqual([42]);
    expect(slider.emitted("input")?.[0]?.[0]).toBeInstanceOf(Event);
  });

  it("renders tooltip, popover, and separator primitives with stable slots", async () => {
    const tooltip = mount(UiTooltip, {
      props: { text: "Refresh cache" },
      slots: { default: "<button>Refresh</button>" },
      attachTo: document.body
    });

    expect(tooltip.get("button").text()).toBe("Refresh");

    const popover = mount(UiPopover, {
      props: { label: "More actions" },
      slots: {
        trigger: "<button>More</button>",
        default: "<p>Action list</p>"
      },
      attachTo: document.body
    });

    await popover.get("button").trigger("click");
    expect(document.body.textContent).toContain("Action list");

    const separator = mount(UiSeparator);
    expect(separator.attributes("role")).toBe("separator");
    expect(separator.classes()).toContain("ui-separator");
  });
```

- [ ] **Step 2: Run the primitive tests and verify the new assertions fail**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app vitest run --project jsdom src/renderer/components/ui/UiComponents.test.ts
```

Expected: FAIL because `UiSlider`, `UiTooltip`, `UiPopover`, and `UiSeparator` are not exported and `UiSelect` / `UiSwitch` still render native controls.

- [ ] **Step 3: Commit the failing tests**

Run:

```bash
git add apps/desktop-app/src/renderer/components/ui/UiComponents.test.ts
git commit -m "test: define final ui primitive contracts"
```

Expected: commit succeeds with failing tests committed for the next task.

---

### Task 3: Implement Reka-Backed And Shadcn-Inspired UI Primitives

**Files:**
- Modify: `apps/desktop-app/src/renderer/components/ui/UiButton.vue`
- Modify: `apps/desktop-app/src/renderer/components/ui/UiIconButton.vue`
- Modify: `apps/desktop-app/src/renderer/components/ui/UiSelect.vue`
- Modify: `apps/desktop-app/src/renderer/components/ui/UiSwitch.vue`
- Modify: `apps/desktop-app/src/renderer/components/ui/UiSegmentedControl.vue`
- Create: `apps/desktop-app/src/renderer/components/ui/UiSlider.vue`
- Create: `apps/desktop-app/src/renderer/components/ui/UiTooltip.vue`
- Create: `apps/desktop-app/src/renderer/components/ui/UiPopover.vue`
- Create: `apps/desktop-app/src/renderer/components/ui/UiSeparator.vue`
- Modify: `apps/desktop-app/src/renderer/components/ui/index.ts`

- [ ] **Step 1: Update `UiButton` to expose shadcn-like slots and sizing**

Replace `apps/desktop-app/src/renderer/components/ui/UiButton.vue` with:

```vue
<template>
  <button
    class="ui-button"
    :class="[
      `ui-button--${variant}`,
      `ui-button--${size}`,
      { 'ui-button--block': block }
    ]"
    data-slot="button"
    :data-variant="variant"
    :data-size="size"
    :type="type"
    :disabled="disabled"
  >
    <slot />
  </button>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    variant?: "primary" | "secondary" | "ghost" | "danger";
    size?: "sm" | "md" | "lg";
    type?: "button" | "submit" | "reset";
    disabled?: boolean;
    block?: boolean;
  }>(),
  {
    variant: "secondary",
    size: "md",
    type: "button",
    disabled: false,
    block: false
  }
);
</script>
```

- [ ] **Step 2: Update `UiIconButton` to use the same size contract**

Replace `apps/desktop-app/src/renderer/components/ui/UiIconButton.vue` with:

```vue
<template>
  <button
    class="ui-icon-button"
    :class="[
      `ui-icon-button--${variant}`,
      `ui-icon-button--${size}`,
      { 'is-active': active }
    ]"
    data-slot="icon-button"
    :data-variant="variant"
    :data-size="size"
    type="button"
    :disabled="disabled"
    :aria-label="label"
    :aria-pressed="pressed"
    :title="title || label"
  >
    <slot />
  </button>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    label: string;
    title?: string;
    variant?: "ghost" | "secondary" | "danger";
    size?: "sm" | "md" | "lg";
    disabled?: boolean;
    active?: boolean;
    pressed?: boolean | "true" | "false" | "mixed";
  }>(),
  {
    title: "",
    variant: "ghost",
    size: "md",
    disabled: false,
    active: false,
    pressed: undefined
  }
);
</script>
```

- [ ] **Step 3: Replace `UiSelect` with a Reka-backed select**

Replace `apps/desktop-app/src/renderer/components/ui/UiSelect.vue` with:

```vue
<template>
  <SelectRoot
    :model-value="modelValue"
    :disabled="disabled"
    @update:model-value="emitValue"
  >
    <SelectTrigger
      v-bind="attrs"
      class="ui-select"
      data-slot="select-trigger"
      :aria-label="ariaLabel"
    >
      <SelectValue :placeholder="placeholder" />
      <SelectIcon class="ui-select__icon" aria-hidden="true">⌄</SelectIcon>
    </SelectTrigger>
    <SelectPortal>
      <SelectContent class="ui-select-content" data-slot="select-content" position="popper">
        <SelectViewport class="ui-select-content__viewport">
          <SelectItem
            v-for="option in options"
            :key="option.value"
            class="ui-select-item"
            data-slot="select-item"
            :data-value="option.value"
            :value="option.value"
            :disabled="option.disabled"
          >
            <SelectItemText>{{ option.label }}</SelectItemText>
          </SelectItem>
        </SelectViewport>
      </SelectContent>
    </SelectPortal>
  </SelectRoot>
</template>

<script setup lang="ts">
import { useAttrs } from "vue";
import {
  SelectContent,
  SelectIcon,
  SelectItem,
  SelectItemText,
  SelectPortal,
  SelectRoot,
  SelectTrigger,
  SelectValue,
  SelectViewport
} from "reka-ui";

defineOptions({ inheritAttrs: false });

const attrs = useAttrs();

const props = withDefaults(
  defineProps<{
    modelValue: string;
    options: Array<{ value: string; label: string; disabled?: boolean }>;
    disabled?: boolean;
    ariaLabel?: string;
    placeholder?: string;
  }>(),
  {
    disabled: false,
    ariaLabel: "",
    placeholder: ""
  }
);

const emit = defineEmits<{ "update:modelValue": [value: string] }>();

function emitValue(value: string | string[] | undefined) {
  if (typeof value === "string") {
    emit("update:modelValue", value);
    return;
  }
  emit("update:modelValue", props.modelValue);
}
</script>
```

- [ ] **Step 4: Replace `UiSwitch` with a Reka-backed switch**

Replace `apps/desktop-app/src/renderer/components/ui/UiSwitch.vue` with:

```vue
<template>
  <label class="ui-switch" :class="{ 'ui-switch--disabled': disabled }">
    <SwitchRoot
      class="ui-switch__control"
      data-slot="switch"
      :model-value="modelValue"
      :disabled="disabled"
      :aria-label="label"
      :data-testid="inputTestId || undefined"
      @update:model-value="$emit('update:modelValue', $event)"
    >
      <SwitchThumb class="ui-switch__thumb" />
    </SwitchRoot>
    <span v-if="showLabel" class="ui-switch__label toggle__text">{{ label }}</span>
  </label>
</template>

<script setup lang="ts">
import { SwitchRoot, SwitchThumb } from "reka-ui";

withDefaults(
  defineProps<{
    modelValue: boolean;
    label: string;
    inputTestId?: string;
    showLabel?: boolean;
    disabled?: boolean;
  }>(),
  {
    inputTestId: "",
    showLabel: true,
    disabled: false
  }
);

defineEmits<{ "update:modelValue": [value: boolean] }>();
</script>
```

- [ ] **Step 5: Add shadcn-style slots to `UiSegmentedControl`**

Replace `apps/desktop-app/src/renderer/components/ui/UiSegmentedControl.vue` with:

```vue
<template>
  <div class="ui-segmented" data-slot="segmented-control" role="radiogroup" :aria-label="label">
    <button
      v-for="option in options"
      :key="option.value"
      type="button"
      class="ui-segmented__item"
      data-slot="segmented-control-item"
      :data-state="modelValue === option.value ? 'checked' : 'unchecked'"
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

- [ ] **Step 6: Add `UiSlider` with native event passthrough**

Create `apps/desktop-app/src/renderer/components/ui/UiSlider.vue`:

```vue
<template>
  <input
    class="ui-slider"
    data-slot="slider"
    type="range"
    :min="min"
    :max="max"
    :step="step"
    :value="modelValue"
    :disabled="disabled"
    :aria-label="label"
    :style="fillStyle"
    @pointerdown="$emit('pointerdown', $event)"
    @pointercancel="$emit('pointercancel', $event)"
    @input="handleInput"
    @change="$emit('change', $event)"
  />
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    modelValue: number;
    min?: number;
    max?: number;
    step?: number;
    label: string;
    disabled?: boolean;
    fillStyle?: Record<string, string>;
  }>(),
  {
    min: 0,
    max: 100,
    step: 1,
    disabled: false,
    fillStyle: () => ({})
  }
);

const emit = defineEmits<{
  "update:modelValue": [value: number];
  input: [event: Event];
  change: [event: Event];
  pointerdown: [event: PointerEvent];
  pointercancel: [event: PointerEvent];
}>();

function handleInput(event: Event) {
  const value = Number((event.target as HTMLInputElement).value);
  if (Number.isFinite(value)) {
    emit("update:modelValue", value);
  }
  emit("input", event);
}
</script>
```

- [ ] **Step 7: Add `UiTooltip`**

Create `apps/desktop-app/src/renderer/components/ui/UiTooltip.vue`:

```vue
<template>
  <TooltipProvider :delay-duration="delayDuration">
    <TooltipRoot>
      <TooltipTrigger as-child>
        <slot />
      </TooltipTrigger>
      <TooltipPortal>
        <TooltipContent class="ui-tooltip" data-slot="tooltip-content" :side="side" :side-offset="sideOffset">
          {{ text }}
        </TooltipContent>
      </TooltipPortal>
    </TooltipRoot>
  </TooltipProvider>
</template>

<script setup lang="ts">
import {
  TooltipContent,
  TooltipPortal,
  TooltipProvider,
  TooltipRoot,
  TooltipTrigger
} from "reka-ui";

withDefaults(
  defineProps<{
    text: string;
    side?: "top" | "right" | "bottom" | "left";
    sideOffset?: number;
    delayDuration?: number;
  }>(),
  {
    side: "top",
    sideOffset: 6,
    delayDuration: 250
  }
);
</script>
```

- [ ] **Step 8: Add `UiPopover`**

Create `apps/desktop-app/src/renderer/components/ui/UiPopover.vue`:

```vue
<template>
  <PopoverRoot>
    <PopoverTrigger as-child :aria-label="label">
      <slot name="trigger" />
    </PopoverTrigger>
    <PopoverPortal>
      <PopoverContent class="ui-popover" data-slot="popover-content" :side="side" :side-offset="sideOffset">
        <slot />
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>

<script setup lang="ts">
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from "reka-ui";

withDefaults(
  defineProps<{
    label: string;
    side?: "top" | "right" | "bottom" | "left";
    sideOffset?: number;
  }>(),
  {
    side: "bottom",
    sideOffset: 6
  }
);
</script>
```

- [ ] **Step 9: Add `UiSeparator`**

Create `apps/desktop-app/src/renderer/components/ui/UiSeparator.vue`:

```vue
<template>
  <div class="ui-separator" role="separator" aria-orientation="horizontal" />
</template>
```

- [ ] **Step 10: Export the new primitives**

Update `apps/desktop-app/src/renderer/components/ui/index.ts`:

```ts
export { default as UiBadge } from "./UiBadge.vue";
export { default as UiButton } from "./UiButton.vue";
export { default as UiEmptyState } from "./UiEmptyState.vue";
export { default as UiField } from "./UiField.vue";
export { default as UiIconButton } from "./UiIconButton.vue";
export { default as UiInput } from "./UiInput.vue";
export { default as UiListItem } from "./UiListItem.vue";
export { default as UiPopover } from "./UiPopover.vue";
export { default as UiProgress } from "./UiProgress.vue";
export { default as UiSection } from "./UiSection.vue";
export { default as UiSelect } from "./UiSelect.vue";
export { default as UiSegmentedControl } from "./UiSegmentedControl.vue";
export { default as UiSeparator } from "./UiSeparator.vue";
export { default as UiSlider } from "./UiSlider.vue";
export { default as UiStatus } from "./UiStatus.vue";
export { default as UiSwitch } from "./UiSwitch.vue";
export { default as UiTextarea } from "./UiTextarea.vue";
export { default as UiTooltip } from "./UiTooltip.vue";
```

- [ ] **Step 11: Run primitive tests**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app vitest run --project jsdom src/renderer/components/ui/UiComponents.test.ts
```

Expected: PASS.

- [ ] **Step 12: Run boundary tests**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app vitest run --project jsdom src/renderer/uiLibraryBoundary.test.ts
```

Expected: PASS.

- [ ] **Step 13: Commit**

Run:

```bash
git add apps/desktop-app/src/renderer/components/ui apps/desktop-app/src/renderer/uiLibraryBoundary.test.ts
git commit -m "feat: add shadcn inspired desktop ui primitives"
```

Expected: commit succeeds.

---

### Task 4: Replace Custom SVG Icons With Lucide-Backed Local Icons

**Files:**
- Create: `apps/desktop-app/src/renderer/components/icons/iconSizing.ts`
- Modify: `apps/desktop-app/src/renderer/components/icons/IconAdd.vue`
- Modify: `apps/desktop-app/src/renderer/components/icons/IconCheck.vue`
- Modify: `apps/desktop-app/src/renderer/components/icons/IconChevronDown.vue`
- Modify: `apps/desktop-app/src/renderer/components/icons/IconChevronUp.vue`
- Modify: `apps/desktop-app/src/renderer/components/icons/IconDelete.vue`
- Modify: `apps/desktop-app/src/renderer/components/icons/IconFolder.vue`
- Modify: `apps/desktop-app/src/renderer/components/icons/IconFullscreen.vue`
- Modify: `apps/desktop-app/src/renderer/components/icons/IconLock.vue`
- Modify: `apps/desktop-app/src/renderer/components/icons/IconPause.vue`
- Modify: `apps/desktop-app/src/renderer/components/icons/IconPin.vue`
- Modify: `apps/desktop-app/src/renderer/components/icons/IconPlay.vue`
- Modify: `apps/desktop-app/src/renderer/components/icons/IconRefresh.vue`
- Modify: `apps/desktop-app/src/renderer/components/icons/IconSettings.vue`
- Modify: `apps/desktop-app/src/renderer/components/icons/index.ts`
- Delete: `apps/desktop-app/src/renderer/shared/iconDefs.ts`
- Create: `apps/desktop-app/src/renderer/components/icons/icons.test.ts`

- [ ] **Step 1: Write the icon boundary test**

Create `apps/desktop-app/src/renderer/components/icons/icons.test.ts`:

```ts
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import { IconAdd, IconDelete, IconPlay, IconSettings } from "./index";

describe("lucide-backed local icons", () => {
  it("keeps the local icon API while rendering lucide svg output", () => {
    for (const Icon of [IconAdd, IconDelete, IconPlay, IconSettings]) {
      const wrapper = mount(Icon, { props: { size: "md" } });
      const svg = wrapper.get("svg");

      expect(svg.attributes("aria-hidden")).toBe("true");
      expect(svg.classes()).toContain("icon");
      expect(svg.classes()).toContain("icon--md");
      expect(svg.attributes("width")).toBe("16");
      expect(svg.attributes("height")).toBe("16");
    }
  });
});
```

- [ ] **Step 2: Run the icon test and verify it fails before replacement**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app vitest run --project jsdom src/renderer/components/icons/icons.test.ts
```

Expected: FAIL because existing icons do not expose Lucide width/height attributes consistently.

- [ ] **Step 3: Add shared icon sizing**

Create `apps/desktop-app/src/renderer/components/icons/iconSizing.ts`:

```ts
export type IconSize = "sm" | "md" | "lg";

export const ICON_SIZE_PX: Record<IconSize, number> = {
  sm: 14,
  md: 16,
  lg: 20
};

export function iconClass(size: IconSize) {
  return ["icon", `icon--${size}`];
}
```

- [ ] **Step 4: Replace each local icon wrapper with a lucide component**

Use this mapping and preserve each filename:

```ts
IconAdd.vue -> Plus
IconCheck.vue -> Check
IconChevronDown.vue -> ChevronDown
IconChevronUp.vue -> ChevronUp
IconDelete.vue -> Trash2
IconFolder.vue -> FolderOpen
IconFullscreen.vue -> Maximize2
IconLock.vue -> Lock
IconPause.vue -> Pause
IconPin.vue -> Pin
IconPlay.vue -> Play
IconRefresh.vue -> RefreshCw
IconSettings.vue -> Settings
```

Use this exact component shape for `IconAdd.vue`, changing only the imported Lucide component for the other files:

```vue
<template>
  <Plus
    :class="iconClass(size)"
    :size="ICON_SIZE_PX[size]"
    :stroke-width="2"
    aria-hidden="true"
  />
</template>

<script setup lang="ts">
import { Plus } from "lucide-vue-next";
import { ICON_SIZE_PX, iconClass, type IconSize } from "./iconSizing";

const { size = "md" } = defineProps<{
  size?: IconSize;
}>();
</script>
```

- [ ] **Step 5: Remove the old shared icon definitions**

Run:

```bash
rg -n "shared/iconDefs|ICON_" apps/desktop-app/src/renderer
```

Expected after replacements: no results.

Delete:

```bash
rm apps/desktop-app/src/renderer/shared/iconDefs.ts
```

- [ ] **Step 6: Run icon and renderer tests**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app vitest run --project jsdom src/renderer/components/icons/icons.test.ts
pnpm --filter @immersive-subs/desktop-app vitest run --project jsdom src/renderer/components/ui/UiComponents.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

Run:

```bash
git add apps/desktop-app/src/renderer/components/icons apps/desktop-app/src/renderer/shared/iconDefs.ts
git commit -m "feat: use lucide backed desktop icons"
```

Expected: commit succeeds.

---

### Task 5: Apply The Final Shadcn-Inspired CSS Token And Primitive Styles

**Files:**
- Modify: `apps/desktop-app/src/renderer/style.css`
- Modify: `apps/desktop-app/src/renderer/styleConvergence.test.ts`

- [ ] **Step 1: Strengthen CSS convergence tests**

Append this test to `apps/desktop-app/src/renderer/styleConvergence.test.ts`:

```ts
  it("contains final primitive styles for the open-source UI foundation", () => {
    for (const selector of [
      ".ui-button",
      ".ui-icon-button",
      ".ui-select",
      ".ui-select-content",
      ".ui-select-item",
      ".ui-switch__control",
      ".ui-slider",
      ".ui-tooltip",
      ".ui-popover",
      ".ui-separator"
    ]) {
      expect(css).toContain(selector);
    }
  });

  it("keeps Tailwind utility classes out of app styles", () => {
    expect(activeCss).not.toMatch(/\.(?:items-center|justify-center|rounded-md|text-sm|bg-primary|text-muted-foreground|border-input)\b/);
  });
```

- [ ] **Step 2: Run CSS convergence test and verify it fails**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app vitest run --project jsdom src/renderer/styleConvergence.test.ts
```

Expected: FAIL because the new selectors are not all present.

- [ ] **Step 3: Replace primitive CSS blocks**

In `apps/desktop-app/src/renderer/style.css`, replace the existing `.ui-button`, `.ui-icon-button`, `.ui-input`, `.ui-textarea`, `.ui-select`, `.ui-switch`, `.ui-progress`, `.ui-segmented`, `.ui-badge`, `.ui-status`, `.ui-empty-state`, and `.ui-section` primitive blocks with a single primitive section using these class names:

```css
.ui-button,
.ui-icon-button,
.ui-input,
.ui-textarea,
.ui-select {
  font: inherit;
}

.ui-button {
  min-height: 34px;
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius-sm);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--ui-text);
  background: var(--ui-surface);
  cursor: pointer;
  user-select: none;
  white-space: nowrap;
}

.ui-button--sm { min-height: 28px; padding: 0 10px; font-size: var(--ui-font-sm); }
.ui-button--md { min-height: 34px; padding: 0 12px; font-size: var(--ui-font-md); }
.ui-button--lg { min-height: 38px; padding: 0 14px; font-size: 14px; }
.ui-button--block { width: 100%; }
.ui-button--primary { border-color: var(--ui-accent); color: #ffffff; background: var(--ui-accent); }
.ui-button--secondary { border-color: var(--ui-border); background: var(--ui-surface); }
.ui-button--ghost { border-color: transparent; color: var(--ui-text-muted); background: transparent; }
.ui-button--danger { border-color: var(--ui-border); color: var(--ui-danger); background: var(--ui-surface); }

.ui-icon-button {
  width: 32px;
  height: 32px;
  border: 1px solid transparent;
  border-radius: var(--ui-radius-sm);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  color: var(--ui-text-muted);
  background: transparent;
  cursor: pointer;
  user-select: none;
}

.ui-icon-button--sm { width: 28px; height: 28px; }
.ui-icon-button--md { width: 32px; height: 32px; }
.ui-icon-button--lg { width: 36px; height: 36px; }
.ui-icon-button--secondary { border-color: var(--ui-border); background: var(--ui-surface); color: var(--ui-text); }
.ui-icon-button--danger { color: var(--ui-danger); }
.ui-icon-button.is-active { border-color: var(--ui-accent); color: var(--ui-accent); background: var(--ui-surface-muted); }

.ui-button:hover:not(:disabled),
.ui-icon-button:hover:not(:disabled),
.ui-select:hover:not([data-disabled]) {
  border-color: var(--ui-accent);
}

.ui-input,
.ui-textarea,
.ui-select {
  width: 100%;
  min-height: 34px;
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius-sm);
  padding: 6px 10px;
  color: var(--ui-text);
  background: var(--ui-surface);
}

.ui-select {
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  cursor: pointer;
}

.ui-select__icon {
  color: var(--ui-text-muted);
}

.ui-select-content,
.ui-popover,
.ui-tooltip {
  z-index: 10000;
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius-sm);
  background: var(--ui-surface);
  color: var(--ui-text);
}

.ui-select-content {
  min-width: 180px;
  max-height: 260px;
  overflow: hidden;
}

.ui-select-content__viewport {
  padding: 4px;
}

.ui-select-item {
  min-height: 30px;
  border-radius: var(--ui-radius-sm);
  display: flex;
  align-items: center;
  padding: 0 8px;
  color: var(--ui-text);
  cursor: pointer;
}

.ui-select-item[data-highlighted] {
  outline: none;
  background: var(--ui-surface-muted);
}

.ui-select-item[data-disabled] {
  opacity: 0.55;
  cursor: not-allowed;
}

.ui-switch {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--ui-text);
}

.ui-switch__control {
  position: relative;
  width: 34px;
  height: 20px;
  border: 1px solid var(--ui-border);
  border-radius: 999px;
  padding: 0;
  background: var(--ui-surface-muted);
  cursor: pointer;
}

.ui-switch__control[data-state="checked"] {
  border-color: var(--ui-accent);
  background: var(--ui-accent);
}

.ui-switch__thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 14px;
  height: 14px;
  border-radius: 999px;
  background: var(--ui-surface);
  transform: translateX(0);
}

.ui-switch__control[data-state="checked"] .ui-switch__thumb {
  transform: translateX(14px);
}

.ui-slider {
  width: 100%;
  min-width: 80px;
  accent-color: var(--ui-accent);
}

.ui-tooltip {
  padding: 4px 8px;
  font-size: var(--ui-font-sm);
}

.ui-popover {
  min-width: 180px;
  padding: 8px;
}

.ui-separator {
  height: 1px;
  width: 100%;
  background: var(--ui-border);
}

.ui-button:disabled,
.ui-icon-button:disabled,
.ui-input:disabled,
.ui-textarea:disabled,
.ui-select[data-disabled],
.ui-switch--disabled,
.ui-slider:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.ui-button:focus-visible,
.ui-icon-button:focus-visible,
.ui-input:focus-visible,
.ui-textarea:focus-visible,
.ui-select:focus-visible,
.ui-switch__control:focus-visible,
.ui-slider:focus-visible,
.ui-segmented__item:focus-visible {
  outline: 2px solid var(--ui-accent);
  outline-offset: 2px;
}
```

- [ ] **Step 4: Run CSS and primitive tests**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app vitest run --project jsdom src/renderer/styleConvergence.test.ts src/renderer/components/ui/UiComponents.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add apps/desktop-app/src/renderer/style.css apps/desktop-app/src/renderer/styleConvergence.test.ts
git commit -m "style: apply final desktop ui primitive system"
```

Expected: commit succeeds.

---

### Task 6: Convert Settings And Plugin Settings To Final Primitives

**Files:**
- Modify: `apps/desktop-app/src/renderer/components/settings/SettingsNav.vue`
- Modify: `apps/desktop-app/src/renderer/components/settings/profiles/ProfileUrlRules.vue`
- Modify: `apps/desktop-app/src/renderer/components/settings/profiles/SubtitleStyleFields.vue`
- Modify: `apps/desktop-app/src/renderer/components/settings/profiles/ColorSchemeGrid.vue`
- Modify: `apps/desktop-app/src/renderer/components/settings/SettingsGlobal.vue`
- Modify: `apps/desktop-app/src/renderer/components/settings/SettingsCache.vue`
- Modify: `apps/desktop-app/src/renderer/components/settings/SettingsPlugins.vue`
- Modify: `apps/desktop-app/src/renderer/components/settings/SettingsProfiles.vue`
- Modify: `apps/desktop-app/src/renderer/components/settings/SettingsTranscription.vue`
- Modify: `apps/desktop-app/src/renderer/components/settings/SettingsWordLookup.vue`
- Modify: `apps/desktop-app/src/renderer/components/settings/SettingsMediaServer.vue`
- Modify: `apps/desktop-app/src/renderer/components/settings/transcription/*.vue`
- Modify: `apps/desktop-app/src/renderer/components/settings/*.test.ts`
- Modify: `apps/desktop-app/src/renderer/components/settings/*.browser.test.ts`

- [ ] **Step 1: Write guardrail tests for raw controls in settings**

Append this test to `apps/desktop-app/src/renderer/uiLibraryBoundary.test.ts`:

```ts
  it("keeps settings feature components on local primitives instead of raw controls", () => {
    const allowedRawControlFiles = new Set([
      "components/settings/profiles/ColorSchemeGrid.vue"
    ]);
    const offenders = walkFiles(join(rendererRoot, "components/settings"))
      .filter((path) => !normalize(path).endsWith(".test.ts"))
      .filter((path) => !allowedRawControlFiles.has(normalize(path)))
      .filter((path) => /<(button|select|textarea)\b|<input\b(?![^>]*type="color")/.test(readFileSync(path, "utf8")))
      .map(normalize);

    expect(offenders).toEqual([]);
  });
```

- [ ] **Step 2: Run the guardrail test and verify it fails**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app vitest run --project jsdom src/renderer/uiLibraryBoundary.test.ts
```

Expected: FAIL listing settings files with raw controls, including `components/settings/SettingsNav.vue`, `components/settings/profiles/ProfileUrlRules.vue`, and `components/settings/profiles/SubtitleStyleFields.vue`.

- [ ] **Step 3: Convert `SettingsNav` to `UiButton`**

Change `apps/desktop-app/src/renderer/components/settings/SettingsNav.vue` to:

```vue
<template>
  <nav class="settings-nav" data-testid="settings-nav" :aria-label="navAriaLabel">
    <UiButton
      v-for="section in sections"
      :key="section.id"
      type="button"
      variant="ghost"
      size="sm"
      class="settings-nav__item"
      :data-testid="`settings-nav-item-${section.id}`"
      :aria-current="section.id === currentSection ? 'location' : undefined"
      @click="$emit('select', section.id)"
    >
      <span class="settings-nav__item-label">{{ section.label }}</span>
    </UiButton>
  </nav>
</template>

<script setup lang="ts">
import { UiButton } from "../ui";
import type { SettingsSectionId } from "./settingsSections";

defineProps<{
  sections: ReadonlyArray<{
    id: SettingsSectionId;
    label: string;
    anchorId: string;
  }>;
  currentSection: SettingsSectionId;
  navAriaLabel: string;
}>();

defineEmits<{
  select: [id: SettingsSectionId];
}>();
</script>
```

- [ ] **Step 4: Convert `ProfileUrlRules` raw select/input controls**

In `apps/desktop-app/src/renderer/components/settings/profiles/ProfileUrlRules.vue`, import `UiInput` and `UiSelect`:

```ts
import { UiBadge, UiEmptyState, UiIconButton, UiInput, UiListItem, UiSelect, UiSwitch } from "../../ui";
```

Add this computed option list:

```ts
const matchTypeOptions = computed(() => [
  { value: "contains", label: t("rule-match-contains", "Contains") },
  { value: "exact", label: t("rule-match-exact", "Exact Match") },
  { value: "regex", label: t("rule-match-regex", "Regex") }
]);
```

Replace each raw match-type `<select>` with:

```vue
<UiSelect
  class="profile-url-rule__match-select"
  data-testid="profile-url-rule-match-type"
  :model-value="rule.matchType"
  :options="matchTypeOptions"
  :aria-label="t('rule-match-label', 'Match Type')"
  @update:model-value="updateRuleMatchType(rule.id, $event)"
  @mousedown.stop
/>
```

Replace the new-rule match-type select with:

```vue
<UiSelect
  v-model="newRule.matchType"
  class="profile-url-rule__match-select"
  :options="matchTypeOptions"
  :aria-label="t('rule-match-label', 'Match Type')"
  @mousedown.stop
/>
```

Replace each raw text input with `UiInput`:

```vue
<UiInput
  data-testid="profile-url-rule-pattern"
  type="text"
  :model-value="rule.pattern"
  :placeholder="t('rule-pattern-label', 'Pattern')"
  :aria-label="t('rule-pattern-label', 'Pattern')"
  autocomplete="off"
  @change="commitRulePattern(rule, ($event.target as HTMLInputElement).value)"
  @keydown.enter.prevent="commitRulePattern(rule, ($event.target as HTMLInputElement).value)"
  @mousedown.stop
/>
```

For the new rule:

```vue
<UiInput
  data-testid="profile-url-new-rule-pattern"
  type="text"
  v-model="newRule.pattern"
  :placeholder="t('rule-pattern-label', 'Pattern')"
  :aria-label="t('rule-pattern-label', 'Pattern')"
  autocomplete="off"
  @blur="saveNewRule"
  @keydown.enter.prevent="saveNewRule"
/>
```

- [ ] **Step 5: Convert settings range inputs to `UiSlider`**

In `apps/desktop-app/src/renderer/components/settings/profiles/SubtitleStyleFields.vue`, import `UiSlider`:

```ts
import { UiField, UiInput, UiSelect, UiSlider, UiSwitch } from "../../ui";
```

Replace each raw `input type="range"` label block with a `UiField` plus `UiSlider`. Use this exact shape for scroll position:

```vue
<UiField
  id="subtitle-scroll-position"
  :label="t('subtitle-scroll-position-label', 'Subtitle Scroll Position')"
  :value="`${subtitleScrollPosition}%`"
  :hint="t('subtitle-scroll-position-hint', 'Where active subtitles sit in the panel (0% top, 50% middle, 100% bottom)')"
>
  <UiSlider
    v-model="subtitleScrollPosition"
    :min="0"
    :max="100"
    :step="1"
    :label="t('subtitle-scroll-position-label', 'Subtitle Scroll Position')"
  />
</UiField>
```

Use these values for the remaining sliders:

```vue
<UiField id="subtitle-primary-secondary-gap" :label="t('subtitle-primary-secondary-gap-label', 'Primary to Secondary Subtitle Gap')" :value="`${subtitlePrimarySecondaryGap}px`">
  <UiSlider v-model="subtitlePrimarySecondaryGap" :min="0" :max="60" :step="1" :label="t('subtitle-primary-secondary-gap-label', 'Primary to Secondary Subtitle Gap')" />
</UiField>

<UiField id="subtitle-line-height" :label="t('subtitle-line-height-label', 'Line Height')" :value="String(subtitleLineHeight)">
  <UiSlider v-model="subtitleLineHeight" :min="1" :max="3" :step="0.05" :label="t('subtitle-line-height-label', 'Line Height')" />
</UiField>

<UiField id="subtitle-block-gap" :label="t('subtitle-block-gap-label', 'Block Gap')" :value="`${subtitleBlockGap}px`" :hint="t('subtitle-block-gap-hint', 'Gap between subtitle text blocks')">
  <UiSlider v-model="subtitleBlockGap" :min="0" :max="60" :step="1" :label="t('subtitle-block-gap-label', 'Block Gap')" />
</UiField>
```

- [ ] **Step 6: Normalize settings page surfaces**

Edit each settings and plugin settings component listed in this task so repeated records use `UiListItem`, section shells use `UiSection`, field rows use `UiField`, actions use `UiButton` or `UiIconButton`, and status values use `UiBadge` or `UiStatus`.

Concrete class removals to verify with `rg`:

```bash
rg -n "settings-panel|settings-surface|plugin-card|fw-|btn-primary|btn-secondary|settings-action-btn" apps/desktop-app/src/renderer/components/settings apps/desktop-app/src/renderer/style.css
```

Expected after edits: no results except test names or comments that explicitly assert the strings are absent.

- [ ] **Step 7: Run focused settings tests**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app vitest run --project jsdom \
  src/renderer/uiLibraryBoundary.test.ts \
  src/renderer/components/settings/SettingsCache.test.ts \
  src/renderer/components/settings/SettingsMediaServer.test.ts \
  src/renderer/components/settings/SettingsPlugins.test.ts \
  src/renderer/components/settings/SettingsWindowShell.test.ts
```

Expected: PASS.

- [ ] **Step 8: Run settings browser tests**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app vitest run --project browser \
  src/renderer/components/settings/SettingsProfiles.browser.test.ts \
  src/renderer/components/settings/SettingsWindowShell.browser.test.ts
```

Expected: PASS or intentional screenshot mismatch limited to settings UI snapshots. If snapshots mismatch, inspect the generated screenshots and update only settings snapshots.

- [ ] **Step 9: Commit**

Run:

```bash
git add apps/desktop-app/src/renderer/components/settings apps/desktop-app/src/renderer/uiLibraryBoundary.test.ts apps/desktop-app/src/renderer/style.css
git commit -m "refactor: converge desktop settings on ui primitives"
```

Expected: commit succeeds.

---

### Task 7: Convert Top Controls And Subtitle-Panel Controls

**Files:**
- Modify: `apps/desktop-app/src/renderer/components/top-panel/TopControlPanel.vue`
- Modify: `apps/desktop-app/src/renderer/components/subtitle/PlaybackControls.vue`
- Modify: `apps/desktop-app/src/renderer/components/subtitle/TrackSelector.vue`
- Modify: `apps/desktop-app/src/renderer/components/subtitle/TranscriptionControls.vue`
- Modify: `apps/desktop-app/src/renderer/components/subtitle/StatusBanner.vue`
- Modify: `apps/desktop-app/src/renderer/components/top-panel/TopControlPanel.test.ts`
- Modify: `apps/desktop-app/src/renderer/components/subtitle/SubtitleView.browser.test.ts`

- [ ] **Step 1: Add a raw-control guardrail for top and subtitle controls**

Append this test to `apps/desktop-app/src/renderer/uiLibraryBoundary.test.ts`:

```ts
  it("keeps top and subtitle-panel controls on local primitives outside the transcript body", () => {
    const allowedRawControlFiles = new Set([
      "components/subtitle/CueAnchorRail.vue",
      "components/subtitle/TranscriptSurface.vue",
      "components/subtitle/TranscriptBlock.vue"
    ]);

    const controlFiles = [
      ...walkFiles(join(rendererRoot, "components/top-panel")),
      ...walkFiles(join(rendererRoot, "components/subtitle"))
    ];

    const offenders = controlFiles
      .filter((path) => !normalize(path).endsWith(".test.ts"))
      .filter((path) => !allowedRawControlFiles.has(normalize(path)))
      .filter((path) => !normalize(path).startsWith("components/subtitle/transcript/"))
      .filter((path) => /<(button|select|textarea)\b|<input\b/.test(readFileSync(path, "utf8")))
      .map(normalize);

    expect(offenders).toEqual([]);
  });
```

- [ ] **Step 2: Run the guardrail test and verify it fails**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app vitest run --project jsdom src/renderer/uiLibraryBoundary.test.ts
```

Expected: FAIL listing `components/top-panel/TopControlPanel.vue`, `components/subtitle/PlaybackControls.vue`, and `components/subtitle/WordLookupWindow.vue`.

- [ ] **Step 3: Convert the top panel opacity range to `UiSlider`**

In `apps/desktop-app/src/renderer/components/top-panel/TopControlPanel.vue`, import `UiSlider`:

```ts
import { UiIconButton, UiSlider, UiTooltip } from "../ui";
```

Replace the opacity range with:

```vue
<UiTooltip text="Background opacity">
  <div class="transparency-inline">
    <UiSlider
      v-model="panelOpacityValue"
      class="header-slider"
      :min="0"
      :max="100"
      :step="1"
      label="Background opacity"
    />
  </div>
</UiTooltip>
```

- [ ] **Step 4: Convert playback slider to `UiSlider` without changing scrub events**

In `apps/desktop-app/src/renderer/components/subtitle/PlaybackControls.vue`, import `UiSlider`:

```ts
import { UiIconButton, UiSlider, UiTooltip } from "../ui";
```

Replace the raw playback range with:

```vue
<UiSlider
  class="playback-slider"
  :model-value="sliderValue"
  :min="0"
  :max="sliderMax"
  :step="sliderStep"
  :disabled="!sliderEnabled"
  :fill-style="sliderFillStyle"
  :label="t('playback-position-label', 'Playback Position')"
  @pointerdown="$emit('scrub-start')"
  @pointercancel="$emit('scrub-cancel')"
  @input="$emit('scrub-input', $event)"
  @change="$emit('scrub-end', $event)"
/>
```

Keep the emitted event names and payload types unchanged.

- [ ] **Step 5: Wrap icon-only controls with tooltips where labels are not visible**

Use this pattern for top-panel and playback icon buttons:

```vue
<UiTooltip :text="pinLabel">
  <UiIconButton
    :label="pinLabel"
    :pressed="isPinned"
    :active="isPinned"
    @click="cyclePin"
  >
    <IconPin v-if="alwaysOnTop === 'off'" size="md" />
    <IconPin v-else-if="alwaysOnTop === 'floating'" size="md" />
    <IconLock v-else size="md" />
  </UiIconButton>
</UiTooltip>
```

Apply the same pattern to fullscreen, settings, play/pause, and auto-hide icon buttons with their existing labels.

- [ ] **Step 6: Convert status banner to `UiStatus`**

Update `apps/desktop-app/src/renderer/components/subtitle/StatusBanner.vue` to:

```vue
<template>
  <UiStatus v-if="banner.text" class="status-banner" :tone="tone">
    {{ banner.text }}
  </UiStatus>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { UiStatus } from "../ui";

const props = defineProps<{
  banner: {
    text: string;
    modifier: string;
  };
}>();

const tone = computed(() => {
  if (props.banner.modifier === "error") return "danger";
  if (props.banner.modifier === "warning") return "warning";
  if (props.banner.modifier === "success") return "success";
  return "info";
});
</script>
```

- [ ] **Step 7: Run focused top/subtitle tests**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app vitest run --project jsdom \
  src/renderer/uiLibraryBoundary.test.ts \
  src/renderer/components/top-panel/TopControlPanel.test.ts \
  src/renderer/components/subtitle/WordLookupWindow.test.ts
```

Expected: PASS.

- [ ] **Step 8: Run subtitle browser tests**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app vitest run --project browser \
  src/renderer/components/subtitle/SubtitleView.browser.test.ts \
  src/renderer/components/subtitle/TranscriptSurface.browser.test.ts
```

Expected: PASS. Transcript screenshots and geometry-sensitive assertions must not change.

- [ ] **Step 9: Commit**

Run:

```bash
git add apps/desktop-app/src/renderer/components/top-panel apps/desktop-app/src/renderer/components/subtitle apps/desktop-app/src/renderer/uiLibraryBoundary.test.ts apps/desktop-app/src/renderer/style.css
git commit -m "refactor: converge subtitle panel controls on ui primitives"
```

Expected: commit succeeds.

---

### Task 8: Finalize Word Lookup Chrome On Shared Tokens

**Files:**
- Modify: `apps/desktop-app/src/renderer/components/subtitle/WordLookupWindow.vue`
- Modify: `apps/desktop-app/src/renderer/components/subtitle/WordLookupWindow.test.ts`
- Modify: `apps/desktop-app/src/renderer/style.css`

- [ ] **Step 1: Add word lookup chrome assertions**

Append this test to `apps/desktop-app/src/renderer/components/subtitle/WordLookupWindow.test.ts`:

```ts
  it("uses primitive-compatible chrome for resize and scroll affordances", () => {
    const wrapper = mount(WordLookupWindow, {
      global: {
        stubs: {
          teleport: true
        }
      }
    });

    expect(wrapper.get('[data-testid="word-lookup-resize-handle"]').classes()).toContain("ui-resize-handle");
    expect(wrapper.get('[data-testid="word-lookup-scrollbar"]').classes()).toContain("ui-scrollbar");
  });
```

- [ ] **Step 2: Run the word lookup test and verify it fails**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app vitest run --project jsdom src/renderer/components/subtitle/WordLookupWindow.test.ts
```

Expected: FAIL because the new primitive-compatible chrome classes are not present.

- [ ] **Step 3: Update word lookup chrome classes**

In `apps/desktop-app/src/renderer/components/subtitle/WordLookupWindow.vue`, change:

```vue
class="word-lookup-scrollbar"
```

to:

```vue
class="word-lookup-scrollbar ui-scrollbar"
```

Change:

```vue
class="word-lookup-resize-handle"
```

to:

```vue
class="word-lookup-resize-handle ui-resize-handle"
```

Keep `type="button"`, `aria-label`, `data-testid`, and `@pointerdown="beginResizeDrag"` unchanged.

- [ ] **Step 4: Add shared chrome styles**

In `apps/desktop-app/src/renderer/style.css`, add:

```css
.ui-scrollbar {
  border-radius: 999px;
  background: transparent;
}

.ui-scrollbar [class$="__thumb"],
.word-lookup-scrollbar__thumb {
  border-radius: 999px;
  background: var(--ui-border);
}

.ui-resize-handle {
  border: 1px solid transparent;
  border-radius: var(--ui-radius-sm);
  background: transparent;
  color: var(--ui-text-muted);
  cursor: nwse-resize;
}

.ui-resize-handle:focus-visible {
  outline: 2px solid var(--ui-accent);
  outline-offset: 2px;
}
```

- [ ] **Step 5: Run word lookup and guardrail tests**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app vitest run --project jsdom \
  src/renderer/components/subtitle/WordLookupWindow.test.ts \
  src/renderer/uiLibraryBoundary.test.ts \
  src/renderer/styleConvergence.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```bash
git add apps/desktop-app/src/renderer/components/subtitle/WordLookupWindow.vue apps/desktop-app/src/renderer/components/subtitle/WordLookupWindow.test.ts apps/desktop-app/src/renderer/style.css
git commit -m "style: converge word lookup chrome"
```

Expected: commit succeeds.

---

### Task 9: Full Verification And Cleanup

**Files:**
- Modify only files required by failing tests from previous tasks.

- [ ] **Step 1: Run desktop renderer tests**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app test:renderer
```

Expected: PASS.

- [ ] **Step 2: Run desktop typecheck**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app typecheck
```

Expected: PASS.

- [ ] **Step 3: Run root tests to catch workspace regressions**

Run:

```bash
pnpm test
```

Expected: PASS.

- [ ] **Step 4: Search for disallowed dependencies and visual systems**

Run:

```bash
rg -n "from ['\"]reka-ui['\"]" apps/desktop-app/src/renderer/components --glob '!ui/**'
rg -n "shadcn-vue|registry/.*ui|tailwind|settings-surface|plugin-card|fw-|btn-primary|btn-secondary|settings-action-btn|box-shadow|linear-gradient|radial-gradient|backdrop-filter|filter:\\s*blur" apps/desktop-app/src/renderer
rg -n "<button|<select|<textarea|<input" apps/desktop-app/src/renderer/components/settings apps/desktop-app/src/renderer/components/top-panel apps/desktop-app/src/renderer/components/subtitle --glob '!**/TranscriptSurface.vue' --glob '!**/TranscriptBlock.vue' --glob '!**/transcript/**' --glob '!**/CueAnchorRail.vue'
```

Expected:

- First command: no results.
- Second command: no results except tests asserting strings are absent and transcript-body styles explicitly excluded by convergence tests.
- Third command: no results except `ColorSchemeGrid.vue` color inputs and `WordLookupWindow.vue` resize-handle button if the final implementation keeps that specialized native handle with `ui-resize-handle`.

- [ ] **Step 5: Inspect the final diff**

Run:

```bash
git diff --stat HEAD
git diff -- apps/desktop-app/src/renderer/components/subtitle/TranscriptSurface.vue apps/desktop-app/src/renderer/components/subtitle/TranscriptBlock.vue apps/desktop-app/src/renderer/components/subtitle/transcript
```

Expected:

- `git diff --stat HEAD` shows only uncommitted fixes if any were made after the last task commit.
- Transcript-body diff is empty.

- [ ] **Step 6: Commit verification fixes if there are any**

If Step 5 shows uncommitted fixes, run:

```bash
git add apps/desktop-app pnpm-lock.yaml
git commit -m "chore: verify final desktop ui convergence"
```

Expected: commit succeeds. If Step 5 shows no uncommitted files, skip this commit.

- [ ] **Step 7: Record verification result in the plan**

After all commands pass, append an `Implementation Result` section to this plan:

```markdown
## Implementation Result

Executed against the final design in `docs/superpowers/specs/2026-05-22-open-source-ui-library-final-design.md`.

Final state:

- Desktop UI primitives contain the shadcn-vue/Reka-inspired component boundary.
- `reka-ui` usage is contained in `components/ui`.
- Lucide icons are exposed through local `components/icons` wrappers.
- Desktop settings, official plugin settings, top controls, subtitle-panel controls, and word lookup chrome use shared primitives or primitive-compatible chrome.
- Transcript body components were not modified.

Verification passed:

- `pnpm --filter @immersive-subs/desktop-app test:renderer`
- `pnpm --filter @immersive-subs/desktop-app typecheck`
- `pnpm test`
```

- [ ] **Step 8: Commit the plan result update**

Run:

```bash
git add docs/superpowers/plans/2026-05-22-open-source-ui-library-final.md
git commit -m "docs: record desktop ui library implementation result"
```

Expected: commit succeeds.
