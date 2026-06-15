# Renderer UI Foundation Implementation Plan

> Historical note, 2026-06-15: Plugin-related settings tasks in this plan predate the built-in Features replacement. Current source no longer has `SettingsPlugins`, `PluginSettingsSchema`, plugin catalog UI, or plugin runtime settings; treat plugin-specific references below as implementation history, not current architecture guidance.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the project-owned desktop renderer UI foundation and express all current renderer surfaces through it.

**Architecture:** Keep `apps/desktop-app/src/renderer/components/ui` as the only shared renderer UI boundary. Add missing foundation components and boundary checks first, then replace duplicated settings, top panel, subtitle control, and word lookup chrome with those components while leaving domain-specific layout in product components. Keep external UI/style frameworks out of runtime dependencies.

**Tech Stack:** Vue 3, TypeScript, Vite, Vitest jsdom/browser projects, Electron renderer, existing `@lucide/vue` icons, project-owned CSS tokens.

**Implementation Status:** Implemented on the current branch. The final renderer now has the new foundation components, production renderer UI boundary guard, root test integration, compact foundation control variants, and migrated settings/top-panel/subtitle/word-lookup chrome. Follow-up review fixes moved remaining product-layer shared-control chrome into the UI foundation, added regression coverage for the boundary guard, removed duplicate `UiSettingRow` ARIA wiring, and deleted the weak stylesheet-comment test. The final cleanup pass moved subtitle status banners onto `UiMessage` compact/neutral foundation variants, removed unused legacy settings helper CSS, replaced the historical old-class blacklist with foundation class-family chrome checks, and removed old-class negative assertions from focused tests. Per-task commits, subagents, and worktrees were not used because the implementation request explicitly required a single current-branch modification pass.

---

## File Structure

### Create

- `apps/desktop-app/src/renderer/components/ui/UiSettingRow.vue`  
  Shared settings/form row with label, hint, value, error, compact/wide/editor/stats control widths, and accessible IDs.

- `apps/desktop-app/src/renderer/components/ui/UiToolbar.vue`  
  Shared dense toolbar/action cluster for top panel and compact row actions.

- `apps/desktop-app/src/renderer/components/ui/UiSurface.vue`  
  Shared tokenized surface wrapper for floating panels, settings shells, word lookup chrome, and repeated product surfaces.

- `apps/desktop-app/src/renderer/components/ui/UiMessage.vue`  
  Shared inline message component for neutral, info, warning, danger, and success text, including compact presentation for dense panels.

- `scripts/check-renderer-ui-boundaries.mjs`  
  Repository check that blocks external renderer UI/style framework imports and product-owned overrides of foundation control, feedback, and structure chrome.

### Modify

- `package.json`  
  Add `lint:renderer-ui-boundaries`; Task 9 wires it into the root `test` command after the renderer boundary passes.

- `apps/desktop-app/src/renderer/components/ui/index.ts`  
  Export the new foundation components.

- `apps/desktop-app/src/renderer/components/ui/UiComponents.test.ts`  
  Cover new foundation components and contract behavior.

- `apps/desktop-app/src/renderer/style.css`  
  Keep one renderer stylesheet import path, but organize contents as token layer, foundation layer, and product layout layer.

- `apps/desktop-app/src/renderer/components/settings/*.vue`  
  Replace settings row/group/list/action chrome with UI foundation components.

- `apps/desktop-app/src/renderer/components/settings/profiles/*.vue`  
  Replace style editor/profile chrome with UI foundation components while keeping subtitle preview layout domain-owned.

- `apps/desktop-app/src/renderer/components/top-panel/TopControlPanel.vue`  
  Use foundation surface, toolbar, status, slider, icon button, tooltip, and tokenized layout.

- `apps/desktop-app/src/renderer/components/subtitle/*.vue`  
  Use foundation controls for playback, track selection, transcription, status, and cue action chrome. Keep transcript projection and subtitle text layout domain-owned.

- `apps/desktop-app/src/renderer/components/subtitle/WordLookupWindow.vue`  
  Use foundation chrome and tokenized surfaces for the word lookup window. Keep dictionary content domain-owned.

- Existing focused tests under `apps/desktop-app/src/renderer/components/**`  
  Update assertions to target foundation components and stable `data-slot` contracts.

---

## Task 1: Add Renderer UI Boundary Guard

**Files:**
- Create: `scripts/check-renderer-ui-boundaries.mjs`
- Modify: `package.json`

- [ ] **Step 1: Write the boundary guard script**

Create `scripts/check-renderer-ui-boundaries.mjs` with this content:

```js
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const rendererRoot = path.join(repoRoot, "apps/desktop-app/src/renderer");
const productRoots = [
  path.join(rendererRoot, "components/settings"),
  path.join(rendererRoot, "components/top-panel"),
  path.join(rendererRoot, "components/subtitle")
];

const externalUiImportPatterns = [
  /from\s+["']antd(?:\/|["'])/,
  /from\s+["']@ant-design\//,
  /from\s+["']@arco-design\//,
  /from\s+["']element-plus(?:\/|["'])/,
  /from\s+["']naive-ui(?:\/|["'])/,
  /from\s+["']vuetify(?:\/|["'])/,
  /from\s+["']reka-ui(?:\/|["'])/,
  /from\s+["']radix-vue(?:\/|["'])/,
  /from\s+["']@radix-ui\//,
  /from\s+["']@headlessui\//,
  /from\s+["']@mui\//,
  /from\s+["']@chakra-ui\//,
  /from\s+["']@mantine\//,
  /from\s+["']@fluentui\//,
  /from\s+["']@douyinfe\/semi-/,
  /from\s+["']tailwindcss(?:\/|["'])/,
  /from\s+["']@tailwindcss\//,
  /from\s+["']unocss(?:\/|["'])/,
  /from\s+["']@unocss\//
];

const foundationChromeSelectorGroups = [
  {
    kind: "control",
    pattern: /\.ui-(?:button|icon-button|input|textarea|select|switch|slider|segmented|color-input)(?:\b|[#.:[\s])/
  },
  {
    kind: "feedback",
    pattern: /\.ui-(?:status|badge|message|empty-state|progress)(?:\b|[#.:[\s])/
  },
  {
    kind: "structure",
    pattern: /\.ui-(?:surface|toolbar|setting-row|list-item|chip|stat|group)(?:\b|[#.:[\s])/
  }
];
const chromeDeclarationPattern = /(?:^|[;\s])(?:width|height|min-height|border|border-color|border-radius|background|color|padding|outline|font-size|line-height)\s*:/;
const productCssSectionMarker = "/* Product surfaces */";

const failures = [];

for (const file of walk(rendererRoot)) {
  const text = readFileSync(file, "utf8");
  const rel = path.relative(repoRoot, file);
  for (const pattern of externalUiImportPatterns) {
    if (pattern.test(text)) {
      failures.push(`${rel}: imports a blocked external UI/style framework (${pattern})`);
    }
  }
}

for (const root of productRoots) {
  for (const file of walk(root)) {
    const text = readFileSync(file, "utf8");
    const rel = path.relative(repoRoot, file);
    for (const failure of findProductUiChromeOverrides(text)) {
      failures.push(`${rel}: overrides foundation ${failure.kind} chrome (${failure.selector})`);
    }
  }
}

const rendererStylesheet = path.join(rendererRoot, "style.css");
for (const failure of findProductUiChromeOverrides(readFileSync(rendererStylesheet, "utf8"), {
  onlyAfterMarker: productCssSectionMarker
})) {
  failures.push(`${path.relative(repoRoot, rendererStylesheet)}: overrides foundation ${failure.kind} chrome (${failure.selector})`);
}

if (failures.length) {
  console.error("Renderer UI boundary check failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Renderer UI boundary check passed.");

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === "dist" || entry === "coverage") {
      continue;
    }
    const fullPath = path.join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      yield* walk(fullPath);
      continue;
    }
    if (/\.(vue|ts|tsx|js|mjs|css)$/.test(entry)) {
      yield fullPath;
    }
  }
}
```

- [ ] **Step 2: Add the package scripts**

Modify the root `package.json` scripts so the relevant entries are:

```json
{
  "scripts": {
    "build": "pnpm --filter @immersive-subs/contracts build && pnpm --filter @immersive-subs/desktop-app build:app && pnpm --filter @immersive-subs/extension build:app",
    "test": "pnpm test:scripts && node ./scripts/check-silent-catches.mjs && pnpm --filter @immersive-subs/contracts test && pnpm --filter @immersive-subs/desktop-app test:app && pnpm --filter @immersive-subs/extension test:app",
    "lint:silent-catches": "node ./scripts/check-silent-catches.mjs",
    "lint:renderer-ui-boundaries": "node ./scripts/check-renderer-ui-boundaries.mjs",
    "test:scripts": "node --test scripts/release/release-scripts.test.mjs scripts/check-renderer-ui-boundaries.test.mjs"
  }
}
```

Keep all other existing scripts unchanged.

- [ ] **Step 3: Run the boundary guard and verify it fails before the UI replacement**

Run:

```bash
pnpm lint:renderer-ui-boundaries
```

Expected: FAIL while product CSS still overrides `.ui-*` foundation control, feedback, or structure chrome.

- [ ] **Step 4: Commit the standalone guard while failing state is expected for the current task**

The root `test` command still passes because Task 9 wires this guard into root `test` after the duplicate chrome has been removed. Commit:

```bash
git add scripts/check-renderer-ui-boundaries.mjs package.json
git commit -m "test: add renderer ui boundary guard"
```

Expected: commit succeeds.

---

## Task 2: Add Missing UI Foundation Components

**Files:**
- Create: `apps/desktop-app/src/renderer/components/ui/UiSettingRow.vue`
- Create: `apps/desktop-app/src/renderer/components/ui/UiToolbar.vue`
- Create: `apps/desktop-app/src/renderer/components/ui/UiSurface.vue`
- Create: `apps/desktop-app/src/renderer/components/ui/UiMessage.vue`
- Modify: `apps/desktop-app/src/renderer/components/ui/index.ts`
- Modify: `apps/desktop-app/src/renderer/components/ui/UiComponents.test.ts`
- Modify: `apps/desktop-app/src/renderer/style.css`

- [ ] **Step 1: Add failing component contract tests**

Append these tests inside the existing `describe("UI primitives", () => { ... })` block in `apps/desktop-app/src/renderer/components/ui/UiComponents.test.ts`:

```ts
it("renders setting rows with shared label, hint, value, error, and control slots", () => {
  const wrapper = mount(UiSettingRow, {
    props: {
      id: "cache-path",
      label: "Cache path",
      hint: "Folder for cached subtitles",
      value: "Enabled",
      error: "Folder is not writable",
      controlWidth: "wide"
    },
    slots: {
      default: '<input class="ui-input" />'
    }
  });

  expect(wrapper.classes()).toContain("ui-setting-row");
  expect(wrapper.classes()).toContain("ui-setting-row--wide");
  expect(wrapper.get(".ui-setting-row__label").attributes("id")).toBe("cache-path-label");
  expect(wrapper.get(".ui-setting-row__hint").attributes("id")).toBe("cache-path-hint");
  expect(wrapper.get(".ui-setting-row__error").attributes("id")).toBe("cache-path-error");
  expect(wrapper.get(".ui-setting-row__value").text()).toBe("Enabled");
  expect(wrapper.get(".ui-setting-row__control").attributes("aria-describedby")).toContain("cache-path-hint");
  expect(wrapper.get(".ui-setting-row__control").attributes("aria-describedby")).toContain("cache-path-error");
});

it("renders shared toolbar, surface, and message primitives", () => {
  const toolbar = mount(UiToolbar, {
    props: { label: "Panel actions", density: "compact" },
    slots: { default: "<button>Pin</button>" }
  });
  expect(toolbar.classes()).toContain("ui-toolbar");
  expect(toolbar.classes()).toContain("ui-toolbar--compact");
  expect(toolbar.attributes("aria-label")).toBe("Panel actions");

  const surface = mount(UiSurface, {
    props: { variant: "floating", padded: false },
    slots: { default: "Surface" }
  });
  expect(surface.classes()).toContain("ui-surface");
  expect(surface.classes()).toContain("ui-surface--floating");
  expect(surface.classes()).toContain("ui-surface--flush");

  const message = mount(UiMessage, {
    props: { tone: "warning" },
    slots: { default: "Check settings" }
  });
  expect(message.classes()).toContain("ui-message");
  expect(message.classes()).toContain("ui-message--warning");
  expect(message.attributes("role")).toBe("status");
});
```

Update the import list in that test file to include:

```ts
  UiMessage,
  UiSettingRow,
  UiSurface,
  UiToolbar,
```

- [ ] **Step 2: Run the focused UI tests and verify the new tests fail**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app test:renderer:jsdom -- UiComponents.test.ts
```

Expected: FAIL because `UiSettingRow`, `UiToolbar`, `UiSurface`, and `UiMessage` are not exported.

- [ ] **Step 3: Create `UiSettingRow.vue`**

Create `apps/desktop-app/src/renderer/components/ui/UiSettingRow.vue`:

```vue
<template>
  <div
    class="ui-setting-row"
    :class="[`ui-setting-row--${controlWidth}`, { 'ui-setting-row--stacked': stacked }]"
    data-slot="setting-row"
  >
    <div class="ui-setting-row__meta">
      <span :id="labelId" class="ui-setting-row__label">{{ label }}</span>
      <span v-if="hint" :id="hintId" class="ui-setting-row__hint">{{ hint }}</span>
      <span v-if="value" class="ui-setting-row__value">{{ value }}</span>
    </div>
    <div class="ui-setting-row__control" :aria-describedby="describedBy || undefined">
      <slot />
    </div>
    <span v-if="error" :id="errorId" class="ui-setting-row__error">{{ error }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed, provide } from "vue";
import { uiFieldContextKey } from "./fieldContext";

const props = withDefaults(
  defineProps<{
    id: string;
    label: string;
    hint?: string;
    value?: string;
    error?: string | null;
    controlWidth?: "compact" | "field" | "wide" | "editor" | "stats";
    stacked?: boolean;
  }>(),
  {
    hint: "",
    value: "",
    error: null,
    controlWidth: "field",
    stacked: false
  }
);

const labelId = computed(() => `${props.id}-label`);
const hintId = computed(() => `${props.id}-hint`);
const errorId = computed(() => `${props.id}-error`);
const describedBy = computed(() =>
  [props.hint ? hintId.value : "", props.error ? errorId.value : ""].filter(Boolean).join(" ")
);

provide(uiFieldContextKey, {
  labelId,
  describedBy
});
</script>
```

- [ ] **Step 4: Create `UiToolbar.vue`**

Create `apps/desktop-app/src/renderer/components/ui/UiToolbar.vue`:

```vue
<template>
  <div
    class="ui-toolbar"
    :class="[`ui-toolbar--${density}`, { 'ui-toolbar--wrap': wrap }]"
    data-slot="toolbar"
    role="toolbar"
    :aria-label="label"
  >
    <slot />
  </div>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    label: string;
    density?: "compact" | "default";
    wrap?: boolean;
  }>(),
  {
    density: "default",
    wrap: false
  }
);
</script>
```

- [ ] **Step 5: Create `UiSurface.vue`**

Create `apps/desktop-app/src/renderer/components/ui/UiSurface.vue`:

```vue
<template>
  <component
    :is="as"
    class="ui-surface"
    :class="[
      `ui-surface--${variant}`,
      { 'ui-surface--flush': !padded }
    ]"
    data-slot="surface"
  >
    <slot />
  </component>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    as?: "div" | "section" | "article";
    variant?: "default" | "muted" | "floating" | "transparent";
    padded?: boolean;
  }>(),
  {
    as: "div",
    variant: "default",
    padded: true
  }
);
</script>
```

- [ ] **Step 6: Create `UiMessage.vue`**

Create `apps/desktop-app/src/renderer/components/ui/UiMessage.vue`:

```vue
<template>
  <p class="ui-message" :class="`ui-message--${tone}`" :role="role">
    <slot />
  </p>
</template>

<script setup lang="ts">
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    tone?: "info" | "success" | "warning" | "danger";
  }>(),
  {
    tone: "info"
  }
);

const role = computed(() => (props.tone === "danger" ? "alert" : "status"));
</script>
```

- [ ] **Step 7: Export the new components**

Add these exports to `apps/desktop-app/src/renderer/components/ui/index.ts`:

```ts
export { default as UiMessage } from "./UiMessage.vue";
export { default as UiSettingRow } from "./UiSettingRow.vue";
export { default as UiSurface } from "./UiSurface.vue";
export { default as UiToolbar } from "./UiToolbar.vue";
```

- [ ] **Step 8: Add foundation CSS for the new components**

Add these rules to the UI foundation section in `apps/desktop-app/src/renderer/style.css`:

```css
.ui-surface {
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius);
  padding: var(--ui-space-4);
  color: var(--ui-text);
  background: var(--ui-surface);
}

.ui-surface--muted {
  background: var(--ui-surface-muted);
}

.ui-surface--floating {
  background: var(--ui-surface);
  box-shadow: var(--ui-shadow-floating);
}

.ui-surface--transparent {
  border-color: transparent;
  background: transparent;
}

.ui-surface--flush {
  padding: 0;
}

.ui-toolbar {
  display: inline-flex;
  align-items: center;
  gap: var(--ui-space-2);
  min-width: 0;
}

.ui-toolbar--compact {
  gap: var(--ui-space-1);
}

.ui-toolbar--wrap {
  flex-wrap: wrap;
}

.ui-setting-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(180px, 280px);
  align-items: center;
  gap: var(--ui-space-3);
  min-width: 0;
}

.ui-setting-row--compact {
  grid-template-columns: minmax(0, 1fr) minmax(90px, 140px);
}

.ui-setting-row--field {
  grid-template-columns: minmax(0, 1fr) minmax(180px, 280px);
}

.ui-setting-row--wide,
.ui-setting-row--editor,
.ui-setting-row--stats,
.ui-setting-row--stacked {
  grid-template-columns: minmax(0, 1fr);
  align-items: stretch;
}

.ui-setting-row__meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.ui-setting-row__label {
  color: var(--ui-text);
  font-size: var(--ui-font-sm);
  font-weight: 650;
}

.ui-setting-row__hint,
.ui-setting-row__value {
  color: var(--ui-text-muted);
  font-size: var(--ui-font-sm);
  line-height: 1.35;
  overflow-wrap: anywhere;
}

.ui-setting-row__control {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--ui-space-2);
  min-width: 0;
}

.ui-setting-row--wide .ui-setting-row__control,
.ui-setting-row--editor .ui-setting-row__control,
.ui-setting-row--stats .ui-setting-row__control,
.ui-setting-row--stacked .ui-setting-row__control {
  justify-content: stretch;
}

.ui-setting-row--wide .ui-setting-row__control > *,
.ui-setting-row--editor .ui-setting-row__control > *,
.ui-setting-row--stats .ui-setting-row__control > * {
  width: 100%;
}

.ui-setting-row__error {
  grid-column: 1 / -1;
  color: var(--ui-danger);
  font-size: var(--ui-font-sm);
}

.ui-message {
  margin: 0;
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius-sm);
  padding: 8px 10px;
  color: var(--ui-text);
  background: var(--ui-surface-muted);
  font-size: var(--ui-font-sm);
  line-height: 1.35;
}

.ui-message--success {
  border-color: color-mix(in srgb, var(--ui-success) 42%, var(--ui-border));
  color: var(--ui-success);
}

.ui-message--warning {
  border-color: color-mix(in srgb, var(--ui-warning) 42%, var(--ui-border));
  color: var(--ui-warning);
}

.ui-message--danger {
  border-color: color-mix(in srgb, var(--ui-danger) 42%, var(--ui-border));
  color: var(--ui-danger);
}
```

If `--ui-shadow-floating` is missing, add it to `:root`:

```css
--ui-shadow-floating: 0 12px 32px rgb(0 0 0 / 0.18);
```

and to `:root[data-theme="dark"]`:

```css
--ui-shadow-floating: 0 12px 32px rgb(0 0 0 / 0.42);
```

- [ ] **Step 9: Run focused UI tests**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app test:renderer:jsdom -- UiComponents.test.ts
```

Expected: PASS.

- [ ] **Step 10: Commit**

Run:

```bash
git add apps/desktop-app/src/renderer/components/ui apps/desktop-app/src/renderer/style.css
git commit -m "feat: add renderer ui foundation components"
```

Expected: commit succeeds.

---

## Task 3: Normalize Renderer Tokens and CSS Ownership

**Files:**
- Modify: `apps/desktop-app/src/renderer/style.css`
- Modify: `apps/desktop-app/src/renderer/components/top-panel/TopControlPanel.test.ts`
- Modify: `apps/desktop-app/src/renderer/components/settings/SettingsWindowShell.test.ts`
- Modify: `apps/desktop-app/src/renderer/components/subtitle/TranscriptBlock.test.ts`

- [ ] **Step 1: Add stylesheet ownership tests**

Add this test to `apps/desktop-app/src/renderer/components/settings/SettingsWindowShell.test.ts`:

```ts
it("keeps renderer stylesheet organized by token, foundation, and product layers", () => {
  expect(rendererStylesheet).toContain("/* Renderer tokens */");
  expect(rendererStylesheet).toContain("/* UI foundation */");
  expect(rendererStylesheet).toContain("/* Product surfaces */");
  expect(rendererStylesheet.indexOf("/* Renderer tokens */")).toBeLessThan(
    rendererStylesheet.indexOf("/* UI foundation */")
  );
  expect(rendererStylesheet.indexOf("/* UI foundation */")).toBeLessThan(
    rendererStylesheet.indexOf("/* Product surfaces */")
  );
});
```

- [ ] **Step 2: Run the stylesheet ownership test and verify it fails**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app test:renderer:jsdom -- SettingsWindowShell.test.ts
```

Expected: FAIL because the layer comments do not exist yet.

- [ ] **Step 3: Reorganize `style.css` by ownership**

Edit `apps/desktop-app/src/renderer/style.css` into this top-level order:

```css
/* Renderer tokens */
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
  --ui-space-6: 24px;
  --ui-font-sm: 12px;
  --ui-font-md: 13px;
  --ui-font-lg: 16px;
  --ui-bg: #f6f7f9;
  --ui-surface: #ffffff;
  --ui-surface-muted: #eef1f4;
  --ui-text: #101418;
  --ui-text-muted: #66707c;
  --ui-border: #d8dee6;
  --ui-accent: #2563eb;
  --ui-success: #16803c;
  --ui-warning: #b45309;
  --ui-danger: #dc2626;
  --ui-info: #2563eb;
  --ui-shadow-floating: 0 12px 32px rgb(0 0 0 / 0.18);
}

:root[data-theme="dark"] {
  --ui-bg: #141414;
  --ui-surface: #181818;
  --ui-surface-muted: #242424;
  --ui-text: #f2f2f2;
  --ui-text-muted: #a6a6a6;
  --ui-border: #363636;
  --ui-accent: #d6d6d6;
  --ui-success: #c7c7c7;
  --ui-warning: #b8b8b8;
  --ui-danger: #e0e0e0;
  --ui-info: #cfcfcf;
  --ui-shadow-floating: 0 12px 32px rgb(0 0 0 / 0.42);
}

/* Base document */
*,
*::before,
*::after {
  box-sizing: border-box;
}

body {
  margin: 0;
  padding: 0;
  background: transparent;
  color: var(--ui-text);
  user-select: none;
}

button,
input,
select,
textarea {
  font: inherit;
}

/* UI foundation */
```

Move every `.ui-*` selector and foundation helper selector under `/* UI foundation */`. Foundation helper selectors include:

```css
.ui-inline-control
.ui-chip
.ui-stat-grid
.ui-stat
.ui-group
```

Put all window/domain selectors under:

```css
/* Product surfaces */
```

Product selectors include `.settings-window*`, `.settings-nav*`, `.settings-split*`, `.global-settings*`, `.top-control-panel*`, `.control-panel*`, `.track-picker*`, `.playback-*`, `.subtitle-*`, `.transcript-*`, `.word-lookup-*`, `.profile-*`, `.priority-*`, `.plugin-*`, `.schema-*`, and `.color-swatch-*`.

Do not change selector bodies in this task except for replacing hard-coded values with existing tokens when the exact same value already has a token.

- [ ] **Step 4: Run stylesheet-dependent tests**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app test:renderer:jsdom -- SettingsWindowShell.test.ts TopControlPanel.test.ts TranscriptBlock.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add apps/desktop-app/src/renderer/style.css apps/desktop-app/src/renderer/components/settings/SettingsWindowShell.test.ts apps/desktop-app/src/renderer/components/top-panel/TopControlPanel.test.ts apps/desktop-app/src/renderer/components/subtitle/TranscriptBlock.test.ts
git commit -m "refactor: organize renderer styles by ui ownership"
```

Expected: commit succeeds.

---

## Task 4: Convert Settings Rows to Foundation Components

**Files:**
- Modify: `apps/desktop-app/src/renderer/components/settings/SettingsGlobal.vue`
- Modify: `apps/desktop-app/src/renderer/components/settings/SettingsReleaseUpdate.vue`
- Modify: `apps/desktop-app/src/renderer/components/settings/NetworkEndpointEditor.vue`
- Modify: `apps/desktop-app/src/renderer/components/settings/PillListEditor.vue`
- Modify: `apps/desktop-app/src/renderer/components/settings/ShortcutInput.vue`
- Modify: `apps/desktop-app/src/renderer/components/settings/SettingsGlobal.test.ts`
- Modify: `apps/desktop-app/src/renderer/components/settings/SettingsReleaseUpdate.test.ts`
- Modify: `apps/desktop-app/src/renderer/components/settings/NetworkEndpointEditor.browser.test.ts`
- Modify: `apps/desktop-app/src/renderer/components/settings/PillListEditor.test.ts`
- Modify: `apps/desktop-app/src/renderer/components/settings/PillListEditor.browser.test.ts`

- [ ] **Step 1: Add failing assertions for settings rows**

Add this assertion to `SettingsGlobal.test.ts` in the test that mounts global settings:

```ts
expect(wrapper.findAll('[data-slot="setting-row"]').length).toBeGreaterThanOrEqual(8);
expect(wrapper.get("#language-label").element.closest('[data-slot="setting-row"]')).not.toBeNull();
expect(wrapper.get("#language-label").element.closest('[data-slot="setting-row"]')?.querySelector(".ui-select")).not.toBeNull();
```

Add this assertion to `SettingsReleaseUpdate.test.ts` after mounting `SettingsReleaseUpdate`:

```ts
expect(wrapper.findAll('[data-slot="setting-row"]').length).toBeGreaterThanOrEqual(2);
expect(wrapper.get('[data-testid="release-check"]').exists()).toBe(true);
```

- [ ] **Step 2: Run the settings tests and verify they fail**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app test:renderer:jsdom -- SettingsGlobal.test.ts SettingsReleaseUpdate.test.ts
```

Expected: FAIL because these files do not yet expose the final `UiSettingRow` contracts.

- [ ] **Step 3: Replace global settings row chrome**

In `SettingsGlobal.vue`, import `UiSettingRow`:

```ts
import {
  UiBadge,
  UiField,
  UiIconButton,
  UiInput,
  UiSection,
  UiSegmentedControl,
  UiSelect,
  UiSettingRow,
  UiSwitch
} from "../ui";
```

Replace each manual row like:

```vue
<div class="global-settings__row">
  <div class="global-settings__row-meta">
    <span id="auto-start-label" class="ui-field__label">{{ t("auto-start-label") }}</span>
  </div>
  <div class="global-settings__control global-settings__control--compact">
    <UiSwitch v-model="autoLaunch" :label="autoLaunch ? t('toggle-on') : t('toggle-off')" />
  </div>
</div>
```

with:

```vue
<UiSettingRow id="auto-start" :label="t('auto-start-label')" control-width="compact">
  <UiSwitch v-model="autoLaunch" :label="autoLaunch ? t('toggle-on') : t('toggle-off')" />
</UiSettingRow>
```

Use these row IDs and widths:

```ts
const globalSettingsRows = [
  ["auto-start", "compact"],
  ["network-endpoints", "editor"],
  ["toggle-shortcut", "field"],
  ["process-blacklist", "editor"],
  ["cache-enabled", "compact"],
  ["cache-path", "wide"],
  ["cache-retention", "compact"],
  ["cache-stats", "stats"]
] as const;
```

Keep `UiField` for `language` and `appearance-theme` because those are already inline foundation fields.

- [ ] **Step 4: Replace release update row chrome**

In `SettingsReleaseUpdate.vue`, import `UiSettingRow`:

```ts
import { UiButton, UiSettingRow, UiStatus, UiSwitch } from "../ui";
```

Replace manual rows with this structure:

```vue
<UiSettingRow id="release-current-version" :label="t('release-current-version')" :hint="currentVersion" control-width="compact">
  <UiButton data-testid="release-check" :disabled="checking" @click="check">
    <IconRefresh size="sm" :class="{ 'icon--spinning': checking }" />
    {{ t("release-check") }}
  </UiButton>
</UiSettingRow>

<UiSettingRow id="release-auto-check" :label="t('release-auto-check')" :hint="t('release-auto-check-hint')" control-width="compact">
  <UiSwitch v-model="autoCheckUpdates" :label="autoCheckUpdates ? t('toggle-on') : t('toggle-off')" />
</UiSettingRow>
```

Use `UiSettingRow control-width="editor"` for available/error/unavailable release state content.

- [ ] **Step 5: Convert editor components to foundation labels and errors**

In `PillListEditor.vue`, replace:

```vue
<span class="settings-field__label">{{ label }}</span>
```

with:

```vue
<span class="ui-field__label">{{ label }}</span>
```

Replace:

```vue
<div v-if="error" class="settings-field__error">{{ error }}</div>
```

with:

```vue
<UiMessage v-if="error" tone="danger">{{ error }}</UiMessage>
```

Add:

```ts
import { UiIconButton, UiInput, UiMessage } from "../ui";
```

In `NetworkEndpointEditor.vue`, replace `.settings-field__error` error markup with:

```vue
<UiMessage v-if="error" tone="danger">{{ error }}</UiMessage>
```

and import `UiMessage`.

- [ ] **Step 6: Run focused settings tests**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app test:renderer:jsdom -- SettingsGlobal.test.ts SettingsReleaseUpdate.test.ts PillListEditor.test.ts
pnpm --filter @immersive-subs/desktop-app test:renderer:browser -- NetworkEndpointEditor.browser.test.ts PillListEditor.browser.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

Run:

```bash
git add apps/desktop-app/src/renderer/components/settings apps/desktop-app/src/renderer/components/ui apps/desktop-app/src/renderer/style.css
git commit -m "refactor: express settings rows through ui foundation"
```

Expected: commit succeeds.

---

## Task 5: Convert Settings Lists, Plugin Schema, and Profile Editors

**Files:**
- Modify: `apps/desktop-app/src/renderer/components/settings/SettingsPlugins.vue`
- Modify: `apps/desktop-app/src/renderer/components/settings/PluginSettingsSchema.vue`
- Modify: `apps/desktop-app/src/renderer/components/settings/profiles/ProfileList.vue`
- Modify: `apps/desktop-app/src/renderer/components/settings/profiles/ProfileUrlRules.vue`
- Modify: `apps/desktop-app/src/renderer/components/settings/profiles/PriorityEditor.vue`
- Modify: `apps/desktop-app/src/renderer/components/settings/profiles/SubtitleStyleFields.vue`
- Modify: `apps/desktop-app/src/renderer/components/settings/profiles/ColorSchemeGrid.vue`
- Modify: `apps/desktop-app/src/renderer/components/settings/SettingsPlugins.test.ts`
- Modify: `apps/desktop-app/src/renderer/components/settings/PluginSettingsSchema.test.ts`
- Modify: `apps/desktop-app/src/renderer/components/settings/profiles/ProfileList.test.ts`
- Modify: `apps/desktop-app/src/renderer/components/settings/SettingsProfiles.browser.test.ts`

- [ ] **Step 1: Add failing assertions for profile/plugin foundation usage**

Add this assertion to `SettingsPlugins.test.ts`:

```ts
expect(wrapper.findAll('[data-slot="surface"]').length).toBeGreaterThanOrEqual(1);
expect(wrapper.findAll('[data-slot="toolbar"]').length).toBeGreaterThanOrEqual(1);
```

Add this assertion to `PluginSettingsSchema.test.ts`:

```ts
expect(wrapper.findAll('[data-slot="setting-row"]').length).toBeGreaterThanOrEqual(1);
```

Add this assertion to `ProfileList.test.ts`:

```ts
expect(wrapper.findAll('[data-slot="toolbar"]').length).toBeGreaterThanOrEqual(1);
expect(wrapper.findAll('[data-slot="icon-button"]').length).toBeGreaterThanOrEqual(3);
```

- [ ] **Step 2: Run focused tests and verify they fail**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app test:renderer:jsdom -- SettingsPlugins.test.ts PluginSettingsSchema.test.ts ProfileList.test.ts
```

Expected: FAIL because toolbar/surface/setting-row contracts are not yet used consistently.

- [ ] **Step 3: Replace plugin install and plugin actions with toolbar/surface**

In `SettingsPlugins.vue`, import:

```ts
import { UiBadge, UiButton, UiEmptyState, UiInput, UiListItem, UiSection, UiSurface, UiToolbar } from "../ui";
```

Wrap the install form with:

```vue
<UiSurface class="plugin-install-surface" variant="muted">
  <form class="plugin-install" @submit.prevent="installFromInput">
    <UiInput
      v-model="installPath"
      :placeholder="t('plugin-install-placeholder')"
      data-testid="plugin-install-input"
    />
    <UiToolbar :label="t('plugin-install')" density="compact">
      <UiButton type="submit" variant="primary" :disabled="busy || !installPath.trim()">
        {{ t("plugin-install") }}
      </UiButton>
    </UiToolbar>
  </form>
</UiSurface>
```

Wrap each plugin action group with:

```vue
<UiToolbar :label="`${plugin.displayName} actions`" density="compact" wrap>
  <!-- existing UiButton actions stay inside this toolbar -->
</UiToolbar>
```

- [ ] **Step 4: Replace plugin schema rows**

In `PluginSettingsSchema.vue`, import `UiSettingRow` and replace:

```vue
<UiField v-for="field in section.schema" :id="`${plugin.pluginKey}-${field.id}`" :key="field.id" :label="field.label">
```

with:

```vue
<UiSettingRow
  v-for="field in section.schema"
  :id="`${plugin.pluginKey}-${field.id}`"
  :key="field.id"
  :label="field.label"
  control-width="editor"
  stacked
>
```

Close each row with `</UiSettingRow>`. Keep the current field rendering logic inside the default slot.

Replace `plugin-server-list__delete` local button classes with `UiIconButton`.

- [ ] **Step 5: Convert profile editor repeated chrome**

In `ProfileList.vue`, wrap the sidebar buttons in:

```vue
<UiToolbar :label="t('profile-actions')" density="compact">
  <!-- add, duplicate, delete UiIconButton controls -->
</UiToolbar>
```

In `PriorityEditor.vue` and `ProfileUrlRules.vue`, replace direct `settings-field__label` and `priority-editor__hint` chrome with `UiSettingRow` or `UiField` labels. Keep drag/drop list layout local.

In `SubtitleStyleFields.vue`, keep the existing `UiField`, `UiSelect`, `UiSlider`, `UiSwitch`, and `UiInput` usage. Replace layout-only repeated groups that mimic rows with `UiSettingRow` when the row has a label, hint, and single control.

- [ ] **Step 6: Run focused profile and plugin tests**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app test:renderer:jsdom -- SettingsPlugins.test.ts PluginSettingsSchema.test.ts ProfileList.test.ts
pnpm --filter @immersive-subs/desktop-app test:renderer:browser -- SettingsProfiles.browser.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

Run:

```bash
git add apps/desktop-app/src/renderer/components/settings apps/desktop-app/src/renderer/components/ui apps/desktop-app/src/renderer/style.css
git commit -m "refactor: align settings lists and profile editors with ui foundation"
```

Expected: commit succeeds.

---

## Task 6: Convert Top Control Panel Chrome

**Files:**
- Modify: `apps/desktop-app/src/renderer/components/top-panel/TopControlPanel.vue`
- Modify: `apps/desktop-app/src/renderer/components/top-panel/TopControlPanel.test.ts`
- Modify: `apps/desktop-app/src/renderer/components/top-panel/TopControlPanel.browser.test.ts`
- Modify: `apps/desktop-app/src/renderer/style.css`

- [ ] **Step 1: Add failing assertions for top panel foundation chrome**

Add this assertion to `TopControlPanel.test.ts` after mounting the panel:

```ts
expect(wrapper.get('[data-testid="top-control-panel-surface"]').attributes("data-slot")).toBe("surface");
expect(wrapper.get('[data-testid="top-control-panel-actions"]').attributes("data-slot")).toBe("toolbar");
expect(wrapper.find(".top-control-panel__status [data-slot='status']").exists()).toBe(true);
```

- [ ] **Step 2: Run focused top panel tests and verify they fail**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app test:renderer:jsdom -- TopControlPanel.test.ts
```

Expected: FAIL because `UiSurface`, `UiToolbar`, and `UiStatus` are not used in the top panel shell.

- [ ] **Step 3: Replace top panel shell with foundation components**

In `TopControlPanel.vue`, import:

```ts
import { UiIconButton, UiSlider, UiStatus, UiSurface, UiToolbar, UiTooltip } from "../ui";
```

Replace:

```vue
<section
  ref="surfaceRef"
  class="top-control-panel__surface"
  data-testid="top-control-panel-surface"
>
```

with:

```vue
<UiSurface
  ref="surfaceRef"
  as="section"
  variant="floating"
  class="top-control-panel__surface"
  data-testid="top-control-panel-surface"
>
```

and close it with `</UiSurface>`.

Replace:

```vue
<div class="top-control-panel__status" data-testid="top-control-panel-status">
  {{ connectionText }}
</div>
```

with:

```vue
<div class="top-control-panel__status" data-testid="top-control-panel-status">
  <UiStatus :tone="connectionTone">{{ connectionText }}</UiStatus>
</div>
```

Add:

```ts
const connectionTone = computed<"neutral" | "success" | "warning" | "danger" | "info">(() => {
  if (!hasActiveVideo) return "neutral";
  if (statusBanner.tone === "danger" || statusBanner.tone === "warning") return statusBanner.tone;
  return "success";
});
```

Replace:

```vue
<div class="top-control-panel__actions" data-testid="top-control-panel-actions">
```

with:

```vue
<UiToolbar
  class="top-control-panel__actions"
  data-testid="top-control-panel-actions"
  :label="t('top-panel-actions')"
  density="compact"
>
```

and close it with `</UiToolbar>`.

- [ ] **Step 4: Tokenize top panel scoped CSS**

In `style.css`, keep geometry selectors such as `.top-control-panel`, `.top-edge-trigger-zone`, `.top-control-panel--collapsed`, and drag handles product-owned. Remove top-panel-specific redefinitions of shared icon button, select, and slider chrome when the same rule belongs to `.ui-icon-button`, `.ui-select`, or `.ui-slider`.

The final top panel CSS may keep:

```css
.top-control-panel__surface {
  overflow: hidden;
  backdrop-filter: blur(18px);
  opacity: var(--panel-opacity-factor);
}

.top-control-panel__actions {
  flex: 0 0 auto;
}
```

It must not keep selectors that restyle shared control internals:

```css
.top-control-panel .ui-icon-button
.top-control-panel .ui-select
.top-control-panel .ui-slider
.top-control-panel .ui-slider::-webkit-slider-thumb
```

- [ ] **Step 5: Run top panel tests**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app test:renderer:jsdom -- TopControlPanel.test.ts
pnpm --filter @immersive-subs/desktop-app test:renderer:browser -- TopControlPanel.browser.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```bash
git add apps/desktop-app/src/renderer/components/top-panel apps/desktop-app/src/renderer/style.css
git commit -m "refactor: align top panel chrome with ui foundation"
```

Expected: commit succeeds.

---

## Task 7: Convert Subtitle Control Chrome

**Files:**
- Modify: `apps/desktop-app/src/renderer/components/subtitle/PlaybackControls.vue`
- Modify: `apps/desktop-app/src/renderer/components/subtitle/TrackSelector.vue`
- Modify: `apps/desktop-app/src/renderer/components/subtitle/TranscriptionControls.vue`
- Modify: `apps/desktop-app/src/renderer/components/subtitle/StatusBanner.vue`
- Modify: `apps/desktop-app/src/renderer/components/subtitle/CueAnchorRail.vue`
- Modify: `apps/desktop-app/src/renderer/components/subtitle/PlaybackControls.test.ts`
- Modify: `apps/desktop-app/src/renderer/components/subtitle/TrackSelector.test.ts`
- Modify: `apps/desktop-app/src/renderer/components/subtitle/TranscriptBlock.test.ts`
- Modify: `apps/desktop-app/src/renderer/components/subtitle/SubtitleView.browser.test.ts`
- Modify: `apps/desktop-app/src/renderer/style.css`

- [ ] **Step 1: Add failing assertions for subtitle foundation chrome**

Add this assertion to `PlaybackControls.test.ts`:

```ts
const wrapper = mountPlaybackControls(false, document.body);
expect(wrapper.findAll('[data-slot="icon-button"]').length).toBeGreaterThanOrEqual(2);
expect(wrapper.findAll('[data-slot="slider"]').length).toBe(1);
wrapper.unmount();
```

Add this assertion to `TranscriptBlock.test.ts` for cue controls:

```ts
expect(wrapper.findAll('[data-slot="icon-button"]').length).toBeGreaterThanOrEqual(1);
```

- [ ] **Step 2: Run subtitle tests and verify they fail**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app test:renderer:jsdom -- PlaybackControls.test.ts TranscriptBlock.test.ts
```

Expected: FAIL because cue and playback controls still expose local button chrome classes.

- [ ] **Step 3: Replace cue action buttons**

In `CueAnchorRail.vue`, import:

```ts
import { UiIconButton, UiToolbar, UiTooltip } from "../ui";
```

Wrap cue actions in:

```vue
<UiToolbar class="transcript-block__cue-actions" :label="timeLabel" density="compact">
  <span class="transcript-block__cue-time">{{ timeLabel }}</span>
  <UiTooltip :text="playLabel">
    <UiIconButton :label="playLabel" size="sm" @click="$emit('seek')">
      <IconPlay size="sm" />
    </UiIconButton>
  </UiTooltip>
  <UiTooltip :text="abLoopLabel">
    <UiIconButton
      :label="abLoopLabel"
      size="sm"
      :active="isAbPoint"
      :pressed="isAbPoint"
      @click="$emit('toggle-ab')"
    >
      <IconRepeat size="sm" />
    </UiIconButton>
  </UiTooltip>
  <UiTooltip :text="singleLoopLabel">
    <UiIconButton
      :label="singleLoopLabel"
      size="sm"
      :active="isLooping"
      :pressed="isLooping"
      @click="$emit('toggle-loop')"
    >
      <IconLoop size="sm" />
    </UiIconButton>
  </UiTooltip>
</UiToolbar>
```

Use the actual icon components already imported in the file. Preserve existing emitted event names.

- [ ] **Step 4: Replace transcription action button chrome**

In `TranscriptionControls.vue`, keep `UiSelect` and replace local `transcription-btn` with:

```vue
<UiIconButton
  :label="isTranscribing ? t('transcription-running') : t('transcription-start')"
  size="sm"
  :disabled="!canTranscribe || isTranscribing"
  @click="$emit('start')"
>
  <IconRefresh v-if="isTranscribing" size="sm" class="icon--spinning" />
  <IconSparkles v-else size="sm" />
</UiIconButton>
```

- [ ] **Step 5: Remove local shared-control CSS**

In `style.css`, delete CSS rules for these local control chrome classes after the Vue templates no longer use them:

```css
.playback-toggle-btn
.auto-hide-toggle
.transcription-btn
.transcript-block__play-btn
.transcript-block__ab-btn
.transcript-block__loop-btn
```

Keep transcript geometry, cue rail positioning, active block styling, word token styling, and subtitle text projection selectors.

- [ ] **Step 6: Run subtitle tests**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app test:renderer:jsdom -- PlaybackControls.test.ts TrackSelector.test.ts TranscriptBlock.test.ts
pnpm --filter @immersive-subs/desktop-app test:renderer:browser -- SubtitleView.browser.test.ts TranscriptSurface.browser.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

Run:

```bash
git add apps/desktop-app/src/renderer/components/subtitle apps/desktop-app/src/renderer/style.css
git commit -m "refactor: align subtitle controls with ui foundation"
```

Expected: commit succeeds.

---

## Task 8: Convert Word Lookup Window Chrome

**Files:**
- Modify: `apps/desktop-app/src/renderer/components/subtitle/WordLookupWindow.vue`
- Modify: `apps/desktop-app/src/renderer/components/subtitle/WordLookupWindow.test.ts`
- Modify: `apps/desktop-app/src/renderer/style.css`

- [ ] **Step 1: Add failing assertions for word lookup foundation chrome**

Add this assertion to `WordLookupWindow.test.ts` after mounting with payload:

```ts
expect(wrapper.find('[data-slot="surface"]').exists()).toBe(true);
expect(wrapper.findAll('[data-slot="icon-button"]').length).toBeGreaterThanOrEqual(1);
```

- [ ] **Step 2: Run word lookup tests and verify they fail**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app test:renderer:jsdom -- WordLookupWindow.test.ts
```

Expected: FAIL because the word lookup surface still uses product-owned window chrome.

- [ ] **Step 3: Replace word lookup window surface**

In `WordLookupWindow.vue`, import:

```ts
import { UiEmptyState, UiIconButton, UiMessage, UiSurface, UiToolbar } from "../ui";
```

Replace the outer dictionary popover shell with:

```vue
<UiSurface
  as="section"
  variant="floating"
  class="word-lookup-window__surface"
  data-testid="word-lookup-surface"
>
  <UiToolbar class="word-lookup-window__toolbar" label="Word lookup actions" density="compact">
    <UiIconButton
      v-if="canClose"
      :label="closeLabel"
      size="sm"
      @click="close"
    >
      <IconX size="sm" />
    </UiIconButton>
  </UiToolbar>
  <!-- existing dictionary content stays below -->
</UiSurface>
```

Preserve existing close behavior, resize behavior, payload loading, scroll thumb behavior, and dictionary entry rendering.

Use `UiEmptyState` for no matches:

```vue
<UiEmptyState v-if="!matches.length" :message="emptyLabel" />
```

Use `UiMessage tone="danger"` for payload load errors.

- [ ] **Step 4: Remove word lookup duplicate chrome CSS**

In `style.css`, remove product-owned rules that define generic window chrome already handled by `UiSurface`, `UiToolbar`, and `UiIconButton`. Keep content-specific rules:

```css
.word-lookup-entry
.word-lookup-entry__header
.word-lookup-entry__word
.word-lookup-entry__aliases
.word-lookup-entry__body
.word-lookup-scrollbar
.word-lookup-scrollbar__thumb
.word-lookup-resize-handle
```

Delete or rewrite selectors that exist only to style the old shell:

```css
.word-lookup-popover--window
.word-lookup-popover__content-clip--custom
```

- [ ] **Step 5: Run word lookup tests**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app test:renderer:jsdom -- WordLookupWindow.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```bash
git add apps/desktop-app/src/renderer/components/subtitle/WordLookupWindow.vue apps/desktop-app/src/renderer/components/subtitle/WordLookupWindow.test.ts apps/desktop-app/src/renderer/style.css
git commit -m "refactor: align word lookup chrome with ui foundation"
```

Expected: commit succeeds.

---

## Task 9: Enforce Final UI Foundation Boundary

**Files:**
- Modify: `package.json`
- Modify: `scripts/check-renderer-ui-boundaries.mjs`
- Modify: `apps/desktop-app/src/renderer/style.css`
- Modify: renderer components that still fail the boundary guard

- [ ] **Step 1: Run the boundary guard**

Run:

```bash
pnpm lint:renderer-ui-boundaries
```

Expected: FAIL only if duplicated chrome remains. Every failure names a file and pattern.

- [ ] **Step 2: Remove remaining duplicate chrome**

For every reported product file, replace the reported class with one of these foundation components:

```ts
import {
  UiButton,
  UiIconButton,
  UiInput,
  UiMessage,
  UiSettingRow,
  UiStatus,
  UiSurface,
  UiToolbar
} from "../ui";
```

Use `../../ui` for files under `settings/profiles`.

Replace each class according to this table:

```md
| Reported class | Final replacement |
| --- | --- |
| `settings-field__label` | `UiSettingRow` `label` prop or `.ui-field__label` inside a foundation-owned row |
| `settings-field__error` | `UiMessage tone="danger"` |
| `global-settings__row-meta` | `UiSettingRow` `label` and `hint` props |
| `global-settings__control` | `UiSettingRow` default slot |
| `playback-toggle-btn` | `UiIconButton` inside `UiTooltip` |
| `transcription-btn` | `UiIconButton` |
| `transcript-block__play-btn` | `UiIconButton` inside cue toolbar |
| `transcript-block__ab-btn` | `UiIconButton` inside cue toolbar |
| `transcript-block__loop-btn` | `UiIconButton` inside cue toolbar |
```

- [ ] **Step 3: Add root test integration if Task 1 left it out**

Ensure `package.json` root `test` contains:

```json
"test": "pnpm test:scripts && node ./scripts/check-silent-catches.mjs && pnpm lint:renderer-ui-boundaries && pnpm --filter @immersive-subs/contracts test && pnpm --filter @immersive-subs/desktop-app test:app && pnpm --filter @immersive-subs/extension test:app"
```

- [ ] **Step 4: Run the boundary guard and verify it passes**

Run:

```bash
pnpm lint:renderer-ui-boundaries
```

Expected:

```text
Renderer UI boundary check passed.
```

- [ ] **Step 5: Run source searches for blocked runtime dependencies**

Run:

```bash
rg -n "antd|@ant-design|@arco-design|element-plus|naive-ui|vuetify|shadcn-vue|reka-ui|@radix-ui|radix-vue|tailwindcss|@tailwindcss|unocss|@unocss|bootstrap|@mui|@chakra-ui|@mantine|@fluentui" apps/desktop-app/src/renderer apps/desktop-app/package.json package.json
```

Expected: no matches except text inside `scripts/check-renderer-ui-boundaries.mjs` if the script path is included by mistake. Re-run against only renderer/package files when needed:

```bash
rg -n "antd|@ant-design|@arco-design|element-plus|naive-ui|vuetify|shadcn-vue|reka-ui|@radix-ui|radix-vue|tailwindcss|@tailwindcss|unocss|@unocss|bootstrap|@mui|@chakra-ui|@mantine|@fluentui" apps/desktop-app/src/renderer apps/desktop-app/package.json package.json
```

Expected: no matches.

- [ ] **Step 6: Commit**

Run:

```bash
git add package.json scripts/check-renderer-ui-boundaries.mjs apps/desktop-app/src/renderer
git commit -m "test: enforce renderer ui foundation boundary"
```

Expected: commit succeeds.

---

## Task 10: Final Verification

**Files:**
- No source edits unless verification exposes a concrete failure.

- [ ] **Step 1: Run renderer typecheck**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app typecheck:renderer
```

Expected: PASS.

- [ ] **Step 2: Run desktop focused renderer tests**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app test:renderer:jsdom
pnpm --filter @immersive-subs/desktop-app test:renderer:browser
```

Expected: PASS.

- [ ] **Step 3: Run desktop app build**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app build:app
```

Expected: PASS.

- [ ] **Step 4: Run desktop app test suite**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app test:app
```

Expected: PASS.

- [ ] **Step 5: Run repository test command**

Run:

```bash
pnpm test
```

Expected: PASS, including:

```text
Renderer UI boundary check passed.
```

- [ ] **Step 6: Inspect final diff for design intent**

Run:

```bash
git diff --stat HEAD~9..HEAD
git log --oneline -10
```

Expected: commits show the UI foundation, settings, top panel, subtitle, word lookup, boundary guard, and verification work as separate focused changes.

---

## Self-Review Checklist

- Spec coverage: tasks cover the UI foundation boundary, dependency shape, architecture, tokens, foundation components, settings, top panel, subtitle, word lookup, data flow, local error handling, accessibility, styling rules, tests, and dependency checks.
- Red-flag scan: this plan contains no deferred implementation markers.
- Type consistency: new component names are `UiSettingRow`, `UiToolbar`, `UiSurface`, and `UiMessage`; exports and imports use those names consistently.
