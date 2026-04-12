# Settings Panel Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the desktop settings window into a document-style layout with a stable left navigation, a continuous right-hand scroll surface, and a lighter modern visual system without changing settings behavior.

**Architecture:** Keep the current Electron window and Pinia/IPC data flow intact, but replace the renderer shell from "single active page" to "left directory + right document". Centralize the visual system in shared renderer CSS, keep complex sections (`Profiles`, `Rules`, `Media Server`) structurally richer than simple fields, and verify the redesign with jsdom and browser regression tests.

**Tech Stack:** Vue 3, Pinia, TypeScript, Vitest, Playwright browser snapshots, Electron renderer CSS

---

## File Structure

### Existing files to modify

- `desktop-app/src/renderer/components/settings/SettingsWindowShell.vue`
  - Replace single-section conditional rendering with one scrollable document containing all top-level sections.
- `desktop-app/src/renderer/components/settings/SettingsNav.vue`
  - Convert nav from "active page switcher" to "scroll-to-section directory" and expose section metadata needed for orientation.
- `desktop-app/src/renderer/components/settings/settingsSections.ts`
  - Expand section metadata so nav and shell share ids, labels, descriptions, and anchor/test ids.
- `desktop-app/src/renderer/components/settings/SettingsWindowShell.test.ts`
  - Update jsdom expectations from "conditional page swap" to "all sections render and nav tracks current section".
- `desktop-app/src/renderer/style.css`
  - Introduce the new settings-shell visual system: surface colors, spacing, typography, controlled content width, stable scrollbar gutter, section rhythm, and lighter controls.
- `desktop-app/src/renderer/components/settings/SettingsGlobal.vue`
  - Remove local card-heavy layout and migrate to document-style section groups.
- `desktop-app/src/renderer/components/settings/SettingsProfiles.vue`
  - Align headings, spacing, and split-pane surface styling to the shared shell language.
- `desktop-app/src/renderer/components/settings/SettingsRules.vue`
  - Keep dual-pane behavior, but restyle it to the lighter system and fit it into the long-page chapter rhythm.
- `desktop-app/src/renderer/components/settings/SettingsTranscription.vue`
  - Re-group fields into document sections and normalize spacing/controls against shared styles.
- `desktop-app/src/renderer/components/settings/SettingsMediaServer.vue`
  - Align entity-management UI with the shared document shell and lighter split-pane treatment.
- `desktop-app/src/renderer/components/settings/SettingsCache.vue`
  - Move cache/danger actions into a low-noise end-of-document section with clearer separation.
- `desktop-app/src/renderer/SettingsApp.vue`
  - Add the root class hooks needed for the new settings shell if required.

### Existing tests to modify

- `desktop-app/src/renderer/components/settings/SettingsRules.browser.test.ts`
  - Refresh screenshot expectations if the split-pane visuals change materially.
- `desktop-app/src/renderer/components/settings/SettingsProfiles.browser.test.ts`
  - Refresh screenshot expectations if the profile editor visuals change materially.

### Files likely to create

- `desktop-app/src/renderer/components/settings/SettingsWindowShell.browser.test.ts`
  - Browser-level regression for the redesigned shell layout, scroll gutter, and directory styling.

## Task 1: Lock the new shell behavior with failing tests

**Files:**
- Modify: `desktop-app/src/renderer/components/settings/SettingsWindowShell.test.ts`
- Create: `desktop-app/src/renderer/components/settings/SettingsWindowShell.browser.test.ts`
- Modify: `desktop-app/src/renderer/components/settings/settingsSections.ts`

- [ ] **Step 1: Write the failing jsdom test for document-style rendering**

```ts
import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import SettingsWindowShell from "./SettingsWindowShell.vue";

const sectionIds = [
  "general",
  "profiles",
  "rules",
  "transcription",
  "media-server",
  "cache"
] as const;

describe("SettingsWindowShell", () => {
  it("renders every top-level section in one scrollable document", () => {
    const wrapper = mount(SettingsWindowShell, {
      attachTo: document.body,
      global: {
        stubs: {
          SettingsGlobal: { template: '<section data-testid="settings-section-general" />' },
          SettingsProfiles: { template: '<section data-testid="settings-section-profiles" />' },
          SettingsRules: { template: '<section data-testid="settings-section-rules" />' },
          SettingsTranscription: { template: '<section data-testid="settings-section-transcription" />' },
          SettingsMediaServer: { template: '<section data-testid="settings-section-media-server" />' },
          SettingsCache: { template: '<section data-testid="settings-section-cache" />' }
        }
      }
    });

    expect(wrapper.get('[data-testid="settings-content"]').attributes("data-scroll-mode")).toBe("document");

    for (const id of sectionIds) {
      expect(wrapper.get(`[data-testid="settings-nav-item-${id}"]`).exists()).toBe(true);
      expect(wrapper.get(`[data-testid="settings-section-${id}"]`).exists()).toBe(true);
    }
  });

  it("scrolls to a section instead of swapping the rendered page", async () => {
    const scrollIntoView = vi.fn();

    const wrapper = mount(SettingsWindowShell, {
      attachTo: document.body,
      global: {
        stubs: {
          SettingsGlobal: { template: '<section data-testid="settings-section-general" />' },
          SettingsProfiles: { template: '<section data-testid="settings-section-profiles" />' },
          SettingsRules: { template: '<section data-testid="settings-section-rules" />' },
          SettingsTranscription: { template: '<section data-testid="settings-section-transcription" />' },
          SettingsMediaServer: { template: '<section data-testid="settings-section-media-server" />' },
          SettingsCache: { template: '<section data-testid="settings-section-cache" />' }
        }
      }
    });

    const target = wrapper.get('[data-testid="settings-section-profiles"]').element as HTMLElement;
    target.scrollIntoView = scrollIntoView;

    await wrapper.get('[data-testid="settings-nav-item-profiles"]').trigger("click");

    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "start" });
    expect(wrapper.get('[data-testid="settings-section-general"]').exists()).toBe(true);
    expect(wrapper.get('[data-testid="settings-section-profiles"]').exists()).toBe(true);
  });
});
```

- [ ] **Step 2: Run the jsdom test and verify it fails**

Run:

```bash
npm run test:renderer:jsdom -- SettingsWindowShell
```

Expected: FAIL because `SettingsWindowShell.vue` still conditionally renders one section at a time and does not expose document-mode attributes.

- [ ] **Step 3: Write the failing browser regression test for the new shell**

```ts
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import SettingsWindowShell from "./SettingsWindowShell.vue";

describe("SettingsWindowShell browser layout", () => {
  it("keeps a fixed nav and a padded document column with visible scrollbar gutter", async () => {
    const wrapper = mount(SettingsWindowShell, {
      attachTo: document.body
    });

    const shell = wrapper.get('[data-testid="settings-shell"]');
    const content = wrapper.get('[data-testid="settings-content"]');

    expect(shell.classes()).toContain("settings-window-shell--document");
    expect(content.attributes("data-scroll-mode")).toBe("document");
    await expect.element(shell.element).toMatchScreenshot("settings-window-shell-document.png");
  });
});
```

- [ ] **Step 4: Run the browser test and verify it fails**

Run:

```bash
npm run test:renderer:browser -- SettingsWindowShell.browser
```

Expected: FAIL because the shell still uses the old page-switch layout and screenshot output does not match the new structure.

- [ ] **Step 5: Commit the failing-test baseline**

```bash
git add \
  desktop-app/src/renderer/components/settings/SettingsWindowShell.test.ts \
  desktop-app/src/renderer/components/settings/SettingsWindowShell.browser.test.ts \
  desktop-app/src/renderer/components/settings/settingsSections.ts
git commit -m "test(settings): capture document-shell redesign expectations"
```

## Task 2: Refactor the settings shell into a directory + document layout

**Files:**
- Modify: `desktop-app/src/renderer/components/settings/settingsSections.ts`
- Modify: `desktop-app/src/renderer/components/settings/SettingsNav.vue`
- Modify: `desktop-app/src/renderer/components/settings/SettingsWindowShell.vue`
- Modify: `desktop-app/src/renderer/components/settings/SettingsWindowShell.test.ts`

- [ ] **Step 1: Expand the section metadata so shell and nav can share anchors**

```ts
export const SETTINGS_SECTIONS = [
  {
    id: "general",
    label: "General",
    description: "App language, shortcuts, startup, and connectivity",
    anchorId: "settings-section-general"
  },
  {
    id: "profiles",
    label: "Profiles",
    description: "Subtitle styles and playback preferences",
    anchorId: "settings-section-profiles"
  },
  {
    id: "rules",
    label: "Rules",
    description: "Automatic profile selection rules",
    anchorId: "settings-section-rules"
  },
  {
    id: "transcription",
    label: "Transcription",
    description: "Providers, prompts, and extraction defaults",
    anchorId: "settings-section-transcription"
  },
  {
    id: "media-server",
    label: "Media Server",
    description: "Server connections and playback integration",
    anchorId: "settings-section-media-server"
  },
  {
    id: "cache",
    label: "Cache",
    description: "Storage limits and destructive cleanup actions",
    anchorId: "settings-section-cache"
  }
] as const;
```

- [ ] **Step 2: Update the nav component so it emits scroll targets, not page switches**

```vue
<template>
  <nav class="settings-nav" data-testid="settings-nav" aria-label="Settings sections">
    <div class="settings-nav__meta">
      <p class="settings-nav__eyebrow">Preferences</p>
      <h1 class="settings-nav__title">Settings</h1>
      <p class="settings-nav__description">All application preferences in one document.</p>
    </div>
    <button
      v-for="section in sections"
      :key="section.id"
      type="button"
      class="settings-nav__item"
      :data-testid="`settings-nav-item-${section.id}`"
      :aria-current="section.id === currentSection ? 'location' : undefined"
      @click="$emit('select', section.id)"
    >
      <span class="settings-nav__item-label">{{ section.label }}</span>
      <span class="settings-nav__item-description">{{ section.description }}</span>
    </button>
  </nav>
</template>
```

- [ ] **Step 3: Replace conditional page rendering with one scrollable document shell**

```vue
<template>
  <section class="settings-window-shell settings-window-shell--document" data-testid="settings-shell">
    <header class="settings-window-shell__header">Settings</header>
    <div class="settings-window-shell__body">
      <SettingsNav
        :sections="sections"
        :current-section="currentSection"
        @select="scrollToSection"
      />
      <main
        ref="contentRef"
        class="settings-window-shell__content"
        data-testid="settings-content"
        data-scroll-mode="document"
      >
        <div class="settings-document">
          <header class="settings-document__intro">
            <p class="settings-document__eyebrow">Preferences</p>
            <h2 class="settings-document__title">Tune the app without losing context.</h2>
            <p class="settings-document__description">
              Navigate from the left, edit on the right, and keep every section in one continuous reading flow.
            </p>
          </header>

          <section
            v-for="section in sections"
            :id="section.anchorId"
            :key="section.id"
            :data-testid="section.anchorId"
            class="settings-document__section"
          >
            <component :is="sectionComponents[section.id]" />
          </section>
        </div>
      </main>
    </div>
  </section>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";

const currentSection = ref<SettingsSectionId>("general");
const contentRef = ref<HTMLElement | null>(null);

function scrollToSection(id: SettingsSectionId) {
  const target = document.getElementById(`settings-section-${id}`);
  target?.scrollIntoView({ behavior: "smooth", block: "start" });
}

onMounted(() => {
  const observer = new IntersectionObserver((entries) => {
    const visible = entries
      .filter((entry) => entry.isIntersecting)
      .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

    if (visible?.target.id) {
      currentSection.value = visible.target.id.replace("settings-section-", "") as SettingsSectionId;
    }
  }, {
    root: contentRef.value,
    threshold: [0.2, 0.4, 0.6]
  });

  document.querySelectorAll<HTMLElement>(".settings-document__section").forEach((section) => observer.observe(section));
  onBeforeUnmount(() => observer.disconnect());
});
</script>
```

- [ ] **Step 4: Run the jsdom tests and make sure the shell tests pass**

Run:

```bash
npm run test:renderer:jsdom -- SettingsWindowShell
```

Expected: PASS with both document-mode tests succeeding.

- [ ] **Step 5: Commit the shell refactor**

```bash
git add \
  desktop-app/src/renderer/components/settings/settingsSections.ts \
  desktop-app/src/renderer/components/settings/SettingsNav.vue \
  desktop-app/src/renderer/components/settings/SettingsWindowShell.vue \
  desktop-app/src/renderer/components/settings/SettingsWindowShell.test.ts
git commit -m "feat(settings): render settings as a scrollable document"
```

## Task 3: Introduce the shared visual system and scroll-safe shell styles

**Files:**
- Modify: `desktop-app/src/renderer/style.css`
- Modify: `desktop-app/src/renderer/SettingsApp.vue`
- Test: `desktop-app/src/renderer/components/settings/SettingsWindowShell.browser.test.ts`

- [ ] **Step 1: Write the failing style assertions in the browser test**

```ts
it("uses a padded document column and stable scrollbar gutter", async () => {
  const wrapper = mount(SettingsWindowShell, { attachTo: document.body });
  const content = wrapper.get('[data-testid="settings-content"]').element as HTMLElement;
  const styles = getComputedStyle(content);

  expect(styles.scrollbarGutter).toBe("stable");
  expect(styles.paddingRight).toBe("32px");
  expect(wrapper.get(".settings-document").exists()).toBe(true);
});
```

- [ ] **Step 2: Run the browser test and verify it fails**

Run:

```bash
npm run test:renderer:browser -- SettingsWindowShell.browser
```

Expected: FAIL because the current shell uses the old dark panel styling, tight padding, and no stable scrollbar gutter.

- [ ] **Step 3: Implement the shared settings-shell visual system in `style.css`**

```css
:root {
  --settings-bg: #eef1f4;
  --settings-surface: rgba(255, 255, 255, 0.78);
  --settings-surface-strong: rgba(255, 255, 255, 0.96);
  --settings-border: rgba(15, 23, 42, 0.08);
  --settings-border-strong: rgba(15, 23, 42, 0.14);
  --settings-text: #18212b;
  --settings-text-muted: #5f6b76;
  --settings-accent: #2463eb;
  --settings-accent-soft: rgba(36, 99, 235, 0.12);
}

.settings-window {
  min-height: 100vh;
  background:
    radial-gradient(circle at top left, rgba(255, 255, 255, 0.92), rgba(255, 255, 255, 0) 36%),
    linear-gradient(180deg, #f6f7f8 0%, #edf1f4 100%);
  color: var(--settings-text);
}

.settings-window-shell {
  display: grid;
  grid-template-rows: 52px minmax(0, 1fr);
  height: 100vh;
}

.settings-window-shell__body {
  display: grid;
  grid-template-columns: 248px minmax(0, 1fr);
  min-height: 0;
}

.settings-window-shell__content {
  overflow-y: auto;
  min-height: 0;
  scrollbar-gutter: stable;
  padding: 24px 32px 40px 24px;
}

.settings-document {
  width: min(100%, 880px);
  margin: 0 auto;
}

.settings-document__section {
  padding: 0 0 40px;
}

.settings-document__section + .settings-document__section {
  margin-top: 40px;
  border-top: 1px solid var(--settings-border);
  padding-top: 40px;
}
```

- [ ] **Step 4: Add the root class hook in `SettingsApp.vue` if the layout needs a dedicated mount class**

```vue
<template>
  <div class="settings-window settings-window--document">
    <SettingsWindowShell />
  </div>
</template>
```

- [ ] **Step 5: Run browser and renderer type checks**

Run:

```bash
npm run typecheck:renderer
npm run test:renderer:browser -- SettingsWindowShell.browser
```

Expected: PASS with the new screenshot and computed-style checks succeeding.

- [ ] **Step 6: Commit the visual-system shell**

```bash
git add \
  desktop-app/src/renderer/style.css \
  desktop-app/src/renderer/SettingsApp.vue \
  desktop-app/src/renderer/components/settings/SettingsWindowShell.browser.test.ts
git commit -m "feat(settings): add document-shell styling system"
```

## Task 4: Convert simple settings sections to document-style content blocks

**Files:**
- Modify: `desktop-app/src/renderer/components/settings/SettingsGlobal.vue`
- Modify: `desktop-app/src/renderer/components/settings/SettingsTranscription.vue`
- Modify: `desktop-app/src/renderer/components/settings/SettingsCache.vue`
- Modify: `desktop-app/src/renderer/style.css`

- [ ] **Step 1: Write a failing shell/browser assertion that the heavy cards are gone from `General`**

```ts
it("renders general settings as document groups instead of stacked cards", async () => {
  const wrapper = mount(SettingsWindowShell, { attachTo: document.body });
  expect(wrapper.find(".settings-card").exists()).toBe(false);
  expect(wrapper.find(".settings-group").exists()).toBe(true);
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```bash
npm run test:renderer:jsdom -- SettingsWindowShell
```

Expected: FAIL because `SettingsGlobal.vue` still renders `.settings-card`.

- [ ] **Step 3: Refactor `SettingsGlobal.vue` into section groups backed by shared styles**

```vue
<template>
  <section class="settings-chapter">
    <header class="settings-chapter__header">
      <p class="settings-chapter__eyebrow">General</p>
      <h3 class="settings-chapter__title">{{ t("section-global-settings", "Global Settings") }}</h3>
      <p class="settings-chapter__description">
        Language, startup, connectivity, shortcuts, and process blacklists.
      </p>
    </header>

    <div class="settings-group">
      <div class="settings-group__header">
        <h4 class="settings-group__title">{{ t("global-general", "General") }}</h4>
      </div>
      <div class="settings-group__body">
        <label class="settings-field">
          <span class="settings-field__label">{{ t("language-label", "Language") }}</span>
          <select v-model="languageSetting">
            <option value="en">{{ t("language-option-en", "English") }}</option>
            <option value="zh">{{ t("language-option-zh", "中文") }}</option>
          </select>
        </label>
        <div class="settings-field settings-field--row">
          <div>
            <span class="settings-field__label">{{ t("auto-start-label", "Auto Start") }}</span>
            <p class="settings-field__hint">{{ t("toggle-enable", "Enable launch at login.") }}</p>
          </div>
          <label class="toggle">
            <input type="checkbox" v-model="autoLaunch" />
            <span class="toggle__text">{{ t("toggle-enable", "Enable") }}</span>
          </label>
        </div>
      </div>
    </div>
  </section>
</template>
```

- [ ] **Step 4: Add the reusable group primitives to `style.css` and apply them to `Transcription`/`Cache`**

```css
.settings-chapter {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.settings-group {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.settings-group__header {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.settings-group__title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--settings-text);
}

.settings-group__body {
  display: grid;
  gap: 16px;
}

.settings-field--row {
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 0;
  border-top: 1px solid var(--settings-border);
}
```

- [ ] **Step 5: Run jsdom and browser tests for the simple sections**

Run:

```bash
npm run test:renderer:jsdom -- SettingsWindowShell
npm run test:renderer:browser -- SettingsWindowShell.browser
```

Expected: PASS with no `.settings-card` in `General` and updated screenshots matching the lighter document layout.

- [ ] **Step 6: Commit the simple-section refactor**

```bash
git add \
  desktop-app/src/renderer/components/settings/SettingsGlobal.vue \
  desktop-app/src/renderer/components/settings/SettingsTranscription.vue \
  desktop-app/src/renderer/components/settings/SettingsCache.vue \
  desktop-app/src/renderer/style.css
git commit -m "feat(settings): restyle document-style form sections"
```

## Task 5: Align complex sections with the new shell without changing their behavior

**Files:**
- Modify: `desktop-app/src/renderer/components/settings/SettingsProfiles.vue`
- Modify: `desktop-app/src/renderer/components/settings/SettingsRules.vue`
- Modify: `desktop-app/src/renderer/components/settings/SettingsMediaServer.vue`
- Modify: `desktop-app/src/renderer/style.css`
- Modify: `desktop-app/src/renderer/components/settings/SettingsProfiles.browser.test.ts`
- Modify: `desktop-app/src/renderer/components/settings/SettingsRules.browser.test.ts`

- [ ] **Step 1: Write the failing screenshot expectation for the lighter split panes**

```ts
await expect.element(wrapper.get(".settings-section").element).toMatchScreenshot(
  "settings-rules-soft-split-pane.png"
);
```

```ts
await expect.element(wrapper.get(".settings-section").element).toMatchScreenshot(
  "settings-profiles-soft-split-pane.png"
);
```

- [ ] **Step 2: Run the browser tests and verify they fail**

Run:

```bash
npm run test:renderer:browser -- SettingsRules SettingsProfiles
```

Expected: FAIL because the current split panes still use strong borders, darker backgrounds, and old density.

- [ ] **Step 3: Soften the split-pane CSS and align headings with the chapter system**

```css
.settings-section--split {
  min-height: 640px;
}

.settings-split {
  display: grid;
  grid-template-columns: 248px minmax(0, 1fr);
  min-height: 640px;
  border: 1px solid var(--settings-border);
  border-radius: 20px;
  background: var(--settings-surface);
  backdrop-filter: blur(18px);
  overflow: clip;
}

.settings-split__sidebar {
  background: rgba(248, 250, 252, 0.72);
  border-right: 1px solid var(--settings-border);
}

.settings-split__editor {
  padding: 24px;
  background: var(--settings-surface-strong);
}
```

- [ ] **Step 4: Add chapter headers around `Profiles`, `Rules`, and `Media Server` while preserving their internal editors**

```vue
<section class="settings-chapter settings-section settings-section--split">
  <header class="settings-chapter__header">
    <p class="settings-chapter__eyebrow">Profiles</p>
    <h3 class="settings-chapter__title">{{ t("section-profiles", "Profiles") }}</h3>
    <p class="settings-chapter__description">
      Manage reusable subtitle display and playback presets.
    </p>
  </header>

  <div class="settings-split">
    <!-- existing list/editor structure stays here -->
  </div>
</section>
```

- [ ] **Step 5: Run the browser regression tests and renderer suite**

Run:

```bash
npm run test:renderer:browser -- SettingsRules SettingsProfiles SettingsWindowShell.browser
npm run test:renderer:jsdom -- SettingsWindowShell
```

Expected: PASS with updated split-pane screenshots and unchanged section behavior.

- [ ] **Step 6: Commit the complex-section alignment**

```bash
git add \
  desktop-app/src/renderer/components/settings/SettingsProfiles.vue \
  desktop-app/src/renderer/components/settings/SettingsRules.vue \
  desktop-app/src/renderer/components/settings/SettingsMediaServer.vue \
  desktop-app/src/renderer/components/settings/SettingsProfiles.browser.test.ts \
  desktop-app/src/renderer/components/settings/SettingsRules.browser.test.ts \
  desktop-app/src/renderer/style.css
git commit -m "feat(settings): align complex editors with document shell"
```

## Task 6: Final verification and cleanup

**Files:**
- Modify: `desktop-app/src/renderer/style.css`
- Test: `desktop-app/src/renderer/components/settings/SettingsWindowShell.browser.test.ts`
- Test: `desktop-app/src/renderer/components/settings/SettingsWindowShell.test.ts`

- [ ] **Step 1: Add the final regression assertions for orientation and scroll safety**

```ts
it("marks the current nav item as the visible chapter", async () => {
  const wrapper = mount(SettingsWindowShell, { attachTo: document.body });

  await wrapper.get('[data-testid="settings-nav-item-transcription"]').trigger("click");

  expect(
    wrapper.get('[data-testid="settings-nav-item-transcription"]').attributes("aria-current")
  ).toBe("location");
});
```

- [ ] **Step 2: Run the full renderer verification suite**

Run:

```bash
npm run typecheck:renderer
npm run test:renderer
```

Expected: PASS with jsdom and browser projects both succeeding.

- [ ] **Step 3: Do a final spec-to-code checklist before closing**

Use this checklist:

```text
- left nav remains stable while right content scrolls
- right side renders all six top-level chapters in one document
- nav click scrolls to chapter instead of swapping pages
- active chapter is reflected in nav state
- right content uses a controlled reading width
- scrollbar gutter is stable and content has right-side breathing room
- general/transcription/cache use document groups instead of heavy card stacks
- profiles/rules/media-server keep richer structures but share the same visual language
```

- [ ] **Step 4: Commit the verification pass**

```bash
git add \
  desktop-app/src/renderer/components/settings/SettingsWindowShell.browser.test.ts \
  desktop-app/src/renderer/components/settings/SettingsWindowShell.test.ts \
  desktop-app/src/renderer/style.css
git commit -m "test(settings): verify redesigned settings shell"
```

## Self-Review

Spec coverage check:

- Information architecture is covered by Task 2.
- Visual language and surface strategy are covered by Tasks 3, 4, and 5.
- Long-page reading flow and chapter rhythm are covered by Tasks 2 and 4.
- Scrollbar space, orientation, and sticky-ready shell behavior are covered by Tasks 2, 3, and 6.
- Complex-section handling for `Profiles`, `Rules`, and `Media Server` is covered by Task 5.
- Validation and regression coverage are covered by Tasks 1, 3, 5, and 6.

Placeholder scan:

- No `TODO`, `TBD`, or deferred references remain.
- Every task includes file paths, code snippets, and explicit commands.

Type consistency check:

- Section ids are consistently `general`, `profiles`, `rules`, `transcription`, `media-server`, and `cache`.
- Shared anchor naming stays `settings-section-<id>` across metadata, shell ids, tests, and nav targets.
- Shell state uses `aria-current="location"` consistently for the document-directory pattern.
