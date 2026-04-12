# Settings Window Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Split settings out of the subtitle window into a dedicated fixed-size Electron window, then rebuild the settings UI around a left navigation rail and a right content area.

**Architecture:** Add a second managed `BrowserWindow` for settings, expose explicit renderer APIs for opening and identifying the window role, and introduce a dedicated settings renderer root instead of mounting the settings panel inside `App.vue`. Reuse the existing settings store/data flow, but wrap the existing settings modules in a new shell and reshape `Rules` into a proper list-plus-editor layout that fits the fixed window.

**Tech Stack:** Electron main/preload, Vue 3, Pinia, TypeScript, Vite multi-entry build, Vitest, Vue Test Utils, Playwright browser-mode tests

---

## File Structure

### New Files

- `desktop-app/src/main/window/settingsWindowManager.ts`
  Purpose: own the settings `BrowserWindow` lifecycle, fixed-size constraints, singleton focus behavior, and cleanup.
- `desktop-app/src/renderer/settings-main.ts`
  Purpose: boot the settings renderer entry with Pinia and the new settings root component.
- `desktop-app/src/renderer/settings.html`
  Purpose: dedicated HTML entry for the settings window.
- `desktop-app/src/renderer/SettingsApp.vue`
  Purpose: top-level settings renderer root with initialization, language syncing, and layout shell wiring.
- `desktop-app/src/renderer/components/settings/SettingsWindowShell.vue`
  Purpose: fixed two-column settings shell with header/drag area, navigation, and content outlet.
- `desktop-app/src/renderer/components/settings/SettingsNav.vue`
  Purpose: render the left navigation rail and emit section changes.
- `desktop-app/src/renderer/components/settings/settingsSections.ts`
  Purpose: define the section ids/labels used by the shell and tests in one place.
- `desktop-app/src/renderer/components/settings/SettingsWindowShell.test.ts`
  Purpose: verify left-nav rendering, default section selection, and section switching.
- `desktop-app/src/renderer/components/settings/SettingsRules.browser.test.ts`
  Purpose: lock in the new list-plus-editor layout for the rules page in browser mode.

### Modified Files

- `desktop-app/src/main/window/windowController.ts`
  Purpose: construct both window managers, forward settings updates to both windows, and expose open/focus behavior.
- `desktop-app/src/main/window/windowManager.ts`
  Purpose: narrow responsibility to the subtitle main window only and allow custom renderer entry loading if needed.
- `desktop-app/src/main/index.ts`
  Purpose: wire the updated window controller initialization path.
- `desktop-app/src/main/ipc/ipcRouter.ts`
  Purpose: extend IPC context with settings-window accessors.
- `desktop-app/src/main/ipc/handlers/windowHandlers.ts`
  Purpose: register explicit `usp:open-settings-window` and optional settings drag behavior.
- `desktop-app/src/preload.cts`
  Purpose: expose `openSettingsWindow()` to renderer code.
- `desktop-app/src/renderer/global.d.ts`
  Purpose: pick up the expanded preload API types.
- `desktop-app/vite.config.ts`
  Purpose: build both `index.html` and `settings.html`.
- `desktop-app/src/renderer/main.ts`
  Purpose: stay focused on the subtitle window entry only.
- `desktop-app/src/renderer/App.vue`
  Purpose: remove embedded settings rendering and `isSettingsOpen`-driven layout branches.
- `desktop-app/src/renderer/components/HeaderBar.vue`
  Purpose: replace settings-panel toggle with explicit settings-window open/focus behavior.
- `desktop-app/src/renderer/stores/desktop.ts`
  Purpose: remove the obsolete `isSettingsOpen` state and keep shared settings initialization usable from both windows.
- `desktop-app/src/renderer/style.css`
  Purpose: drop embedded-settings styles and add shared shell/page layout styles for the settings window.
- `desktop-app/src/renderer/components/SettingsPanel.vue`
  Purpose: delete after migration is complete.
- `desktop-app/src/renderer/components/settings/SettingsRules.vue`
  Purpose: reshape the page into list-plus-editor columns suitable for the dedicated window.
- `desktop-app/src/renderer/components/settings/SettingsProfiles.browser.test.ts`
  Purpose: update screenshot mount assumptions if the new shell classes/styles affect rendering.
- `desktop-app/src/renderer/stores/desktop.test.ts`
  Purpose: cover initialization behavior after `isSettingsOpen` removal.

## Task 1: Add Main-Process Settings Window Infrastructure

**Files:**
- Create: `desktop-app/src/main/window/settingsWindowManager.ts`
- Modify: `desktop-app/src/main/window/windowController.ts`
- Modify: `desktop-app/src/main/ipc/ipcRouter.ts`
- Modify: `desktop-app/src/main/ipc/handlers/windowHandlers.ts`
- Test: `desktop-app/src/renderer/testingStackUpgrade.test.ts`

- [x] **Step 1: Add a failing API-presence test for the new window command**

Append this test to `desktop-app/src/renderer/testingStackUpgrade.test.ts`:

```ts
  it("documents the settings window preload and main-process wiring", () => {
    const preload = readText(path.join(desktopAppRoot, "src/preload.cts"));
    const windowHandlers = readText(path.join(desktopAppRoot, "src/main/ipc/handlers/windowHandlers.ts"));
    const windowController = readText(path.join(desktopAppRoot, "src/main/window/windowController.ts"));

    expect(preload).toContain("openSettingsWindow");
    expect(windowHandlers).toContain("usp:open-settings-window");
    expect(windowController).toContain("openSettingsWindow()");
    expect(windowController).toContain("settingsWindowManager");
  });
```

- [x] **Step 2: Run the focused test and confirm it fails**

Run: `npm --prefix desktop-app run test:renderer -- testingStackUpgrade`

Expected: FAIL because the preload API, IPC handler, and controller wiring do not exist yet.

- [x] **Step 3: Add the dedicated settings window manager and IPC plumbing**

Create `desktop-app/src/main/window/settingsWindowManager.ts`:

```ts
import { BrowserWindow } from "electron";
import path from "path";
import { fileURLToPath } from "url";

type SettingsWindowManagerOptions = {
  getWindowIconPath: () => string;
  onDidFinishLoad?: (window: BrowserWindow) => void;
  onClosed?: () => void;
};

export class SettingsWindowManager {
  private settingsWindow: BrowserWindow | null = null;
  private readonly __dirname = path.dirname(fileURLToPath(import.meta.url));

  constructor(private readonly options: SettingsWindowManagerOptions) {}

  getWindow() {
    return this.settingsWindow;
  }

  openSettingsWindow() {
    if (this.settingsWindow && !this.settingsWindow.isDestroyed()) {
      if (this.settingsWindow.isMinimized()) {
        this.settingsWindow.restore();
      }
      this.settingsWindow.show();
      this.settingsWindow.focus();
      return this.settingsWindow;
    }

    this.settingsWindow = new BrowserWindow({
      width: 1120,
      height: 760,
      minWidth: 1120,
      minHeight: 760,
      maxWidth: 1120,
      maxHeight: 760,
      resizable: false,
      fullscreenable: false,
      titleBarStyle: "hidden",
      ...(process.platform === "win32" && {
        titleBarOverlay: {
          color: "#0d1117",
          symbolColor: "#e5e5e5",
          height: 48
        }
      }),
      backgroundColor: "#101418",
      webPreferences: {
        preload: path.join(this.__dirname, "../../preload.cjs"),
        contextIsolation: true,
        nodeIntegration: false
      },
      icon: this.options.getWindowIconPath()
    });

    this.settingsWindow.loadFile(path.join(this.__dirname, "../../renderer/settings.html"));
    this.settingsWindow.webContents.once("did-finish-load", () => {
      if (this.settingsWindow) {
        this.options.onDidFinishLoad?.(this.settingsWindow);
      }
    });
    this.settingsWindow.on("closed", () => {
      this.settingsWindow = null;
      this.options.onClosed?.();
    });

    return this.settingsWindow;
  }
}
```

Update `desktop-app/src/main/ipc/ipcRouter.ts` context:

```ts
  openSettingsWindow: () => BrowserWindow | null;
```

Update `desktop-app/src/main/ipc/handlers/windowHandlers.ts`:

```ts
  ipcMain.handle("usp:open-settings-window", () => {
    const window = context.openSettingsWindow();
    if (!window || window.isDestroyed()) {
      return { success: false, error: "Settings window not available" };
    }
    return { success: true };
  });
```

Update `desktop-app/src/main/window/windowController.ts` constructor fields and methods:

```ts
  private readonly settingsWindowManager: SettingsWindowManager;
```

```ts
    this.settingsWindowManager = new SettingsWindowManager({
      getWindowIconPath: () => this.getWindowIconPath(),
      onDidFinishLoad: () => {
        this.pushSettingsToSettingsWindow();
        this.pushStateToSettingsWindow(this.options.stateManager.getState());
      }
    });
```

```ts
      openSettingsWindow: () => this.openSettingsWindow(),
```

```ts
  openSettingsWindow() {
    return this.settingsWindowManager.openSettingsWindow();
  }
```

- [x] **Step 4: Re-run the focused test**

Run: `npm --prefix desktop-app run test:renderer -- testingStackUpgrade`

Expected: PASS for the new assertions covering preload/IPC/controller wiring text.

- [x] **Step 5: Commit**

```bash
git add desktop-app/src/main/window/settingsWindowManager.ts \
  desktop-app/src/main/window/windowController.ts \
  desktop-app/src/main/ipc/ipcRouter.ts \
  desktop-app/src/main/ipc/handlers/windowHandlers.ts \
  desktop-app/src/renderer/testingStackUpgrade.test.ts
git commit -m "feat: add dedicated settings window manager"
```

## Task 2: Split Renderer Entry Points And Remove Embedded Settings State

**Files:**
- Create: `desktop-app/src/renderer/settings.html`
- Create: `desktop-app/src/renderer/settings-main.ts`
- Modify: `desktop-app/vite.config.ts`
- Modify: `desktop-app/src/preload.cts`
- Modify: `desktop-app/src/renderer/global.d.ts`
- Modify: `desktop-app/src/renderer/App.vue`
- Modify: `desktop-app/src/renderer/components/HeaderBar.vue`
- Modify: `desktop-app/src/renderer/stores/desktop.ts`
- Test: `desktop-app/src/renderer/stores/desktop.test.ts`

- [x] **Step 1: Write a failing store/UI regression test for the old embedded-settings state**

Append this test to `desktop-app/src/renderer/stores/desktop.test.ts`:

```ts
  it("does not expose an embedded settings-open flag in the store state", () => {
    const store = useDesktopStore();

    expect("isSettingsOpen" in store.$state).toBe(false);
    expect(typeof window.usp.openSettingsWindow).toBe("function");
  });
```

- [x] **Step 2: Run the store test and confirm it fails**

Run: `npm --prefix desktop-app run test:renderer -- desktop.test`

Expected: FAIL because `isSettingsOpen` still exists and `openSettingsWindow` is not part of the preload API yet.

- [x] **Step 3: Add explicit preload APIs and a second renderer entry**

Update `desktop-app/src/preload.cts`:

```ts
  openSettingsWindow: (): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke("usp:open-settings-window"),
```

Update `desktop-app/vite.config.ts` build input:

```ts
import { fileURLToPath } from "node:url";
```

```ts
  build: {
    target: "chrome146",
    outDir: path.resolve(__dirname, "dist/renderer"),
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, "src/renderer/index.html"),
        settings: path.resolve(__dirname, "src/renderer/settings.html")
      }
    }
  }
```

Create `desktop-app/src/renderer/settings.html`:

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Settings</title>
</head>
<body>
  <div id="app"></div>
  <script type="module" src="/settings-main.ts"></script>
</body>
</html>
```

Create `desktop-app/src/renderer/settings-main.ts`:

```ts
import { createApp } from "vue";
import { createPinia } from "pinia";
import SettingsApp from "./SettingsApp.vue";
import "./style.css";

const app = createApp(SettingsApp);
app.use(createPinia());
app.mount("#app");
```

Update `desktop-app/src/renderer/components/HeaderBar.vue`:

```ts
async function openSettingsWindow() {
  await window.usp.openSettingsWindow();
}
```

```vue
      <button
        class="icon-button"
        type="button"
        aria-label="Open settings"
        @click="openSettingsWindow"
      >
```

Update `desktop-app/src/renderer/stores/desktop.ts` by deleting:

```ts
    isSettingsOpen: false,
```

and delete the whole `setSettingsOpen(next: boolean)` action.

Update `desktop-app/src/renderer/App.vue` to remove:

```vue
      <SettingsPanel v-show="store.isSettingsOpen" />
```

and simplify:

```ts
const windowClasses = computed(() => ({
  "auto-hide-collapsed": autoHideCollapsed.value
}));
```

- [x] **Step 4: Re-run the focused test and a renderer typecheck**

Run: `npm --prefix desktop-app run test:renderer -- desktop.test`

Expected: PASS with the obsolete store flag removed.

Run: `npm --prefix desktop-app run typecheck:renderer`

Expected: PASS with the expanded preload API reflected in `global.d.ts`.

- [x] **Step 5: Commit**

```bash
git add desktop-app/src/preload.cts \
  desktop-app/src/renderer/global.d.ts \
  desktop-app/vite.config.ts \
  desktop-app/src/renderer/settings.html \
  desktop-app/src/renderer/settings-main.ts \
  desktop-app/src/renderer/App.vue \
  desktop-app/src/renderer/components/HeaderBar.vue \
  desktop-app/src/renderer/stores/desktop.ts \
  desktop-app/src/renderer/stores/desktop.test.ts
git commit -m "refactor: split settings into dedicated renderer entry"
```

## Task 3: Build The Settings Window Shell And Navigation

**Files:**
- Create: `desktop-app/src/renderer/SettingsApp.vue`
- Create: `desktop-app/src/renderer/components/settings/settingsSections.ts`
- Create: `desktop-app/src/renderer/components/settings/SettingsNav.vue`
- Create: `desktop-app/src/renderer/components/settings/SettingsWindowShell.vue`
- Create: `desktop-app/src/renderer/components/settings/SettingsWindowShell.test.ts`
- Modify: `desktop-app/src/renderer/style.css`
- Delete: `desktop-app/src/renderer/components/SettingsPanel.vue`

- [x] **Step 1: Add a failing shell test for left navigation and default page selection**

Create `desktop-app/src/renderer/components/settings/SettingsWindowShell.test.ts`:

```ts
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import SettingsWindowShell from "./SettingsWindowShell.vue";

describe("SettingsWindowShell", () => {
  it("renders a fixed left nav and selects General by default", () => {
    const wrapper = mount(SettingsWindowShell, {
      global: {
        stubs: {
          SettingsGlobal: true,
          SettingsProfiles: true,
          SettingsRules: true,
          SettingsTranscription: true,
          SettingsMediaServer: true,
          SettingsCache: true
        }
      }
    });

    expect(wrapper.get('[data-testid="settings-nav"]').exists()).toBe(true);
    expect(wrapper.get('[data-testid="settings-nav-item-general"]').attributes("aria-current")).toBe("page");
    expect(wrapper.get('[data-testid="settings-content"]').text()).toContain("SettingsGlobal");
  });
});
```

- [x] **Step 2: Run the shell test and confirm it fails**

Run: `npm --prefix desktop-app run test:renderer -- SettingsWindowShell`

Expected: FAIL because the shell/nav files do not exist yet.

- [x] **Step 3: Create the settings shell, nav, and renderer root**

Create `desktop-app/src/renderer/components/settings/settingsSections.ts`:

```ts
export const SETTINGS_SECTIONS = [
  { id: "general", label: "General" },
  { id: "profiles", label: "Profiles" },
  { id: "rules", label: "Rules" },
  { id: "transcription", label: "Transcription" },
  { id: "media-server", label: "Media Server" },
  { id: "cache", label: "Cache" }
] as const;

export type SettingsSectionId = (typeof SETTINGS_SECTIONS)[number]["id"];
```

Create `desktop-app/src/renderer/components/settings/SettingsNav.vue`:

```vue
<template>
  <nav class="settings-nav" data-testid="settings-nav" aria-label="Settings sections">
    <button
      v-for="section in sections"
      :key="section.id"
      type="button"
      class="settings-nav__item"
      :data-testid="`settings-nav-item-${section.id}`"
      :aria-current="section.id === currentSection ? 'page' : undefined"
      @click="$emit('select', section.id)"
    >
      {{ section.label }}
    </button>
  </nav>
</template>
```

Create `desktop-app/src/renderer/components/settings/SettingsWindowShell.vue`:

```vue
<template>
  <section class="settings-window-shell">
    <header class="settings-window-shell__header">Settings</header>
    <div class="settings-window-shell__body">
      <SettingsNav :sections="sections" :current-section="currentSection" @select="currentSection = $event" />
      <main class="settings-window-shell__content" data-testid="settings-content">
        <SettingsGlobal v-if="currentSection === 'general'" />
        <SettingsProfiles v-else-if="currentSection === 'profiles'" />
        <SettingsRules v-else-if="currentSection === 'rules'" />
        <SettingsTranscription v-else-if="currentSection === 'transcription'" />
        <SettingsMediaServer v-else-if="currentSection === 'media-server'" />
        <SettingsCache v-else-if="currentSection === 'cache'" />
      </main>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref } from "vue";
import SettingsGlobal from "./SettingsGlobal.vue";
import SettingsProfiles from "./SettingsProfiles.vue";
import SettingsRules from "./SettingsRules.vue";
import SettingsTranscription from "./SettingsTranscription.vue";
import SettingsMediaServer from "./SettingsMediaServer.vue";
import SettingsCache from "./SettingsCache.vue";
import SettingsNav from "./SettingsNav.vue";
import { SETTINGS_SECTIONS } from "./settingsSections";

const sections = SETTINGS_SECTIONS;
const currentSection = ref<typeof sections[number]["id"]>("general");
</script>
```

Create `desktop-app/src/renderer/SettingsApp.vue`:

```vue
<template>
  <div class="settings-window">
    <SettingsWindowShell />
  </div>
</template>

<script setup lang="ts">
import { onMounted, watch } from "vue";
import SettingsWindowShell from "./components/settings/SettingsWindowShell.vue";
import { useDesktopStore } from "./stores/desktop";
import { normalizeLanguage } from "./i18n";

const store = useDesktopStore();

onMounted(() => {
  store.initialize();
});

watch(
  () => store.settings?.global.language,
  (lang) => {
    document.documentElement.lang = normalizeLanguage(lang);
  },
  { immediate: true }
);
</script>
```

Update `desktop-app/src/renderer/style.css` with shell scaffolding:

```css
.settings-window {
  min-height: 100vh;
  background: #101418;
  color: #f5f7fa;
}

.settings-window-shell {
  display: grid;
  grid-template-rows: 48px 1fr;
  height: 100vh;
}

.settings-window-shell__body {
  display: grid;
  grid-template-columns: 200px minmax(0, 1fr);
  height: 100%;
}

.settings-nav {
  border-right: 1px solid rgba(255, 255, 255, 0.08);
  padding: 16px 12px;
}
```

- [x] **Step 4: Re-run the shell test**

Run: `npm --prefix desktop-app run test:renderer -- SettingsWindowShell`

Expected: PASS with General selected by default and the nav rendered.

- [x] **Step 5: Commit**

```bash
git add desktop-app/src/renderer/SettingsApp.vue \
  desktop-app/src/renderer/components/settings/settingsSections.ts \
  desktop-app/src/renderer/components/settings/SettingsNav.vue \
  desktop-app/src/renderer/components/settings/SettingsWindowShell.vue \
  desktop-app/src/renderer/components/settings/SettingsWindowShell.test.ts \
  desktop-app/src/renderer/style.css
git commit -m "feat: add settings window shell and navigation"
```

## Task 4: Migrate Settings Pages Into The New Shell And Rebuild Rules As Dual Pane

**Files:**
- Modify: `desktop-app/src/renderer/components/settings/SettingsGlobal.vue`
- Modify: `desktop-app/src/renderer/components/settings/SettingsProfiles.vue`
- Modify: `desktop-app/src/renderer/components/settings/SettingsRules.vue`
- Modify: `desktop-app/src/renderer/components/settings/SettingsTranscription.vue`
- Modify: `desktop-app/src/renderer/components/settings/SettingsMediaServer.vue`
- Modify: `desktop-app/src/renderer/components/settings/SettingsCache.vue`
- Create: `desktop-app/src/renderer/components/settings/SettingsRules.browser.test.ts`
- Test: `desktop-app/src/renderer/components/settings/SettingsProfiles.browser.test.ts`

- [x] **Step 1: Add a failing browser-mode test for the Rules dual-pane layout**

Create `desktop-app/src/renderer/components/settings/SettingsRules.browser.test.ts`:

```ts
import { createPinia, setActivePinia } from "pinia";
import { mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import SettingsRules from "./SettingsRules.vue";
import { useDesktopStore } from "../../stores/desktop";

describe("SettingsRules", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    document.body.innerHTML = "";
    document.body.style.margin = "0";
    document.body.style.padding = "24px";
    document.body.style.width = "1120px";
  });

  it("renders rules as a left list and a right editor", async () => {
    const store = useDesktopStore();
    store.settings = {
      global: {
        closeBehavior: "tray",
        autoLaunch: false,
        toggleWindowShortcut: "CommandOrControl+Shift+S",
        gameProcessBlacklist: [],
        autoHidePanels: false,
        autoHideActiveZoneHeight: 80,
        alwaysOnTop: "off",
        panelOpacity: 100,
        language: "en"
      },
      network: { host: "127.0.0.1", port: 4312 },
      profiles: [{ id: "profile-1", name: "Default", description: null, settings: {} as any }],
      defaultProfileId: "profile-1",
      rules: [{ id: "rule-1", name: "Netflix", matchType: "contains", pattern: "netflix.com", profileId: "profile-1", isEnabled: true }],
      mediaServer: { enabled: false, configs: [] },
      transcription: { enabled: false, activeConfigId: null, configs: [] },
      cache: { enabled: false, path: "", retentionDays: 30 }
    } as any;

    const wrapper = mount(SettingsRules, { attachTo: document.body });

    expect(wrapper.get('[data-testid="rules-list"]').exists()).toBe(true);
    expect(wrapper.get('[data-testid="rules-editor"]').exists()).toBe(true);
    await expect.element(wrapper.get(".settings-section").element).toMatchScreenshot("settings-rules-dual-pane.png");
  });
});
```

- [x] **Step 2: Run the browser-mode test and confirm it fails**

Run: `npm --prefix desktop-app run test:renderer:browser -- SettingsRules`

Expected: FAIL because `SettingsRules.vue` still renders a vertical list-plus-form stack and the new data-testid hooks do not exist.

- [x] **Step 3: Rebuild the settings pages for the fixed shell, prioritizing Rules**

Update `desktop-app/src/renderer/components/settings/SettingsRules.vue` to use an explicit two-pane structure:

```vue
  <section class="settings-section settings-section--split">
    <div class="settings-split">
      <aside class="settings-split__sidebar" data-testid="rules-list">
        <button
          v-for="rule in rules"
          :key="rule.id"
          type="button"
          class="rule-list__item"
          :class="{ 'is-selected': rule.id === ruleForm.id }"
          @click="editRule(rule)"
        >
          <span class="rule-list__name">{{ rule.name }}</span>
          <span class="rule-list__meta">{{ rule.pattern }}</span>
        </button>
      </aside>

      <form class="settings-split__editor" data-testid="rules-editor" @submit.prevent="saveRule">
        <!-- keep the existing form fields, but render them in the right editor pane -->
      </form>
    </div>
  </section>
```

Also make these shell-fit adjustments:

- `SettingsGlobal.vue`: keep grouped cards, but remove `auto-fit` assumptions and use a fixed two-column grid only when space is guaranteed.
- `SettingsProfiles.vue`, `SettingsTranscription.vue`, `SettingsMediaServer.vue`: keep their inner list/editor pattern, but ensure the outermost wrapper stretches to the shell height and uses one scroll container per page.
- `SettingsCache.vue`: wrap the page in the shared section class so it matches the new shell spacing.

- [x] **Step 4: Re-run the browser-mode Rules test and a focused existing settings test**

Run: `npm --prefix desktop-app run test:renderer:browser -- SettingsRules`

Expected: PASS with the screenshot and dual-pane assertions green.

Run: `npm --prefix desktop-app run test:renderer -- SettingsProfiles`

Expected: PASS, confirming the existing complex settings page still mounts correctly inside the new shell assumptions.

- [x] **Step 5: Commit**

```bash
git add desktop-app/src/renderer/components/settings/SettingsGlobal.vue \
  desktop-app/src/renderer/components/settings/SettingsProfiles.vue \
  desktop-app/src/renderer/components/settings/SettingsRules.vue \
  desktop-app/src/renderer/components/settings/SettingsTranscription.vue \
  desktop-app/src/renderer/components/settings/SettingsMediaServer.vue \
  desktop-app/src/renderer/components/settings/SettingsCache.vue \
  desktop-app/src/renderer/components/settings/SettingsRules.browser.test.ts
git commit -m "feat: move settings pages into dedicated shell"
```

## Task 5: Final Integration Verification And Cleanup

**Files:**
- Modify: `desktop-app/src/main/window/windowController.ts`
- Delete: `desktop-app/src/renderer/components/SettingsPanel.vue`
- Modify: `desktop-app/src/renderer/style.css`
- Test: `desktop-app/src/renderer/components/settings/SettingsWindowShell.test.ts`
- Test: `desktop-app/src/renderer/testingStackUpgrade.test.ts`

- [x] **Step 1: Add a failing integration assertion that the subtitle app no longer references `SettingsPanel`**

Append this test to `desktop-app/src/renderer/testingStackUpgrade.test.ts`:

```ts
  it("keeps the subtitle window free of embedded settings rendering", () => {
    const appVue = readText(path.join(desktopAppRoot, "src/renderer/App.vue"));

    expect(appVue).not.toContain("SettingsPanel");
    expect(appVue).not.toContain("window--settings-open");
  });
```

- [x] **Step 2: Run the focused test and confirm it fails before cleanup**

Run: `npm --prefix desktop-app run test:renderer -- testingStackUpgrade`

Expected: FAIL until the last embedded settings references are removed.

- [x] **Step 3: Finish cleanup and run the full desktop verification sweep**

Delete `desktop-app/src/renderer/components/SettingsPanel.vue` entirely.

Remove stale `.window--settings-open` styles from `desktop-app/src/renderer/style.css`.

Ensure `desktop-app/src/main/window/windowController.ts` pushes settings/state updates to both windows:

```ts
  private pushSettings() {
    const settings = this.options.getSettings();
    this.windowManager.getWindow()?.webContents.send("usp:settings", settings);
    this.settingsWindowManager.getWindow()?.webContents.send("usp:settings", settings);
  }
```

```ts
  private pushState(state: DesktopState) {
    this.windowManager.getWindow()?.webContents.send("usp:state", state);
    this.settingsWindowManager.getWindow()?.webContents.send("usp:state", state);
  }
```

Run:

`npm --prefix desktop-app run test:renderer -- testingStackUpgrade`

Expected: PASS

Run:

`npm --prefix desktop-app run test:renderer -- SettingsWindowShell desktop`

Expected: PASS

Run:

`npm --prefix desktop-app run test:renderer:browser -- SettingsProfiles SettingsRules`

Expected: PASS

Run:

`npm --prefix desktop-app run typecheck:renderer`

Expected: PASS

- [x] **Step 4: Build the desktop app to verify both renderer entries are emitted**

Run: `npm --prefix desktop-app run build`

Expected: PASS and `desktop-app/dist/renderer/settings.html` exists alongside `index.html`.

- [x] **Step 5: Commit**

```bash
git add desktop-app/src/main/window/windowController.ts \
  desktop-app/src/renderer/App.vue \
  desktop-app/src/renderer/style.css \
  desktop-app/src/renderer/testingStackUpgrade.test.ts
git commit -m "refactor: remove embedded settings panel flow"
```
