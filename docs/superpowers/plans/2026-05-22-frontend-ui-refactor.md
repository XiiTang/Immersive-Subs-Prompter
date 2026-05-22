# Frontend UI Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a unified modern UI across desktop settings, official plugin settings, desktop controls, word lookup chrome, and the extension popup while leaving the subtitle transcript body unchanged.

**Architecture:** Add a typed appearance setting, a small renderer theme runtime, and shared Vue UI primitives backed by semantic CSS tokens. Desktop settings render one active section at a time and host/plugin settings use shared primitives. The extension popup remains native DOM but adopts matching tokens, component classes, and an independent appearance preference.

**Tech Stack:** Electron, Vue 3, Pinia, TypeScript, Vite, Vitest, jsdom, browser-mode Vitest, Chrome extension APIs, CSS custom properties.

## Implementation Result

Executed in the current branch as requested: no subagents, no worktree, and no intermediate commits.

Final shape:

- Desktop has a persisted `global.appearance.theme` setting with `system`, `light`, and `dark`.
- Renderer roots apply `data-theme` and react to system color-scheme changes.
- Settings use a left nav with one active section and a first-class Appearance page.
- Desktop settings, official plugin settings, and subtitle controls now use shared Vue UI primitives and semantic CSS tokens.
- The subtitle transcript body components were not modified.
- Extension popup has independent appearance storage and matching light/dark/system theme semantics.
- Legacy one-off button/status classes were removed from active plugin and popup UI.

---

## Scope Check

This plan covers one connected UI refactor. The desktop and extension surfaces are separate at runtime, but they share the same visual system and theme semantics, so the dependency order is single-plan friendly:

1. Appearance data model.
2. Renderer theme runtime.
3. Shared desktop UI primitives and CSS tokens.
4. Settings shell and host/plugin settings.
5. Desktop controls outside the transcript body.
6. Extension popup.
7. Verification and cleanup.

The plan deliberately excludes transcript body redesign and transcript geometry changes.

## Current Worktree Note

Before executing Task 1, run:

```bash
git status --short
```

Expected now: existing unrelated modified files may be present under `apps/desktop-app/src/renderer/...`. Do not revert them. Read any file before editing it and work with the current contents.

## Target File Structure

Desktop appearance model:

- Modify: `apps/desktop-app/src/main/types.ts`
- Modify: `apps/desktop-app/src/main/settings/constants.ts`
- Modify: `apps/desktop-app/src/main/settings/sanitizers/globalSanitizer.ts`
- Modify: `apps/desktop-app/src/main/settings/appSettingsSanitizer.test.ts`
- Modify: `apps/desktop-app/src/main/default-settings.json`
- Modify: `apps/desktop-app/src/renderer/stores/desktop/types.ts`
- Modify: `apps/desktop-app/src/renderer/stores/desktop.test.ts`
- Modify: `apps/desktop-app/src/renderer/locales/en.json`
- Modify: `apps/desktop-app/src/renderer/locales/zh.json`

Theme runtime:

- Create: `apps/desktop-app/src/renderer/theme.ts`
- Create: `apps/desktop-app/src/renderer/theme.test.ts`
- Modify: `apps/desktop-app/src/renderer/main.ts`
- Modify: `apps/desktop-app/src/renderer/settings-main.ts`
- Modify: `apps/desktop-app/src/renderer/App.vue`
- Modify: `apps/desktop-app/src/renderer/SettingsApp.vue`

Desktop UI primitives:

- Create: `apps/desktop-app/src/renderer/components/ui/UiButton.vue`
- Create: `apps/desktop-app/src/renderer/components/ui/UiIconButton.vue`
- Create: `apps/desktop-app/src/renderer/components/ui/UiField.vue`
- Create: `apps/desktop-app/src/renderer/components/ui/UiInput.vue`
- Create: `apps/desktop-app/src/renderer/components/ui/UiTextarea.vue`
- Create: `apps/desktop-app/src/renderer/components/ui/UiSelect.vue`
- Create: `apps/desktop-app/src/renderer/components/ui/UiSwitch.vue`
- Create: `apps/desktop-app/src/renderer/components/ui/UiSection.vue`
- Create: `apps/desktop-app/src/renderer/components/ui/UiListItem.vue`
- Create: `apps/desktop-app/src/renderer/components/ui/UiBadge.vue`
- Create: `apps/desktop-app/src/renderer/components/ui/UiStatus.vue`
- Create: `apps/desktop-app/src/renderer/components/ui/UiEmptyState.vue`
- Create: `apps/desktop-app/src/renderer/components/ui/index.ts`
- Create: `apps/desktop-app/src/renderer/components/ui/UiComponents.test.ts`
- Modify: `apps/desktop-app/src/renderer/style.css`

Desktop settings shell and sections:

- Create: `apps/desktop-app/src/renderer/components/settings/SettingsAppearance.vue`
- Modify: `apps/desktop-app/src/renderer/components/settings/settingsSections.ts`
- Modify: `apps/desktop-app/src/renderer/components/settings/SettingsWindowShell.vue`
- Modify: `apps/desktop-app/src/renderer/components/settings/SettingsWindowShell.test.ts`
- Modify: `apps/desktop-app/src/renderer/components/settings/SettingsWindowShell.browser.test.ts`
- Modify: `apps/desktop-app/src/renderer/components/settings/SettingsNav.vue`
- Modify: `apps/desktop-app/src/renderer/components/settings/SettingsGlobal.vue`
- Modify: `apps/desktop-app/src/renderer/components/settings/SettingsCache.vue`
- Modify: `apps/desktop-app/src/renderer/components/settings/SettingsProfiles.vue`
- Modify: `apps/desktop-app/src/renderer/components/settings/profiles/ProfileList.vue`
- Modify: `apps/desktop-app/src/renderer/components/settings/profiles/ProfileUrlRules.vue`
- Modify: `apps/desktop-app/src/renderer/components/settings/profiles/PriorityEditor.vue`
- Modify: `apps/desktop-app/src/renderer/components/settings/profiles/ColorSchemeGrid.vue`
- Modify: `apps/desktop-app/src/renderer/components/settings/profiles/SubtitleStyleFields.vue`

Official plugin settings:

- Modify: `apps/desktop-app/src/renderer/components/settings/SettingsPlugins.vue`
- Modify: `apps/desktop-app/src/renderer/components/settings/SettingsTranscription.vue`
- Modify: `apps/desktop-app/src/renderer/components/settings/transcription/TranscriptionConfigList.vue`
- Modify: `apps/desktop-app/src/renderer/components/settings/transcription/WhisperApiForm.vue`
- Modify: `apps/desktop-app/src/renderer/components/settings/transcription/FasterWhisperBinariesCard.vue`
- Modify: `apps/desktop-app/src/renderer/components/settings/transcription/FasterWhisperModelsCard.vue`
- Modify: `apps/desktop-app/src/renderer/components/settings/transcription/FasterWhisperRuntimeCard.vue`
- Modify: `apps/desktop-app/src/renderer/components/settings/SettingsWordLookup.vue`
- Modify: `apps/desktop-app/src/renderer/components/settings/SettingsMediaServer.vue`
- Modify: `apps/desktop-app/src/renderer/components/settings/SettingsPlugins.test.ts`
- Modify: `apps/desktop-app/src/renderer/components/settings/SettingsMediaServer.test.ts`

Desktop control surfaces:

- Modify: `apps/desktop-app/src/renderer/components/top-panel/TopControlPanel.vue`
- Modify: `apps/desktop-app/src/renderer/components/top-panel/TopControlPanel.test.ts`
- Modify: `apps/desktop-app/src/renderer/components/subtitle/PlaybackControls.vue`
- Modify: `apps/desktop-app/src/renderer/components/subtitle/TrackSelector.vue`
- Modify: `apps/desktop-app/src/renderer/components/subtitle/TranscriptionControls.vue`
- Modify: `apps/desktop-app/src/renderer/components/subtitle/StatusBanner.vue`
- Modify: `apps/desktop-app/src/renderer/components/subtitle/WordLookupWindow.vue`
- Do not modify transcript projection helpers unless a test proves a control-only change requires it.

Extension popup:

- Create: `apps/extension/src/shared/appearance.ts`
- Create: `apps/extension/src/shared/appearance.test.ts`
- Modify: `apps/extension/src/shared/constants.ts`
- Modify: `apps/extension/popup.html`
- Modify: `apps/extension/popup.css`
- Modify: `apps/extension/src/popup.ts`

Verification artifacts:

- Screenshot snapshots under `apps/desktop-app/src/renderer/components/settings/__screenshots__/` may be updated only after the new settings UI is intentionally in place.

---

### Task 1: Desktop Appearance Settings Model

**Files:**
- Modify: `apps/desktop-app/src/main/types.ts`
- Modify: `apps/desktop-app/src/main/settings/constants.ts`
- Modify: `apps/desktop-app/src/main/settings/sanitizers/globalSanitizer.ts`
- Modify: `apps/desktop-app/src/main/settings/appSettingsSanitizer.test.ts`
- Modify: `apps/desktop-app/src/main/default-settings.json`
- Modify: `apps/desktop-app/src/renderer/locales/en.json`
- Modify: `apps/desktop-app/src/renderer/locales/zh.json`

- [ ] **Step 1: Write failing sanitizer tests**

Add these tests inside `describe("sanitizeSettings", ...)` in `apps/desktop-app/src/main/settings/appSettingsSanitizer.test.ts`:

```ts
    it("keeps supported appearance themes", () => {
      expect(sanitizeSettings({ global: { appearance: { theme: "light" } } } as never).global.appearance.theme).toBe("light");
      expect(sanitizeSettings({ global: { appearance: { theme: "dark" } } } as never).global.appearance.theme).toBe("dark");
      expect(sanitizeSettings({ global: { appearance: { theme: "system" } } } as never).global.appearance.theme).toBe("system");
    });

    it("falls back to system appearance for unsupported themes", () => {
      const result = sanitizeSettings({
        global: { appearance: { theme: "blue" } }
      } as never);

      expect(result.global.appearance.theme).toBe("system");
    });
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app vitest run src/main/settings/appSettingsSanitizer.test.ts
```

Expected: FAIL because `global.appearance` does not exist on sanitized settings.

- [ ] **Step 3: Add appearance types**

In `apps/desktop-app/src/main/types.ts`, add these declarations near `AlwaysOnTopLevel`:

```ts
export type AppearanceTheme = "system" | "light" | "dark";

export interface AppearanceSettings {
  theme: AppearanceTheme;
}
```

Then add this property to `GlobalSettings`:

```ts
  appearance: AppearanceSettings;
```

- [ ] **Step 4: Add defaults**

In `apps/desktop-app/src/main/settings/constants.ts`, add `appearance` to `DEFAULT_GLOBAL_SETTINGS`:

```ts
  appearance: {
    theme: "system"
  },
```

In `apps/desktop-app/src/main/default-settings.json`, add the same shape inside `global`:

```json
    "appearance": {
      "theme": "system"
    },
```

- [ ] **Step 5: Sanitize appearance**

In `apps/desktop-app/src/main/settings/sanitizers/globalSanitizer.ts`, import the new type and add a guard:

```ts
import { AppearanceTheme, CloseBehavior, GlobalSettings } from "../../types.js";
```

```ts
function isAppearanceTheme(value: unknown): value is AppearanceTheme {
  return value === "system" || value === "light" || value === "dark";
}
```

Inside `sanitizeGlobalSettings`, compute:

```ts
  const appearanceSource =
    source.appearance && typeof source.appearance === "object"
      ? source.appearance
      : {};
  const appearance = {
    theme: isAppearanceTheme((appearanceSource as { theme?: unknown }).theme)
      ? (appearanceSource as { theme: AppearanceTheme }).theme
      : DEFAULT_GLOBAL_SETTINGS.appearance.theme
  };
```

Return it in the final object:

```ts
    appearance,
```

- [ ] **Step 6: Add locale strings**

In `apps/desktop-app/src/renderer/locales/en.json`, add:

```json
  "section-appearance": "Appearance",
  "appearance-theme-label": "Theme",
  "appearance-theme-system": "System",
  "appearance-theme-light": "Light",
  "appearance-theme-dark": "Dark",
```

In `apps/desktop-app/src/renderer/locales/zh.json`, add:

```json
  "section-appearance": "外观",
  "appearance-theme-label": "主题",
  "appearance-theme-system": "跟随系统",
  "appearance-theme-light": "浅色",
  "appearance-theme-dark": "深色",
```

- [ ] **Step 7: Run tests to verify pass**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app vitest run src/main/settings/appSettingsSanitizer.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/desktop-app/src/main/types.ts apps/desktop-app/src/main/settings/constants.ts apps/desktop-app/src/main/settings/sanitizers/globalSanitizer.ts apps/desktop-app/src/main/settings/appSettingsSanitizer.test.ts apps/desktop-app/src/main/default-settings.json apps/desktop-app/src/renderer/locales/en.json apps/desktop-app/src/renderer/locales/zh.json
git commit -m "feat(settings): add appearance theme setting"
```

---

### Task 2: Renderer Theme Runtime

**Files:**
- Create: `apps/desktop-app/src/renderer/theme.ts`
- Create: `apps/desktop-app/src/renderer/theme.test.ts`
- Modify: `apps/desktop-app/src/renderer/main.ts`
- Modify: `apps/desktop-app/src/renderer/settings-main.ts`
- Modify: `apps/desktop-app/src/renderer/App.vue`
- Modify: `apps/desktop-app/src/renderer/SettingsApp.vue`

- [ ] **Step 1: Write failing theme tests**

Create `apps/desktop-app/src/renderer/theme.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  applyThemeToDocument,
  resolveTheme,
  watchSystemTheme,
  type AppearanceTheme
} from "./theme";

function installMatchMedia(matches: boolean) {
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  const mediaQuery = {
    matches,
    media: "(prefers-color-scheme: dark)",
    onchange: null,
    addEventListener: vi.fn((_type: string, listener: (event: MediaQueryListEvent) => void) => listeners.add(listener)),
    removeEventListener: vi.fn((_type: string, listener: (event: MediaQueryListEvent) => void) => listeners.delete(listener)),
    dispatch(nextMatches: boolean) {
      for (const listener of listeners) {
        listener({ matches: nextMatches } as MediaQueryListEvent);
      }
    }
  } as MediaQueryList & { dispatch(nextMatches: boolean): void };

  vi.stubGlobal("matchMedia", vi.fn(() => mediaQuery));
  return mediaQuery;
}

describe("theme runtime", () => {
  afterEach(() => {
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.removeAttribute("data-theme-mode");
    vi.unstubAllGlobals();
  });

  it.each([
    ["light", false, "light"],
    ["dark", false, "dark"],
    ["system", true, "dark"],
    ["system", false, "light"]
  ] satisfies Array<[AppearanceTheme, boolean, "light" | "dark"]>)(
    "resolves %s with system dark=%s",
    (theme, systemDark, expected) => {
      expect(resolveTheme(theme, systemDark)).toBe(expected);
    }
  );

  it("writes theme attributes to the document root", () => {
    applyThemeToDocument("dark", "system");

    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(document.documentElement.dataset.themeMode).toBe("system");
  });

  it("notifies when system theme changes", () => {
    const mediaQuery = installMatchMedia(false);
    const onChange = vi.fn();

    const stop = watchSystemTheme(onChange);
    mediaQuery.dispatch(true);
    stop();
    mediaQuery.dispatch(false);

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(true);
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app vitest run src/renderer/theme.test.ts
```

Expected: FAIL because `src/renderer/theme.ts` does not exist.

- [ ] **Step 3: Create the runtime**

Create `apps/desktop-app/src/renderer/theme.ts`:

```ts
import { computed, onBeforeUnmount, ref, watch, type ComputedRef } from "vue";
import type { AppearanceTheme } from "../main/types";

export type { AppearanceTheme };
export type ResolvedTheme = "light" | "dark";

const darkQuery = "(prefers-color-scheme: dark)";

export function getSystemPrefersDark(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia(darkQuery).matches
    : false;
}

export function resolveTheme(theme: AppearanceTheme, systemPrefersDark = getSystemPrefersDark()): ResolvedTheme {
  if (theme === "dark") return "dark";
  if (theme === "light") return "light";
  return systemPrefersDark ? "dark" : "light";
}

export function applyThemeToDocument(resolvedTheme: ResolvedTheme, mode: AppearanceTheme) {
  document.documentElement.dataset.theme = resolvedTheme;
  document.documentElement.dataset.themeMode = mode;
}

export function watchSystemTheme(onChange: (prefersDark: boolean) => void): () => void {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return () => undefined;
  }
  const mediaQuery = window.matchMedia(darkQuery);
  const listener = (event: MediaQueryListEvent) => onChange(event.matches);
  mediaQuery.addEventListener("change", listener);
  return () => mediaQuery.removeEventListener("change", listener);
}

export function useDocumentTheme(theme: ComputedRef<AppearanceTheme | undefined>) {
  const systemPrefersDark = ref(getSystemPrefersDark());
  const mode = computed<AppearanceTheme>(() => theme.value ?? "system");
  const resolvedTheme = computed(() => resolveTheme(mode.value, systemPrefersDark.value));

  const stopWatch = watch(
    [mode, resolvedTheme],
    () => applyThemeToDocument(resolvedTheme.value, mode.value),
    { immediate: true }
  );

  const stopSystemWatch = watchSystemTheme((prefersDark) => {
    systemPrefersDark.value = prefersDark;
  });

  onBeforeUnmount(() => {
    stopWatch();
    stopSystemWatch();
  });

  return { mode, resolvedTheme };
}
```

- [ ] **Step 4: Wire the runtime into desktop roots**

In `apps/desktop-app/src/renderer/App.vue`, import `computed` and `useDocumentTheme`, then call it after store creation:

```ts
import { computed } from "vue";
import { useDocumentTheme } from "./theme";
```

```ts
useDocumentTheme(computed(() => store.settings?.global.appearance.theme));
```

In `apps/desktop-app/src/renderer/SettingsApp.vue`, keep the existing language watch and add:

```ts
import { computed, onMounted, watch } from "vue";
import { useDocumentTheme } from "./theme";
```

```ts
useDocumentTheme(computed(() => store.settings?.global.appearance.theme));
```

Keep `main.ts` and `settings-main.ts` importing `./style.css`; no code change is needed there unless TypeScript ordering requires sorted imports.

- [ ] **Step 5: Run tests**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app vitest run src/renderer/theme.test.ts
pnpm --filter @immersive-subs/desktop-app typecheck:renderer
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/desktop-app/src/renderer/theme.ts apps/desktop-app/src/renderer/theme.test.ts apps/desktop-app/src/renderer/App.vue apps/desktop-app/src/renderer/SettingsApp.vue apps/desktop-app/src/renderer/main.ts apps/desktop-app/src/renderer/settings-main.ts
git commit -m "feat(renderer): apply appearance theme"
```

---

### Task 3: Shared Desktop UI Primitives And Tokens

**Files:**
- Create: all files under `apps/desktop-app/src/renderer/components/ui/`
- Modify: `apps/desktop-app/src/renderer/style.css`

- [ ] **Step 1: Write primitive component tests**

Create `apps/desktop-app/src/renderer/components/ui/UiComponents.test.ts`:

```ts
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import {
  UiBadge,
  UiButton,
  UiField,
  UiIconButton,
  UiInput,
  UiListItem,
  UiSection,
  UiSelect,
  UiStatus,
  UiSwitch,
  UiTextarea,
  UiEmptyState
} from "./index";

describe("UI primitives", () => {
  it("renders button variants with stable classes", () => {
    const wrapper = mount(UiButton, {
      props: { variant: "primary" },
      slots: { default: "Save" }
    });

    expect(wrapper.classes()).toContain("ui-button");
    expect(wrapper.classes()).toContain("ui-button--primary");
    expect(wrapper.text()).toBe("Save");
  });

  it("renders icon buttons with accessible labels", () => {
    const wrapper = mount(UiIconButton, {
      props: { label: "Refresh" },
      slots: { default: "R" }
    });

    expect(wrapper.attributes("aria-label")).toBe("Refresh");
    expect(wrapper.classes()).toContain("ui-icon-button");
  });

  it("connects field label, hint, and error text", () => {
    const wrapper = mount(UiField, {
      props: {
        id: "api-key",
        label: "API Key",
        hint: "Used by the provider",
        error: "Required"
      },
      slots: { default: '<input id="api-key" />' }
    });

    expect(wrapper.text()).toContain("API Key");
    expect(wrapper.text()).toContain("Used by the provider");
    expect(wrapper.text()).toContain("Required");
    expect(wrapper.get(".ui-field__control").attributes("aria-describedby")).toContain("api-key-hint");
    expect(wrapper.get(".ui-field__control").attributes("aria-describedby")).toContain("api-key-error");
  });

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
        options: [
          { value: "system", label: "System" },
          { value: "dark", label: "Dark" }
        ]
      }
    });
    await select.get("select").setValue("system");
    expect(select.emitted("update:modelValue")?.[0]).toEqual(["system"]);

    const toggle = mount(UiSwitch, { props: { modelValue: false, label: "On" } });
    await toggle.get("input").setValue(true);
    expect(toggle.emitted("update:modelValue")?.[0]).toEqual([true]);
  });

  it("renders section, list item, badge, status, and empty state classes", () => {
    expect(mount(UiSection, { props: { title: "General" } }).classes()).toContain("ui-section");
    expect(mount(UiListItem, { props: { selected: true } }).classes()).toContain("is-selected");
    expect(mount(UiBadge, { props: { tone: "success" }, slots: { default: "Ready" } }).classes()).toContain("ui-badge--success");
    expect(mount(UiStatus, { props: { tone: "danger" }, slots: { default: "Error" } }).classes()).toContain("ui-status--danger");
    expect(mount(UiEmptyState, { props: { message: "No items" } }).text()).toBe("No items");
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app vitest run src/renderer/components/ui/UiComponents.test.ts
```

Expected: FAIL because the UI primitive files do not exist.

- [ ] **Step 3: Create primitive exports**

Create `apps/desktop-app/src/renderer/components/ui/index.ts`:

```ts
export { default as UiBadge } from "./UiBadge.vue";
export { default as UiButton } from "./UiButton.vue";
export { default as UiEmptyState } from "./UiEmptyState.vue";
export { default as UiField } from "./UiField.vue";
export { default as UiIconButton } from "./UiIconButton.vue";
export { default as UiInput } from "./UiInput.vue";
export { default as UiListItem } from "./UiListItem.vue";
export { default as UiSection } from "./UiSection.vue";
export { default as UiSelect } from "./UiSelect.vue";
export { default as UiStatus } from "./UiStatus.vue";
export { default as UiSwitch } from "./UiSwitch.vue";
export { default as UiTextarea } from "./UiTextarea.vue";
```

- [ ] **Step 4: Create button primitives**

Create `UiButton.vue`:

```vue
<template>
  <button
    class="ui-button"
    :class="[`ui-button--${variant}`, { 'ui-button--block': block }]"
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
    type?: "button" | "submit" | "reset";
    disabled?: boolean;
    block?: boolean;
  }>(),
  {
    variant: "secondary",
    type: "button",
    disabled: false,
    block: false
  }
);
</script>
```

Create `UiIconButton.vue`:

```vue
<template>
  <button
    class="ui-icon-button"
    :class="[`ui-icon-button--${variant}`, `ui-icon-button--${size}`, { 'is-active': active }]"
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
    size?: "sm" | "md";
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

- [ ] **Step 5: Create form primitives**

Create `UiField.vue`:

```vue
<template>
  <label class="ui-field" :class="{ 'ui-field--inline': inline }">
    <span class="ui-field__label-row">
      <span class="ui-field__label">{{ label }}</span>
      <span v-if="value" class="ui-field__value">{{ value }}</span>
    </span>
    <span class="ui-field__control" :aria-describedby="describedBy">
      <slot />
    </span>
    <span v-if="hint" :id="`${id}-hint`" class="ui-field__hint">{{ hint }}</span>
    <span v-if="error" :id="`${id}-error`" class="ui-field__error">{{ error }}</span>
  </label>
</template>

<script setup lang="ts">
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    id: string;
    label: string;
    hint?: string;
    error?: string | null;
    value?: string;
    inline?: boolean;
  }>(),
  {
    hint: "",
    error: null,
    value: "",
    inline: false
  }
);

const describedBy = computed(() =>
  [props.hint ? `${props.id}-hint` : "", props.error ? `${props.id}-error` : ""]
    .filter(Boolean)
    .join(" ")
);
</script>
```

Create `UiInput.vue`, `UiTextarea.vue`, `UiSelect.vue`, and `UiSwitch.vue` with these core controls:

```vue
<!-- UiInput.vue -->
<template>
  <input
    class="ui-input"
    :type="type"
    :value="modelValue"
    :disabled="disabled"
    :readonly="readonly"
    :autocomplete="autocomplete"
    @input="handleInput"
  />
</template>

<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    modelValue: string | number;
    type?: string;
    disabled?: boolean;
    readonly?: boolean;
    autocomplete?: string;
  }>(),
  {
    type: "text",
    disabled: false,
    readonly: false,
    autocomplete: "off"
  }
);

const emit = defineEmits<{ "update:modelValue": [value: string | number] }>();

function handleInput(event: Event) {
  const value = (event.target as HTMLInputElement).value;
  emit("update:modelValue", props.type === "number" ? Number(value) : value);
}
</script>
```

```vue
<!-- UiTextarea.vue -->
<template>
  <textarea
    class="ui-textarea"
    :value="modelValue"
    :rows="rows"
    :disabled="disabled"
    @input="$emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
  />
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    modelValue: string;
    rows?: number;
    disabled?: boolean;
  }>(),
  {
    rows: 3,
    disabled: false
  }
);

defineEmits<{ "update:modelValue": [value: string] }>();
</script>
```

```vue
<!-- UiSelect.vue -->
<template>
  <select
    class="ui-select"
    :value="modelValue"
    :disabled="disabled"
    @change="$emit('update:modelValue', ($event.target as HTMLSelectElement).value)"
  >
    <option v-for="option in options" :key="option.value" :value="option.value" :disabled="option.disabled">
      {{ option.label }}
    </option>
  </select>
</template>

<script setup lang="ts">
defineProps<{
  modelValue: string;
  options: Array<{ value: string; label: string; disabled?: boolean }>;
  disabled?: boolean;
}>();

defineEmits<{ "update:modelValue": [value: string] }>();
</script>
```

```vue
<!-- UiSwitch.vue -->
<template>
  <label class="ui-switch">
    <input
      type="checkbox"
      :checked="modelValue"
      :disabled="disabled"
      @change="$emit('update:modelValue', ($event.target as HTMLInputElement).checked)"
    />
    <span class="ui-switch__track" aria-hidden="true">
      <span class="ui-switch__thumb" />
    </span>
    <span class="ui-switch__label">{{ label }}</span>
  </label>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    modelValue: boolean;
    label: string;
    disabled?: boolean;
  }>(),
  {
    disabled: false
  }
);

defineEmits<{ "update:modelValue": [value: boolean] }>();
</script>
```

- [ ] **Step 6: Create layout and status primitives**

Create `UiSection.vue`, `UiListItem.vue`, `UiBadge.vue`, `UiStatus.vue`, and `UiEmptyState.vue`:

```vue
<!-- UiSection.vue -->
<template>
  <section class="ui-section">
    <header class="ui-section__header">
      <h2 class="ui-section__title">{{ title }}</h2>
      <slot name="actions" />
    </header>
    <div class="ui-section__body">
      <slot />
    </div>
  </section>
</template>

<script setup lang="ts">
defineProps<{ title: string }>();
</script>
```

```vue
<!-- UiListItem.vue -->
<template>
  <component
    :is="as"
    class="ui-list-item"
    :class="{ 'is-selected': selected, 'is-disabled': disabled }"
    :type="as === 'button' ? 'button' : undefined"
    :disabled="as === 'button' ? disabled : undefined"
  >
    <slot />
  </component>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    as?: "button" | "div" | "article";
    selected?: boolean;
    disabled?: boolean;
  }>(),
  {
    as: "div",
    selected: false,
    disabled: false
  }
);
</script>
```

```vue
<!-- UiBadge.vue -->
<template>
  <span class="ui-badge" :class="`ui-badge--${tone}`"><slot /></span>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{ tone?: "neutral" | "success" | "warning" | "danger" | "info" }>(),
  { tone: "neutral" }
);
</script>
```

```vue
<!-- UiStatus.vue -->
<template>
  <span class="ui-status" :class="`ui-status--${tone}`">
    <span class="ui-status__dot" aria-hidden="true" />
    <span><slot /></span>
  </span>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{ tone?: "neutral" | "success" | "warning" | "danger" | "info" }>(),
  { tone: "neutral" }
);
</script>
```

```vue
<!-- UiEmptyState.vue -->
<template>
  <p class="ui-empty-state">{{ message }}</p>
</template>

<script setup lang="ts">
defineProps<{ message: string }>();
</script>
```

- [ ] **Step 7: Add CSS tokens and primitive classes**

At the top of `apps/desktop-app/src/renderer/style.css`, replace hard-coded root colors with semantic tokens:

```css
:root {
  color-scheme: light dark;
  font-family: "Inter", "PingFang SC", "Microsoft YaHei", system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
  font-size: 14px;
  --panel-opacity-factor: 1;
  --top-panel-collapsed-offset: 0px;
  --ui-radius: 8px;
  --ui-radius-sm: 6px;
  --ui-space-1: 4px;
  --ui-space-2: 8px;
  --ui-space-3: 12px;
  --ui-space-4: 16px;
  --ui-space-5: 20px;
  --ui-font-sm: 12px;
  --ui-font-md: 13px;
  --ui-font-lg: 16px;
  --ui-bg: #f6f7f9;
  --ui-surface: #ffffff;
  --ui-surface-muted: #eef1f4;
  --ui-text: #101418;
  --ui-text-muted: #66707c;
  --ui-border: rgba(16, 20, 24, 0.12);
  --ui-control-bg: #ffffff;
  --ui-accent: #2563eb;
  --ui-accent-soft: rgba(37, 99, 235, 0.1);
  --ui-success: #16803c;
  --ui-warning: #b45309;
  --ui-danger: #dc2626;
  --ui-info: #2563eb;
  --ui-focus: rgba(37, 99, 235, 0.32);
}

:root[data-theme="dark"] {
  --ui-bg: #0f1216;
  --ui-surface: #171b21;
  --ui-surface-muted: #202630;
  --ui-text: #edf1f5;
  --ui-text-muted: #9ba6b2;
  --ui-border: rgba(237, 241, 245, 0.12);
  --ui-control-bg: #11161d;
  --ui-accent: #60a5fa;
  --ui-accent-soft: rgba(96, 165, 250, 0.14);
  --ui-success: #4ade80;
  --ui-warning: #f59e0b;
  --ui-danger: #f87171;
  --ui-info: #60a5fa;
  --ui-focus: rgba(96, 165, 250, 0.36);
}
```

Add primitive classes under a `/* UI primitives */` comment. Keep the declarations concise and use existing selectors only where an old component still relies on them:

```css
.ui-button,
.ui-icon-button,
.ui-input,
.ui-textarea,
.ui-select {
  font: inherit;
}

.ui-button {
  min-height: 32px;
  border: 1px solid transparent;
  border-radius: var(--ui-radius-sm);
  padding: 0 12px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--ui-text);
  background: transparent;
  cursor: pointer;
}

.ui-button--primary {
  color: #ffffff;
  background: var(--ui-accent);
}

.ui-button--secondary {
  border-color: var(--ui-border);
  background: var(--ui-control-bg);
}

.ui-button--ghost {
  color: var(--ui-text-muted);
}

.ui-button--danger {
  color: var(--ui-danger);
}

.ui-button:disabled,
.ui-icon-button:disabled,
.ui-input:disabled,
.ui-textarea:disabled,
.ui-select:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.ui-button:focus-visible,
.ui-icon-button:focus-visible,
.ui-input:focus-visible,
.ui-textarea:focus-visible,
.ui-select:focus-visible,
.ui-switch input:focus-visible + .ui-switch__track {
  outline: 3px solid var(--ui-focus);
  outline-offset: 2px;
}
```

- [ ] **Step 8: Run primitive tests and renderer typecheck**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app vitest run src/renderer/components/ui/UiComponents.test.ts
pnpm --filter @immersive-subs/desktop-app typecheck:renderer
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add apps/desktop-app/src/renderer/components/ui apps/desktop-app/src/renderer/style.css
git commit -m "feat(renderer): add shared ui primitives"
```

---

### Task 4: Single-Section Settings Shell And Appearance Section

**Files:**
- Create: `apps/desktop-app/src/renderer/components/settings/SettingsAppearance.vue`
- Modify: `apps/desktop-app/src/renderer/components/settings/settingsSections.ts`
- Modify: `apps/desktop-app/src/renderer/components/settings/SettingsWindowShell.vue`
- Modify: `apps/desktop-app/src/renderer/components/settings/SettingsNav.vue`
- Modify: `apps/desktop-app/src/renderer/components/settings/SettingsWindowShell.test.ts`
- Modify: `apps/desktop-app/src/renderer/components/settings/SettingsWindowShell.browser.test.ts`

- [ ] **Step 1: Rewrite shell tests for active section behavior**

In `SettingsWindowShell.test.ts`, replace the document-mode tests with these expectations:

```ts
  it("renders only the active top-level section", async () => {
    const wrapper = mount(SettingsWindowShell, {
      attachTo: document.body,
      global: {
        stubs: {
          SettingsGlobal: sectionStub("settings-section-general-content"),
          SettingsAppearance: sectionStub("settings-section-appearance-content"),
          SettingsProfiles: sectionStub("settings-section-profiles-content"),
          SettingsCache: sectionStub("settings-section-cache-content"),
          SettingsPlugins: sectionStub("settings-section-plugins-content")
        }
      }
    });

    expect(wrapper.get('[data-testid="settings-content"]').attributes("data-scroll-mode")).toBe("section");
    expect(wrapper.get('[data-testid="settings-section-general-content"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="settings-section-appearance-content"]').exists()).toBe(false);

    await wrapper.get('[data-testid="settings-nav-item-appearance"]').trigger("click");

    expect(wrapper.get('[data-testid="settings-section-appearance-content"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="settings-section-general-content"]').exists()).toBe(false);
  });
```

Update plugin tests so a newly enabled plugin appears in nav but its component mounts only after selecting it:

```ts
    expect(wrapper.get('[data-testid="settings-nav-item-official.transcription.settings"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="settings-section-plugin-official-transcription-content"]').exists()).toBe(false);

    await wrapper.get('[data-testid="settings-nav-item-official.transcription.settings"]').trigger("click");
    expect(wrapper.get('[data-testid="settings-section-plugin-official-transcription-content"]').exists()).toBe(true);
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app vitest run src/renderer/components/settings/SettingsWindowShell.test.ts
```

Expected: FAIL because the shell still renders a scrollable document.

- [ ] **Step 3: Add appearance section definition**

Modify `apps/desktop-app/src/renderer/components/settings/settingsSections.ts` so the host sections include:

```ts
  {
    id: "appearance",
    labelKey: "section-appearance",
    fallback: "Appearance",
    anchorId: "settings-section-appearance"
  },
```

Extend `SettingsSectionId` to include `"appearance"` if the current type is a literal union.

- [ ] **Step 4: Create SettingsAppearance**

Create `apps/desktop-app/src/renderer/components/settings/SettingsAppearance.vue`:

```vue
<template>
  <UiSection :title="t('section-appearance', 'Appearance')">
    <UiField id="appearance-theme" :label="t('appearance-theme-label', 'Theme')">
      <div class="ui-segmented" role="radiogroup" :aria-label="t('appearance-theme-label', 'Theme')">
        <button
          v-for="option in themeOptions"
          :key="option.value"
          type="button"
          class="ui-segmented__item"
          :class="{ 'is-selected': appearanceTheme === option.value }"
          role="radio"
          :aria-checked="appearanceTheme === option.value"
          @click="appearanceTheme = option.value"
        >
          {{ option.label }}
        </button>
      </div>
    </UiField>
  </UiSection>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { AppearanceTheme } from "../../../main/types";
import { DEFAULT_LANGUAGE, useI18n } from "../../i18n";
import { useDesktopStore } from "../../stores/desktop";
import { UiField, UiSection } from "../ui";

const store = useDesktopStore();
const language = computed(() => store.settings?.global.language ?? DEFAULT_LANGUAGE);
const { t } = useI18n(language);

const themeOptions = computed<Array<{ value: AppearanceTheme; label: string }>>(() => [
  { value: "system", label: t("appearance-theme-system", "System") },
  { value: "light", label: t("appearance-theme-light", "Light") },
  { value: "dark", label: t("appearance-theme-dark", "Dark") }
]);

const appearanceTheme = computed<AppearanceTheme>({
  get: () => store.settings?.global.appearance.theme ?? "system",
  set: (theme) => {
    const current = store.settings?.global.appearance ?? { theme: "system" };
    store.updateGlobalSetting("appearance", { ...current, theme });
  }
});
</script>
```

- [ ] **Step 5: Simplify SettingsWindowShell**

Replace the observer and scroll logic in `SettingsWindowShell.vue` with active-section state:

```ts
import { computed, ref, watch } from "vue";
import SettingsAppearance from "./SettingsAppearance.vue";
```

```ts
const hostComponentMap: Record<string, unknown> = {
  general: SettingsGlobal,
  appearance: SettingsAppearance,
  profiles: SettingsProfiles,
  cache: SettingsCache,
  plugins: SettingsPlugins
};

const currentSection = ref<SettingsSectionId>("general");
const activeComponent = computed(() => resolveComponent(currentSection.value));

watch(
  () => allSections.value.map((section) => section.id),
  (ids) => {
    if (!ids.includes(currentSection.value)) {
      currentSection.value = (ids[0] ?? "general") as SettingsSectionId;
    }
  },
  { immediate: true }
);

function selectSection(id: SettingsSectionId) {
  currentSection.value = id;
}
```

Use a single content region:

```vue
<main class="settings-window-shell__content" data-testid="settings-content" data-scroll-mode="section">
  <component :is="activeComponent" :key="currentSection" />
</main>
```

Remove `IntersectionObserver`, `sectionIdFromAnchor`, `scrollToSection`, `nextTick`, `onMounted`, and `onBeforeUnmount` from this component.

- [ ] **Step 6: Update SettingsNav event names**

In `SettingsWindowShell.vue`, change `@select="scrollToSection"` to:

```vue
@select="selectSection"
```

Keep `SettingsNav.vue` class names stable, but allow plugin ids in test ids by keeping:

```vue
:data-testid="`settings-nav-item-${section.id}`"
```

- [ ] **Step 7: Add segmented CSS and section shell CSS**

In `style.css`, add:

```css
.ui-segmented {
  display: inline-grid;
  grid-auto-flow: column;
  gap: 2px;
  padding: 2px;
  border-radius: var(--ui-radius);
  background: var(--ui-surface-muted);
}

.ui-segmented__item {
  min-height: 32px;
  border: 0;
  border-radius: var(--ui-radius-sm);
  padding: 0 12px;
  color: var(--ui-text-muted);
  background: transparent;
  font: inherit;
  cursor: pointer;
}

.ui-segmented__item.is-selected {
  color: var(--ui-text);
  background: var(--ui-surface);
}
```

- [ ] **Step 8: Run shell tests**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app vitest run src/renderer/components/settings/SettingsWindowShell.test.ts src/renderer/components/settings/SettingsWindowShell.browser.test.ts
pnpm --filter @immersive-subs/desktop-app typecheck:renderer
```

Expected: PASS after updating the browser test to expect `data-scroll-mode="section"` and a single content panel.

- [ ] **Step 9: Commit**

```bash
git add apps/desktop-app/src/renderer/components/settings/SettingsAppearance.vue apps/desktop-app/src/renderer/components/settings/settingsSections.ts apps/desktop-app/src/renderer/components/settings/SettingsWindowShell.vue apps/desktop-app/src/renderer/components/settings/SettingsNav.vue apps/desktop-app/src/renderer/components/settings/SettingsWindowShell.test.ts apps/desktop-app/src/renderer/components/settings/SettingsWindowShell.browser.test.ts apps/desktop-app/src/renderer/style.css
git commit -m "feat(settings): use single-section layout"
```

---

### Task 5: Host Settings Sections Use Shared Primitives

**Files:**
- Modify: `apps/desktop-app/src/renderer/components/settings/SettingsGlobal.vue`
- Modify: `apps/desktop-app/src/renderer/components/settings/SettingsCache.vue`
- Modify: `apps/desktop-app/src/renderer/components/settings/SettingsProfiles.vue`
- Modify: `apps/desktop-app/src/renderer/components/settings/profiles/ProfileList.vue`
- Modify: `apps/desktop-app/src/renderer/components/settings/profiles/ProfileUrlRules.vue`
- Modify: `apps/desktop-app/src/renderer/components/settings/profiles/PriorityEditor.vue`
- Modify: `apps/desktop-app/src/renderer/components/settings/profiles/ColorSchemeGrid.vue`
- Modify: `apps/desktop-app/src/renderer/components/settings/profiles/SubtitleStyleFields.vue`
- Modify: `apps/desktop-app/src/renderer/components/settings/SettingsCache.test.ts`
- Modify: `apps/desktop-app/src/renderer/components/settings/SettingsProfiles.browser.test.ts`

- [ ] **Step 1: Write host visual structure tests**

In `SettingsCache.test.ts`, add an assertion that the cache section uses shared classes:

```ts
  it("uses shared section and field primitives", () => {
    const wrapper = mount(SettingsCache);

    expect(wrapper.get(".ui-section").exists()).toBe(true);
    expect(wrapper.findAll(".ui-field").length).toBeGreaterThan(0);
    expect(wrapper.findAll(".settings-surface")).toHaveLength(0);
  });
```

In `SettingsProfiles.browser.test.ts`, update screenshot expectations only after manual review. Add a structural test first:

```ts
  it("renders profiles with shared list and field primitives", async () => {
    const wrapper = mount(SettingsProfiles, { attachTo: document.body });
    await nextTick();

    expect(wrapper.get(".ui-section").exists()).toBe(true);
    expect(wrapper.findAll(".ui-list-item").length).toBeGreaterThan(0);
    expect(wrapper.findAll(".ui-field").length).toBeGreaterThan(0);
  });
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app vitest run src/renderer/components/settings/SettingsCache.test.ts src/renderer/components/settings/SettingsProfiles.browser.test.ts
```

Expected: FAIL because host settings still use old classes.

- [ ] **Step 3: Convert SettingsGlobal**

Use `UiSection`, `UiField`, `UiInput`, `UiSelect`, `UiSwitch`, `UiButton`, and `UiIconButton`. The top template shape should be:

```vue
<template>
  <UiSection :title="t('section-global-settings', 'Global Settings')">
    <div class="settings-fields-grid settings-fields-grid--two-col">
      <UiField id="language" :label="t('language-label', 'Language')">
        <UiSelect v-model="languageSetting" :options="languageOptions" />
      </UiField>

      <UiField id="auto-start" :label="t('auto-start-label', 'Auto Start')" inline>
        <UiSwitch v-model="autoLaunch" :label="autoLaunch ? t('toggle-on', 'On') : t('toggle-off', 'Off')" />
      </UiField>
    </div>
  </UiSection>
</template>
```

Add:

```ts
import { UiField, UiIconButton, UiInput, UiSection, UiSelect, UiSwitch } from "../ui";
```

Keep the existing computed setters for language, network, shortcut, endpoint, and process blacklist. Convert process blacklist values to compact chips:

```vue
<div v-if="gameProcesses.length" class="ui-chip-list">
  <span v-for="process in gameProcesses" :key="process" class="ui-chip">
    {{ process }}
    <button type="button" class="ui-chip__remove" :aria-label="t('game-blacklist-remove', 'Remove')" @click="removeGameProcess(process)">x</button>
  </span>
</div>
```

- [ ] **Step 4: Convert SettingsCache**

The final template shape should be:

```vue
<template>
  <UiSection :title="t('section-cache', 'Subtitle Cache')">
    <template #actions>
      <UiSwitch v-model="cacheEnabled" :label="cacheEnabled ? t('toggle-on', 'On') : t('toggle-off', 'Off')" />
    </template>

    <div v-if="cacheEnabled" class="settings-panel">
      <div class="cache-field-row">
        <UiField id="cache-path" class="cache-field--grow" :label="t('cache-path-label', 'Cache Path')" :hint="t('cache-path-hint', 'Leave blank to use the default location.')">
          <div class="ui-inline-control">
            <UiInput v-model="cachePath" />
            <UiIconButton :label="t('button-open-cache', 'Open Cache Folder')" @click="openCacheFolder">
              <IconFolder size="md" />
            </UiIconButton>
          </div>
        </UiField>
        <UiField id="cache-retention" :label="t('cache-retention-label', 'Retention (days)')">
          <UiInput v-model="cacheRetentionDays" type="number" />
        </UiField>
      </div>
      <div class="ui-stat-grid">
        <div class="ui-stat">
          <span class="ui-stat__label">{{ statLabel('cache-stats-entries', 'Total entries') }}</span>
          <UiBadge>{{ cacheStatsDisplay.entries }}</UiBadge>
        </div>
      </div>
    </div>
  </UiSection>
</template>
```

When writing the actual file, include all three stats: entries, size, oldest.

- [ ] **Step 5: Convert profile list and editor components**

`ProfileList.vue` should render shared list items:

```vue
<UiListItem
  v-for="(profile, index) in profiles"
  :key="profile.id"
  as="button"
  :selected="profile.id === editingProfileId"
  draggable="true"
  class="profile-list__item"
  @click="$emit('select', profile.id)"
  @dragstart="onDragStart($event, index)"
  @dragover.prevent="dragOverIndex = index"
  @dragleave="dragOverIndex = null"
  @drop.prevent="onDrop(index)"
  @dragend="resetDrag"
>
  <span class="profile-list__content">
    <span class="profile-list__name">{{ profile.name }}</span>
    <span class="profile-list__meta">{{ profileRuleSummary(profile.id) }}</span>
  </span>
  <UiBadge v-if="profile.id === activeProfileId" tone="info">{{ t("active-badge", "Applied") }}</UiBadge>
  <UiBadge v-else-if="profile.id === defaultProfileId" tone="neutral">{{ t("default-badge", "Default") }}</UiBadge>
</UiListItem>
```

`SettingsProfiles.vue` should use `UiSection` at the top and `UiField` for profile name and yt-dlp args:

```vue
<UiSection :title="t('section-profiles', 'Profiles')">
  <div class="settings-split">
    <ProfileList ... />
    <div class="settings-split__editor" v-if="editingProfile">
      <UiField id="profile-name" :label="t('profile-name-label', 'Profile Name')">
        <UiInput v-model="profileName" />
      </UiField>
      ...
    </div>
  </div>
</UiSection>
```

- [ ] **Step 6: Convert profile field children**

Convert `SubtitleStyleFields.vue`, `ColorSchemeGrid.vue`, `PriorityEditor.vue`, and `ProfileUrlRules.vue` to shared controls while preserving their props and emits.

Use these target patterns:

```vue
<UiField id="subtitle-font" :label="t('subtitle-font-label', 'Subtitle Font')">
  <UiSelect v-model="subtitleFontFamily" :options="fontOptions" />
</UiField>
```

```vue
<UiListItem as="article" class="profile-url-rule" :class="{ 'is-disabled': !rule.isEnabled, 'is-drag-over': dragOverIndex === index }">
  <UiSwitch v-model="ruleEnabled" :label="rule.isEnabled ? t('toggle-on', 'On') : t('toggle-off', 'Off')" />
  <UiSelect :model-value="rule.matchType" :options="matchTypeOptions" @update:model-value="updateRule(rule.id, { matchType: $event as UrlMatchType })" />
  <UiInput :model-value="rule.pattern" @update:model-value="updateRule(rule.id, { pattern: $event })" />
</UiListItem>
```

Do not simplify rule ordering or validation behavior.

- [ ] **Step 7: Replace old host section CSS**

In `style.css`, remove or neutralize old host settings card styles that duplicate primitives:

```css
.settings-surface,
.settings-group,
.settings-note,
.settings-list__item,
.profile-list__item,
.priority-editor__list,
.profile-url-rules,
.profile-url-rule,
.cache-status-item {
  box-shadow: none;
}
```

Then move persistent layout-only styles to neutral classes such as `.settings-panel`, `.settings-split`, `.settings-fields-grid`, `.ui-chip-list`, `.ui-chip`, `.ui-stat-grid`, and `.ui-stat`.

- [ ] **Step 8: Run host section tests**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app vitest run src/renderer/components/settings/SettingsCache.test.ts src/renderer/components/settings/SettingsProfiles.browser.test.ts
pnpm --filter @immersive-subs/desktop-app typecheck:renderer
```

Expected: PASS. Browser screenshots may fail until baseline update; inspect the generated image before accepting it.

- [ ] **Step 9: Commit**

```bash
git add apps/desktop-app/src/renderer/components/settings/SettingsGlobal.vue apps/desktop-app/src/renderer/components/settings/SettingsCache.vue apps/desktop-app/src/renderer/components/settings/SettingsProfiles.vue apps/desktop-app/src/renderer/components/settings/profiles/ProfileList.vue apps/desktop-app/src/renderer/components/settings/profiles/ProfileUrlRules.vue apps/desktop-app/src/renderer/components/settings/profiles/PriorityEditor.vue apps/desktop-app/src/renderer/components/settings/profiles/ColorSchemeGrid.vue apps/desktop-app/src/renderer/components/settings/profiles/SubtitleStyleFields.vue apps/desktop-app/src/renderer/components/settings/SettingsCache.test.ts apps/desktop-app/src/renderer/components/settings/SettingsProfiles.browser.test.ts apps/desktop-app/src/renderer/style.css
git commit -m "refactor(settings): use shared host ui"
```

---

### Task 6: Official Plugin Settings Use Shared Primitives

**Files:**
- Modify: `apps/desktop-app/src/renderer/components/settings/SettingsPlugins.vue`
- Modify: `apps/desktop-app/src/renderer/components/settings/SettingsTranscription.vue`
- Modify: `apps/desktop-app/src/renderer/components/settings/transcription/TranscriptionConfigList.vue`
- Modify: `apps/desktop-app/src/renderer/components/settings/transcription/WhisperApiForm.vue`
- Modify: `apps/desktop-app/src/renderer/components/settings/transcription/FasterWhisperBinariesCard.vue`
- Modify: `apps/desktop-app/src/renderer/components/settings/transcription/FasterWhisperModelsCard.vue`
- Modify: `apps/desktop-app/src/renderer/components/settings/transcription/FasterWhisperRuntimeCard.vue`
- Modify: `apps/desktop-app/src/renderer/components/settings/SettingsWordLookup.vue`
- Modify: `apps/desktop-app/src/renderer/components/settings/SettingsMediaServer.vue`
- Modify: `apps/desktop-app/src/renderer/components/settings/SettingsPlugins.test.ts`
- Modify: `apps/desktop-app/src/renderer/components/settings/SettingsMediaServer.test.ts`

- [ ] **Step 1: Write plugin primitive tests**

In `SettingsPlugins.test.ts`, add:

```ts
  it("renders plugin rows with shared list and badge primitives", () => {
    const wrapper = mount(SettingsPlugins);

    expect(wrapper.get(".ui-section").exists()).toBe(true);
    expect(wrapper.findAll(".ui-list-item").length).toBeGreaterThan(0);
    expect(wrapper.findAll(".ui-badge").length).toBeGreaterThan(0);
  });
```

In `SettingsMediaServer.test.ts`, add:

```ts
  it("renders server config editor with shared primitives", () => {
    const wrapper = mount(SettingsMediaServer);

    expect(wrapper.get(".ui-section").exists()).toBe(true);
    expect(wrapper.findAll(".ui-field").length).toBeGreaterThan(0);
    expect(wrapper.findAll(".settings-surface")).toHaveLength(0);
  });
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app vitest run src/renderer/components/settings/SettingsPlugins.test.ts src/renderer/components/settings/SettingsMediaServer.test.ts
```

Expected: FAIL because plugin settings still use old plugin-specific classes.

- [ ] **Step 3: Convert SettingsPlugins**

Use this target row shape:

```vue
<UiSection :title="t('plugin-section-title', 'Plugin Management')">
  <div v-if="catalog.length" class="ui-list">
    <UiListItem v-for="plugin in catalog" :key="plugin.id" as="article" class="plugin-card">
      <div class="ui-list-item__main">
        <div class="ui-list-item__title-row">
          <span class="ui-list-item__title">{{ plugin.displayName }}</span>
          <span class="ui-list-item__meta">v{{ plugin.version }}</span>
          <UiBadge :tone="statusTone(plugin.status)">{{ statusLabel(plugin.status) }}</UiBadge>
        </div>
        <p class="ui-list-item__description">{{ plugin.description }}</p>
        <p v-if="plugin.error" class="ui-field__error">{{ plugin.error }}</p>
      </div>
      <UiButton :variant="plugin.enabled ? 'secondary' : 'primary'" @click="plugin.enabled ? store.disablePlugin(plugin.id) : store.enablePlugin(plugin.id)">
        {{ plugin.enabled ? t("plugin-disable", "Disable") : t("plugin-enable", "Enable") }}
      </UiButton>
    </UiListItem>
  </div>
  <UiEmptyState v-else :message="t('plugin-empty', 'No plugins available.')" />
</UiSection>
```

Add a `statusTone` function:

```ts
function statusTone(status: string): "success" | "neutral" | "danger" {
  if (status === "enabled") return "success";
  if (status === "broken") return "danger";
  return "neutral";
}
```

- [ ] **Step 4: Convert Transcription settings**

`SettingsTranscription.vue` uses `UiSection`, `UiField`, `UiInput`, `UiSelect`, `UiTextarea`, and `UiSwitch`. Keep provider switching and all composable logic unchanged.

The provider field target shape:

```vue
<UiField id="transcription-provider" :label="t('transcription-provider-label', 'Provider')">
  <UiSelect v-model="provider" :options="providerOptions" />
</UiField>
```

Define:

```ts
const providerOptions = computed(() => [
  { value: "whisper-api", label: t("transcription-provider-whisper", "Whisper API (OpenAI-compatible)") },
  { value: "faster-whisper", label: t("transcription-provider-faster", "Faster-Whisper (local CLI)") }
]);
```

`TranscriptionConfigList.vue` uses `UiListItem`, `UiIconButton`, and `UiBadge`:

```vue
<UiListItem
  v-for="config in transcriptionConfigs"
  :key="config.id"
  as="button"
  :selected="config.id === activeConfigId"
  class="transcription-config-list__item"
  @click="$emit('select', config.id)"
>
  <span class="transcription-config-list__name">
    <span class="transcription-config-list__label">{{ config.name || config.id }}</span>
    <UiBadge v-if="config.id === activeConfigId" tone="info">{{ t("transcription-config-active-badge", "Active") }}</UiBadge>
  </span>
</UiListItem>
```

- [ ] **Step 5: Convert Faster-Whisper cards**

Replace `.fw-card` visual card styling with neutral grouped layouts:

```vue
<section class="ui-group">
  <header class="ui-group__header">
    <h3 class="ui-group__title">{{ t("transcription-faster-downloads", "Downloads & Management") }}</h3>
    <slot name="actions" />
  </header>
  <div class="ui-group__body">
    ...
  </div>
</section>
```

Keep download actions, progress values, model selection, open folder actions, and status checks unchanged.

- [ ] **Step 6: Convert Word Lookup and Jellyfin / Emby settings**

`SettingsWordLookup.vue` target:

```vue
<UiSection :title="t('word-lookup-section-title', 'Word Lookup')">
  <UiField id="word-list-path" :label="t('word-lookup-path-label', 'Word List Path')" :hint="t('word-lookup-path-hint', 'JSONL rows with word, content, and optional aliases.')">
    <div class="ui-inline-control">
      <UiInput :model-value="config.wordListPath" @update:model-value="handlePathInput" />
      <UiButton variant="secondary" @click="selectFile">{{ t("word-lookup-select-file", "Select File") }}</UiButton>
    </div>
  </UiField>
  ...
</UiSection>
```

Add `handlePathInput(value: string)` so updates no longer depend on raw DOM events:

```ts
async function handlePathInput(value: string) {
  await updateConfig({ wordListPath: value });
  await refresh();
}
```

`SettingsMediaServer.vue` target:

```vue
<UiSection :title="t('section-mediaserver', 'Jellyfin / Emby')">
  <div class="settings-split">
    <div class="settings-split__sidebar">...</div>
    <div class="settings-split__editor" v-if="selectedMediaServerConfig">
      <UiField id="server-name" :label="t('server-name-label', 'Server Name')">
        <UiInput v-model="mediaServerName" />
      </UiField>
      ...
    </div>
  </div>
</UiSection>
```

- [ ] **Step 7: Remove duplicated plugin CSS**

In `style.css`, delete or collapse styles that duplicate primitives:

```css
.plugin-card__badge,
.plugin-card__badge--enabled,
.plugin-card__badge--disabled,
.plugin-card__badge--error,
.fw-badge,
.fw-badge--success,
.fw-badge--error,
.word-lookup-status div {
  all: unset;
}
```

Use targeted replacements instead of leaving `all: unset` in final CSS. The final CSS should use `.ui-badge`, `.ui-status`, `.ui-group`, `.ui-stat`, and layout-only classes.

- [ ] **Step 8: Run plugin tests**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app vitest run src/renderer/components/settings/SettingsPlugins.test.ts src/renderer/components/settings/SettingsMediaServer.test.ts
pnpm --filter @immersive-subs/desktop-app typecheck:renderer
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add apps/desktop-app/src/renderer/components/settings/SettingsPlugins.vue apps/desktop-app/src/renderer/components/settings/SettingsTranscription.vue apps/desktop-app/src/renderer/components/settings/transcription/TranscriptionConfigList.vue apps/desktop-app/src/renderer/components/settings/transcription/WhisperApiForm.vue apps/desktop-app/src/renderer/components/settings/transcription/FasterWhisperBinariesCard.vue apps/desktop-app/src/renderer/components/settings/transcription/FasterWhisperModelsCard.vue apps/desktop-app/src/renderer/components/settings/transcription/FasterWhisperRuntimeCard.vue apps/desktop-app/src/renderer/components/settings/SettingsWordLookup.vue apps/desktop-app/src/renderer/components/settings/SettingsMediaServer.vue apps/desktop-app/src/renderer/components/settings/SettingsPlugins.test.ts apps/desktop-app/src/renderer/components/settings/SettingsMediaServer.test.ts apps/desktop-app/src/renderer/style.css
git commit -m "refactor(settings): unify plugin settings ui"
```

---

### Task 7: Desktop Controls Outside The Transcript Body

**Files:**
- Modify: `apps/desktop-app/src/renderer/components/top-panel/TopControlPanel.vue`
- Modify: `apps/desktop-app/src/renderer/components/top-panel/TopControlPanel.test.ts`
- Modify: `apps/desktop-app/src/renderer/components/subtitle/PlaybackControls.vue`
- Modify: `apps/desktop-app/src/renderer/components/subtitle/TrackSelector.vue`
- Modify: `apps/desktop-app/src/renderer/components/subtitle/TranscriptionControls.vue`
- Modify: `apps/desktop-app/src/renderer/components/subtitle/StatusBanner.vue`
- Modify: `apps/desktop-app/src/renderer/components/subtitle/WordLookupWindow.vue`
- Modify: `apps/desktop-app/src/renderer/locales/en.json`
- Modify: `apps/desktop-app/src/renderer/locales/zh.json`
- Modify: `apps/desktop-app/src/renderer/style.css`

- [ ] **Step 1: Add control structure tests**

In `TopControlPanel.test.ts`, add:

```ts
  it("uses shared control classes without touching transcript content", () => {
    const wrapper = mountTopControlPanel();

    expect(wrapper.findAll(".ui-icon-button").length).toBeGreaterThanOrEqual(3);
    expect(wrapper.findAll(".ui-select").length).toBeGreaterThanOrEqual(2);
    expect(wrapper.find(".transcript-surface").exists()).toBe(false);
  });
```

If this test helper name differs, use the local helper that mounts `TopControlPanel` with existing props.

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app vitest run src/renderer/components/top-panel/TopControlPanel.test.ts
```

Expected: FAIL because the controls still use old button/select classes.

- [ ] **Step 3: Convert TopControlPanel action buttons**

Import shared buttons:

```ts
import { UiIconButton } from "../ui";
```

Use this target button shape:

```vue
<UiIconButton
  :label="pinLabel"
  :pressed="isPinned"
  :active="isPinned"
  :class="pinButtonClass"
  @click="cyclePin"
>
  <span aria-hidden="true">{{ pinIcon }}</span>
</UiIconButton>
```

Convert fullscreen and settings buttons the same way. Keep drag-handle refs, panel state, pointer behavior, and opacity computed setter unchanged.

- [ ] **Step 4: Add control locale keys**

In `apps/desktop-app/src/renderer/locales/en.json`, add:

```json
  "primary-track-label": "Primary Subtitle",
  "secondary-track-label": "Secondary Subtitle",
```

In `apps/desktop-app/src/renderer/locales/zh.json`, add:

```json
  "primary-track-label": "主字幕",
  "secondary-track-label": "副字幕",
```

- [ ] **Step 5: Convert track and transcription controls**

`TrackSelector.vue` should use `UiSelect`:

```vue
<label class="track-picker" :class="{ 'track-picker--grow': grow }">
  <UiSelect :model-value="modelValue" :options="options" :aria-label="ariaLabel" @update:model-value="$emit('update:modelValue', $event)" />
</label>
```

Rename the disabled first-option prop to `leadLabel` and update `TopControlPanel.vue` to pass `:lead-label="t('primary-track-label', 'Primary Subtitle')"`.

Compute options:

```ts
const options = computed(() => [
  ...(leadLabel ? [{ value: "", label: leadLabel, disabled: true }] : []),
  ...(noneLabel ? [{ value: "", label: noneLabel }] : []),
  ...tracks.map((track) => ({ value: track.id, label: formatSourceFile(track.sourceFile) }))
]);
```

`TranscriptionControls.vue` should use `UiSelect` and `UiIconButton`.

- [ ] **Step 6: Convert playback and status controls**

`PlaybackControls.vue` keeps the same emits and range behavior. Change the play and auto-hide buttons to shared icon buttons:

```vue
<UiIconButton
  :label="isPlaying ? t('pause-button', 'Pause') : t('play-button', 'Play')"
  :disabled="!hasActiveVideo"
  variant="secondary"
  @click="$emit('toggle-playback')"
>
  <span aria-hidden="true">{{ isPlaying ? "Pause" : "Play" }}</span>
</UiIconButton>
```

Use CSS to render the text compactly if icons are not available. Do not change scrub events.

`StatusBanner.vue` should use shared status colors:

```vue
<p class="status-banner" :class="`status-banner--${banner.modifier}`">{{ banner.text }}</p>
```

Map CSS variables to `--ui-danger`, `--ui-success`, `--ui-info`, and `--ui-warning`.

- [ ] **Step 7: Theme word lookup chrome only**

In `WordLookupWindow.vue` and `style.css`, limit changes to popover chrome classes:

```css
.word-lookup-popover {
  border-color: var(--ui-border);
  background: color-mix(in srgb, var(--ui-surface) 96%, transparent);
  color: var(--ui-text);
}

.word-lookup-entry__body {
  color: var(--ui-text);
}
```

Do not change tokenization, entry rendering loops, resize behavior, or transcript token hover logic.

- [ ] **Step 8: Run control tests and transcript-sensitive tests**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app vitest run src/renderer/components/top-panel/TopControlPanel.test.ts src/renderer/components/subtitle/SubtitleView.browser.test.ts src/renderer/components/subtitle/TranscriptSurface.browser.test.ts
pnpm --filter @immersive-subs/desktop-app typecheck:renderer
```

Expected: PASS. If transcript screenshot tests fail because transcript geometry changed, revert the transcript-affecting CSS and keep only control changes.

- [ ] **Step 9: Commit**

```bash
git add apps/desktop-app/src/renderer/components/top-panel/TopControlPanel.vue apps/desktop-app/src/renderer/components/top-panel/TopControlPanel.test.ts apps/desktop-app/src/renderer/components/subtitle/PlaybackControls.vue apps/desktop-app/src/renderer/components/subtitle/TrackSelector.vue apps/desktop-app/src/renderer/components/subtitle/TranscriptionControls.vue apps/desktop-app/src/renderer/components/subtitle/StatusBanner.vue apps/desktop-app/src/renderer/components/subtitle/WordLookupWindow.vue apps/desktop-app/src/renderer/locales/en.json apps/desktop-app/src/renderer/locales/zh.json apps/desktop-app/src/renderer/style.css
git commit -m "refactor(renderer): unify desktop controls"
```

---

### Task 8: Extension Appearance Model And Helpers

**Files:**
- Create: `apps/extension/src/shared/appearance.ts`
- Create: `apps/extension/src/shared/appearance.test.ts`
- Modify: `apps/extension/src/shared/constants.ts`

- [ ] **Step 1: Write failing extension appearance tests**

Create `apps/extension/src/shared/appearance.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  APPEARANCE_STORAGE_KEY,
  getStoredAppearanceTheme,
  normalizeAppearanceTheme,
  resolveAppearanceTheme,
  type AppearanceTheme
} from "./appearance";

describe("extension appearance helpers", () => {
  it.each([
    ["system", "system"],
    ["light", "light"],
    ["dark", "dark"],
    ["blue", "system"],
    [null, "system"]
  ] satisfies Array<[unknown, AppearanceTheme]>)("normalizes %s", (input, expected) => {
    expect(normalizeAppearanceTheme(input)).toBe(expected);
  });

  it.each([
    ["light", true, "light"],
    ["dark", false, "dark"],
    ["system", true, "dark"],
    ["system", false, "light"]
  ] satisfies Array<[AppearanceTheme, boolean, "light" | "dark"]>)(
    "resolves %s with system dark=%s",
    (theme, systemDark, expected) => {
      expect(resolveAppearanceTheme(theme, systemDark)).toBe(expected);
    }
  );

  it("reads stored theme from a storage payload", () => {
    expect(getStoredAppearanceTheme({ [APPEARANCE_STORAGE_KEY]: "dark" })).toBe("dark");
    expect(getStoredAppearanceTheme({ [APPEARANCE_STORAGE_KEY]: "invalid" })).toBe("system");
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
pnpm --filter @immersive-subs/extension vitest run src/shared/appearance.test.ts
```

Expected: FAIL because `appearance.ts` does not exist.

- [ ] **Step 3: Add constants and helper implementation**

In `apps/extension/src/shared/constants.ts`, add:

```ts
export const APPEARANCE_STORAGE_KEY = "usp.appearance.theme";
```

Create `apps/extension/src/shared/appearance.ts`:

```ts
import { APPEARANCE_STORAGE_KEY } from "./constants";

export { APPEARANCE_STORAGE_KEY };

export type AppearanceTheme = "system" | "light" | "dark";
export type ResolvedAppearanceTheme = "light" | "dark";

export function normalizeAppearanceTheme(value: unknown): AppearanceTheme {
  return value === "light" || value === "dark" || value === "system" ? value : "system";
}

export function resolveAppearanceTheme(theme: AppearanceTheme, systemPrefersDark: boolean): ResolvedAppearanceTheme {
  if (theme === "light") return "light";
  if (theme === "dark") return "dark";
  return systemPrefersDark ? "dark" : "light";
}

export function getStoredAppearanceTheme(payload: Record<string, unknown>): AppearanceTheme {
  return normalizeAppearanceTheme(payload[APPEARANCE_STORAGE_KEY]);
}
```

- [ ] **Step 4: Run extension helper tests**

Run:

```bash
pnpm --filter @immersive-subs/extension vitest run src/shared/appearance.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/extension/src/shared/appearance.ts apps/extension/src/shared/appearance.test.ts apps/extension/src/shared/constants.ts
git commit -m "feat(extension): add appearance helpers"
```

---

### Task 9: Extension Popup UI Refactor

**Files:**
- Modify: `apps/extension/popup.html`
- Modify: `apps/extension/popup.css`
- Modify: `apps/extension/src/popup.ts`

- [ ] **Step 1: Add popup behavior tests through helper extraction**

In `apps/extension/src/popup.ts`, plan to export pure helpers for panel class names and appearance labels:

```ts
export function appearanceLabel(theme: AppearanceTheme): string {
  if (theme === "light") return "Light";
  if (theme === "dark") return "Dark";
  return "System";
}
```

Create tests in a new `apps/extension/src/popup.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { appearanceLabel } from "./popup";

describe("popup helpers", () => {
  it("labels appearance modes", () => {
    expect(appearanceLabel("system")).toBe("System");
    expect(appearanceLabel("light")).toBe("Light");
    expect(appearanceLabel("dark")).toBe("Dark");
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
pnpm --filter @immersive-subs/extension vitest run src/popup.test.ts
```

Expected: FAIL because `appearanceLabel` is not exported.

- [ ] **Step 3: Add appearance panel markup**

Modify `apps/extension/popup.html` header actions to include an appearance button:

```html
<button type="button" class="usp-icon-button" id="appearance-btn" title="Appearance" aria-label="Appearance">
  <span aria-hidden="true">Aa</span>
</button>
```

Add a new drawer section:

```html
<section class="drawer-panel appearance-panel" id="appearance-panel" aria-hidden="true">
  <div class="drawer-panel__header">
    <button type="button" class="usp-back-button" id="appearance-back">Back</button>
    <div>
      <h2>Appearance</h2>
    </div>
  </div>
  <div class="appearance-options" role="radiogroup" aria-label="Theme">
    <button type="button" class="appearance-option" data-theme-option="system" role="radio">System</button>
    <button type="button" class="appearance-option" data-theme-option="light" role="radio">Light</button>
    <button type="button" class="appearance-option" data-theme-option="dark" role="radio">Dark</button>
  </div>
</section>
```

Keep connections and blacklist panels, but rename old pill button classes to shared popup classes.

- [ ] **Step 4: Add popup theme and panel logic**

In `apps/extension/src/popup.ts`, import helpers:

```ts
import {
  APPEARANCE_STORAGE_KEY,
  getStoredAppearanceTheme,
  normalizeAppearanceTheme,
  resolveAppearanceTheme,
  type AppearanceTheme
} from "./shared/appearance";
```

Add DOM refs:

```ts
const appearancePanel = document.getElementById("appearance-panel");
const appearanceButton = document.getElementById("appearance-btn");
const appearanceBackButton = document.getElementById("appearance-back");
const appearanceOptionButtons = Array.from(document.querySelectorAll<HTMLButtonElement>("[data-theme-option]"));
```

Update panel state type:

```ts
let activePanel: "blacklist" | "connections" | "appearance" | null = null;
let appearanceTheme: AppearanceTheme = "system";
```

Add helpers:

```ts
export function appearanceLabel(theme: AppearanceTheme): string {
  if (theme === "light") return "Light";
  if (theme === "dark") return "Dark";
  return "System";
}

function systemPrefersDark() {
  return typeof matchMedia === "function" && matchMedia("(prefers-color-scheme: dark)").matches;
}

function applyAppearance(theme: AppearanceTheme) {
  appearanceTheme = theme;
  document.documentElement.dataset.themeMode = theme;
  document.documentElement.dataset.theme = resolveAppearanceTheme(theme, systemPrefersDark());
  for (const button of appearanceOptionButtons) {
    const selected = button.dataset.themeOption === theme;
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-checked", String(selected));
  }
}

function saveAppearance(theme: AppearanceTheme) {
  applyAppearance(theme);
  chrome.storage.local.set({ [APPEARANCE_STORAGE_KEY]: theme });
}
```

Load on startup:

```ts
chrome.storage.local.get([APPEARANCE_STORAGE_KEY], (result) => {
  applyAppearance(getStoredAppearanceTheme(result ?? {}));
});
```

Add panel branch in `setActivePanel`:

```ts
document.body.classList.toggle("appearance-open", nextPanel === "appearance");
appearancePanel?.setAttribute("aria-hidden", String(nextPanel !== "appearance"));
```

Wire events:

```ts
appearanceButton?.addEventListener("click", () => setActivePanel("appearance"));
appearanceBackButton?.addEventListener("click", () => setActivePanel(null));
for (const button of appearanceOptionButtons) {
  button.addEventListener("click", () => {
    saveAppearance(normalizeAppearanceTheme(button.dataset.themeOption));
  });
}
```

- [ ] **Step 5: Replace popup CSS with shared tokens**

In `apps/extension/popup.css`, use these root tokens:

```css
:root {
  color-scheme: light dark;
  --ui-radius: 8px;
  --ui-bg: #f6f7f9;
  --ui-surface: #ffffff;
  --ui-surface-muted: #eef1f4;
  --ui-text: #101418;
  --ui-text-muted: #66707c;
  --ui-border: rgba(16, 20, 24, 0.12);
  --ui-accent: #2563eb;
  --ui-success: #16803c;
  --ui-warning: #b45309;
  --ui-danger: #dc2626;
}

:root[data-theme="dark"] {
  --ui-bg: #0f1216;
  --ui-surface: #171b21;
  --ui-surface-muted: #202630;
  --ui-text: #edf1f5;
  --ui-text-muted: #9ba6b2;
  --ui-border: rgba(237, 241, 245, 0.12);
  --ui-accent: #60a5fa;
  --ui-success: #4ade80;
  --ui-warning: #f59e0b;
  --ui-danger: #f87171;
}
```

Use shared popup classes:

```css
.usp-icon-button,
.icon-btn {
  width: 32px;
  height: 32px;
  border: 0;
  border-radius: var(--ui-radius);
  background: transparent;
  color: var(--ui-text-muted);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.media-card,
.server-card,
.blacklist-item {
  border: 0;
  border-radius: var(--ui-radius);
  background: var(--ui-surface);
  box-shadow: none;
}

.media-card.playing {
  box-shadow: inset 3px 0 0 var(--ui-accent);
}
```

Remove old blue pill gradients and heavy card shadows.

- [ ] **Step 6: Run popup tests and build**

Run:

```bash
pnpm --filter @immersive-subs/extension vitest run src/shared/appearance.test.ts src/popup.test.ts
pnpm --filter @immersive-subs/extension build
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/extension/popup.html apps/extension/popup.css apps/extension/src/popup.ts apps/extension/src/popup.test.ts
git commit -m "refactor(extension): unify popup ui"
```

---

### Task 10: Final CSS Cleanup And Verification

**Files:**
- Modify: `apps/desktop-app/src/renderer/style.css`
- Modify screenshot baselines under `apps/desktop-app/src/renderer/components/settings/__screenshots__/` only after inspecting generated output.

- [ ] **Step 1: Scan for old one-off styles**

Run:

```bash
rg -n "plugin-card__badge|fw-badge|btn-primary|btn-secondary|settings-surface|server-card|usp-pill-button|linear-gradient|box-shadow" apps/desktop-app/src/renderer apps/extension
```

Expected: any remaining matches are either transcript body styles, intentionally retained layout classes, or old classes that still need removal.

- [ ] **Step 2: Remove duplicate classes**

Update CSS and templates so these old button/status classes no longer drive visual styling:

```text
btn-primary
btn-secondary
plugin-card__badge
fw-badge
usp-pill-button
```

Keep class names only when tests or DOM hooks still need them, and make them layout aliases with no unique colors.

- [ ] **Step 3: Run full renderer and extension verification**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app test:renderer
pnpm --filter @immersive-subs/desktop-app typecheck
pnpm --filter @immersive-subs/extension test
pnpm --filter @immersive-subs/extension build
```

Expected: PASS.

- [ ] **Step 4: Manual theme checks**

Run the desktop renderer:

```bash
pnpm --filter @immersive-subs/desktop-app dev:renderer
```

Open the settings URL shown by Vite and check:

- Appearance: system, light, dark.
- General settings.
- Profiles.
- Cache.
- Plugins.
- Transcription settings when enabled.
- Word Lookup settings when enabled.
- Jellyfin / Emby settings when enabled.

Run the extension build and inspect `apps/extension/dist/chrome/popup.html` in a browser-compatible extension context, or use the built popup file for static visual review where Chrome APIs are mocked. Check:

- Appearance panel.
- Connections panel.
- Blacklist panel.
- Media cards.
- Light, dark, and system modes.

- [ ] **Step 5: Update intentional screenshots**

If browser screenshot tests fail only because settings UI intentionally changed, update the settings screenshots after visual inspection. Do not update transcript screenshots unless the image confirms transcript body behavior is unchanged and the diff is caused by surrounding controls.

- [ ] **Step 6: Final status and commit**

```bash
git status --short
git add apps/desktop-app/src/renderer apps/extension docs/superpowers/plans/2026-05-22-frontend-ui-refactor.md
git commit -m "refactor: unify frontend ui"
```

Expected: the final commit includes only intentional UI refactor files and this plan if it was not committed earlier.

---

## Self-Review

Spec coverage:

- All frontend surfaces are covered: desktop settings, host settings, plugin settings, top controls, word lookup chrome, and extension popup.
- Theme modes are covered for desktop and extension: system, light, dark.
- The extension stores appearance independently.
- Settings uses left navigation with one active section.
- Host and plugin settings share UI primitives.
- Top controls may change, but transcript body components remain out of scope.
- Medium information density is represented by keeping network, path, regex, API, runtime, cache, status, and error hints.

Type consistency:

- `AppearanceTheme` is defined in main types and reused by renderer theme code.
- Extension has its own `AppearanceTheme` in `src/shared/appearance.ts`.
- Shared UI primitive names are consistent across tasks.
- `SettingsAppearance.vue` writes `global.appearance.theme`.

Verification coverage:

- Sanitizer tests cover persisted desktop settings.
- Renderer theme tests cover system resolution and document attributes.
- UI primitive tests cover shared components.
- Settings shell tests cover one active section.
- Host/plugin tests cover shared primitive use.
- Top control tests and transcript browser tests protect the subtitle body boundary.
- Extension helper tests, popup tests, extension test, and extension build cover popup changes.
