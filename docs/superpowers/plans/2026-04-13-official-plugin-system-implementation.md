# Official Plugin System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a first-party plugin host for the desktop app, expose plugin installation and settings management in the existing settings window, and migrate speech transcription into the first official plugin package.

**Architecture:** The desktop app remains the product skeleton and owns settings persistence, IPC, state, and UI surfaces. Plugins are loaded from a controlled local registry under the user-data directory, contribute manifest-declared capabilities and settings sections, and are integrated through host-owned registries rather than direct access to app internals. The first vertical slice adds host foundations, plugin management UI, runtime loading, and a transcription plugin sample.

**Tech Stack:** TypeScript, Electron 41, Vue 3.5, Pinia, Vitest (jsdom + new node project), Electron Forge, pnpm workspaces

---

## File Structure

### Files To Create

- `packages/plugin-sdk/package.json`
  - Internal workspace package for plugin manifest and contribution types shared by host and official plugins.
- `packages/plugin-sdk/tsconfig.json`
  - Build config for the plugin SDK package.
- `packages/plugin-sdk/src/manifest.ts`
  - Stable manifest, surface, and plugin registration types.
- `packages/plugin-sdk/src/index.ts`
  - Public export surface for official plugin packages and the desktop app.
- `apps/desktop-app/src/main/plugins/pluginCatalog.ts`
  - Loads the built-in official plugin catalog shown in the settings UI.
- `apps/desktop-app/src/main/plugins/pluginRegistryStore.ts`
  - Reads and writes the local installed-plugin registry under user data.
- `apps/desktop-app/src/main/plugins/pluginPaths.ts`
  - Computes plugin package, resource, and cache directories.
- `apps/desktop-app/src/main/plugins/pluginInstaller.ts`
  - Installs plugin packages and resources into the local plugin directory.
- `apps/desktop-app/src/main/plugins/pluginHost.ts`
  - Loads enabled plugins, validates manifests, and collects main-process contributions.
- `apps/desktop-app/src/main/plugins/pluginTypes.ts`
  - Desktop-app-specific runtime types for plugin status, registry rows, and host state.
- `apps/desktop-app/src/main/plugins/pluginInstaller.test.ts`
  - Node-level tests for install, enable-preflight, and failure recovery.
- `apps/desktop-app/src/main/plugins/pluginHost.test.ts`
  - Node-level tests for manifest validation and contribution loading.
- `apps/desktop-app/src/main/ipc/handlers/pluginHandlers.ts`
  - IPC endpoints for listing, installing, enabling, disabling, and repairing plugins.
- `apps/desktop-app/src/main/default-plugin-catalog.json`
  - Built-in official plugin catalog data shipped with the desktop app.
- `apps/desktop-app/src/renderer/components/settings/SettingsPlugins.vue`
  - Plugin management section shown inside the settings window.
- `apps/desktop-app/src/renderer/components/settings/PluginSettingsSectionHost.vue`
  - Renders plugin-provided settings sections with a local error boundary.
- `apps/desktop-app/src/renderer/components/settings/SettingsPlugins.test.ts`
  - jsdom tests for plugin install/enable status rendering.
- `apps/desktop-app/src/renderer/components/settings/SettingsWindowShell.plugins.test.ts`
  - jsdom tests for static + plugin section composition.
- `apps/desktop-app/src/renderer/plugins/pluginSections.ts`
  - Builds the merged settings section list from host sections and plugin sections.
- `apps/desktop-app/src/renderer/plugins/pluginUi.ts`
  - Renderer-side plugin metadata adapters consumed by settings UI.
- `apps/desktop-app/src/main/plugins/official/transcription/manifest.ts`
  - Manifest and registration entry for the first official transcription plugin.
- `apps/desktop-app/src/main/plugins/official/transcription/registerMain.ts`
  - Main-process registration for transcription capabilities.
- `apps/desktop-app/src/renderer/plugins/official/transcription/registerRenderer.ts`
  - Renderer registration for the transcription settings section.
- `apps/desktop-app/src/main/plugins/official/transcription/registerMain.test.ts`
  - Node-level tests covering transcription plugin enablement and command wiring.

### Files To Modify

- `pnpm-workspace.yaml`
  - Confirm the current workspace globs cover `packages/plugin-sdk`; modify only if the package is not already included.
- `package.json`
  - Ensure the existing root scripts continue to cover the new plugin SDK package through workspace recursion.
- `apps/desktop-app/package.json`
  - Add the `@immersive-subs/plugin-sdk` dependency.
- `apps/desktop-app/vitest.config.ts`
  - Add a `node` Vitest project for `src/main/**/*.test.ts`.
- `apps/desktop-app/src/main/types.ts`
  - Add `plugins` settings and state models, and remove top-level ownership of transcription settings after migration.
- `apps/desktop-app/src/main/default-settings.json`
  - Seed empty plugin settings, local plugin registry defaults, and no built-in transcription section ownership.
- `apps/desktop-app/src/main/ipc/ipcRouter.ts`
  - Register plugin IPC handlers and expose plugin host context.
- `apps/desktop-app/src/main/ipc/handlers/settingsHandlers.ts`
  - Keep unchanged unless the settings UI needs an explicit “open plugin folder” action; otherwise do not touch it.
- `apps/desktop-app/src/main/index.ts`
  - Construct the plugin host during app startup and make it available to IPC/state wiring.
- `apps/desktop-app/src/preload.cts`
  - Add typed plugin-management methods to the renderer bridge.
- `apps/desktop-app/src/renderer/global.d.ts`
  - Extend the `window.usp` contract with plugin methods and plugin list payload types.
- `apps/desktop-app/src/renderer/stores/desktop.ts`
  - Load plugin catalog/registry state and expose actions for install, enable, disable, and refresh.
- `apps/desktop-app/src/renderer/components/settings/settingsSections.ts`
  - Make room for a static `plugins` section in the settings nav.
- `apps/desktop-app/src/renderer/components/settings/SettingsWindowShell.vue`
  - Merge host sections with plugin sections and render plugin section components.
- `apps/desktop-app/src/renderer/components/settings/SettingsTranscription.vue`
  - Reduce or remove host-owned transcription UI once it moves into the plugin renderer registration.
- `apps/desktop-app/src/main/ipc/handlers/transcriptionHandlers.ts`
  - Delegate start-transcription execution to the transcription plugin contribution rather than the host-owned implementation.
- `apps/desktop-app/src/main/transcriptionService.ts`
  - Keep service logic, but stop exposing it as a built-in user-facing feature outside the plugin.
- `README.md`
  - Document the new plugin section, official plugin catalog behavior, and the first transcription plugin flow.

### Files To Leave Alone

- `apps/desktop-app/src/main/window/*`
  - Window, tray, and shortcut management remain host-owned.
- `apps/desktop-app/src/renderer/components/subtitle/*`
  - Subtitle reading surface stays host-owned for this plan; plugins only attach through declared surfaces.
- `apps/extension/**`
  - Browser extension work is out of scope for this implementation plan.

---

### Task 1: Add Plugin SDK Types And Desktop Node Test Support

**Files:**
- Create: `packages/plugin-sdk/package.json`
- Create: `packages/plugin-sdk/tsconfig.json`
- Create: `packages/plugin-sdk/src/manifest.ts`
- Create: `packages/plugin-sdk/src/index.ts`
- Modify: `apps/desktop-app/package.json`
- Modify: `apps/desktop-app/vitest.config.ts`
- Create: `apps/desktop-app/src/main/plugins/pluginHost.test.ts`
- Test: `apps/desktop-app/src/main/plugins/pluginHost.test.ts`

- [ ] **Step 1: Write the failing node test for manifest parsing and contribution typing**

```ts
import { describe, expect, it } from "vitest";
import type { PluginManifest } from "@immersive-subs/plugin-sdk";

describe("plugin manifest contract", () => {
  it("requires an official id, settings declaration, and host version range", () => {
    const manifest: PluginManifest = {
      id: "official.transcription",
      version: "1.0.0",
      displayName: "Speech Transcription",
      description: "Downloadable transcription feature",
      hostVersionRange: "^1.0.0",
      features: ["transcription.run"],
      settings: [
        {
          id: "official.transcription.settings",
          title: "Speech Transcription",
          anchorId: "settings-section-plugin-official-transcription"
        }
      ],
      surfaces: [],
      resources: []
    };

    expect(manifest.id.startsWith("official.")).toBe(true);
    expect(manifest.settings[0]?.anchorId).toContain("plugin");
    expect(manifest.hostVersionRange).toBe("^1.0.0");
  });
});
```

- [ ] **Step 2: Run the node test and verify it fails before the plugin SDK exists**

Run:

```bash
cd /Users/cq-laptop/Projects/Immersive-Subs-Prompter
pnpm --filter @immersive-subs/desktop-app vitest run --project node apps/desktop-app/src/main/plugins/pluginHost.test.ts
```

Expected: FAIL because the desktop Vitest config does not yet expose a `node` project and `@immersive-subs/plugin-sdk` does not exist.

- [ ] **Step 3: Create the plugin SDK package and add desktop node-test support**

```ts
// packages/plugin-sdk/src/manifest.ts
export type PluginSurfaceId = "settings.section" | "subtitle.context-tools" | "right-panel.card";

export interface PluginSettingsContribution {
  id: string;
  title: string;
  anchorId: string;
  order?: number;
}

export interface PluginResourceDescriptor {
  id: string;
  version: string;
  required: boolean;
  archiveFileName: string;
}

export interface PluginManifest {
  id: `official.${string}`;
  version: string;
  displayName: string;
  description: string;
  hostVersionRange: string;
  features: string[];
  settings: PluginSettingsContribution[];
  surfaces: PluginSurfaceId[];
  resources: PluginResourceDescriptor[];
}
```

```ts
// apps/desktop-app/vitest.config.ts
defineProject({
  test: {
    name: "node",
    environment: "node",
    globals: true,
    include: ["src/main/**/*.test.ts"]
  }
});
```

```json
// apps/desktop-app/package.json
{
  "dependencies": {
    "@immersive-subs/plugin-sdk": "workspace:*"
  }
}
```

- [ ] **Step 4: Run the node test and desktop typecheck**

Run:

```bash
cd /Users/cq-laptop/Projects/Immersive-Subs-Prompter
pnpm --filter @immersive-subs/desktop-app vitest run --project node src/main/plugins/pluginHost.test.ts
pnpm --filter @immersive-subs/desktop-app typecheck
```

Expected: PASS for the new node test and PASS for desktop typecheck with the new workspace dependency.

- [ ] **Step 5: Commit the SDK and test harness**

```bash
cd /Users/cq-laptop/Projects/Immersive-Subs-Prompter
git add packages/plugin-sdk apps/desktop-app/package.json apps/desktop-app/vitest.config.ts apps/desktop-app/src/main/plugins/pluginHost.test.ts pnpm-lock.yaml
git commit -m "feat: add plugin sdk contracts and desktop node tests"
```

### Task 2: Implement Plugin Registry, Catalog, And Installer In The Main Process

**Files:**
- Create: `apps/desktop-app/src/main/plugins/pluginTypes.ts`
- Create: `apps/desktop-app/src/main/plugins/pluginPaths.ts`
- Create: `apps/desktop-app/src/main/plugins/pluginCatalog.ts`
- Create: `apps/desktop-app/src/main/plugins/pluginRegistryStore.ts`
- Create: `apps/desktop-app/src/main/plugins/pluginInstaller.ts`
- Create: `apps/desktop-app/src/main/default-plugin-catalog.json`
- Create: `apps/desktop-app/src/main/plugins/pluginInstaller.test.ts`
- Modify: `apps/desktop-app/src/main/types.ts`
- Modify: `apps/desktop-app/src/main/default-settings.json`
- Test: `apps/desktop-app/src/main/plugins/pluginInstaller.test.ts`

- [ ] **Step 1: Write the failing installer test for install state and recovery**

```ts
import { describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { PluginRegistryStore } from "./pluginRegistryStore";
import { PluginInstaller } from "./pluginInstaller";

describe("PluginInstaller", () => {
  it("installs an official plugin into packages and leaves it disabled by default", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "usp-plugin-test-"));
    const registry = new PluginRegistryStore(root);
    const installer = new PluginInstaller({ rootDir: root, registryStore: registry });

    await installer.install({
      id: "official.transcription",
      version: "1.0.0",
      packageArchivePath: "/tmp/official.transcription-1.0.0.zip",
      resources: []
    });

    const state = registry.read();
    expect(state.plugins["official.transcription"]?.status).toBe("installed-disabled");
    expect(state.plugins["official.transcription"]?.enabled).toBe(false);
    expect(readFileSync(path.join(root, "plugins", "registry.json"), "utf8")).toContain("official.transcription");
  });
});
```

- [ ] **Step 2: Run the installer test and verify it fails before the registry and installer exist**

Run:

```bash
cd /Users/cq-laptop/Projects/Immersive-Subs-Prompter
pnpm --filter @immersive-subs/desktop-app vitest run --project node src/main/plugins/pluginInstaller.test.ts
```

Expected: FAIL because `PluginRegistryStore` and `PluginInstaller` are not implemented yet.

- [ ] **Step 3: Implement the registry, plugin paths, catalog reader, and installer**

```ts
// apps/desktop-app/src/main/plugins/pluginTypes.ts
export type LocalPluginStatus =
  | "not-installed"
  | "installed-disabled"
  | "enabled"
  | "broken"
  | "needs-attention"
  | "updating";

export interface InstalledPluginRecord {
  id: `official.${string}`;
  version: string;
  enabled: boolean;
  status: LocalPluginStatus;
  installedAt: number;
  error: string | null;
}
```

```ts
// apps/desktop-app/src/main/plugins/pluginRegistryStore.ts
export class PluginRegistryStore {
  constructor(private readonly userDataRoot: string) {}

  read(): PluginRegistryState {
    // create default { plugins: {} } if missing, then return parsed JSON
  }

  write(next: PluginRegistryState) {
    // mkdir -p plugins directory and persist registry.json atomically
  }
}
```

```ts
// apps/desktop-app/src/main/types.ts
export interface PluginSettingsRecord {
  enabled: boolean;
  config: Record<string, unknown>;
}

export interface PluginSettingsRoot {
  [pluginId: string]: PluginSettingsRecord | undefined;
}

export interface AppSettings {
  global: GlobalSettings;
  network: NetworkSettings;
  profiles: ProfileDefinition[];
  defaultProfileId: string;
  rules: ProfileRule[];
  mediaServer: MediaServerSettings;
  plugins: PluginSettingsRoot;
  cache: SubtitleCacheSettings;
}
```

- [ ] **Step 4: Run the installer test and desktop node test suite**

Run:

```bash
cd /Users/cq-laptop/Projects/Immersive-Subs-Prompter
pnpm --filter @immersive-subs/desktop-app vitest run --project node src/main/plugins/pluginInstaller.test.ts src/main/plugins/pluginHost.test.ts
pnpm --filter @immersive-subs/desktop-app typecheck
```

Expected: PASS for installer and host tests; PASS for typecheck with the new `plugins` settings root and plugin registry types.

- [ ] **Step 5: Commit the plugin persistence layer**

```bash
cd /Users/cq-laptop/Projects/Immersive-Subs-Prompter
git add apps/desktop-app/src/main/plugins apps/desktop-app/src/main/types.ts apps/desktop-app/src/main/default-settings.json apps/desktop-app/src/main/default-plugin-catalog.json
git commit -m "feat: add desktop plugin registry and installer"
```

### Task 3: Add Plugin IPC, Preload Bridge, And Renderer Store Wiring

**Files:**
- Create: `apps/desktop-app/src/main/ipc/handlers/pluginHandlers.ts`
- Modify: `apps/desktop-app/src/main/ipc/ipcRouter.ts`
- Modify: `apps/desktop-app/src/main/index.ts`
- Modify: `apps/desktop-app/src/preload.cts`
- Modify: `apps/desktop-app/src/renderer/global.d.ts`
- Modify: `apps/desktop-app/src/renderer/stores/desktop.ts`
- Create: `apps/desktop-app/src/renderer/plugins/pluginUi.ts`
- Test: `apps/desktop-app/src/main/plugins/pluginHost.test.ts`

- [ ] **Step 1: Write the failing store test for plugin catalog loading**

```ts
import { setActivePinia, createPinia } from "pinia";
import { describe, expect, it, vi } from "vitest";
import { useDesktopStore } from "./desktop";

describe("desktop store plugin state", () => {
  it("loads plugin catalog rows during initialization", async () => {
    setActivePinia(createPinia());
    window.usp.getPluginCatalog = vi.fn().mockResolvedValue([
      { id: "official.transcription", status: "installed-disabled", enabled: false }
    ]);

    window.usp.getInitialState = vi.fn().mockResolvedValue({});
    window.usp.getSettings = vi.fn().mockResolvedValue({ global: { language: "en" }, plugins: {} });

    const store = useDesktopStore();
    await store.initialize();

    expect(store.pluginCatalog).toHaveLength(1);
    expect(store.pluginCatalog[0]?.id).toBe("official.transcription");
  });
});
```

- [ ] **Step 2: Run the jsdom store test and verify it fails before plugin IPC exists**

Run:

```bash
cd /Users/cq-laptop/Projects/Immersive-Subs-Prompter
pnpm --filter @immersive-subs/desktop-app vitest run --project jsdom src/renderer/stores/desktop.test.ts
```

Expected: FAIL because `window.usp.getPluginCatalog` and store plugin state/actions are not defined yet.

- [ ] **Step 3: Add plugin IPC endpoints, preload methods, and store actions**

```ts
// apps/desktop-app/src/main/ipc/handlers/pluginHandlers.ts
ipcMain.handle("usp:get-plugin-catalog", async () => context.pluginHost.listCatalog());
ipcMain.handle("usp:install-plugin", async (_event, pluginId: string) => context.pluginHost.install(pluginId));
ipcMain.handle("usp:enable-plugin", async (_event, pluginId: string) => context.pluginHost.enable(pluginId));
ipcMain.handle("usp:disable-plugin", async (_event, pluginId: string) => context.pluginHost.disable(pluginId));
```

```ts
// apps/desktop-app/src/preload.cts
getPluginCatalog: () => ipcRenderer.invoke("usp:get-plugin-catalog"),
installPlugin: (pluginId: string) => ipcRenderer.invoke("usp:install-plugin", pluginId),
enablePlugin: (pluginId: string) => ipcRenderer.invoke("usp:enable-plugin", pluginId),
disablePlugin: (pluginId: string) => ipcRenderer.invoke("usp:disable-plugin", pluginId),
```

```ts
// apps/desktop-app/src/renderer/stores/desktop.ts
pluginCatalog: [] as PluginCatalogRow[],

async refreshPluginCatalog() {
  this.pluginCatalog = await window.usp.getPluginCatalog();
},

async installPlugin(pluginId: string) {
  await window.usp.installPlugin(pluginId);
  await this.refreshPluginCatalog();
},
```

- [ ] **Step 4: Run the affected jsdom and node tests**

Run:

```bash
cd /Users/cq-laptop/Projects/Immersive-Subs-Prompter
pnpm --filter @immersive-subs/desktop-app vitest run --project jsdom src/renderer/stores/desktop.test.ts
pnpm --filter @immersive-subs/desktop-app vitest run --project node src/main/plugins/pluginHost.test.ts src/main/plugins/pluginInstaller.test.ts
```

Expected: PASS for the store test and PASS for the node-side plugin host tests after wiring IPC to the host service.

- [ ] **Step 5: Commit the plugin bridge and state wiring**

```bash
cd /Users/cq-laptop/Projects/Immersive-Subs-Prompter
git add apps/desktop-app/src/main/ipc apps/desktop-app/src/main/index.ts apps/desktop-app/src/preload.cts apps/desktop-app/src/renderer/global.d.ts apps/desktop-app/src/renderer/stores/desktop.ts apps/desktop-app/src/renderer/plugins/pluginUi.ts
git commit -m "feat: wire desktop plugin host through ipc and store"
```

### Task 4: Add Plugin Management UI And Dynamic Settings Sections

**Files:**
- Create: `apps/desktop-app/src/renderer/components/settings/SettingsPlugins.vue`
- Create: `apps/desktop-app/src/renderer/components/settings/PluginSettingsSectionHost.vue`
- Create: `apps/desktop-app/src/renderer/components/settings/SettingsPlugins.test.ts`
- Create: `apps/desktop-app/src/renderer/components/settings/SettingsWindowShell.plugins.test.ts`
- Create: `apps/desktop-app/src/renderer/plugins/pluginSections.ts`
- Modify: `apps/desktop-app/src/renderer/components/settings/settingsSections.ts`
- Modify: `apps/desktop-app/src/renderer/components/settings/SettingsWindowShell.vue`
- Test: `apps/desktop-app/src/renderer/components/settings/SettingsPlugins.test.ts`
- Test: `apps/desktop-app/src/renderer/components/settings/SettingsWindowShell.plugins.test.ts`

- [ ] **Step 1: Write the failing jsdom tests for the plugin section and merged navigation**

```ts
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { describe, expect, it } from "vitest";
import SettingsWindowShell from "./SettingsWindowShell.vue";
import { useDesktopStore } from "../../stores/desktop";

describe("SettingsWindowShell plugin sections", () => {
  it("shows a static Plugins section and enabled plugin settings sections", async () => {
    setActivePinia(createPinia());
    const store = useDesktopStore();
    store.settings = { global: { language: "en" }, plugins: {} } as any;
    store.pluginCatalog = [
      {
        id: "official.transcription",
        enabled: true,
        status: "enabled",
        settingsSections: [{ id: "official.transcription.settings", title: "Speech Transcription", anchorId: "settings-section-plugin-official-transcription" }]
      }
    ] as any;

    const wrapper = mount(SettingsWindowShell);

    expect(wrapper.text()).toContain("Plugins");
    expect(wrapper.text()).toContain("Speech Transcription");
  });
});
```

- [ ] **Step 2: Run the new jsdom tests and verify they fail before the settings shell is dynamic**

Run:

```bash
cd /Users/cq-laptop/Projects/Immersive-Subs-Prompter
pnpm --filter @immersive-subs/desktop-app vitest run --project jsdom src/renderer/components/settings/SettingsPlugins.test.ts src/renderer/components/settings/SettingsWindowShell.plugins.test.ts
```

Expected: FAIL because there is no `Plugins` section component yet and the shell still uses a fixed section-to-component map.

- [ ] **Step 3: Implement the plugin settings section host and plugin management section**

```ts
// apps/desktop-app/src/renderer/plugins/pluginSections.ts
export function buildPluginAwareSettingsSections(language: SupportedLanguage, pluginCatalog: PluginCatalogRow[]) {
  return [
    ...buildSettingsSections(language),
    {
      id: "plugins",
      label: translate("section-plugins", "Plugins", language),
      anchorId: "settings-section-plugins"
    },
    ...pluginCatalog
      .filter((plugin) => plugin.enabled)
      .flatMap((plugin) => plugin.settingsSections)
  ];
}
```

```vue
<!-- apps/desktop-app/src/renderer/components/settings/SettingsPlugins.vue -->
<template>
  <section>
    <h2>Plugins</h2>
    <ul>
      <li v-for="plugin in store.pluginCatalog" :key="plugin.id">
        <span>{{ plugin.displayName }}</span>
        <button v-if="plugin.status === 'not-installed'" @click="store.installPlugin(plugin.id)">Install</button>
        <button v-else-if="plugin.enabled" @click="store.disablePlugin(plugin.id)">Disable</button>
        <button v-else @click="store.enablePlugin(plugin.id)">Enable</button>
      </li>
    </ul>
  </section>
</template>
```

- [ ] **Step 4: Run the plugin UI tests and the existing settings shell tests**

Run:

```bash
cd /Users/cq-laptop/Projects/Immersive-Subs-Prompter
pnpm --filter @immersive-subs/desktop-app vitest run --project jsdom src/renderer/components/settings/SettingsPlugins.test.ts src/renderer/components/settings/SettingsWindowShell.plugins.test.ts src/renderer/components/settings/SettingsWindowShell.test.ts
```

Expected: PASS for the new plugin tests and PASS for the existing settings shell coverage with the added `Plugins` section.

- [ ] **Step 5: Commit the plugin settings UI**

```bash
cd /Users/cq-laptop/Projects/Immersive-Subs-Prompter
git add apps/desktop-app/src/renderer/components/settings apps/desktop-app/src/renderer/plugins apps/desktop-app/src/renderer/components/settings/settingsSections.ts
git commit -m "feat: add plugin management settings ui"
```

### Task 5: Implement Runtime Plugin Loading And Migrate Transcription Into The First Official Plugin

**Files:**
- Create: `apps/desktop-app/src/main/plugins/official/transcription/manifest.ts`
- Create: `apps/desktop-app/src/main/plugins/official/transcription/registerMain.ts`
- Create: `apps/desktop-app/src/renderer/plugins/official/transcription/registerRenderer.ts`
- Create: `apps/desktop-app/src/main/plugins/official/transcription/registerMain.test.ts`
- Modify: `apps/desktop-app/src/main/plugins/pluginHost.ts`
- Modify: `apps/desktop-app/src/main/ipc/handlers/transcriptionHandlers.ts`
- Modify: `apps/desktop-app/src/renderer/components/settings/SettingsTranscription.vue`
- Modify: `apps/desktop-app/src/main/transcriptionService.ts`
- Modify: `apps/desktop-app/src/main/types.ts`
- Test: `apps/desktop-app/src/main/plugins/official/transcription/registerMain.test.ts`

- [ ] **Step 1: Write the failing transcription-plugin test for start-transcription delegation**

```ts
import { describe, expect, it, vi } from "vitest";
import { registerTranscriptionPluginMain } from "./registerMain";

describe("official transcription plugin", () => {
  it("registers a startTranscription command that uses the existing TranscriptionService", async () => {
    const transcribe = vi.fn().mockResolvedValue({ id: "track-1", sourceFile: "demo.srt", cues: [] });
    const contribution = registerTranscriptionPluginMain({
      transcriptionService: { transcribe } as any,
      stateManager: { getState: () => ({ activeSource: "extension", videoUrl: "https://example.com" }) } as any
    });

    await contribution.commands.startTranscription();

    expect(transcribe).toHaveBeenCalledWith(
      "https://example.com",
      expect.objectContaining({ provider: expect.any(String) })
    );
  });
});
```

- [ ] **Step 2: Run the node test and verify it fails before the official plugin exists**

Run:

```bash
cd /Users/cq-laptop/Projects/Immersive-Subs-Prompter
pnpm --filter @immersive-subs/desktop-app vitest run --project node src/main/plugins/official/transcription/registerMain.test.ts
```

Expected: FAIL because there is no `official/transcription` plugin registration yet and the host still owns transcription directly.

- [ ] **Step 3: Implement plugin host loading, register the transcription plugin, and delegate the IPC handler**

```ts
// apps/desktop-app/src/main/plugins/pluginHost.ts
export class PluginHost {
  async loadEnabledPlugins() {
    const installed = this.registryStore.read();
    for (const plugin of Object.values(installed.plugins).filter((row) => row.enabled)) {
      if (plugin.id === "official.transcription") {
        this.loaded.set(plugin.id, registerTranscriptionPluginMain(this.context));
      }
    }
  }

  getCommand(pluginId: string, commandName: string) {
    return this.loaded.get(pluginId)?.commands[commandName];
  }
}
```

```ts
// apps/desktop-app/src/main/ipc/handlers/transcriptionHandlers.ts
ipcMain.handle("usp:start-transcription", async () => {
  const run = context.pluginHost.getCommand("official.transcription", "startTranscription");
  if (!run) {
    return { ok: false, error: "Speech Transcription plugin is not enabled." };
  }
  return run();
});
```

```ts
// apps/desktop-app/src/renderer/plugins/official/transcription/registerRenderer.ts
export function registerTranscriptionPluginRenderer() {
  return {
    settingsSections: [
      {
        id: "official.transcription.settings",
        title: "Speech Transcription",
        anchorId: "settings-section-plugin-official-transcription",
        component: SettingsTranscription
      }
    ]
  };
}
```

- [ ] **Step 4: Run the focused transcription plugin test and full desktop verification**

Run:

```bash
cd /Users/cq-laptop/Projects/Immersive-Subs-Prompter
pnpm --filter @immersive-subs/desktop-app vitest run --project node src/main/plugins/official/transcription/registerMain.test.ts src/main/plugins/pluginHost.test.ts src/main/plugins/pluginInstaller.test.ts
pnpm --filter @immersive-subs/desktop-app vitest run --project jsdom src/renderer/components/settings/SettingsPlugins.test.ts src/renderer/components/settings/SettingsWindowShell.plugins.test.ts
pnpm --filter @immersive-subs/desktop-app typecheck
pnpm --filter @immersive-subs/desktop-app test:renderer:jsdom
```

Expected: PASS for the focused node plugin tests, PASS for the plugin settings UI tests, PASS for typecheck, and PASS for the full jsdom renderer suite.

- [ ] **Step 5: Commit the first official plugin migration**

```bash
cd /Users/cq-laptop/Projects/Immersive-Subs-Prompter
git add apps/desktop-app/src/main/plugins apps/desktop-app/src/main/ipc/handlers/transcriptionHandlers.ts apps/desktop-app/src/renderer/plugins apps/desktop-app/src/renderer/components/settings/SettingsTranscription.vue apps/desktop-app/src/main/transcriptionService.ts apps/desktop-app/src/main/types.ts README.md
git commit -m "feat: migrate transcription into official plugin host"
```

### Task 6: Final Integration Pass And Documentation Verification

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/specs/2026-04-13-official-plugin-system-design.md`
- Test: `apps/desktop-app/src/main/plugins/pluginInstaller.test.ts`
- Test: `apps/desktop-app/src/renderer/components/settings/SettingsWindowShell.plugins.test.ts`

- [ ] **Step 1: Write the final verification checklist into the README update**

```md
## Plugins

The desktop app ships with an official plugin catalog. Plugins are installed into the user-data directory, remain disabled after installation, and expose their configuration through the settings window.

Current official plugin:

- Speech Transcription
```

- [ ] **Step 2: Run the repository-level checks after documentation is in place**

Run:

```bash
cd /Users/cq-laptop/Projects/Immersive-Subs-Prompter
pnpm --filter @immersive-subs/plugin-sdk build
pnpm --filter @immersive-subs/desktop-app typecheck
pnpm --filter @immersive-subs/desktop-app vitest run --project node src/main/plugins/pluginInstaller.test.ts src/main/plugins/pluginHost.test.ts src/main/plugins/official/transcription/registerMain.test.ts
pnpm --filter @immersive-subs/desktop-app test:renderer:jsdom
```

Expected: PASS for the plugin SDK build, PASS for desktop typecheck, PASS for the node-side plugin host tests, and PASS for the desktop jsdom renderer suite.

- [ ] **Step 3: Inspect the working tree and make sure only plan-scope files changed**

Run:

```bash
cd /Users/cq-laptop/Projects/Immersive-Subs-Prompter
git status --short
```

Expected: Only plugin-system-related files from this plan appear. No `apps/extension/**` changes and no unrelated window-management or subtitle-renderer rewrites.

- [ ] **Step 4: Create the final integration commit**

```bash
cd /Users/cq-laptop/Projects/Immersive-Subs-Prompter
git add README.md docs/superpowers/specs/2026-04-13-official-plugin-system-design.md
git commit -m "docs: document official desktop plugin system"
```

- [ ] **Step 5: Prepare the branch for review**

```bash
cd /Users/cq-laptop/Projects/Immersive-Subs-Prompter
git log --oneline --decorate -5
```

Expected: The latest history shows the plugin SDK, registry/installer, IPC/store, settings UI, transcription-plugin migration, and final documentation commits in a clean sequence.
