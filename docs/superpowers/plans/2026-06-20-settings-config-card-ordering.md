# Settings Config Card Ordering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Speech Transcription and Jellyfin / Emby configuration rows behave like profile cards: drag-sortable, enabled by row circle, and final-state only.

**Architecture:** Add explicit Speech Transcription per-config enablement at the settings schema boundary, keep `activeConfigId` as the control-panel runtime selection, and derive runtime availability only from enabled configs. Reuse the existing profile-list interaction pattern in the settings pages, with store actions responsible for persisted array reorder and active-id normalization. Jellyfin / Emby gets persisted server reorder plus an enabled local draft for new incomplete servers so strict persisted validation stays intact.

**Tech Stack:** Vue 3, Pinia, TypeScript, Vitest, Vue Test Utils, Electron renderer/main shared settings types.

---

## Source Spec

Implement [docs/superpowers/specs/2026-06-20-settings-config-card-ordering-design.md](../specs/2026-06-20-settings-config-card-ordering-design.md).

Do not add compatibility, migration, old-shape coercion, or legacy row-circle active switching. This repo is pre-launch; update the current settings contract directly.

## File Structure

- Modify: `apps/desktop-app/src/main/types.ts`
  - Add `enabled: boolean` to `TranscriptionConfig`.
- Modify: `apps/desktop-app/src/common/transcriptionDefaults.ts`
  - Default transcription config enablement.
- Modify: `apps/desktop-app/src/common/featureDefaults.ts`
  - Clone transcription config enablement.
- Modify: `apps/desktop-app/src/main/settings/appSettingsSanitizer.ts`
  - Require `TranscriptionConfig.enabled`.
  - Require `activeConfigId` to reference an enabled config when any enabled config exists.
- Modify: `apps/desktop-app/src/main/settings/appSettingsSanitizer.test.ts`
  - Lock final schema validation.
- Modify: `apps/desktop-app/src/main/features/transcriptionFeatureConfig.ts`
  - Reject disabled active configs at runtime.
- Modify: `apps/desktop-app/src/main/features/transcriptionFeatureService.test.ts`
  - Lock runtime disabled-config rejection.
- Modify: `apps/desktop-app/src/renderer/stores/desktop/types.ts`
  - Add transcription toggle/reorder and Jellyfin / Emby reorder store action types.
- Modify: `apps/desktop-app/src/renderer/stores/desktop/actions/featureActions.ts`
  - Add active-id normalization, transcription enable toggle/reorder, and Jellyfin / Emby reorder.
  - Allow `updateJellyfinEmbyServer()` to insert a valid new server when the id is not already persisted.
- Modify: `apps/desktop-app/src/renderer/stores/desktop.test.ts`
  - Lock store action behavior.
- Modify: `apps/desktop-app/src/renderer/components/settings/transcription/composables/useTranscriptionConfig.ts`
  - Remove settings-page make-active behavior.
  - Add toggle-enabled and reorder behavior.
- Modify: `apps/desktop-app/src/renderer/components/settings/transcription/TranscriptionConfigList.vue`
  - Add profile-style drag/drop.
  - Change row circle from active to enabled.
- Modify: `apps/desktop-app/src/renderer/components/settings/TranscriptionFeatureSettings.vue`
  - Wire list events to the new composable/store behavior.
- Modify: `apps/desktop-app/src/renderer/components/subtitle/SubtitleView.vue`
  - Filter control-panel transcription configs to enabled rows and guard active selection.
- Modify: `apps/desktop-app/src/renderer/components/subtitle/TranscriptionControls.vue`
  - Keep dropdown rendering stable when no enabled configs exist.
- Modify: `apps/desktop-app/src/renderer/components/settings/JellyfinEmbyFeatureSettings.vue`
  - Add drag/drop reorder.
  - Add enabled local draft behavior for newly added incomplete servers.
- Modify: `apps/desktop-app/src/renderer/components/settings/SettingsFeatures.test.ts`
  - Replace old transcription active-circle tests with enablement/reorder tests.
  - Add Jellyfin / Emby reorder and enabled-new-draft tests.
- Modify: `apps/desktop-app/src/renderer/components/settings/SettingsFeatures.browser.test.ts`
  - Update transcription fixture configs with `enabled`.
  - Preserve profile-list sizing checks.
- Modify: `apps/desktop-app/src/renderer/components/subtitle/SubtitleView.browser.test.ts`
  - Lock enabled-only dropdown config projection.

## Task 1: Final Transcription Schema and Runtime Guard

**Files:**
- Modify: `apps/desktop-app/src/main/types.ts`
- Modify: `apps/desktop-app/src/common/transcriptionDefaults.ts`
- Modify: `apps/desktop-app/src/common/featureDefaults.ts`
- Modify: `apps/desktop-app/src/main/settings/appSettingsSanitizer.ts`
- Modify: `apps/desktop-app/src/main/settings/appSettingsSanitizer.test.ts`
- Modify: `apps/desktop-app/src/main/features/transcriptionFeatureConfig.ts`
- Modify: `apps/desktop-app/src/main/features/transcriptionFeatureService.test.ts`
- Modify existing test helpers that construct `TranscriptionConfig` values:
  - `apps/desktop-app/src/main/transcriptionService.test.ts`
  - `apps/desktop-app/src/renderer/components/settings/SettingsFeatures.test.ts`
  - `apps/desktop-app/src/renderer/components/settings/SettingsFeatures.browser.test.ts`

- [ ] **Step 1: Write failing sanitizer tests for final transcription enablement**

Add these cases inside the `sanitizeSettings` describe block in `apps/desktop-app/src/main/settings/appSettingsSanitizer.test.ts`, near the existing transcription settings tests:

```ts
it("requires enablement on every Speech Transcription config", () => {
  const settings = DEFAULT_SETTINGS_FACTORY();
  const config = settings.features.transcription.configs[0]!;
  const { enabled: _enabled, ...withoutEnabled } = config;

  expect(() =>
    sanitizeSettings({
      ...settings,
      features: {
        ...settings.features,
        transcription: {
          ...settings.features.transcription,
          configs: [withoutEnabled]
        }
      }
    })
  ).toThrow("features.transcription.configs.0 must include current settings");
});

it("requires active Speech Transcription config to be enabled when enabled configs exist", () => {
  const settings = DEFAULT_SETTINGS_FACTORY();
  const configA = settings.features.transcription.configs[0]!;
  const configB = {
    ...configA,
    id: "config-b",
    name: "Config B",
    enabled: false
  };

  expect(() =>
    sanitizeSettings({
      ...settings,
      features: {
        ...settings.features,
        transcription: {
          enabled: true,
          activeConfigId: configB.id,
          configs: [
            { ...configA, enabled: true },
            configB
          ]
        }
      }
    })
  ).toThrow("features.transcription.activeConfigId must reference an enabled config");
});

it("allows all Speech Transcription configs to be disabled without inventing a runtime config", () => {
  const settings = DEFAULT_SETTINGS_FACTORY();
  const config = settings.features.transcription.configs[0]!;

  expect(sanitizeSettings({
    ...settings,
    features: {
      ...settings.features,
      transcription: {
        enabled: true,
        activeConfigId: config.id,
        configs: [{ ...config, enabled: false }]
      }
    }
  }).features.transcription.configs[0]?.enabled).toBe(false);
});
```

- [ ] **Step 2: Write failing runtime config tests**

In `apps/desktop-app/src/main/features/transcriptionFeatureService.test.ts`, update `createRuntimeConfig()` to include `enabled: true`, then add this test inside the `buildFeatureTranscriptionConfig` describe block:

```ts
it("rejects disabled active transcription configs", () => {
  expect(() =>
    buildFeatureTranscriptionConfig({
      enabled: true,
      activeConfigId: "config-a",
      configs: [createRuntimeConfig({ enabled: false })]
    })
  ).toThrow("Active transcription config is disabled.");
});
```

- [ ] **Step 3: Run focused main tests and verify failure**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app exec vitest run --project main src/main/settings/appSettingsSanitizer.test.ts src/main/features/transcriptionFeatureService.test.ts
```

Expected: FAIL because `TranscriptionConfig` does not yet have `enabled`, sanitizer does not require it, and `buildFeatureTranscriptionConfig()` still accepts disabled configs.

- [ ] **Step 4: Add `enabled` to the final transcription config type and defaults**

In `apps/desktop-app/src/main/types.ts`, change `TranscriptionConfig` to:

```ts
export interface TranscriptionConfig {
  id: string;
  enabled: boolean;
  name: string;
  provider: TranscriptionProvider;
  baseUrl: string;
  apiKey: string;
  model: string;
  language: string;
  prompt: string;
  enableWordTimestamps: boolean;
  extraParams: Record<string, string>;
  ytDlpArgs: string;
  fasterWhisperBinary: string;
  fasterWhisperModel: string;
  fasterWhisperModelDir: string;
  fasterWhisperDevice: FasterWhisperDevice;
  fasterWhisperVadFilter: boolean;
  fasterWhisperVadThreshold: number;
  fasterWhisperVadMethod: string;
  fasterWhisperUseKim2: boolean;
}
```

In `apps/desktop-app/src/common/transcriptionDefaults.ts`, add enablement to the base config:

```ts
export const BASE_TRANSCRIPTION_CONFIG: Omit<TranscriptionConfig, "id"> = {
  enabled: true,
  name: "Default Whisper API",
  provider: "whisper-api",
  baseUrl: "https://api.openai.com/v1",
  apiKey: "",
  model: "whisper-1",
  language: "",
  prompt: "",
  enableWordTimestamps: false,
  extraParams: {},
  ytDlpArgs: DEFAULT_TRANSCRIPTION_YTDLP_ARGS,
  fasterWhisperBinary: "faster-whisper",
  fasterWhisperModel: "base",
  fasterWhisperModelDir: "",
  fasterWhisperDevice: "cpu",
  fasterWhisperVadFilter: true,
  fasterWhisperVadThreshold: 0.5,
  fasterWhisperVadMethod: "",
  fasterWhisperUseKim2: false
};
```

In `apps/desktop-app/src/common/featureDefaults.ts`, keep the existing clone shape but make sure `enabled` is copied through the config spread:

```ts
configs: settings.transcription.configs.map((config) => ({
  ...config,
  extraParams: { ...config.extraParams }
}))
```

- [ ] **Step 5: Update sanitizer keys and active-enabled validation**

In `apps/desktop-app/src/main/settings/appSettingsSanitizer.ts`, add `"enabled"` to `TRANSCRIPTION_CONFIG_KEYS`:

```ts
const TRANSCRIPTION_CONFIG_KEYS = [
  "id",
  "enabled",
  "name",
  "provider",
  "baseUrl",
  "apiKey",
  "model",
  "language",
  "prompt",
  "enableWordTimestamps",
  "extraParams",
  "ytDlpArgs",
  "fasterWhisperBinary",
  "fasterWhisperModel",
  "fasterWhisperModelDir",
  "fasterWhisperDevice",
  "fasterWhisperVadFilter",
  "fasterWhisperVadThreshold",
  "fasterWhisperVadMethod",
  "fasterWhisperUseKim2"
] as const;
```

In `validateTranscriptionConfigRecord()`, require `enabled` with the other booleans:

```ts
for (const key of [
  "enabled",
  "enableWordTimestamps",
  "fasterWhisperVadFilter",
  "fasterWhisperUseKim2"
] as const) {
  requireBoolean(config, key, context);
}
```

In `validateTranscriptionFeature()`, track enabled ids and validate active selection:

```ts
const seenIds = new Set<string>();
const enabledIds = new Set<string>();
record.configs.forEach((config, index) => {
  validateTranscriptionConfigRecord(config, `features.transcription.configs.${index}`, seenIds);
  if ((config as Record<string, unknown>).enabled === true) {
    enabledIds.add((config as Record<string, unknown>).id as string);
  }
});
if (typeof record.activeConfigId === "string" && !seenIds.has(record.activeConfigId)) {
  throw new Error("features.transcription.activeConfigId must reference an existing config");
}
if (
  typeof record.activeConfigId === "string" &&
  enabledIds.size > 0 &&
  !enabledIds.has(record.activeConfigId)
) {
  throw new Error("features.transcription.activeConfigId must reference an enabled config");
}
```

- [ ] **Step 6: Reject disabled active runtime config**

In `apps/desktop-app/src/main/features/transcriptionFeatureConfig.ts`, replace the function with:

```ts
import type { TranscriptionConfig, TranscriptionFeatureSettings } from "../types.js";

export function buildFeatureTranscriptionConfig(settings: TranscriptionFeatureSettings): TranscriptionConfig {
  const active = settings.configs.find((config) => config.id === settings.activeConfigId);
  if (!active) {
    throw new Error("Active transcription config is not available.");
  }
  if (!active.enabled) {
    throw new Error("Active transcription config is disabled.");
  }
  return {
    ...active,
    extraParams: { ...active.extraParams }
  };
}
```

- [ ] **Step 7: Update local test helpers that construct transcription configs**

Add `enabled: true` to every local `createConfig()`, `createRuntimeConfig()`, and `createTranscriptionConfig()` helper that returns `TranscriptionConfig`. Use these exact insertions:

```ts
// apps/desktop-app/src/main/transcriptionService.test.ts
return {
  id: "config-1",
  enabled: true,
  name: "Default",
  provider: "whisper-api",
  baseUrl: "https://api.openai.com/v1",
  apiKey: "api-key",
  model: "whisper-1",
  language: "",
  prompt: "",
  enableWordTimestamps: false,
  extraParams: {},
  ytDlpArgs: "--extract-audio --audio-format=wav",
  fasterWhisperBinary: "faster-whisper",
  fasterWhisperModel: "base",
  fasterWhisperModelDir: "",
  fasterWhisperDevice: "cpu",
  fasterWhisperVadFilter: true,
  fasterWhisperVadThreshold: 0.5,
  fasterWhisperVadMethod: "",
  fasterWhisperUseKim2: false,
  ...overrides
};
```

```ts
// apps/desktop-app/src/renderer/components/settings/SettingsFeatures.test.ts
return {
  id: "config-a",
  enabled: true,
  name: "Whisper A",
  provider: "whisper-api",
  baseUrl: "https://api.openai.com/v1",
  apiKey: "",
  model: "whisper-1",
  language: "",
  prompt: "",
  enableWordTimestamps: false,
  extraParams: {},
  ytDlpArgs: "--extract-audio",
  fasterWhisperBinary: "faster-whisper",
  fasterWhisperModel: "base",
  fasterWhisperModelDir: "",
  fasterWhisperDevice: "cpu",
  fasterWhisperVadFilter: true,
  fasterWhisperVadThreshold: 0.5,
  fasterWhisperVadMethod: "",
  fasterWhisperUseKim2: false,
  ...patch
};
```

```ts
// apps/desktop-app/src/renderer/components/settings/SettingsFeatures.browser.test.ts
return {
  id: "config-a",
  enabled: true,
  name: "Whisper A",
  provider: "whisper-api",
  baseUrl: "https://api.openai.com/v1",
  apiKey: "",
  model: "whisper-1",
  language: "",
  prompt: "",
  enableWordTimestamps: false,
  extraParams: {},
  ytDlpArgs: "--extract-audio",
  fasterWhisperBinary: "faster-whisper",
  fasterWhisperModel: "base",
  fasterWhisperModelDir: "",
  fasterWhisperDevice: "cpu",
  fasterWhisperVadFilter: true,
  fasterWhisperVadThreshold: 0.5,
  fasterWhisperVadMethod: "",
  fasterWhisperUseKim2: false,
  ...patch
};
```

- [ ] **Step 8: Run focused main tests and verify pass**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app exec vitest run --project main src/main/settings/appSettingsSanitizer.test.ts src/main/features/transcriptionFeatureService.test.ts src/main/transcriptionService.test.ts
```

Expected: PASS.

- [ ] **Step 9: Commit schema and runtime guard**

```bash
git add apps/desktop-app/src/main/types.ts apps/desktop-app/src/common/transcriptionDefaults.ts apps/desktop-app/src/common/featureDefaults.ts apps/desktop-app/src/main/settings/appSettingsSanitizer.ts apps/desktop-app/src/main/settings/appSettingsSanitizer.test.ts apps/desktop-app/src/main/features/transcriptionFeatureConfig.ts apps/desktop-app/src/main/features/transcriptionFeatureService.test.ts apps/desktop-app/src/main/transcriptionService.test.ts apps/desktop-app/src/renderer/components/settings/SettingsFeatures.test.ts apps/desktop-app/src/renderer/components/settings/SettingsFeatures.browser.test.ts
git commit -m "feat: add transcription config enablement"
```

## Task 2: Store Actions for Reorder, Enablement, and Active Normalization

**Files:**
- Modify: `apps/desktop-app/src/renderer/stores/desktop/types.ts`
- Modify: `apps/desktop-app/src/renderer/stores/desktop/actions/featureActions.ts`
- Modify: `apps/desktop-app/src/renderer/stores/desktop.test.ts`

- [ ] **Step 1: Write failing store action tests**

Add these tests after the existing transcription config store tests in `apps/desktop-app/src/renderer/stores/desktop.test.ts`:

```ts
it("toggles Speech Transcription config enablement and moves active id off disabled configs", async () => {
  const store = useDesktopStore();
  store.settings = createSettings();
  const configA = {
    ...store.settings.features.transcription.configs[0]!,
    id: "config-a",
    name: "A",
    enabled: true
  };
  const configB = {
    ...configA,
    id: "config-b",
    name: "B",
    enabled: true
  };
  store.settings.features.transcription.activeConfigId = "config-a";
  store.settings.features.transcription.configs = [configA, configB];
  const updateSettings = vi.spyOn(store, "updateSettings").mockResolvedValue();

  await store.toggleTranscriptionConfigEnabled("config-a", false);

  expect(updateSettings).toHaveBeenCalledWith({
    features: {
      transcription: {
        enabled: store.settings.features.transcription.enabled,
        activeConfigId: "config-b",
        configs: [
          expect.objectContaining({ id: "config-a", enabled: false }),
          expect.objectContaining({ id: "config-b", enabled: true })
        ]
      }
    }
  });
});

it("keeps active Speech Transcription id when disabling the only enabled config", async () => {
  const store = useDesktopStore();
  store.settings = createSettings();
  const config = {
    ...store.settings.features.transcription.configs[0]!,
    id: "config-a",
    enabled: true
  };
  store.settings.features.transcription.activeConfigId = config.id;
  store.settings.features.transcription.configs = [config];
  const updateSettings = vi.spyOn(store, "updateSettings").mockResolvedValue();

  await store.toggleTranscriptionConfigEnabled("config-a", false);

  expect(updateSettings).toHaveBeenCalledWith({
    features: {
      transcription: {
        enabled: store.settings.features.transcription.enabled,
        activeConfigId: "config-a",
        configs: [expect.objectContaining({ id: "config-a", enabled: false })]
      }
    }
  });
});

it("reorders Speech Transcription configs and keeps active id when it remains enabled", async () => {
  const store = useDesktopStore();
  store.settings = createSettings();
  const configA = { ...store.settings.features.transcription.configs[0]!, id: "config-a", name: "A", enabled: true };
  const configB = { ...configA, id: "config-b", name: "B", enabled: true };
  store.settings.features.transcription.activeConfigId = "config-b";
  store.settings.features.transcription.configs = [configA, configB];
  const updateSettings = vi.spyOn(store, "updateSettings").mockResolvedValue();

  await store.reorderTranscriptionConfig(1, 0);

  expect(updateSettings).toHaveBeenCalledWith({
    features: {
      transcription: {
        enabled: store.settings.features.transcription.enabled,
        activeConfigId: "config-b",
        configs: [
          expect.objectContaining({ id: "config-b" }),
          expect.objectContaining({ id: "config-a" })
        ]
      }
    }
  });
});

it("reorders Jellyfin / Emby servers", async () => {
  const store = useDesktopStore();
  store.settings = createSettings();
  store.settings.features.jellyfinEmby.config.servers = [
    { id: "server-a", name: "A", serverUrls: "https://a.example.test", apiKey: "token-a", enabled: true },
    { id: "server-b", name: "B", serverUrls: "https://b.example.test", apiKey: "token-b", enabled: true }
  ];
  const updateSettings = vi.spyOn(store, "updateSettings").mockResolvedValue();

  await store.reorderJellyfinEmbyServer(1, 0);

  expect(updateSettings).toHaveBeenCalledWith({
    features: {
      jellyfinEmby: {
        enabled: store.settings.features.jellyfinEmby.enabled,
        config: {
          servers: [
            expect.objectContaining({ id: "server-b" }),
            expect.objectContaining({ id: "server-a" })
          ]
        }
      }
    }
  });
});

it("inserts new Jellyfin / Emby server configs through update", async () => {
  const store = useDesktopStore();
  store.settings = createSettings();
  store.settings.features.jellyfinEmby.config.servers = [];
  const updateSettings = vi.spyOn(store, "updateSettings").mockResolvedValue();

  await store.updateJellyfinEmbyServer("server-1", {
    id: "server-1",
    name: "Home",
    serverUrls: "https://home.example.test",
    apiKey: "token",
    enabled: true
  });

  expect(updateSettings).toHaveBeenCalledWith({
    features: {
      jellyfinEmby: {
        enabled: store.settings.features.jellyfinEmby.enabled,
        config: {
          servers: [
            {
              id: "server-1",
              name: "Home",
              serverUrls: "https://home.example.test",
              apiKey: "token",
              enabled: true
            }
          ]
        }
      }
    }
  });
});
```

- [ ] **Step 2: Run store tests and verify failure**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app exec vitest run --project jsdom src/renderer/stores/desktop.test.ts
```

Expected: FAIL because `toggleTranscriptionConfigEnabled`, `reorderTranscriptionConfig`, and `reorderJellyfinEmbyServer` do not exist.

- [ ] **Step 3: Add store action types**

In `apps/desktop-app/src/renderer/stores/desktop/types.ts`, add these action signatures in the feature section:

```ts
  toggleTranscriptionConfigEnabled(configId: string, enabled: boolean): Promise<void>;
  reorderTranscriptionConfig(fromIndex: number, toIndex: number): Promise<void>;
  reorderJellyfinEmbyServer(fromIndex: number, toIndex: number): Promise<void>;
```

- [ ] **Step 4: Add normalization helpers and actions**

In `apps/desktop-app/src/renderer/stores/desktop/actions/featureActions.ts`, add these helpers above `setActiveTranscriptionConfig()`:

```ts
function resolveActiveTranscriptionConfigId(
  configs: FeatureSettings["transcription"]["configs"],
  requestedActiveId: string
): string | null {
  const enabledConfigs = configs.filter((config) => config.enabled);
  if (!enabledConfigs.length) {
    return configs.some((config) => config.id === requestedActiveId)
      ? requestedActiveId
      : configs[0]?.id ?? null;
  }
  if (enabledConfigs.some((config) => config.id === requestedActiveId)) {
    return requestedActiveId;
  }
  return enabledConfigs[0]!.id;
}

function moveArrayItem<T>(items: readonly T[], fromIndex: number, toIndex: number): T[] | null {
  if (
    fromIndex === toIndex ||
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= items.length ||
    toIndex >= items.length
  ) {
    return null;
  }
  const next = [...items];
  const [moved] = next.splice(fromIndex, 1);
  if (!moved) {
    return null;
  }
  next.splice(toIndex, 0, moved);
  return next;
}
```

Replace `setActiveTranscriptionConfig()` with enabled-aware behavior:

```ts
export async function setActiveTranscriptionConfig(this: DesktopStoreThis, configId: string) {
  if (!this.settings) {
    return;
  }
  const configs = this.settings.features.transcription.configs;
  if (!configs.some((config) => config.id === configId && config.enabled)) {
    return;
  }
  await this.updateSettings({
    features: {
      transcription: {
        ...this.settings.features.transcription,
        activeConfigId: configId
      }
    } as Partial<FeatureSettings>
  } as Partial<AppSettings>);
}
```

Replace `setTranscriptionConfigs()` with normalization:

```ts
export async function setTranscriptionConfigs(
  this: DesktopStoreThis,
  configs: FeatureSettings["transcription"]["configs"],
  activeConfigId: string
) {
  if (!this.settings) {
    return;
  }
  const resolvedActiveId = resolveActiveTranscriptionConfigId(configs, activeConfigId);
  if (!resolvedActiveId) {
    return;
  }
  await this.updateSettings({
    features: {
      transcription: {
        enabled: this.settings.features.transcription.enabled,
        activeConfigId: resolvedActiveId,
        configs
      }
    } as Partial<FeatureSettings>
  } as Partial<AppSettings>);
}
```

Add the new actions:

```ts
export async function toggleTranscriptionConfigEnabled(
  this: DesktopStoreThis,
  configId: string,
  enabled: boolean
) {
  if (!this.settings) {
    return;
  }
  const feature = this.settings.features.transcription;
  const configs = feature.configs.map((config) =>
    config.id === configId ? { ...config, enabled } : config
  );
  if (!configs.some((config) => config.id === configId)) {
    return;
  }
  await setTranscriptionConfigs.call(this, configs, feature.activeConfigId);
}

export async function reorderTranscriptionConfig(
  this: DesktopStoreThis,
  fromIndex: number,
  toIndex: number
) {
  if (!this.settings) {
    return;
  }
  const feature = this.settings.features.transcription;
  const configs = moveArrayItem(feature.configs, fromIndex, toIndex);
  if (!configs) {
    return;
  }
  await setTranscriptionConfigs.call(this, configs, feature.activeConfigId);
}

export async function reorderJellyfinEmbyServer(
  this: DesktopStoreThis,
  fromIndex: number,
  toIndex: number
) {
  if (!this.settings) {
    return;
  }
  const servers = moveArrayItem(this.settings.features.jellyfinEmby.config.servers, fromIndex, toIndex);
  if (!servers) {
    return;
  }
  await writeJellyfinEmbyServers.call(this, servers);
}
```

Replace `updateJellyfinEmbyServer()` with insert-or-update behavior for saveable new drafts:

```ts
export async function updateJellyfinEmbyServer(
  this: DesktopStoreThis,
  serverId: string,
  patch: Partial<FeatureSettings["jellyfinEmby"]["config"]["servers"][number]>
) {
  if (!this.settings) {
    return;
  }
  const servers = this.settings.features.jellyfinEmby.config.servers;
  const existing = servers.find((server) => server.id === serverId);
  if (existing) {
    await writeJellyfinEmbyServers.call(
      this,
      servers.map((server) => server.id === serverId ? { ...server, ...patch } : server)
    );
    return;
  }
  if (
    typeof patch.id !== "string" ||
    patch.id !== serverId ||
    typeof patch.name !== "string" ||
    typeof patch.serverUrls !== "string" ||
    typeof patch.apiKey !== "string" ||
    typeof patch.enabled !== "boolean"
  ) {
    return;
  }
  await writeJellyfinEmbyServers.call(this, [
    ...servers,
    {
      id: patch.id,
      name: patch.name,
      serverUrls: patch.serverUrls,
      apiKey: patch.apiKey,
      enabled: patch.enabled
    }
  ]);
}
```

Update the `featureActions` export object:

```ts
export const featureActions = {
  setFeatureEnabled,
  setFeatureConfig,
  setActiveTranscriptionConfig,
  setTranscriptionConfigs,
  toggleTranscriptionConfigEnabled,
  reorderTranscriptionConfig,
  duplicateJellyfinEmbyServer,
  updateJellyfinEmbyServer,
  deleteJellyfinEmbyServer,
  reorderJellyfinEmbyServer
};
```

- [ ] **Step 5: Run store tests and verify pass**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app exec vitest run --project jsdom src/renderer/stores/desktop.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit store actions**

```bash
git add apps/desktop-app/src/renderer/stores/desktop/types.ts apps/desktop-app/src/renderer/stores/desktop/actions/featureActions.ts apps/desktop-app/src/renderer/stores/desktop.test.ts
git commit -m "feat: normalize configurable feature ordering"
```

## Task 3: Speech Transcription Settings List and Control Panel Runtime Selection

**Files:**
- Modify: `apps/desktop-app/src/renderer/components/settings/transcription/composables/useTranscriptionConfig.ts`
- Modify: `apps/desktop-app/src/renderer/components/settings/transcription/TranscriptionConfigList.vue`
- Modify: `apps/desktop-app/src/renderer/components/settings/TranscriptionFeatureSettings.vue`
- Modify: `apps/desktop-app/src/renderer/components/subtitle/SubtitleView.vue`
- Modify: `apps/desktop-app/src/renderer/components/subtitle/TranscriptionControls.vue`
- Modify: `apps/desktop-app/src/renderer/components/settings/SettingsFeatures.test.ts`
- Modify: `apps/desktop-app/src/renderer/components/subtitle/SubtitleView.browser.test.ts`

- [ ] **Step 1: Replace old settings active-circle tests with failing enablement tests**

In `apps/desktop-app/src/renderer/components/settings/SettingsFeatures.test.ts`, delete the test named `activates a speech transcription config from the list row circle without selecting it for editing`.

Add these tests near the other transcription config tests:

```ts
it("toggles speech transcription config enablement from the list row circle without selecting it", async () => {
  const store = seedStore();
  const configA = createTranscriptionConfig({ id: "config-a", name: "Whisper A", enabled: true });
  const configB = createTranscriptionConfig({ id: "config-b", name: "Local B", enabled: false });
  store.settings!.features.transcription.activeConfigId = configA.id;
  store.settings!.features.transcription.configs = [configA, configB];
  const toggleEnabled = vi.spyOn(store, "toggleTranscriptionConfigEnabled").mockResolvedValue();
  const setActiveTranscriptionConfig = vi.spyOn(store, "setActiveTranscriptionConfig").mockResolvedValue();
  const wrapper = mount(TranscriptionFeatureSettings);

  const enableAction = wrapper.get('[data-testid="feature-transcription-config-enabled-config-b"]');
  expect(enableAction.attributes("aria-pressed")).toBe("false");

  await enableAction.trigger("click");

  expect(toggleEnabled).toHaveBeenCalledWith("config-b", true);
  expect(setActiveTranscriptionConfig).not.toHaveBeenCalled();
  expect(wrapper.get('[data-testid="feature-transcription-config-config-a"]').classes()).toContain("is-selected");
  expect(wrapper.get('[data-testid="feature-transcription-config-config-b"]').classes()).not.toContain("is-selected");
});

it("reorders speech transcription configs from the settings list", async () => {
  const store = seedStore();
  const configA = createTranscriptionConfig({ id: "config-a", name: "Whisper A", enabled: true });
  const configB = createTranscriptionConfig({ id: "config-b", name: "Local B", enabled: true });
  store.settings!.features.transcription.configs = [configA, configB];
  const reorder = vi.spyOn(store, "reorderTranscriptionConfig").mockResolvedValue();
  const wrapper = mount(TranscriptionFeatureSettings);
  const dataTransfer = { setData: vi.fn(), effectAllowed: "" };

  await wrapper.get('[data-testid="feature-transcription-config-config-b"]').trigger("dragstart", { dataTransfer });
  await wrapper.get('[data-testid="feature-transcription-config-config-a"]').trigger("dragover");
  await wrapper.get('[data-testid="feature-transcription-config-config-a"]').trigger("drop");

  expect(reorder).toHaveBeenCalledWith(1, 0);
});
```

In `apps/desktop-app/src/renderer/components/subtitle/SubtitleView.browser.test.ts`, add this test near `shows transcription configs from feature settings`:

```ts
it("shows only enabled transcription configs in settings order", async () => {
  const store = useDesktopStore();
  store.settings = createSettings();
  const defaultConfig = store.settings.features.transcription.configs[0]!;
  store.settings.features.transcription = {
    enabled: true,
    activeConfigId: "config-b",
    configs: [
      { ...defaultConfig, id: "config-a", name: "Disabled A", enabled: false },
      { ...defaultConfig, id: "config-b", name: "Enabled B", enabled: true },
      { ...defaultConfig, id: "config-c", name: "Enabled C", enabled: true }
    ]
  };
  store.desktopState = createDesktopState();
  store.playback = store.desktopState.playback;
  store.editingProfileId = DEFAULT_PROFILE_ID;

  const wrapper = mount(SubtitleView, {
    attachTo: document.body,
    global: {
      stubs: {
        TopControlPanel: topControlPanelStub
      }
    }
  });

  await nextTick();

  expect(wrapper.get('[data-testid="transcription-config-count"]').text()).toBe("2");
  expect(wrapper.get('[data-testid="transcription-config-names"]').text()).toBe("Enabled B,Enabled C");
  expect(wrapper.get('[data-testid="transcription-active-id"]').text()).toBe("config-b");
});
```

- [ ] **Step 2: Run focused renderer tests and verify failure**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app exec vitest run --project jsdom src/renderer/components/settings/SettingsFeatures.test.ts
pnpm --filter @immersive-subs/desktop-app exec vitest run --project browser src/renderer/components/subtitle/SubtitleView.browser.test.ts
```

Expected: FAIL because the transcription row circle still emits active switching, list rows are not draggable, and `SubtitleView` still forwards disabled configs.

- [ ] **Step 3: Update `useTranscriptionConfig()` API**

In `apps/desktop-app/src/renderer/components/settings/transcription/composables/useTranscriptionConfig.ts`, update the return interface:

```ts
export interface UseTranscriptionConfigReturn {
  transcriptionConfigs: ComputedRef<TranscriptionConfig[]>;
  activeConfigId: ComputedRef<string>;
  selectedConfigId: Ref<string>;
  selectedConfig: ComputedRef<TranscriptionConfig | null>;
  selectConfig: (id: string) => void;
  updateConfig: (patch: Partial<TranscriptionConfig>) => void;
  renameConfig: (id: string, name: string) => void;
  toggleConfigEnabled: (id: string, enabled: boolean) => void;
  reorderConfig: (fromIndex: number, toIndex: number) => void;
  handleAddConfig: () => void;
  handleDuplicateConfig: () => void;
  handleDeleteConfig: () => void;
  extraParamsText: WritableComputedRef<string>;
  extraParamsError: Ref<string | null>;
}
```

Remove `makeConfigActive()`.

Add these functions:

```ts
function toggleConfigEnabled(id: string, enabled: boolean) {
  if (transcriptionConfigs.value.some((config) => config.id === id)) {
    void store.toggleTranscriptionConfigEnabled(id, enabled);
  }
}

function reorderConfig(fromIndex: number, toIndex: number) {
  void store.reorderTranscriptionConfig(fromIndex, toIndex);
}
```

Update `handleAddConfig()` so a new config becomes active only when the existing active config is not enabled:

```ts
function handleAddConfig() {
  const next = createTranscriptionConfig();
  const activeStillEnabled = transcriptionConfigs.value.some(
    (config) => config.id === activeConfigId.value && config.enabled
  );
  writeConfigs(
    [...transcriptionConfigs.value, next],
    activeStillEnabled ? activeConfigId.value : next.id
  );
  selectedConfigId.value = next.id;
}
```

Return the new functions:

```ts
return {
  transcriptionConfigs,
  activeConfigId,
  selectedConfigId,
  selectedConfig,
  selectConfig,
  updateConfig,
  renameConfig,
  toggleConfigEnabled,
  reorderConfig,
  handleAddConfig,
  handleDuplicateConfig,
  handleDeleteConfig,
  extraParamsText,
  extraParamsError
};
```

- [ ] **Step 4: Update `TranscriptionConfigList.vue` to enabled circle plus drag/drop**

In `apps/desktop-app/src/renderer/components/settings/transcription/TranscriptionConfigList.vue`, change the row loop to include indexes, draggable behavior, and highlighted state:

```vue
<UiListItem
  v-for="(config, index) in transcriptionConfigs"
  :key="config.id"
  as="div"
  density="compact"
  class="profile-list__item"
  :highlighted="dragOverIndex === index"
  :selected="config.id === selectedConfigId"
  :draggable="true"
  :data-testid="`feature-transcription-config-${config.id}`"
  @click="$emit('select', config.id)"
  @dragstart="onDragStart($event, index)"
  @dragover.prevent="dragOverIndex = index"
  @dragleave="dragOverIndex = null"
  @drop.prevent="onDrop(index)"
  @dragend="resetDrag"
>
```

Change the status button to enabled semantics:

```vue
<button
  type="button"
  class="profile-list__status-action"
  :class="{ 'is-active': config.enabled }"
  :aria-label="config.enabled ? t('feature-transcription-enabled') : t('feature-transcription-enable')"
  :aria-pressed="config.enabled ? 'true' : 'false'"
  :data-testid="`feature-transcription-config-enabled-${config.id}`"
  @click.stop="$emit('toggle-enabled', config.id, !config.enabled)"
  @mousedown.stop
  @dragstart.stop
>
  <IconCheck v-if="config.enabled" size="sm" />
</button>
```

Change the emit declarations:

```ts
const emit = defineEmits<{
  add: [];
  duplicate: [];
  delete: [];
  rename: [id: string, name: string];
  select: [id: string];
  reorder: [fromIndex: number, toIndex: number];
  "toggle-enabled": [id: string, enabled: boolean];
}>();
```

Add drag state and handlers:

```ts
const dragIndex = ref<number | null>(null);
const dragOverIndex = ref<number | null>(null);

function onDragStart(event: DragEvent, index: number) {
  dragIndex.value = index;
  dragOverIndex.value = index;
  event.dataTransfer?.setData("text/plain", String(index));
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = "move";
  }
}

function onDrop(index: number) {
  if (dragIndex.value !== null && dragIndex.value !== index) {
    emit("reorder", dragIndex.value, index);
  }
  resetDrag();
}

function resetDrag() {
  dragIndex.value = null;
  dragOverIndex.value = null;
}
```

Keep the existing name edit handlers, and add `@dragstart.stop` to the inline input and editable name button.

- [ ] **Step 5: Wire transcription settings page events**

In `apps/desktop-app/src/renderer/components/settings/TranscriptionFeatureSettings.vue`, change the list usage:

```vue
<TranscriptionConfigList
  :transcription-configs="transcriptionConfigs"
  :active-config-id="activeConfigId"
  :selected-config-id="selectedConfigId"
  :t="t"
  @add="handleAddConfig"
  @duplicate="handleDuplicateConfig"
  @delete="handleDeleteConfig"
  @rename="renameConfig"
  @select="selectConfig"
  @reorder="reorderConfig"
  @toggle-enabled="toggleConfigEnabled"
/>
```

Remove `@activate="makeConfigActive"` and remove `makeConfigActive` from the destructured composable return:

```ts
const {
  transcriptionConfigs,
  activeConfigId,
  selectedConfigId,
  selectedConfig,
  selectConfig,
  updateConfig,
  renameConfig,
  toggleConfigEnabled,
  reorderConfig,
  handleAddConfig,
  handleDuplicateConfig,
  handleDeleteConfig,
  extraParamsText,
  extraParamsError
} = useTranscriptionConfig(t);
```

- [ ] **Step 6: Filter enabled configs in `SubtitleView.vue`**

In `apps/desktop-app/src/renderer/components/subtitle/SubtitleView.vue`, replace the `transcriptionConfigs` computed with:

```ts
const transcriptionConfigs = computed(() => (
  transcriptionEnabled.value
    ? transcriptionFeature.value?.configs
      .filter((config) => config.enabled)
      .map((config) => ({ id: config.id, name: config.name })) ?? []
    : []
));
```

Keep the `activeTranscriptionId` setter but make its guard use the filtered enabled list:

```ts
const activeTranscriptionId = computed({
  get: () => transcriptionFeature.value?.activeConfigId ?? "",
  set: (value: string) => {
    if (!transcriptionConfigs.value.some((config) => config.id === value)) {
      return;
    }
    void store.setActiveTranscriptionConfig(value);
  }
});
```

Update `canTranscribe` to require the active id in enabled options:

```ts
const canTranscribe = computed(() => {
  if (!transcriptionEnabled.value) {
    return false;
  }
  if (!transcriptionConfigs.value.some((config) => config.id === activeTranscriptionId.value)) {
    return false;
  }
  const state = store.desktopState;
  if (!state || !state.videoUrl) {
    return false;
  }
  return state.activeSource !== "mediaserver";
});
```

- [ ] **Step 7: Keep `TranscriptionControls.vue` stable with no options**

In `apps/desktop-app/src/renderer/components/subtitle/TranscriptionControls.vue`, leave the select mounted but keep options derived from props:

```ts
const configOptions = computed(() =>
  configs.map((config) => ({ value: config.id, label: config.name || config.id }))
);
```

No new empty-state text is required. The start button is disabled by `canTranscribe`.

- [ ] **Step 8: Add locale keys for transcription enabled state**

In `apps/desktop-app/src/renderer/locales/en.json`, add near the existing transcription keys:

```json
"feature-transcription-enabled": "Enabled",
"feature-transcription-enable": "Enable",
```

In `apps/desktop-app/src/renderer/locales/zh.json`, add:

```json
"feature-transcription-enabled": "已启用",
"feature-transcription-enable": "启用",
```

If `apps/desktop-app/src/renderer/i18nCoverage.test.ts` has an explicit required-key list for transcription settings, add both keys there.

- [ ] **Step 9: Run focused renderer tests and verify pass**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app exec vitest run --project jsdom src/renderer/components/settings/SettingsFeatures.test.ts src/renderer/i18nCoverage.test.ts
pnpm --filter @immersive-subs/desktop-app exec vitest run --project browser src/renderer/components/subtitle/SubtitleView.browser.test.ts
```

Expected: PASS.

- [ ] **Step 10: Commit transcription UI and control-panel behavior**

```bash
git add apps/desktop-app/src/renderer/components/settings/transcription/composables/useTranscriptionConfig.ts apps/desktop-app/src/renderer/components/settings/transcription/TranscriptionConfigList.vue apps/desktop-app/src/renderer/components/settings/TranscriptionFeatureSettings.vue apps/desktop-app/src/renderer/components/subtitle/SubtitleView.vue apps/desktop-app/src/renderer/components/subtitle/TranscriptionControls.vue apps/desktop-app/src/renderer/components/settings/SettingsFeatures.test.ts apps/desktop-app/src/renderer/components/subtitle/SubtitleView.browser.test.ts apps/desktop-app/src/renderer/locales/en.json apps/desktop-app/src/renderer/locales/zh.json apps/desktop-app/src/renderer/i18nCoverage.test.ts
git commit -m "feat: separate transcription enablement from runtime selection"
```

## Task 4: Jellyfin / Emby Drag Ordering and Enabled New Drafts

**Files:**
- Modify: `apps/desktop-app/src/renderer/components/settings/JellyfinEmbyFeatureSettings.vue`
- Modify: `apps/desktop-app/src/renderer/components/settings/SettingsFeatures.test.ts`
- Modify: `apps/desktop-app/src/renderer/components/settings/SettingsFeatures.browser.test.ts`

- [ ] **Step 1: Write failing Jellyfin / Emby UI tests**

In `apps/desktop-app/src/renderer/components/settings/SettingsFeatures.test.ts`, update the existing `adds and edits Jellyfin / Emby servers through the split editor` test to expect an enabled draft and no persisted server until fields are saveable:

```ts
it("adds an enabled Jellyfin / Emby draft and persists it only when saveable", async () => {
  const store = seedStore();
  const updateServer = vi.spyOn(store, "updateJellyfinEmbyServer").mockResolvedValue();
  const wrapper = mount(JellyfinEmbyFeatureSettings);

  await wrapper.get('[data-testid="feature-jellyfin-emby-add-server"]').trigger("click");
  await wrapper.vm.$nextTick();

  const enabledAction = wrapper.get('[data-testid^="feature-jellyfin-emby-server-enabled-"]');
  expect(enabledAction.attributes("aria-pressed")).toBe("true");
  expect(updateServer).not.toHaveBeenCalled();

  await wrapper.get("#feature-jellyfin-emby-server-url").setValue("http://localhost:8096");
  expect(updateServer).not.toHaveBeenCalled();

  await wrapper.get("#feature-jellyfin-emby-api-key").setValue("token");
  expect(updateServer).toHaveBeenCalledWith(
    expect.stringMatching(/^jellyfin-emby-/),
    expect.objectContaining({
      serverUrls: "http://localhost:8096",
      apiKey: "token",
      enabled: true
    })
  );
});
```

Add a reorder test:

```ts
it("reorders Jellyfin / Emby servers from the settings list", async () => {
  const store = seedStore();
  store.settings!.features.jellyfinEmby.config.servers = [
    { id: "server-a", name: "Home", serverUrls: "https://home.example.test", apiKey: "token-a", enabled: true },
    { id: "server-b", name: "Office", serverUrls: "https://office.example.test", apiKey: "token-b", enabled: true }
  ];
  const reorder = vi.spyOn(store, "reorderJellyfinEmbyServer").mockResolvedValue();
  const wrapper = mount(JellyfinEmbyFeatureSettings);
  const dataTransfer = { setData: vi.fn(), effectAllowed: "" };

  await wrapper.get('[data-testid="feature-jellyfin-emby-server-server-b"]').trigger("dragstart", { dataTransfer });
  await wrapper.get('[data-testid="feature-jellyfin-emby-server-server-a"]').trigger("dragover");
  await wrapper.get('[data-testid="feature-jellyfin-emby-server-server-a"]').trigger("drop");

  expect(reorder).toHaveBeenCalledWith(1, 0);
});
```

- [ ] **Step 2: Run focused settings tests and verify failure**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app exec vitest run --project jsdom src/renderer/components/settings/SettingsFeatures.test.ts
```

Expected: FAIL because the page still creates persisted disabled empty rows and list rows are not draggable.

- [ ] **Step 3: Add Jellyfin / Emby draft and drag state**

In `apps/desktop-app/src/renderer/components/settings/JellyfinEmbyFeatureSettings.vue`, add a draft id helper and drag refs near the existing refs:

```ts
function createServerDraftId(): string {
  return `jellyfin-emby-${crypto.randomUUID()}`;
}

const draftServerIds = ref<Set<string>>(new Set());
const dragIndex = ref<number | null>(null);
const dragOverIndex = ref<number | null>(null);
```

Change `visibleServers` to include drafts already stored in `serverDrafts`:

```ts
const visibleServers = computed(() => {
  const persisted = servers.value.map((server) => serverDrafts.value[server.id] ?? server);
  const persistedIds = new Set(persisted.map((server) => server.id));
  const drafts = Object.values(serverDrafts.value).filter((server) => !persistedIds.has(server.id));
  return [...persisted, ...drafts];
});
```

Replace `addServer()` with a local enabled draft:

```ts
async function addServer() {
  const id = createServerDraftId();
  const draft: JellyfinEmbyServerConfig = {
    id,
    name: `Server ${visibleServers.value.length + 1}`,
    serverUrls: "",
    apiKey: "",
    enabled: true
  };
  draftServerIds.value = new Set([...draftServerIds.value, id]);
  serverDrafts.value = {
    ...serverDrafts.value,
    [id]: draft
  };
  selectedServerId.value = id;
}
```

- [ ] **Step 4: Persist new Jellyfin / Emby drafts only when saveable**

In `updateServer()`, replace the final persist block with draft-aware persistence:

```ts
if (canPersistServerDraft(nextServer)) {
  if (draftServerIds.value.has(nextServer.id)) {
    draftServerIds.value = new Set([...draftServerIds.value].filter((id) => id !== nextServer.id));
  }
  void store.updateJellyfinEmbyServer(nextServer.id, nextServer);
}
```

This uses the Task 2 insert-or-update store behavior as the single write path for persisted Jellyfin / Emby servers.

- [ ] **Step 5: Add drag/drop to Jellyfin / Emby rows**

In the Jellyfin / Emby row loop, include index, highlighted, draggable, and drag events:

```vue
<UiListItem
  v-for="(server, index) in visibleServers"
  :key="server.id"
  as="div"
  density="compact"
  class="profile-list__item"
  :highlighted="dragOverIndex === index"
  :selected="server.id === selectedServerId"
  :draggable="true"
  :data-testid="`feature-jellyfin-emby-server-${server.id}`"
  @click="selectedServerId = server.id"
  @dragstart="onDragStart($event, index)"
  @dragover.prevent="dragOverIndex = index"
  @dragleave="dragOverIndex = null"
  @drop.prevent="onDrop(index)"
  @dragend="resetDrag"
>
```

Add `@dragstart.stop` to the name input, name action, and status action.

Add handlers:

```ts
function onDragStart(event: DragEvent, index: number) {
  dragIndex.value = index;
  dragOverIndex.value = index;
  event.dataTransfer?.setData("text/plain", String(index));
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = "move";
  }
}

function onDrop(index: number) {
  if (dragIndex.value !== null && dragIndex.value !== index) {
    void store.reorderJellyfinEmbyServer(dragIndex.value, index);
  }
  resetDrag();
}

function resetDrag() {
  dragIndex.value = null;
  dragOverIndex.value = null;
}
```

- [ ] **Step 6: Clean up deleted drafts**

In `removeSelectedServer()`, remove draft ids from both draft stores:

```ts
async function removeSelectedServer() {
  const id = selectedServerId.value;
  if (!id) {
    return;
  }
  if (!draftServerIds.value.has(id)) {
    await store.deleteJellyfinEmbyServer(id);
  }
  const { [id]: _removed, ...remainingDrafts } = serverDrafts.value;
  draftServerIds.value = new Set([...draftServerIds.value].filter((draftId) => draftId !== id));
  serverDrafts.value = remainingDrafts;
  selectedServerId.value = visibleServers.value.find((server) => server.id !== id)?.id ?? null;
}
```

- [ ] **Step 7: Run focused settings and store tests**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app exec vitest run --project jsdom src/renderer/components/settings/SettingsFeatures.test.ts src/renderer/stores/desktop.test.ts
```

Expected: PASS.

- [ ] **Step 8: Run browser layout test**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app exec vitest run --project browser src/renderer/components/settings/SettingsFeatures.browser.test.ts
```

Expected: PASS.

- [ ] **Step 9: Commit Jellyfin / Emby ordering**

```bash
git add apps/desktop-app/src/renderer/components/settings/JellyfinEmbyFeatureSettings.vue apps/desktop-app/src/renderer/components/settings/SettingsFeatures.test.ts apps/desktop-app/src/renderer/components/settings/SettingsFeatures.browser.test.ts apps/desktop-app/src/renderer/stores/desktop/actions/featureActions.ts apps/desktop-app/src/renderer/stores/desktop.test.ts
git commit -m "feat: add jellyfin emby config ordering"
```

## Task 5: Full Verification and Dead-Code Cleanup

**Files:**
- Inspect: `apps/desktop-app/src/renderer/components/settings/TranscriptionFeatureSettings.vue`
- Inspect: `apps/desktop-app/src/renderer/components/settings/transcription/TranscriptionConfigList.vue`
- Inspect: `apps/desktop-app/src/renderer/components/subtitle/SubtitleView.vue`
- Inspect: `apps/desktop-app/src/renderer/stores/desktop/actions/featureActions.ts`
- Inspect: `apps/desktop-app/src/main/settings/appSettingsSanitizer.ts`
- Inspect: `apps/desktop-app/src/main/features/transcriptionFeatureConfig.ts`

- [ ] **Step 1: Search for removed settings-page active-switch behavior**

Run:

```bash
rg -n "feature-transcription-config-active|feature-transcription-active|feature-transcription-make-active|makeConfigActive|@activate|activate:" apps/desktop-app/src
```

Expected: no matches in product code or tests. Locale keys may be deleted if they are now unused.

- [ ] **Step 2: Search for transcription config constructors missing `enabled`**

Run:

```bash
rg -n "TranscriptionConfig|createRuntimeConfig|createTranscriptionConfig|createConfig\\(" apps/desktop-app/src | rg -n "enabled" -v
```

Expected: inspect results manually. Any helper returning a full `TranscriptionConfig` must include `enabled: true` or an explicit override. Type-only imports and functions that do not construct configs can remain.

- [ ] **Step 3: Run focused main and renderer suites**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app exec vitest run --project main src/main/settings/appSettingsSanitizer.test.ts src/main/features/transcriptionFeatureService.test.ts src/main/features/jellyfinEmbyMediaSource.test.ts
```

Expected: PASS.

Run:

```bash
pnpm --filter @immersive-subs/desktop-app exec vitest run --project jsdom src/renderer/stores/desktop.test.ts src/renderer/components/settings/SettingsFeatures.test.ts src/renderer/i18nCoverage.test.ts
pnpm --filter @immersive-subs/desktop-app exec vitest run --project browser src/renderer/components/settings/SettingsFeatures.browser.test.ts src/renderer/components/subtitle/SubtitleView.browser.test.ts src/renderer/components/top-panel/TopControlPanel.browser.test.ts
```

Expected: PASS.

- [ ] **Step 4: Run repo gates**

Run:

```bash
pnpm typecheck
```

Expected: PASS.

Run:

```bash
pnpm test
```

Expected: PASS.

Run:

```bash
pnpm lint:silent-catches
```

Expected: PASS.

Run:

```bash
pnpm lint:ui-boundaries
```

Expected: PASS.

Run:

```bash
git diff --check
```

Expected: no whitespace errors.

- [ ] **Step 5: Remove transient browser artifacts if test failures created them**

Run:

```bash
find apps -type d -name __screenshots__ -print
```

Expected: no output. If the command prints directories created by failed browser tests in this run, remove only those transient artifact directories and rerun the affected browser test.

- [ ] **Step 6: Commit cleanup or verification-only final state**

If Step 1 or Step 2 required code cleanup:

```bash
git add apps/desktop-app/src
git commit -m "refactor: remove stale config selection surfaces"
```

If no cleanup was required, do not create an empty commit.

- [ ] **Step 7: Final status check**

Run:

```bash
git status --short
```

Expected: clean working tree, unless the user explicitly asked to leave changes uncommitted.
