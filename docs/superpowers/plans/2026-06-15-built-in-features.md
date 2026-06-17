# Built-In Features Implementation Plan

## Implementation Result

Implemented on 2026-06-15.

Final state:

- `settings.features.wordLookup`, `settings.features.transcription`, and `settings.features.jellyfinEmby` are fixed first-party settings.
- The desktop app ships Word Lookup, Speech Transcription, and Jellyfin / Emby as built-in features.
- The renderer settings window has a single `Features` section with explicit per-feature settings components.
- The plugin manager, plugin IPC routes, plugin catalog store, plugin settings UI, plugin package installer/runtime, plugin source manifests, plugin repository artifacts, and plugin build script are removed.
- No compatibility, migration, fallback, or transitional plugin data path is retained.
- Review follow-up tightened the final state: Jellyfin / Emby settings changes immediately clear active media-source runtime state, fixed feature settings reject invalid ranges and non-HTTP(S) server URLs, incomplete Jellyfin / Emby server rows show inline settings errors and are ignored by runtime matching, Word Lookup runtime errors surface in the subtitle status banner, and transcription config conversion no longer applies implicit defaults for incomplete settings.
- Second review follow-up removed the remaining active plugin-distribution documentation, makes enabled Word Lookup fail fast when no word list path is configured, selects Jellyfin / Emby sessions from hash item routes, removes unused transcription runtime fields, and labels feature switches by current state.
- Third review follow-up closes the remaining final-state gaps: provider-specific transcription config validation now fails before audio download, `TranscriptionService` no longer fills missing model or VAD values with runtime defaults, Jellyfin / Emby subtitle stream HTTP failures surface as media-source errors, and transcription setting labels are localized.

Final verification passed:

```bash
pnpm --filter @immersive-subs/desktop-app exec vitest run src/main/settings/appSettingsSanitizer.test.ts src/main/features/wordLookupService.test.ts src/main/features/transcriptionFeatureService.test.ts src/main/features/jellyfinEmbyMediaSource.test.ts src/main/mediaSources/mediaSourceController.test.ts --project main
pnpm --filter @immersive-subs/desktop-app exec vitest run src/renderer/stores/desktop.test.ts src/renderer/components/settings/SettingsFeatures.test.ts src/renderer/components/settings/SettingsWindowShell.test.ts src/renderer/features/wordLookup/wordLookupMarkdown.test.ts --project jsdom
pnpm --filter @immersive-subs/desktop-app exec vitest run src/renderer/components/settings/SettingsWindowShell.browser.test.ts src/renderer/components/subtitle/SubtitleView.browser.test.ts --project browser
pnpm test:release-scripts
pnpm lint:silent-catches
pnpm typecheck
pnpm test
pnpm build
git diff --check
```

Active source, scripts, release docs, and current built-in feature docs leave only negative tests and final-state design documentation explicitly naming the removed plugin model. Historical security scan artifacts and pre-built-in-features implementation plans are marked as historical output instead of current architecture guidance.

Third review follow-up verification passed:

```bash
pnpm --filter @immersive-subs/desktop-app exec vitest run src/main/transcriptionService.test.ts src/main/features/transcriptionFeatureService.test.ts src/main/features/jellyfinEmbyMediaSource.test.ts --project main
pnpm --filter @immersive-subs/desktop-app exec vitest run src/renderer/components/settings/SettingsFeatures.test.ts src/renderer/i18nCoverage.test.ts --project jsdom
pnpm --filter @immersive-subs/desktop-app typecheck:app
pnpm lint:silent-catches && pnpm test:release-scripts
pnpm build
pnpm test
git diff --check
```

Second review follow-up verification passed:

```bash
pnpm --filter @immersive-subs/desktop-app exec vitest run src/main/features/wordLookupService.test.ts src/main/features/jellyfinEmbyMediaSource.test.ts src/main/features/transcriptionFeatureService.test.ts src/main/mediaSources/mediaSourceController.test.ts --project main
pnpm --filter @immersive-subs/desktop-app exec vitest run src/renderer/components/settings/SettingsFeatures.test.ts --project jsdom
pnpm test:release-scripts
pnpm --filter @immersive-subs/desktop-app typecheck:app
pnpm lint:silent-catches
git diff --check
```

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the desktop app's downloadable plugin platform with first-party built-in Features released with the desktop app.

**Architecture:** Use fixed `settings.features` records for `wordLookup`, `transcription`, and `jellyfinEmby`. Move business logic into normal desktop services, wire those services through explicit IPC and renderer settings components, and delete plugin package/runtime/distribution surfaces.

**Tech Stack:** Electron main/preload, Vue 3, Pinia, Vitest projects `main`, `jsdom`, and `browser`, TypeScript, existing renderer UI foundation.

---

## Scope Check

This is one cohesive replacement of the plugin platform with built-in features. It touches settings, main-process services, IPC/preload, renderer store, settings UI, subtitle UI, and release scripts, but each task below leaves the codebase in a testable state.

The final implementation does not preserve old plugin records, plugin package files, plugin IPC contracts, plugin settings keys, or plugin runtime abstractions.

## Final File Structure

Create these files:

- `apps/desktop-app/src/common/featureDefaults.ts` - default fixed feature settings and feature IDs.
- `apps/desktop-app/src/main/features/wordLookupService.ts` - first-party word lookup parsing, indexing, and lookup.
- `apps/desktop-app/src/main/features/wordLookupService.test.ts` - word lookup service tests.
- `apps/desktop-app/src/main/features/transcriptionFeatureConfig.ts` - typed conversion from `settings.features.transcription.config` to `TranscriptionConfig`.
- `apps/desktop-app/src/main/features/transcriptionFeatureService.ts` - start-transcription orchestration for the built-in transcription feature.
- `apps/desktop-app/src/main/features/transcriptionFeatureService.test.ts` - transcription feature tests.
- `apps/desktop-app/src/main/features/jellyfinEmbyMediaSource.ts` - first-party Jellyfin / Emby media source implementation.
- `apps/desktop-app/src/main/features/jellyfinEmbyMediaSource.test.ts` - Jellyfin / Emby tests.
- `apps/desktop-app/src/main/mediaSources/mediaSourceTypes.ts` - first-party media-source interface shared by controller and Jellyfin / Emby source.
- `apps/desktop-app/src/renderer/stores/desktop/actions/featureActions.ts` - renderer settings helpers for feature enablement and config updates.
- `apps/desktop-app/src/renderer/components/settings/SettingsFeatures.vue` - fixed top-level Features settings page.
- `apps/desktop-app/src/renderer/components/settings/WordLookupFeatureSettings.vue` - Word Lookup settings section.
- `apps/desktop-app/src/renderer/components/settings/TranscriptionFeatureSettings.vue` - Speech Transcription settings section.
- `apps/desktop-app/src/renderer/components/settings/JellyfinEmbyFeatureSettings.vue` - Jellyfin / Emby settings section.
- `apps/desktop-app/src/renderer/components/settings/SettingsFeatures.test.ts` - renderer tests for the Features page.

Modify these files:

- `apps/desktop-app/src/main/types.ts` - replace plugin settings types with fixed feature settings types.
- `apps/desktop-app/src/common/defaultSettings.ts` - create default feature settings.
- `apps/desktop-app/src/common/wordLookupTypes.ts` - rename config type from plugin to feature naming while preserving result payload types.
- `apps/desktop-app/src/common/wordLookupDefaults.ts` - rename defaults to feature naming.
- `apps/desktop-app/src/main/settings/appSettingsSanitizer.ts` - validate fixed `settings.features`.
- `apps/desktop-app/src/main/settings/appSettingsSanitizer.test.ts` - replace dynamic plugin settings tests with fixed feature settings tests.
- `apps/desktop-app/src/main/mediaSources/mediaSourceController.ts` - use first-party media-source providers from `mediaSourceTypes.ts`.
- `apps/desktop-app/src/main/mediaSources/mediaSourceController.test.ts` - update plugin-key terminology to source ID terminology.
- `apps/desktop-app/src/main/window/windowController.ts` - instantiate built-in feature services and remove plugin manager wiring.
- `apps/desktop-app/src/main/ipc/ipcRouter.ts` - remove plugin manager context and add feature services.
- `apps/desktop-app/src/main/ipc/handlers/transcriptionHandlers.ts` - call `TranscriptionFeatureService`.
- `apps/desktop-app/src/main/ipc/handlers/windowHandlers.ts` - keep word lookup window IPC and write panel size to `settings.features.wordLookup`.
- `apps/desktop-app/src/preload.cts` - remove plugin lifecycle API and catalog listener.
- `apps/desktop-app/src/renderer/stores/desktop.ts` - remove `pluginCatalog`, use `featureActions`.
- `apps/desktop-app/src/renderer/stores/desktop/types.ts` - remove plugin actions and add feature actions.
- `apps/desktop-app/src/renderer/stores/desktop/actions/initActions.ts` - remove plugin catalog fetch/listener.
- `apps/desktop-app/src/renderer/stores/desktop.test.ts` - update store tests for absence of plugin catalog.
- `apps/desktop-app/src/renderer/components/settings/settingsSections.ts` - replace `plugins` with `features`.
- `apps/desktop-app/src/renderer/components/settings/SettingsNav.vue` - replace plugin icon key with features icon key.
- `apps/desktop-app/src/renderer/components/icons/index.ts` - export a non-plugin `IconFeatures`.
- `apps/desktop-app/src/renderer/components/settings/SettingsWindowShell.vue` - route fixed `features` section to `SettingsFeatures`.
- `apps/desktop-app/src/renderer/components/settings/SettingsWindowShell.test.ts` - update settings section expectations.
- `apps/desktop-app/src/renderer/components/settings/SettingsWindowShell.browser.test.ts` - update settings section expectations.
- `apps/desktop-app/src/renderer/components/subtitle/SubtitleView.vue` - derive transcription and word lookup availability from `settings.features`.
- `apps/desktop-app/src/renderer/components/subtitle/SubtitleView.browser.test.ts` - update transcription and word lookup tests.
- `apps/desktop-app/src/renderer/locales/en.json` - replace user-facing plugin copy with feature copy.
- `apps/desktop-app/src/renderer/locales/zh.json` - replace user-facing plugin copy with feature copy.
- `package.json` - remove `build:plugins` from the root build.
- `scripts/release/check.mjs` - remove plugin artifact generation and `plugin-repository` diff check.
- `scripts/check-silent-catches.mjs` - remove `plugins` from scanned source directories.
- `scripts/release/release-scripts.test.mjs` - update release check expectations.
- `docs/superpowers/specs/2026-06-10-release-update-system-design.md` - update release boundary so built-in features release with desktop.

Delete these files and directories:

- `apps/desktop-app/src/main/plugins/`
- `apps/desktop-app/src/main/ipc/handlers/pluginHandlers.ts`
- `apps/desktop-app/src/main/pluginTranscriptionConfig.ts`
- `apps/desktop-app/src/main/pluginTranscriptionController.ts`
- `apps/desktop-app/src/common/recommendedPlugins.ts`
- `apps/desktop-app/src/renderer/stores/desktop/actions/pluginActions.ts`
- `apps/desktop-app/src/renderer/components/settings/SettingsPlugins.vue`
- `apps/desktop-app/src/renderer/components/settings/SettingsPlugins.test.ts`
- `apps/desktop-app/src/renderer/components/settings/PluginSettingsSchema.vue`
- `apps/desktop-app/src/renderer/components/settings/PluginSettingsSchema.test.ts`
- `apps/desktop-app/src/renderer/components/settings/pluginSettingsSectionKey.ts`
- `plugins/`
- `plugin-repository/`
- `scripts/package-plugins.mjs`
- `docs/superpowers/specs/2026-06-07-dynamic-plugin-system-design.md`
- `docs/superpowers/plans/2026-06-07-dynamic-plugin-system-implementation-design.md`

---

### Task 1: Fixed Feature Settings Model

**Files:**
- Create: `apps/desktop-app/src/common/featureDefaults.ts`
- Modify: `apps/desktop-app/src/main/types.ts`
- Modify: `apps/desktop-app/src/common/defaultSettings.ts`
- Modify: `apps/desktop-app/src/common/wordLookupTypes.ts`
- Modify: `apps/desktop-app/src/common/wordLookupDefaults.ts`
- Modify: `apps/desktop-app/src/main/settings/appSettingsSanitizer.ts`
- Test: `apps/desktop-app/src/main/settings/appSettingsSanitizer.test.ts`

- [ ] **Step 1: Write failing settings sanitizer tests**

Add tests that require fixed `settings.features`, reject `plugins`, reject arbitrary feature IDs, and validate nested config values.

```ts
import { createDefaultAppSettings } from "../../common/defaultSettings.js";
import { sanitizeSettings, validateSettingsForUpdate, mergeSettings } from "./appSettingsSanitizer.js";

function createSettings() {
  return createDefaultAppSettings({
    networkAuthToken: "0123456789abcdef0123456789abcdef"
  });
}

it("keeps fixed built-in feature settings", () => {
  const settings = createSettings();

  expect(sanitizeSettings(settings).features).toEqual({
    wordLookup: {
      enabled: false,
      config: {
        wordListPath: "",
        modifierKey: "alt",
        panelWidth: 360,
        panelHeight: 300
      }
    },
    transcription: {
      enabled: false,
      config: expect.objectContaining({
        provider: "whisper-api",
        baseUrl: "",
        model: "whisper-1",
        extraParamsJson: "{}"
      })
    },
    jellyfinEmby: {
      enabled: false,
      config: { servers: [] }
    }
  });
});

it("rejects removed plugin settings", () => {
  const settings = createSettings();
  const input = {
    ...settings,
    plugins: {}
  };

  expect(() => sanitizeSettings(input)).toThrow("settings contains unknown setting: plugins");
});

it("rejects arbitrary feature keys", () => {
  const settings = createSettings();

  expect(() =>
    validateSettingsForUpdate(
      {
        features: {
          ...settings.features,
          customFeature: { enabled: true, config: {} }
        } as never
      },
      settings
    )
  ).toThrow("features contains unknown setting: customFeature");
});

it("merges fixed feature config patches", () => {
  const settings = createSettings();
  const next = mergeSettings(settings, {
    features: {
      wordLookup: {
        enabled: true,
        config: { wordListPath: "/tmp/words.jsonl" }
      }
    }
  });

  expect(next.features.wordLookup.enabled).toBe(true);
  expect(next.features.wordLookup.config).toEqual({
    wordListPath: "/tmp/words.jsonl",
    modifierKey: "alt",
    panelWidth: 360,
    panelHeight: 300
  });
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app exec vitest run src/main/settings/appSettingsSanitizer.test.ts --project main
```

Expected: FAIL because `AppSettings` still has `plugins`, `settings.features` is missing, and the sanitizer still accepts dynamic plugin records.

- [ ] **Step 3: Define feature types**

In `apps/desktop-app/src/main/types.ts`, remove `PluginSettingsRecord` and replace the `plugins` property with fixed `features`.

```ts
export type WordLookupModifierKey = "alt" | "ctrl" | "shift";
export type TranscriptionProvider = "whisper-api" | "faster-whisper";
export type FasterWhisperDevice = "cpu" | "cuda";

export interface WordLookupFeatureConfig {
  wordListPath: string;
  modifierKey: WordLookupModifierKey;
  panelWidth: number;
  panelHeight: number;
}

export interface WordLookupFeatureSettings {
  enabled: boolean;
  config: WordLookupFeatureConfig;
}

export interface TranscriptionFeatureConfig {
  provider: TranscriptionProvider;
  baseUrl: string;
  apiKey: string;
  model: string;
  language: string;
  prompt: string;
  enableWordTimestamps: boolean;
  extraParamsJson: string;
  fasterWhisperModel: string;
  fasterWhisperModelDir: string;
  fasterWhisperDevice: FasterWhisperDevice;
  fasterWhisperVadFilter: boolean;
  fasterWhisperVadThreshold: number;
  fasterWhisperVadMethod: string;
  fasterWhisperUseKim2: boolean;
}

export interface TranscriptionFeatureSettings {
  enabled: boolean;
  config: TranscriptionFeatureConfig;
}

export interface JellyfinEmbyServerConfig {
  id: string;
  name: string;
  serverUrl: string;
  apiKey: string;
  enabled: boolean;
}

export interface JellyfinEmbyFeatureSettings {
  enabled: boolean;
  config: {
    servers: JellyfinEmbyServerConfig[];
  };
}

export interface FeatureSettings {
  wordLookup: WordLookupFeatureSettings;
  transcription: TranscriptionFeatureSettings;
  jellyfinEmby: JellyfinEmbyFeatureSettings;
}

export interface AppSettings {
  global: GlobalSettings;
  network: NetworkSettings;
  profiles: ProfileDefinition[];
  defaultProfileId: string;
  rules: ProfileRule[];
  features: FeatureSettings;
  cache: SubtitleCacheSettings;
}
```

Keep `TranscriptionConfig` as the runtime transcription type. Make it refer to the exported `TranscriptionProvider` and `FasterWhisperDevice` types instead of private type aliases.

- [ ] **Step 4: Add feature defaults**

Create `apps/desktop-app/src/common/featureDefaults.ts`.

```ts
import type { FeatureSettings } from "../main/types.js";

export const FEATURE_IDS = ["wordLookup", "transcription", "jellyfinEmby"] as const;
export type FeatureId = (typeof FEATURE_IDS)[number];

export const DEFAULT_FEATURE_SETTINGS: FeatureSettings = {
  wordLookup: {
    enabled: false,
    config: {
      wordListPath: "",
      modifierKey: "alt",
      panelWidth: 360,
      panelHeight: 300
    }
  },
  transcription: {
    enabled: false,
    config: {
      provider: "whisper-api",
      baseUrl: "",
      apiKey: "",
      model: "whisper-1",
      language: "",
      prompt: "",
      enableWordTimestamps: false,
      extraParamsJson: "{}",
      fasterWhisperModel: "base",
      fasterWhisperModelDir: "",
      fasterWhisperDevice: "cpu",
      fasterWhisperVadFilter: true,
      fasterWhisperVadThreshold: 0.5,
      fasterWhisperVadMethod: "",
      fasterWhisperUseKim2: false
    }
  },
  jellyfinEmby: {
    enabled: false,
    config: {
      servers: []
    }
  }
};

export function cloneFeatureSettings(settings: FeatureSettings = DEFAULT_FEATURE_SETTINGS): FeatureSettings {
  return {
    wordLookup: {
      enabled: settings.wordLookup.enabled,
      config: { ...settings.wordLookup.config }
    },
    transcription: {
      enabled: settings.transcription.enabled,
      config: { ...settings.transcription.config }
    },
    jellyfinEmby: {
      enabled: settings.jellyfinEmby.enabled,
      config: {
        servers: settings.jellyfinEmby.config.servers.map((server) => ({ ...server }))
      }
    }
  };
}
```

Update `apps/desktop-app/src/common/defaultSettings.ts` to set:

```ts
import { cloneFeatureSettings } from "./featureDefaults.js";

// inside createDefaultAppSettings()
features: cloneFeatureSettings(),
```

- [ ] **Step 5: Rename word lookup config types**

In `apps/desktop-app/src/common/wordLookupTypes.ts`, replace `WordLookupPluginConfig` with `WordLookupFeatureConfig` by re-exporting the main type:

```ts
import type { WordLookupFeatureConfig, WordLookupModifierKey } from "../main/types.js";

export type { WordLookupFeatureConfig, WordLookupModifierKey };
```

Keep `WordLookupPanelSize`, `WordLookupMatch`, `WordLookupResult`, and `WordLookupStatus` in the same file.

In `apps/desktop-app/src/common/wordLookupDefaults.ts`, replace `DEFAULT_WORD_LOOKUP_PLUGIN_CONFIG` with:

```ts
import type { WordLookupFeatureConfig } from "./wordLookupTypes.js";

export const DEFAULT_WORD_LOOKUP_FEATURE_CONFIG: WordLookupFeatureConfig = {
  wordListPath: "",
  modifierKey: "alt",
  panelWidth: 360,
  panelHeight: 300
};
```

- [ ] **Step 6: Replace sanitizer plugin validation with feature validation**

In `apps/desktop-app/src/main/settings/appSettingsSanitizer.ts`, replace settings keys and validators with fixed features.

```ts
const APP_SETTINGS_KEYS = ["global", "network", "profiles", "defaultProfileId", "rules", "features", "cache"] as const;
const FEATURE_SETTINGS_KEYS = ["wordLookup", "transcription", "jellyfinEmby"] as const;
const FEATURE_RECORD_KEYS = ["enabled", "config"] as const;
```

Add concrete validators:

```ts
function validateFeatureSettingsSnapshot(input: unknown): void {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("features settings must use the current object setting");
  }
  const source = input as Record<string, unknown>;
  assertNoUnknownKeys(source, FEATURE_SETTINGS_KEYS, "features");
  validateWordLookupFeature(source.wordLookup);
  validateTranscriptionFeature(source.transcription);
  validateJellyfinEmbyFeature(source.jellyfinEmby);
}

function validateFeatureRecord(input: unknown, context: string): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error(`${context} must use the current object setting`);
  }
  const record = input as Record<string, unknown>;
  assertNoUnknownKeys(record, FEATURE_RECORD_KEYS, context);
  if (typeof record.enabled !== "boolean") {
    throw new Error(`${context}.enabled must use the current boolean setting`);
  }
  if (!record.config || typeof record.config !== "object" || Array.isArray(record.config)) {
    throw new Error(`${context}.config must use the current object setting`);
  }
  return record.config as Record<string, unknown>;
}

function requireString(source: Record<string, unknown>, key: string, context: string): void {
  if (typeof source[key] !== "string") {
    throw new Error(`${context}.${key} must use the current string setting`);
  }
}

function requireNumber(source: Record<string, unknown>, key: string, context: string): void {
  if (typeof source[key] !== "number" || !Number.isFinite(source[key])) {
    throw new Error(`${context}.${key} must use the current finite number setting`);
  }
}

function requireBoolean(source: Record<string, unknown>, key: string, context: string): void {
  if (typeof source[key] !== "boolean") {
    throw new Error(`${context}.${key} must use the current boolean setting`);
  }
}
```

Validate each fixed feature config with exact keys and allowed option values. Replace `validatePluginSettingsSnapshot(input.plugins)` with `validateFeatureSettingsSnapshot(input.features)`. Replace update validation for `plugins` with update validation for `features`.

Update `mergeSettings` so `features` merges nested configs:

```ts
if (patch.features) {
  next.features = mergeSettingsPatch(base.features, patch.features);
}
```

- [ ] **Step 7: Run focused tests**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app exec vitest run src/main/settings/appSettingsSanitizer.test.ts --project main
pnpm --filter @immersive-subs/desktop-app typecheck:main
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/desktop-app/src/main/types.ts apps/desktop-app/src/common/defaultSettings.ts apps/desktop-app/src/common/featureDefaults.ts apps/desktop-app/src/common/wordLookupTypes.ts apps/desktop-app/src/common/wordLookupDefaults.ts apps/desktop-app/src/main/settings/appSettingsSanitizer.ts apps/desktop-app/src/main/settings/appSettingsSanitizer.test.ts
git commit -m "feat: add fixed built-in feature settings"
```

---

### Task 2: Word Lookup Service

**Files:**
- Create: `apps/desktop-app/src/main/features/wordLookupService.ts`
- Create: `apps/desktop-app/src/main/features/wordLookupService.test.ts`
- Modify: `apps/desktop-app/src/renderer/features/wordLookup/wordLookupTypes.ts`

- [ ] **Step 1: Write failing word lookup service tests**

Create `apps/desktop-app/src/main/features/wordLookupService.test.ts`.

```ts
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { WordLookupService } from "./wordLookupService.js";

let tempDir = "";

beforeEach(async () => {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "usp-word-lookup-"));
});

afterEach(async () => {
  await fs.rm(tempDir, { recursive: true, force: true });
});

async function writeWords(content: string): Promise<string> {
  const filePath = path.join(tempDir, "words.jsonl");
  await fs.writeFile(filePath, content, "utf-8");
  return filePath;
}

describe("WordLookupService", () => {
  it("rejects lookup while the feature is disabled", async () => {
    const service = new WordLookupService(() => ({
      enabled: false,
      config: { wordListPath: "", modifierKey: "alt", panelWidth: 360, panelHeight: 300 }
    }));

    await expect(service.lookup("hello")).rejects.toThrow("Word Lookup feature is disabled.");
  });

  it("loads JSONL words and ranks exact, alias, and normalized matches", async () => {
    const filePath = await writeWords([
      JSON.stringify({ word: "hello", content: "你好", aliases: ["hi"] }),
      JSON.stringify({ word: "co-operate", content: "合作", aliases: ["cooperate"] })
    ].join("\n"));
    const service = new WordLookupService(() => ({
      enabled: true,
      config: { wordListPath: filePath, modifierKey: "alt", panelWidth: 360, panelHeight: 300 }
    }));

    await expect(service.lookup("hello")).resolves.toMatchObject({
      token: "hello",
      matches: [{ word: "hello", content: "你好", matchQuality: 1 }]
    });
    await expect(service.lookup("HI")).resolves.toMatchObject({
      matches: [{ word: "hello", matchQuality: 4 }]
    });
    await expect(service.lookup("cooperate")).resolves.toMatchObject({
      matches: [{ word: "co-operate" }]
    });
  });

  it("reports invalid JSONL rows", async () => {
    const filePath = await writeWords("{not-json}");
    const service = new WordLookupService(() => ({
      enabled: true,
      config: { wordListPath: filePath, modifierKey: "alt", panelWidth: 360, panelHeight: 300 }
    }));

    await expect(service.lookup("hello")).rejects.toThrow("Invalid word list row at line 1");
  });

  it("reloads when the configured word list path changes", async () => {
    const first = await writeWords(JSON.stringify({ word: "alpha", content: "A" }));
    const second = path.join(tempDir, "second.jsonl");
    await fs.writeFile(second, JSON.stringify({ word: "beta", content: "B" }), "utf-8");
    let wordListPath = first;
    const service = new WordLookupService(() => ({
      enabled: true,
      config: { wordListPath, modifierKey: "alt", panelWidth: 360, panelHeight: 300 }
    }));

    await expect(service.lookup("alpha")).resolves.toMatchObject({ matches: [{ word: "alpha" }] });
    wordListPath = second;
    await expect(service.lookup("beta")).resolves.toMatchObject({ matches: [{ word: "beta" }] });
  });
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app exec vitest run src/main/features/wordLookupService.test.ts --project main
```

Expected: FAIL because `WordLookupService` does not exist.

- [ ] **Step 3: Implement `WordLookupService`**

Create `apps/desktop-app/src/main/features/wordLookupService.ts`. Port the current normalization, parsing, alias, indexing, and ranking behavior from `plugins/word-lookup/main.js` into a typed service with this public shape:

```ts
import { promises as fs } from "node:fs";
import type { WordLookupFeatureSettings } from "../types.js";
import type { WordLookupMatch, WordLookupResult } from "../../common/wordLookupTypes.js";

type GetSettings = () => WordLookupFeatureSettings;

const EDGE_PUNCTUATION =
  /^[\s"'“”‘’`.,!?;:()[\]{}<>，。！？；：（）【】《》]+|[\s"'“”‘’`.,!?;:()[\]{}<>，。！？；：（）【】《》]+$/gu;
const CURLY_APOSTROPHES = /[’‘`´]/gu;
const FOLDING_PUNCTUATION = /[\s._\-‐‑‒–—―/\\]+/gu;

interface WordEntry {
  word: string;
  content: string;
  aliases: string[];
  fileOrder: number;
}

type IndexBucket = Map<string, WordEntry[]>;

interface WordIndex {
  exactWord: IndexBucket;
  caseWord: IndexBucket;
  normalizedWord: IndexBucket;
  exactAlias: IndexBucket;
  caseAlias: IndexBucket;
  normalizedAlias: IndexBucket;
}

interface LoadedWordList {
  wordListPath: string;
  entries: WordEntry[];
  index: WordIndex;
  loadedAt: number;
}

export class WordLookupService {
  private loaded: LoadedWordList | null = null;

  constructor(private readonly getSettings: GetSettings) {}

  async lookup(token: string): Promise<WordLookupResult> {
    const settings = this.getSettings();
    if (!settings.enabled) {
      throw new Error("Word Lookup feature is disabled.");
    }
    const wordListPath = normalizeSurface(settings.config.wordListPath);
    const loaded = await this.ensureLoaded(wordListPath);
    const surface = normalizeTokenSurface(token);
    const caseToken = normalizeCase(surface);
    const normalizedToken = normalizeLookupKey(surface);
    const matches: WordLookupMatch[] = [];
    const seen = new Set<number>();

    collectMatches(loaded.index, "exactWord", surface, 1, matches, seen);
    collectMatches(loaded.index, "caseWord", caseToken, 2, matches, seen);
    collectMatches(loaded.index, "exactAlias", surface, 3, matches, seen);
    collectMatches(loaded.index, "caseAlias", caseToken, 4, matches, seen);
    collectMatches(loaded.index, "normalizedWord", normalizedToken, 5, matches, seen);
    collectMatches(loaded.index, "normalizedAlias", normalizedToken, 6, matches, seen);

    matches.sort((left, right) => left.matchQuality - right.matchQuality || left.fileOrder - right.fileOrder);
    return { token: surface, normalizedToken, matches };
  }

  clear(): void {
    this.loaded = null;
  }

  private async ensureLoaded(wordListPath: string): Promise<LoadedWordList> {
    if (this.loaded?.wordListPath === wordListPath) {
      return this.loaded;
    }
    if (!wordListPath) {
      this.loaded = {
        wordListPath,
        entries: [],
        index: createEmptyIndex(),
        loadedAt: Date.now()
      };
      return this.loaded;
    }
    const raw = await fs.readFile(wordListPath, "utf-8");
    const entries = parseWordList(raw);
    this.loaded = {
      wordListPath,
      entries,
      index: buildIndex(entries),
      loadedAt: Date.now()
    };
    return this.loaded;
  }
}
```

Add the same helper functions and error messages from the current plugin source: `normalizeSurface`, `normalizeTokenSurface`, `normalizeCase`, `normalizeLookupKey`, `parseJsonLine`, `parseAliases`, `parseWordList`, `createEmptyIndex`, `appendIndex`, `buildIndex`, and `collectMatches`.

- [ ] **Step 4: Update renderer word lookup type exports**

In `apps/desktop-app/src/renderer/features/wordLookup/wordLookupTypes.ts`, change the import/export from `WordLookupPluginConfig` to `WordLookupFeatureConfig`.

```ts
import type {
  WordLookupFeatureConfig,
  WordLookupResult,
  WordLookupStatus
} from "../../common/wordLookupTypes";

export type { WordLookupFeatureConfig, WordLookupResult, WordLookupStatus };
```

Keep `WordHoverPayload` and `WordLeavePayload` unchanged.

- [ ] **Step 5: Run focused tests**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app exec vitest run src/main/features/wordLookupService.test.ts --project main
pnpm --filter @immersive-subs/desktop-app typecheck:main
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/desktop-app/src/main/features/wordLookupService.ts apps/desktop-app/src/main/features/wordLookupService.test.ts apps/desktop-app/src/renderer/features/wordLookup/wordLookupTypes.ts
git commit -m "feat: add built-in word lookup service"
```

---

### Task 3: Built-In Transcription Feature Service

**Files:**
- Create: `apps/desktop-app/src/main/features/transcriptionFeatureConfig.ts`
- Create: `apps/desktop-app/src/main/features/transcriptionFeatureService.ts`
- Create: `apps/desktop-app/src/main/features/transcriptionFeatureService.test.ts`
- Delete later: `apps/desktop-app/src/main/pluginTranscriptionConfig.ts`
- Delete later: `apps/desktop-app/src/main/pluginTranscriptionController.ts`

- [ ] **Step 1: Write failing transcription feature tests**

Create `apps/desktop-app/src/main/features/transcriptionFeatureService.test.ts`.

```ts
import { describe, expect, it, vi } from "vitest";
import { buildFeatureTranscriptionConfig } from "./transcriptionFeatureConfig.js";
import { startFeatureTranscription } from "./transcriptionFeatureService.js";

function createStateManager(overrides: Record<string, unknown> = {}) {
  const state = {
    activeSource: "extension",
    videoUrl: "https://video.example.test/watch",
    ...overrides
  };
  return {
    getState: vi.fn(() => state),
    setTranscriptionStatus: vi.fn(),
    addOrReplaceSubtitleTrack: vi.fn(),
    updateState: vi.fn((updater: (draft: Record<string, unknown>) => void) => updater(state))
  };
}

describe("buildFeatureTranscriptionConfig", () => {
  it("builds a typed runtime config from feature settings", () => {
    expect(
      buildFeatureTranscriptionConfig({
        provider: "whisper-api",
        baseUrl: "https://api.example.test",
        apiKey: "secret",
        model: "whisper-1",
        language: "en",
        prompt: "technical terms",
        enableWordTimestamps: true,
        extraParamsJson: "{\"temperature\":\"0\"}",
        fasterWhisperModel: "base",
        fasterWhisperModelDir: "",
        fasterWhisperDevice: "cpu",
        fasterWhisperVadFilter: true,
        fasterWhisperVadThreshold: 0.5,
        fasterWhisperVadMethod: "",
        fasterWhisperUseKim2: false
      })
    ).toMatchObject({
      id: "feature-transcription",
      name: "Speech Transcription",
      provider: "whisper-api",
      extraParams: { temperature: "0" }
    });
  });

  it("rejects invalid extra params JSON", () => {
    expect(() =>
      buildFeatureTranscriptionConfig({
        provider: "whisper-api",
        baseUrl: "",
        apiKey: "",
        model: "whisper-1",
        language: "",
        prompt: "",
        enableWordTimestamps: false,
        extraParamsJson: "{",
        fasterWhisperModel: "base",
        fasterWhisperModelDir: "",
        fasterWhisperDevice: "cpu",
        fasterWhisperVadFilter: true,
        fasterWhisperVadThreshold: 0.5,
        fasterWhisperVadMethod: "",
        fasterWhisperUseKim2: false
      })
    ).toThrow("Transcription extra params must be valid JSON");
  });
});

describe("startFeatureTranscription", () => {
  it("rejects when the transcription feature is disabled", async () => {
    const stateManager = createStateManager();
    const result = await startFeatureTranscription({
      stateManager: stateManager as never,
      cacheManager: { get: vi.fn(), set: vi.fn() } as never,
      transcriptionService: { transcribe: vi.fn() } as never,
      getSettings: () => ({ enabled: false, config: {} as never })
    });

    expect(result).toEqual({ ok: false, error: "Speech Transcription feature is disabled." });
    expect(stateManager.setTranscriptionStatus).toHaveBeenCalledWith(
      "error",
      "Speech Transcription feature is disabled.",
      "Speech Transcription"
    );
  });

  it("runs transcription and caches by fixed feature identity", async () => {
    const stateManager = createStateManager();
    const cacheManager = { get: vi.fn().mockResolvedValue(null), set: vi.fn().mockResolvedValue(undefined) };
    const track = { id: "track-1", sourceFile: "transcription", cues: [{ start: 0, end: 1000, text: "hello" }] };
    const transcriptionService = { transcribe: vi.fn().mockResolvedValue(track) };

    const result = await startFeatureTranscription({
      stateManager: stateManager as never,
      cacheManager: cacheManager as never,
      transcriptionService: transcriptionService as never,
      getSettings: () => ({
        enabled: true,
        config: {
          provider: "whisper-api",
          baseUrl: "",
          apiKey: "",
          model: "whisper-1",
          language: "",
          prompt: "",
          enableWordTimestamps: false,
          extraParamsJson: "{}",
          fasterWhisperModel: "base",
          fasterWhisperModelDir: "",
          fasterWhisperDevice: "cpu",
          fasterWhisperVadFilter: true,
          fasterWhisperVadThreshold: 0.5,
          fasterWhisperVadMethod: "",
          fasterWhisperUseKim2: false
        }
      })
    });

    expect(result).toEqual({ ok: true, trackId: "track-1" });
    expect(transcriptionService.transcribe).toHaveBeenCalledWith(
      "https://video.example.test/watch",
      expect.objectContaining({ id: "feature-transcription" })
    );
    expect(cacheManager.set.mock.calls[0][2]).toEqual({ tracks: [track] });
    expect(cacheManager.set.mock.calls[0][3]).toMatch(/^feature-transcription:/);
  });
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app exec vitest run src/main/features/transcriptionFeatureService.test.ts --project main
```

Expected: FAIL because the feature transcription files do not exist.

- [ ] **Step 3: Move config conversion to first-party naming**

Create `apps/desktop-app/src/main/features/transcriptionFeatureConfig.ts` by moving the current logic from `pluginTranscriptionConfig.ts` and changing exported names.

```ts
import type { TranscriptionConfig, TranscriptionFeatureConfig } from "../types.js";

export function buildFeatureTranscriptionConfig(config: TranscriptionFeatureConfig): TranscriptionConfig {
  return {
    id: "feature-transcription",
    name: "Speech Transcription",
    provider: providerValue(config),
    baseUrl: stringField(config, "baseUrl", "", "API base URL"),
    apiKey: stringField(config, "apiKey", "", "API key"),
    model: stringField(config, "model", "whisper-1", "model"),
    language: stringField(config, "language", "", "language"),
    prompt: stringField(config, "prompt", "", "prompt"),
    enableWordTimestamps: booleanField(config, "enableWordTimestamps", false, "word timestamps"),
    extraParams: parseExtraParamsJson(config),
    fasterWhisperModel: stringField(config, "fasterWhisperModel", "base", "faster-whisper model"),
    fasterWhisperModelDir: stringField(config, "fasterWhisperModelDir", "", "faster-whisper model directory"),
    fasterWhisperDevice: deviceValue(config),
    fasterWhisperVadFilter: booleanField(config, "fasterWhisperVadFilter", true, "faster-whisper VAD filter"),
    fasterWhisperVadThreshold: numberField(config, "fasterWhisperVadThreshold", 0.5, "faster-whisper VAD threshold"),
    fasterWhisperVadMethod: stringField(config, "fasterWhisperVadMethod", "", "faster-whisper VAD method"),
    fasterWhisperUseKim2: booleanField(config, "fasterWhisperUseKim2", false, "faster-whisper Kim2")
  };
}
```

Keep the existing helper behavior and error messages from `pluginTranscriptionConfig.ts`, but make the input type `TranscriptionFeatureConfig`.

- [ ] **Step 4: Implement first-party transcription orchestration**

Create `apps/desktop-app/src/main/features/transcriptionFeatureService.ts`.

```ts
import { createHash } from "node:crypto";
import type { TranscriptionFeatureSettings, SubtitleTrack } from "../types.js";
import type { StateManager } from "../stateManager.js";
import type { SubtitleCacheManager } from "../subtitleCacheManager.js";
import type { TranscriptionService } from "../transcriptionService.js";
import { buildFeatureTranscriptionConfig } from "./transcriptionFeatureConfig.js";

export interface TranscriptionFeatureServiceOptions {
  stateManager: StateManager;
  cacheManager: SubtitleCacheManager;
  transcriptionService: TranscriptionService;
  getSettings: () => TranscriptionFeatureSettings;
}

let isTranscribing = false;
const TRANSCRIPTION_FEATURE_NAME = "Speech Transcription";

export async function startFeatureTranscription(
  options: TranscriptionFeatureServiceOptions
): Promise<{ ok: boolean; error?: string; trackId?: string; cached?: boolean }> {
  const settings = options.getSettings();
  if (!settings.enabled) {
    const message = "Speech Transcription feature is disabled.";
    options.stateManager.setTranscriptionStatus("error", message, TRANSCRIPTION_FEATURE_NAME);
    return { ok: false, error: message };
  }

  const state = options.stateManager.getState();
  if (state.activeSource === "mediaserver") {
    const message = "Transcription is not supported in MediaServer mode.";
    options.stateManager.setTranscriptionStatus("error", message, TRANSCRIPTION_FEATURE_NAME);
    return { ok: false, error: message };
  }
  if (!state.videoUrl) {
    const message = "No active video to transcribe.";
    options.stateManager.setTranscriptionStatus("error", message, TRANSCRIPTION_FEATURE_NAME);
    return { ok: false, error: message };
  }
  if (isTranscribing) {
    const message = "Transcription already in progress.";
    options.stateManager.setTranscriptionStatus("running", message, TRANSCRIPTION_FEATURE_NAME);
    return { ok: false, error: message };
  }

  const targetVideoUrl = state.videoUrl;
  const runtimeConfig = buildFeatureTranscriptionConfig(settings.config);
  const cacheVariant = buildFeatureTranscriptionCacheVariant(settings.config);
  isTranscribing = true;
  try {
    options.stateManager.setTranscriptionStatus("running", null, TRANSCRIPTION_FEATURE_NAME);
    const cached = await options.cacheManager.get(targetVideoUrl, "transcription", cacheVariant);
    if (cached?.tracks?.length) {
      const cachedTrack = cached.tracks[0];
      applyTrackToState(options.stateManager, cachedTrack, TRANSCRIPTION_FEATURE_NAME);
      return { ok: true, trackId: cachedTrack.id, cached: true };
    }

    const track = await options.transcriptionService.transcribe(targetVideoUrl, runtimeConfig);
    await options.cacheManager.set(targetVideoUrl, "transcription", { tracks: [track] }, cacheVariant);

    const latestState = options.stateManager.getState();
    if (latestState.videoUrl !== targetVideoUrl) {
      options.stateManager.setTranscriptionStatus("success", "Transcription cached for previous video.", TRANSCRIPTION_FEATURE_NAME);
      return { ok: true, trackId: track.id, cached: true };
    }

    applyTrackToState(options.stateManager, track, TRANSCRIPTION_FEATURE_NAME);
    return { ok: true, trackId: track.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    options.stateManager.setTranscriptionStatus("error", message, TRANSCRIPTION_FEATURE_NAME);
    return { ok: false, error: message };
  } finally {
    isTranscribing = false;
  }
}

function applyTrackToState(stateManager: StateManager, track: SubtitleTrack, configName: string): void {
  stateManager.addOrReplaceSubtitleTrack(track, true);
  stateManager.updateState((draft) => {
    draft.status = "ready";
    draft.error = null;
  });
  stateManager.setTranscriptionStatus(
    "success",
    `Transcription completed (${track.cues.length} lines).`,
    configName
  );
}

function buildFeatureTranscriptionCacheVariant(config: TranscriptionFeatureSettings["config"]): string {
  const hash = createHash("sha256").update(JSON.stringify(config)).digest("hex");
  return `feature-transcription:${hash}`;
}
```

- [ ] **Step 5: Run focused tests**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app exec vitest run src/main/features/transcriptionFeatureService.test.ts --project main
pnpm --filter @immersive-subs/desktop-app typecheck:main
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/desktop-app/src/main/features/transcriptionFeatureConfig.ts apps/desktop-app/src/main/features/transcriptionFeatureService.ts apps/desktop-app/src/main/features/transcriptionFeatureService.test.ts
git commit -m "feat: add built-in transcription service"
```

---

### Task 4: Built-In Jellyfin / Emby Media Source

**Files:**
- Create: `apps/desktop-app/src/main/mediaSources/mediaSourceTypes.ts`
- Create: `apps/desktop-app/src/main/features/jellyfinEmbyMediaSource.ts`
- Create: `apps/desktop-app/src/main/features/jellyfinEmbyMediaSource.test.ts`
- Modify: `apps/desktop-app/src/main/mediaSources/mediaSourceController.ts`
- Modify: `apps/desktop-app/src/main/mediaSources/mediaSourceController.test.ts`

- [ ] **Step 1: Write failing Jellyfin / Emby tests**

Create `apps/desktop-app/src/main/features/jellyfinEmbyMediaSource.test.ts`.

```ts
import { describe, expect, it, vi } from "vitest";
import { JellyfinEmbyMediaSource } from "./jellyfinEmbyMediaSource.js";

function createSettings(overrides = {}) {
  return {
    enabled: true,
    config: {
      servers: [
        {
          id: "server-1",
          name: "Home",
          serverUrl: "https://media.example.test/",
          apiKey: "api-key",
          enabled: true
        }
      ]
    },
    ...overrides
  };
}

describe("JellyfinEmbyMediaSource", () => {
  it("does not claim messages while disabled", async () => {
    const source = new JellyfinEmbyMediaSource({
      getSettings: () => createSettings({ enabled: false }),
      fetch: vi.fn()
    });

    await expect(
      source.handleConnectionMessage({
        type: "video-context",
        tabId: 1,
        pageUrl: "https://media.example.test/web/index.html#!/details?id=item-1",
        videoSrc: null,
        title: "Movie",
        site: "Jellyfin"
      })
    ).resolves.toBeUndefined();
  });

  it("matches configured server URLs and emits source state", async () => {
    const source = new JellyfinEmbyMediaSource({
      getSettings: () => createSettings(),
      fetch: vi.fn().mockResolvedValue({ ok: true, json: async () => [] })
    });

    const result = await source.handleConnectionMessage({
      type: "video-context",
      tabId: 1,
      pageUrl: "https://media.example.test/web/index.html#!/details?id=item-1",
      videoSrc: "blob:https://media.example.test/video",
      title: "Movie",
      site: "Jellyfin"
    });

    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "sourceMatched",
          tabId: 1,
          pageUrl: expect.stringContaining("media.example.test"),
          site: "Jellyfin"
        })
      ])
    );
  });

  it("fetches sessions from enabled configured servers", async () => {
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        {
          Id: "session-1",
          DeviceName: "Chrome",
          Client: "Jellyfin Web",
          UserName: "cq",
          NowPlayingItem: {
            Id: "item-1",
            Name: "Episode",
            RunTimeTicks: 10_000_000,
            MediaSources: [{ Id: "media-1", MediaStreams: [{ Type: "Subtitle", Index: 2, Codec: "srt" }] }]
          },
          PlayState: { MediaSourceId: "media-1", PositionTicks: 1_000_000, IsPaused: false, PlaybackRate: 1 }
        }
      ]
    });
    const source = new JellyfinEmbyMediaSource({ getSettings: () => createSettings(), fetch });

    const result = await source.handleConnectionMessage({
      type: "video-context",
      tabId: 1,
      pageUrl: "https://media.example.test/web/index.html#!/details?id=item-1",
      videoSrc: null,
      title: "Episode",
      site: "Jellyfin"
    });

    expect(fetch).toHaveBeenCalledWith(expect.stringContaining("/Sessions"), expect.any(Object));
    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "sessionsChanged",
          sessions: [expect.objectContaining({ id: "server-1:session-1", serverType: "jellyfinemby" })]
        })
      ])
    );
  });
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app exec vitest run src/main/features/jellyfinEmbyMediaSource.test.ts --project main
```

Expected: FAIL because `JellyfinEmbyMediaSource` does not exist.

- [ ] **Step 3: Move media-source interface out of plugins**

Create `apps/desktop-app/src/main/mediaSources/mediaSourceTypes.ts`.

```ts
import type { MediaServerSessionSummary, SubtitleTrack } from "../types.js";

export type MediaSourceAdapterEvent =
  | {
      type: "sourceMatched";
      tabId: number;
      pageUrl: string | null;
      videoUrl: string | null;
      title: string | null;
      site: string | null;
      selectedSessionId?: string | null;
    }
  | {
      type: "sessionsChanged";
      sessions: MediaServerSessionSummary[];
    }
  | {
      type: "subtitleTracksLoaded";
      sessionId: string | null;
      tracks: SubtitleTrack[];
    }
  | {
      type: "playbackSnapshot";
      sessionId: string | null;
      positionMs: number | null;
      durationMs: number | null;
      playbackRate: number;
      paused: boolean;
    }
  | { type: "sourceDisconnected" }
  | { type: "error"; message: string };

export interface MediaSourceRuntime {
  sourceId: "jellyfinEmby";
  handleConnectionMessage?(message: unknown): Promise<unknown>;
  handleSettingsUpdated?(): Promise<void>;
  stop?(): Promise<void>;
}
```

Modify `mediaSourceController.ts` so `MediaSourceControllerOptions` uses:

```ts
getSources: () => MediaSourceRuntime[];
```

Rename internal state from `activeMediaSourcePluginKey` to `activeMediaSourceId`. Keep the existing event application logic.

- [ ] **Step 4: Implement Jellyfin / Emby as first-party TypeScript**

Create `apps/desktop-app/src/main/features/jellyfinEmbyMediaSource.ts`. Port the current behavior from `plugins/jellyfinemby/main.js` into a class.

```ts
import type { JellyfinEmbyFeatureSettings, JellyfinEmbyServerConfig } from "../types.js";
import type { MediaSourceAdapterEvent, MediaSourceRuntime } from "../mediaSources/mediaSourceTypes.js";

type FetchLike = typeof fetch;

export interface JellyfinEmbyMediaSourceOptions {
  getSettings: () => JellyfinEmbyFeatureSettings;
  fetch?: FetchLike;
}

const SESSION_REFRESH_MS = 2000;

export class JellyfinEmbyMediaSource implements MediaSourceRuntime {
  readonly sourceId = "jellyfinEmby" as const;
  private readonly fetchImpl: FetchLike;
  private readonly sessionsByServer = new Map<string, unknown[]>();
  private readonly lastFetchByServer = new Map<string, number>();

  constructor(private readonly options: JellyfinEmbyMediaSourceOptions) {
    this.fetchImpl = options.fetch ?? fetch;
  }

  async handleConnectionMessage(message: unknown): Promise<MediaSourceAdapterEvent[] | undefined> {
    const settings = this.options.getSettings();
    if (!settings.enabled) {
      return undefined;
    }
    const payload = requireObject(message, "connection message");
    if (payload.type !== "video-context" && payload.type !== "time-update" && payload.type !== "video-ended") {
      return undefined;
    }
    const servers = parseServers(settings.config);
    if (!servers.length) {
      return undefined;
    }

    if (payload.type === "video-context") {
      return this.handleVideoContext(payload, servers);
    }
    if (payload.type === "time-update") {
      return this.handleTimeUpdate(payload);
    }
    return [{ type: "sourceDisconnected" }];
  }

  async handleSettingsUpdated(): Promise<void> {
    this.sessionsByServer.clear();
    this.lastFetchByServer.clear();
  }

  async stop(): Promise<void> {
    this.sessionsByServer.clear();
    this.lastFetchByServer.clear();
  }

  private async handleVideoContext(
    payload: Record<string, unknown>,
    servers: JellyfinEmbyServerConfig[]
  ): Promise<MediaSourceAdapterEvent[] | undefined> {
    const server = findServer(servers, [payload.pageUrl, payload.videoSrc]);
    if (!server) {
      return undefined;
    }
    const sessions = await this.getSessions(server, false);
    return [
      {
        type: "sourceMatched",
        tabId: Number(payload.tabId),
        pageUrl: text(payload.pageUrl),
        videoUrl: text(payload.videoSrc),
        title: text(payload.title),
        site: text(payload.site),
        selectedSessionId: sessions[0]?.id ?? null
      },
      { type: "sessionsChanged", sessions }
    ];
  }

  private async handleTimeUpdate(payload: Record<string, unknown>): Promise<MediaSourceAdapterEvent[] | undefined> {
    const currentTime = typeof payload.currentTime === "number" ? payload.currentTime : null;
    const duration = typeof payload.duration === "number" ? payload.duration : null;
    if (currentTime === null) {
      return undefined;
    }
    return [
      {
        type: "playbackSnapshot",
        sessionId: null,
        positionMs: Math.round(currentTime * 1000),
        durationMs: duration === null ? null : Math.round(duration * 1000),
        playbackRate: typeof payload.playbackRate === "number" ? payload.playbackRate : 1,
        paused: Boolean(payload.paused)
      }
    ];
  }

  private async getSessions(server: JellyfinEmbyServerConfig, forceRefresh: boolean) {
    const lastFetch = this.lastFetchByServer.get(server.id) ?? 0;
    const cached = this.sessionsByServer.get(server.id);
    if (!forceRefresh && cached && Date.now() - lastFetch < SESSION_REFRESH_MS) {
      return cached;
    }
    const sessions = await fetchSessions(this.fetchImpl, server);
    this.sessionsByServer.set(server.id, sessions);
    this.lastFetchByServer.set(server.id, Date.now());
    return sessions;
  }
}
```

Add the same parsing helpers from the existing plugin source with TypeScript types: `text`, `requireObject`, `requireStringValue`, `requireBooleanValue`, `normalizeBaseUrl`, `normalizeServer`, `parseServers`, `parseOptionalUrl`, `findServer`, `fetchJson`, `fetchSessions`, `toSubtitleStream`, `collectSubtitleStreams`, and `toSessionSummary`.

- [ ] **Step 5: Update media source controller tests**

In `apps/desktop-app/src/main/mediaSources/mediaSourceController.test.ts`, replace plugin-key fixtures with source IDs.

Use this fixture shape:

```ts
const getSources = () => [
  {
    sourceId: "jellyfinEmby" as const,
    handleConnectionMessage
  }
];
```

Update assertions from `"xiitang/media-source"` to `"jellyfinEmby"` and from removed-plugin handling to `handleSourceSettingsChanged`.

- [ ] **Step 6: Run focused tests**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app exec vitest run src/main/features/jellyfinEmbyMediaSource.test.ts src/main/mediaSources/mediaSourceController.test.ts --project main
pnpm --filter @immersive-subs/desktop-app typecheck:main
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/desktop-app/src/main/mediaSources/mediaSourceTypes.ts apps/desktop-app/src/main/mediaSources/mediaSourceController.ts apps/desktop-app/src/main/mediaSources/mediaSourceController.test.ts apps/desktop-app/src/main/features/jellyfinEmbyMediaSource.ts apps/desktop-app/src/main/features/jellyfinEmbyMediaSource.test.ts
git commit -m "feat: add built-in jellyfin emby media source"
```

---

### Task 5: Main Process Wiring And IPC

**Files:**
- Modify: `apps/desktop-app/src/main/window/windowController.ts`
- Modify: `apps/desktop-app/src/main/ipc/ipcRouter.ts`
- Modify: `apps/desktop-app/src/main/ipc/handlers/transcriptionHandlers.ts`
- Modify: `apps/desktop-app/src/main/ipc/handlers/windowHandlers.ts`
- Modify: `apps/desktop-app/src/preload.cts`
- Delete: `apps/desktop-app/src/main/ipc/handlers/pluginHandlers.ts`
- Delete: `apps/desktop-app/src/main/pluginTranscriptionConfig.ts`
- Delete: `apps/desktop-app/src/main/pluginTranscriptionController.ts`

- [ ] **Step 1: Write failing IPC/preload boundary tests**

Add a test in the existing preload or store test surface that asserts plugin lifecycle APIs are absent from the exposed API type by using runtime bridge keys.

In `apps/desktop-app/src/renderer/stores/desktop.test.ts`, add:

```ts
it("does not depend on plugin lifecycle bridge methods during initialization", async () => {
  const bridge = createBridge();
  delete (bridge as Record<string, unknown>).getPluginCatalog;
  delete (bridge as Record<string, unknown>).onPluginCatalogChange;
  vi.stubGlobal("window", { usp: bridge });

  const store = useDesktopStore();
  await store.initialize();

  expect(store.initError).toBeNull();
  expect("pluginCatalog" in store).toBe(false);
});
```

This test will fail until Task 6 removes renderer plugin catalog state. Keep it staged with Task 5 only if the current store test helper can run without Task 6; otherwise add it in Task 6 and use this task's typecheck as the boundary verification.

- [ ] **Step 2: Remove plugin context from IPC router**

In `apps/desktop-app/src/main/ipc/ipcRouter.ts`, remove `PluginManager`, `registerPluginHandlers`, `pluginManager`, and `pushPluginCatalog`.

Add first-party services to `IpcContext`:

```ts
import type { WordLookupService } from "../features/wordLookupService.js";
import type { TranscriptionFeatureServiceOptions } from "../features/transcriptionFeatureService.js";

export type IpcContext = {
  stateManager: StateManager;
  connectionManager: ConnectionManager;
  settingsStore: SettingsStore;
  cacheManager: SubtitleCacheManager;
  releaseService: AppReleaseService;
  wordLookupService: WordLookupService;
  transcriptionFeature: TranscriptionFeatureServiceOptions;
  getSettings: () => AppSettings;
  setSettings: (settings: AppSettings) => void;
  updateAppSettings: (partial: Partial<AppSettings>) => AppSettings;
  displayManager: DisplayManager;
  wordLookupWindowManager: WordLookupWindowManager;
  getMainWindow: () => BrowserWindow | null;
  openSettingsWindow: () => BrowserWindow | null;
  logger: ReturnType<typeof createLogger>;
};
```

Keep handler registration list without `registerPluginHandlers`.

- [ ] **Step 3: Replace transcription handler**

In `apps/desktop-app/src/main/ipc/handlers/transcriptionHandlers.ts`, replace plugin orchestration with:

```ts
import { ipcMain } from "electron";
import { startFeatureTranscription } from "../../features/transcriptionFeatureService.js";
import { IpcContext } from "../ipcRouter.js";

export function registerTranscriptionHandlers(context: IpcContext) {
  ipcMain.handle("usp:start-transcription", async () => {
    return startFeatureTranscription(context.transcriptionFeature);
  });
}
```

- [ ] **Step 4: Add first-party word lookup handler**

Delete `pluginHandlers.ts`. Move only the `usp:word-lookup` IPC route into `windowHandlers.ts` or a new first-party handler. If adding to `windowHandlers.ts`, add:

```ts
ipcMain.handle("usp:word-lookup", async (_event, token: string) => {
  return context.wordLookupService.lookup(token);
});
```

Keep word lookup window routes unchanged.

- [ ] **Step 5: Wire feature services in WindowController**

In `apps/desktop-app/src/main/window/windowController.ts`:

- remove `PluginRegistryStore`, `PluginManager`, `getPluginRootPath`, and `getRegistryPath`
- add `private readonly wordLookupService: WordLookupService`
- add `private readonly jellyfinEmbyMediaSource: JellyfinEmbyMediaSource`
- instantiate both services before `MediaSourceController`
- pass `getSources: () => [this.jellyfinEmbyMediaSource]` to `MediaSourceController`
- pass `wordLookupService` and `transcriptionFeature` into `IpcRouter`
- remove `pushPluginCatalog`, `refreshPluginRuntimeSettings`, and `pluginManager.loadEnabledPlugins()`

Use this wiring shape:

```ts
this.wordLookupService = new WordLookupService(() => this.options.getSettings().features.wordLookup);
this.jellyfinEmbyMediaSource = new JellyfinEmbyMediaSource({
  getSettings: () => this.options.getSettings().features.jellyfinEmby
});
this.mediaSourceController = new MediaSourceController({
  bus: this.options.bus,
  stateManager: this.options.stateManager,
  getSources: () => [this.jellyfinEmbyMediaSource]
});
```

Update `replaceAppSettings` and `updateAppSettings` to notify the media source when settings change:

```ts
void this.jellyfinEmbyMediaSource.handleSettingsUpdated?.().catch((error) => {
  this.log.error("Failed to refresh Jellyfin / Emby settings", error);
});
```

Update `updateWordLookupPanelSize`:

```ts
const currentConfig = this.options.getSettings().features.wordLookup.config;
this.updateAppSettings({
  features: {
    wordLookup: {
      enabled: this.options.getSettings().features.wordLookup.enabled,
      config: {
        ...currentConfig,
        panelWidth: size.width,
        panelHeight: size.height
      }
    }
  }
});
```

- [ ] **Step 6: Remove plugin methods from preload**

In `apps/desktop-app/src/preload.cts`, remove:

- `PluginManifest` import
- `onPluginCatalogChange`
- `getPluginCatalog`
- `previewPluginInstall`
- `installPlugin`
- `updatePlugin`
- `deletePlugin`
- `enablePlugin`
- `disablePlugin`

Keep:

```ts
startTranscription: (): Promise<{ ok: boolean; error?: string; trackId?: string }> =>
  ipcRenderer.invoke("usp:start-transcription"),
lookupWord: (token: string): Promise<any> => ipcRenderer.invoke("usp:word-lookup", token),
```

- [ ] **Step 7: Run main and preload typechecks**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app typecheck:main
pnpm --filter @immersive-subs/desktop-app typecheck:preload
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/desktop-app/src/main/window/windowController.ts apps/desktop-app/src/main/ipc/ipcRouter.ts apps/desktop-app/src/main/ipc/handlers/transcriptionHandlers.ts apps/desktop-app/src/main/ipc/handlers/windowHandlers.ts apps/desktop-app/src/preload.cts
git rm apps/desktop-app/src/main/ipc/handlers/pluginHandlers.ts apps/desktop-app/src/main/pluginTranscriptionConfig.ts apps/desktop-app/src/main/pluginTranscriptionController.ts
git commit -m "feat: wire built-in features through ipc"
```

---

### Task 6: Renderer Store Feature State

**Files:**
- Create: `apps/desktop-app/src/renderer/stores/desktop/actions/featureActions.ts`
- Modify: `apps/desktop-app/src/renderer/stores/desktop.ts`
- Modify: `apps/desktop-app/src/renderer/stores/desktop/types.ts`
- Modify: `apps/desktop-app/src/renderer/stores/desktop/actions/initActions.ts`
- Modify: `apps/desktop-app/src/renderer/stores/desktop.test.ts`
- Delete: `apps/desktop-app/src/renderer/stores/desktop/actions/pluginActions.ts`

- [ ] **Step 1: Write failing store tests**

In `apps/desktop-app/src/renderer/stores/desktop.test.ts`, replace plugin catalog tests with feature settings tests.

```ts
it("initializes without requesting a plugin catalog", async () => {
  const bridge = createBridge();
  delete (bridge as Record<string, unknown>).getPluginCatalog;
  delete (bridge as Record<string, unknown>).onPluginCatalogChange;
  vi.stubGlobal("window", { usp: bridge });

  const store = useDesktopStore();
  await store.initialize();

  expect(store.initError).toBeNull();
  expect(store.settings?.features.wordLookup.enabled).toBe(false);
});

it("updates feature enabled state through settings", async () => {
  const bridge = createBridge();
  vi.stubGlobal("window", { usp: bridge });
  const store = useDesktopStore();
  await store.initialize();

  await store.setFeatureEnabled("wordLookup", true);

  expect(bridge.updateSettings).toHaveBeenCalledWith({
    features: {
      wordLookup: {
        enabled: true,
        config: store.settings!.features.wordLookup.config
      }
    }
  });
});
```

- [ ] **Step 2: Run store tests and verify they fail**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app exec vitest run src/renderer/stores/desktop.test.ts --project jsdom
```

Expected: FAIL because `pluginCatalog` and plugin initialization still exist and `setFeatureEnabled` does not exist.

- [ ] **Step 3: Add feature actions**

Create `apps/desktop-app/src/renderer/stores/desktop/actions/featureActions.ts`.

```ts
import type { FeatureId } from "../../../../common/featureDefaults";
import type { FeatureSettings } from "../../../../main/types";
import type { DesktopStoreThis } from "../types";

export async function setFeatureEnabled(
  this: DesktopStoreThis,
  featureId: FeatureId,
  enabled: boolean
) {
  if (!this.settings) {
    return;
  }
  const feature = this.settings.features[featureId];
  await this.updateSettings({
    features: {
      [featureId]: {
        enabled,
        config: feature.config
      }
    } as Partial<FeatureSettings>
  });
}

export async function setFeatureConfig<FeatureKey extends FeatureId>(
  this: DesktopStoreThis,
  featureId: FeatureKey,
  config: Partial<FeatureSettings[FeatureKey]["config"]>
) {
  if (!this.settings) {
    return;
  }
  const feature = this.settings.features[featureId];
  await this.updateSettings({
    features: {
      [featureId]: {
        enabled: feature.enabled,
        config: {
          ...feature.config,
          ...config
        }
      }
    } as Partial<FeatureSettings>
  });
}

export const featureActions = {
  setFeatureEnabled,
  setFeatureConfig
};
```

- [ ] **Step 4: Remove plugin catalog state and actions**

In `desktop.ts`:

- remove `PluginCatalogRow` import
- remove `pluginCatalog` from state
- replace `pluginActions` import with `featureActions`
- replace `...pluginActions` with `...featureActions`

In `types.ts`:

- remove `PluginSettingsRecord`, `PluginCatalogRow`, and `PluginManifest` imports
- remove plugin action signatures
- add:

```ts
setFeatureEnabled(featureId: FeatureId, enabled: boolean): Promise<void>;
setFeatureConfig<FeatureKey extends FeatureId>(
  featureId: FeatureKey,
  config: Partial<FeatureSettings[FeatureKey]["config"]>
): Promise<void>;
```

In `initActions.ts`, remove:

```ts
await this.refreshPluginCatalog();
window.usp.onPluginCatalogChange((catalog) => {
  this.pluginCatalog = catalog;
});
```

- [ ] **Step 5: Delete plugin actions file**

Run:

```bash
git rm apps/desktop-app/src/renderer/stores/desktop/actions/pluginActions.ts
```

Expected: file removed.

- [ ] **Step 6: Run focused renderer tests**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app exec vitest run src/renderer/stores/desktop.test.ts --project jsdom
pnpm --filter @immersive-subs/desktop-app typecheck:renderer
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/desktop-app/src/renderer/stores/desktop.ts apps/desktop-app/src/renderer/stores/desktop/types.ts apps/desktop-app/src/renderer/stores/desktop/actions/initActions.ts apps/desktop-app/src/renderer/stores/desktop/actions/featureActions.ts apps/desktop-app/src/renderer/stores/desktop.test.ts
git commit -m "feat: derive renderer feature state from settings"
```

---

### Task 7: Features Settings UI

**Files:**
- Create: `apps/desktop-app/src/renderer/components/settings/SettingsFeatures.vue`
- Create: `apps/desktop-app/src/renderer/components/settings/WordLookupFeatureSettings.vue`
- Create: `apps/desktop-app/src/renderer/components/settings/TranscriptionFeatureSettings.vue`
- Create: `apps/desktop-app/src/renderer/components/settings/JellyfinEmbyFeatureSettings.vue`
- Create: `apps/desktop-app/src/renderer/components/settings/SettingsFeatures.test.ts`
- Modify: `apps/desktop-app/src/renderer/components/settings/settingsSections.ts`
- Modify: `apps/desktop-app/src/renderer/components/settings/SettingsNav.vue`
- Modify: `apps/desktop-app/src/renderer/components/icons/index.ts`
- Modify: `apps/desktop-app/src/renderer/components/settings/SettingsWindowShell.vue`
- Modify: `apps/desktop-app/src/renderer/components/settings/SettingsWindowShell.test.ts`
- Modify: `apps/desktop-app/src/renderer/components/settings/SettingsWindowShell.browser.test.ts`
- Modify: `apps/desktop-app/src/renderer/locales/en.json`
- Modify: `apps/desktop-app/src/renderer/locales/zh.json`
- Delete: `apps/desktop-app/src/renderer/components/settings/SettingsPlugins.vue`
- Delete: `apps/desktop-app/src/renderer/components/settings/SettingsPlugins.test.ts`
- Delete: `apps/desktop-app/src/renderer/components/settings/PluginSettingsSchema.vue`
- Delete: `apps/desktop-app/src/renderer/components/settings/PluginSettingsSchema.test.ts`
- Delete: `apps/desktop-app/src/renderer/components/settings/pluginSettingsSectionKey.ts`

- [ ] **Step 1: Write failing Features UI tests**

Create `apps/desktop-app/src/renderer/components/settings/SettingsFeatures.test.ts`.

```ts
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDefaultAppSettings } from "../../../common/defaultSettings";
import SettingsFeatures from "./SettingsFeatures.vue";
import { useDesktopStore } from "../../stores/desktop";

function seedStore(language = "en") {
  const store = useDesktopStore();
  store.settings = createDefaultAppSettings({
    networkAuthToken: "0123456789abcdef0123456789abcdef"
  });
  store.settings.global.language = language;
  vi.spyOn(store, "setFeatureEnabled").mockResolvedValue();
  vi.spyOn(store, "setFeatureConfig").mockResolvedValue();
  return store;
}

describe("SettingsFeatures", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    setActivePinia(createPinia());
  });

  it("renders fixed built-in features without plugin lifecycle controls", async () => {
    const store = seedStore();
    const wrapper = mount(SettingsFeatures);

    expect(wrapper.text()).toContain("Word Lookup");
    expect(wrapper.text()).toContain("Speech Transcription");
    expect(wrapper.text()).toContain("Jellyfin / Emby");
    expect(wrapper.text()).not.toContain("Install");
    expect(wrapper.text()).not.toContain("Update");
    expect(wrapper.text()).not.toContain("Delete");
    expect(wrapper.text()).not.toContain("Permissions");

    await wrapper.get('[data-testid="feature-enabled-wordLookup"]').setValue(true);
    expect(store.setFeatureEnabled).toHaveBeenCalledWith("wordLookup", true);
  });

  it("updates Word Lookup config through explicit controls", async () => {
    const store = seedStore();
    const wrapper = mount(SettingsFeatures);

    await wrapper.get('[data-testid="feature-word-lookup-path"]').setValue("/tmp/words.jsonl");

    expect(store.setFeatureConfig).toHaveBeenCalledWith("wordLookup", { wordListPath: "/tmp/words.jsonl" });
  });

  it("adds Jellyfin / Emby server rows", async () => {
    const store = seedStore();
    const wrapper = mount(SettingsFeatures);

    await wrapper.get('[data-testid="feature-jellyfin-emby-add-server"]').trigger("click");

    expect(store.setFeatureConfig).toHaveBeenCalledWith("jellyfinEmby", {
      servers: [
        {
          id: expect.any(String),
          name: "",
          serverUrl: "",
          apiKey: "",
          enabled: true
        }
      ]
    });
  });
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app exec vitest run src/renderer/components/settings/SettingsFeatures.test.ts --project jsdom
```

Expected: FAIL because `SettingsFeatures.vue` does not exist.

- [ ] **Step 3: Add Features section and icon**

In `apps/desktop-app/src/renderer/components/icons/index.ts`, add a non-plugin icon:

```ts
import { SlidersHorizontal } from "@lucide/vue";
export const IconFeatures = icon(SlidersHorizontal);
```

In `settingsSections.ts`, replace plugins with features:

```ts
{
  id: "features",
  labelKey: "section-features",
  icon: "features"
}

export type SettingsNavIconKey =
  | "settings"
  | "profiles"
  | "features"
  | "transcription"
  | "wordLookup"
  | "mediaServer";
```

In `SettingsNav.vue`, replace `IconPlug` with `IconFeatures`:

```ts
import { IconBookOpen, IconFeatures, IconMic, IconServer, IconSettings, IconUser } from "../icons";

const navIconComponents: Partial<Record<SettingsNavIconKey, Component>> = {
  features: IconFeatures,
  mediaServer: IconServer,
  profiles: IconUser,
  settings: IconSettings,
  transcription: IconMic,
  wordLookup: IconBookOpen
};
```

- [ ] **Step 4: Add locale strings**

In `en.json`, replace plugin strings with feature strings:

```json
"section-features": "Features",
"features-section-title": "Features",
"feature-enabled": "Enabled",
"feature-disabled": "Disabled",
"feature-word-lookup-title": "Word Lookup",
"feature-word-lookup-description": "Look up subtitle words from a JSONL word list.",
"feature-word-lookup-path": "Word List Path",
"feature-word-lookup-trigger": "Trigger Key",
"feature-word-lookup-panel-width": "Panel Width",
"feature-word-lookup-panel-height": "Panel Height",
"feature-transcription-title": "Speech Transcription",
"feature-transcription-description": "Transcribe the active browser video through the desktop transcription runtime.",
"feature-jellyfin-emby-title": "Jellyfin / Emby",
"feature-jellyfin-emby-description": "Connect configured Jellyfin or Emby servers as media sources."
```

In `zh.json`, add matching Chinese strings:

```json
"section-features": "功能",
"features-section-title": "功能",
"feature-enabled": "已启用",
"feature-disabled": "已禁用",
"feature-word-lookup-title": "Word Lookup",
"feature-word-lookup-description": "从 JSONL 词库查询字幕单词。",
"feature-word-lookup-path": "词库路径",
"feature-word-lookup-trigger": "触发键",
"feature-word-lookup-panel-width": "面板宽度",
"feature-word-lookup-panel-height": "面板高度",
"feature-transcription-title": "Speech Transcription",
"feature-transcription-description": "通过桌面端转录运行时转录当前浏览器视频。",
"feature-jellyfin-emby-title": "Jellyfin / Emby",
"feature-jellyfin-emby-description": "连接配置好的 Jellyfin 或 Emby 服务器作为媒体源。"
```

Remove obsolete `plugin-*` locale keys after source references are gone.

- [ ] **Step 5: Implement SettingsFeatures shell**

Create `SettingsFeatures.vue`.

```vue
<template>
  <UiSection :title="t('features-section-title')">
    <div class="features-list">
      <FeatureSection
        feature-id="wordLookup"
        :title="t('feature-word-lookup-title')"
        :description="t('feature-word-lookup-description')"
      >
        <WordLookupFeatureSettings />
      </FeatureSection>
      <FeatureSection
        feature-id="transcription"
        :title="t('feature-transcription-title')"
        :description="t('feature-transcription-description')"
      >
        <TranscriptionFeatureSettings />
      </FeatureSection>
      <FeatureSection
        feature-id="jellyfinEmby"
        :title="t('feature-jellyfin-emby-title')"
        :description="t('feature-jellyfin-emby-description')"
      >
        <JellyfinEmbyFeatureSettings />
      </FeatureSection>
    </div>
  </UiSection>
</template>
```

If creating a local `FeatureSection` component inside this file, make it render `UiListItem`, a `UiSwitch` with `data-testid="feature-enabled-${featureId}"`, and a default slot for the feature settings.

- [ ] **Step 6: Implement explicit feature settings components**

`WordLookupFeatureSettings.vue` uses `store.settings.features.wordLookup.config` and calls:

```ts
store.setFeatureConfig("wordLookup", { wordListPath: String(value) });
store.setFeatureConfig("wordLookup", { modifierKey: value as "alt" | "ctrl" | "shift" });
```

Panel width and height use local numeric drafts and persist only valid bounded values. Do not coerce empty input with `Number(value)`.

`TranscriptionFeatureSettings.vue` uses explicit controls for provider, base URL, API key, model, language, prompt, word timestamps, extra params JSON, Faster-Whisper model fields, device, VAD filter, VAD threshold, VAD method, and Kim2.

`JellyfinEmbyFeatureSettings.vue` uses the same server row shape from the old schema renderer:

```ts
function createServerRecord() {
  return {
    id: crypto.randomUUID(),
    name: "",
    serverUrl: "",
    apiKey: "",
    enabled: true
  };
}

function addServer() {
  store.setFeatureConfig("jellyfinEmby", {
    servers: [...servers.value, createServerRecord()]
  });
}
```

- [ ] **Step 7: Update settings shell**

In `SettingsWindowShell.vue`:

- import `SettingsFeatures`
- remove `SettingsPlugins`, `PluginSettingsSchema`, and dynamic plugin sections
- map `features` to `SettingsFeatures`

```ts
const hostComponentMap: Record<string, unknown> = {
  general: SettingsGlobal,
  profiles: SettingsProfiles,
  features: SettingsFeatures
};
```

`allSections` becomes `hostSections` directly.

- [ ] **Step 8: Delete old plugin settings UI**

Run:

```bash
git rm apps/desktop-app/src/renderer/components/settings/SettingsPlugins.vue apps/desktop-app/src/renderer/components/settings/SettingsPlugins.test.ts apps/desktop-app/src/renderer/components/settings/PluginSettingsSchema.vue apps/desktop-app/src/renderer/components/settings/PluginSettingsSchema.test.ts apps/desktop-app/src/renderer/components/settings/pluginSettingsSectionKey.ts
```

Expected: files removed.

- [ ] **Step 9: Run focused settings tests**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app exec vitest run src/renderer/components/settings/SettingsFeatures.test.ts src/renderer/components/settings/SettingsWindowShell.test.ts --project jsdom
pnpm --filter @immersive-subs/desktop-app exec vitest run src/renderer/components/settings/SettingsWindowShell.browser.test.ts --project browser
pnpm --filter @immersive-subs/desktop-app typecheck:renderer
```

Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add apps/desktop-app/src/renderer/components/icons/index.ts apps/desktop-app/src/renderer/components/settings/settingsSections.ts apps/desktop-app/src/renderer/components/settings/SettingsNav.vue apps/desktop-app/src/renderer/components/settings/SettingsWindowShell.vue apps/desktop-app/src/renderer/components/settings/SettingsWindowShell.test.ts apps/desktop-app/src/renderer/components/settings/SettingsWindowShell.browser.test.ts apps/desktop-app/src/renderer/components/settings/SettingsFeatures.vue apps/desktop-app/src/renderer/components/settings/WordLookupFeatureSettings.vue apps/desktop-app/src/renderer/components/settings/TranscriptionFeatureSettings.vue apps/desktop-app/src/renderer/components/settings/JellyfinEmbyFeatureSettings.vue apps/desktop-app/src/renderer/components/settings/SettingsFeatures.test.ts apps/desktop-app/src/renderer/locales/en.json apps/desktop-app/src/renderer/locales/zh.json
git commit -m "feat: replace plugin settings with features"
```

---

### Task 8: Subtitle Renderer Integration

**Files:**
- Modify: `apps/desktop-app/src/renderer/components/subtitle/SubtitleView.vue`
- Modify: `apps/desktop-app/src/renderer/components/subtitle/SubtitleView.browser.test.ts`
- Modify: `apps/desktop-app/src/renderer/test/topPanelTestData.ts`
- Modify other renderer tests that still seed `plugins`.

- [ ] **Step 1: Write failing subtitle tests for feature-derived availability**

In `SubtitleView.browser.test.ts`, replace plugin catalog setup with `settings.features`.

```ts
it("hides transcription controls when the transcription feature is disabled", async () => {
  const wrapper = await mountSubtitleView({
    settings: {
      ...createSettings(),
      features: {
        ...createSettings().features,
        transcription: {
          ...createSettings().features.transcription,
          enabled: false
        }
      }
    }
  });

  expect(wrapper.get('[data-testid="transcription-enabled"]').text()).toBe("false");
});

it("enables word lookup when the word lookup feature is enabled", async () => {
  const settings = createSettings();
  settings.features.wordLookup = {
    enabled: true,
    config: {
      wordListPath: "/tmp/words.jsonl",
      modifierKey: "alt",
      panelWidth: 360,
      panelHeight: 300
    }
  };

  const wrapper = await mountSubtitleView({ settings });

  expect(wrapper.vm).toBeTruthy();
});
```

- [ ] **Step 2: Run focused subtitle tests and verify they fail**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app exec vitest run src/renderer/components/subtitle/SubtitleView.browser.test.ts --project browser
```

Expected: FAIL because `SubtitleView.vue` still derives availability from `pluginCatalog`.

- [ ] **Step 3: Update `SubtitleView.vue`**

Replace plugin catalog computed values with fixed feature settings:

```ts
const transcriptionFeature = computed(() => store.settings?.features.transcription ?? null);
const wordLookupFeature = computed(() => store.settings?.features.wordLookup ?? null);
const transcriptionEnabled = computed(() => Boolean(transcriptionFeature.value?.enabled));
const wordLookupEnabled = computed(() => Boolean(wordLookupFeature.value?.enabled));

const wordLookupConfig = computed(() => {
  const config = wordLookupFeature.value?.config ?? DEFAULT_WORD_LOOKUP_FEATURE_CONFIG;
  return {
    modifierKey: config.modifierKey,
    panelSize: {
      width: config.panelWidth,
      height: config.panelHeight
    }
  };
});

const transcriptionConfigs = computed(() => (
  transcriptionEnabled.value
    ? [{ id: "feature-transcription", name: "Speech Transcription" }]
    : []
));
```

Remove plugin key references from active transcription ID handling:

```ts
const activeTranscriptionId = computed({
  get: () => (transcriptionEnabled.value ? "feature-transcription" : ""),
  set: () => {}
});
```

- [ ] **Step 4: Update renderer test fixtures**

Replace seeded `plugins: {}` with `features: cloneFeatureSettings()` or `createDefaultAppSettings(...).features` in:

```bash
rg -n "plugins:" apps/desktop-app/src/renderer -g '*.ts' -g '*.vue'
```

Expected remaining matches after cleanup: none in renderer source, except comments in obsolete docs if any remain.

- [ ] **Step 5: Run focused subtitle and renderer tests**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app exec vitest run src/renderer/components/subtitle/SubtitleView.browser.test.ts --project browser
pnpm --filter @immersive-subs/desktop-app typecheck:renderer
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/desktop-app/src/renderer/components/subtitle/SubtitleView.vue apps/desktop-app/src/renderer/components/subtitle/SubtitleView.browser.test.ts apps/desktop-app/src/renderer/test/topPanelTestData.ts
git commit -m "feat: drive subtitle features from settings"
```

---

### Task 9: Delete Plugin Platform And Distribution

**Files:**
- Delete: `apps/desktop-app/src/main/plugins/`
- Delete: `apps/desktop-app/src/common/recommendedPlugins.ts`
- Delete: `plugins/`
- Delete: `plugin-repository/`
- Delete: `scripts/package-plugins.mjs`
- Delete: `docs/superpowers/specs/2026-06-07-dynamic-plugin-system-design.md`
- Delete: `docs/superpowers/plans/2026-06-07-dynamic-plugin-system-implementation-design.md`
- Modify: `package.json`
- Modify: `scripts/release/check.mjs`
- Modify: `scripts/check-silent-catches.mjs`
- Modify: `scripts/release/release-scripts.test.mjs`
- Modify: `docs/superpowers/specs/2026-06-10-release-update-system-design.md`

- [ ] **Step 1: Remove plugin platform files**

Run:

```bash
git rm -r apps/desktop-app/src/main/plugins plugins plugin-repository
git rm apps/desktop-app/src/common/recommendedPlugins.ts scripts/package-plugins.mjs
git rm docs/superpowers/specs/2026-06-07-dynamic-plugin-system-design.md docs/superpowers/plans/2026-06-07-dynamic-plugin-system-implementation-design.md
```

Expected: git stages all removed plugin platform and distribution files.

- [ ] **Step 2: Remove plugin build scripts**

In root `package.json`, change:

```json
"build": "pnpm --filter @immersive-subs/contracts build && pnpm --filter @immersive-subs/desktop-app build:app && pnpm --filter @immersive-subs/extension build:app"
```

Remove:

```json
"build:plugins": "node ./scripts/package-plugins.mjs"
```

In `scripts/release/check.mjs`, remove the `pnpm build:plugins` and `git diff --exit-code -- plugin-repository` calls. The file should start release checks like this:

```js
const version = assertUnifiedPackageVersions(process.cwd(), expectedVersion);

if (fileExists("releases/latest.json")) {
  validateReleaseManifest(readJson("releases/latest.json"));
}
```

In `scripts/check-silent-catches.mjs`, change:

```js
const SCAN_DIRS = ["apps/desktop-app/src", "apps/extension/src", "packages"];
```

- [ ] **Step 3: Update release docs and tests**

In `docs/superpowers/specs/2026-06-10-release-update-system-design.md`, replace the `Plugin Boundary` section with:

```md
## Built-In Features Boundary

Built-in Features release with the desktop app.

The desktop release manifest does not list separate feature packages, feature versions, feature install URLs, or feature update status. Feature code is part of the desktop artifact and updates only through a desktop release.
```

In `scripts/release/release-scripts.test.mjs`, remove assertions that expect `build:plugins` or `plugin-repository` checks. Add an assertion that release check no longer references plugin artifacts:

```js
test("release check does not validate plugin artifacts", () => {
  const source = readFileSync(path.join(repoRoot, "scripts/release/check.mjs"), "utf-8");
  assert.equal(source.includes("build:plugins"), false);
  assert.equal(source.includes("plugin-repository"), false);
});
```

- [ ] **Step 4: Run plugin-boundary searches**

Run:

```bash
rg -n "main/plugins|pluginCatalog|PluginCatalog|PluginManager|PluginManifest|PluginSettingsSchema|SettingsPlugins|plugin-repository|build:plugins|preview-plugin-install|install-plugin|update-plugin|delete-plugin|enable-plugin|disable-plugin|recommendedPlugins" apps package.json scripts docs/superpowers
```

Expected: no matches in active source, package scripts, release scripts, or current built-in feature docs. Matches in security scan artifacts are acceptable only if the search includes `docs/security-scans`, which this command does not.

- [ ] **Step 5: Run release script tests**

Run:

```bash
pnpm test:release-scripts
pnpm lint:silent-catches
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add package.json scripts/release/check.mjs scripts/check-silent-catches.mjs scripts/release/release-scripts.test.mjs docs/superpowers/specs/2026-06-10-release-update-system-design.md
git commit -m "chore: remove plugin distribution pipeline"
```

---

### Task 10: Final Typecheck, Tests, Build, And Source Boundary

**Files:**
- Modify only files needed to fix failures found by final verification.

- [ ] **Step 1: Run source-boundary checks**

Run:

```bash
rg -n "plugins|plugin|Plugin" apps/desktop-app/src apps/extension/src packages package.json scripts docs/superpowers/specs/2026-06-15-built-in-features-design.md
```

Expected: no active source or user-facing settings references to the removed plugin platform. Acceptable matches must be intentionally reviewed before completion; examples are the built-in feature spec describing the removed model.

Run:

```bash
rg -n "settings\\.plugins|pluginCatalog|onPluginCatalogChange|getPluginCatalog|previewPluginInstall|installPlugin|updatePlugin|deletePlugin|enablePlugin|disablePlugin" apps/desktop-app/src
```

Expected: no output.

- [ ] **Step 2: Run focused feature tests**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app exec vitest run src/main/settings/appSettingsSanitizer.test.ts src/main/features/wordLookupService.test.ts src/main/features/transcriptionFeatureService.test.ts src/main/features/jellyfinEmbyMediaSource.test.ts src/main/mediaSources/mediaSourceController.test.ts --project main
pnpm --filter @immersive-subs/desktop-app exec vitest run src/renderer/stores/desktop.test.ts src/renderer/components/settings/SettingsFeatures.test.ts src/renderer/components/settings/SettingsWindowShell.test.ts --project jsdom
pnpm --filter @immersive-subs/desktop-app exec vitest run src/renderer/components/settings/SettingsWindowShell.browser.test.ts src/renderer/components/subtitle/SubtitleView.browser.test.ts --project browser
```

Expected: PASS.

- [ ] **Step 3: Run full repository checks**

Run:

```bash
pnpm typecheck
pnpm test
pnpm build
git diff --check
```

Expected: PASS and no whitespace errors.

- [ ] **Step 4: Inspect final changed file list**

Run:

```bash
git status --short
git diff --stat
```

Expected: only files related to built-in features, plugin-platform removal, release script cleanup, and docs are changed.

- [ ] **Step 5: Commit final fixes**

If Step 3 or Step 4 required fixes, commit them:

```bash
git add .
git commit -m "test: verify built-in features replacement"
```

If there are no extra fixes after Task 9, skip this commit.

---

## Self-Review Checklist For Implementer

- [ ] `settings.plugins` no longer exists in active source.
- [ ] `settings.features.wordLookup`, `settings.features.transcription`, and `settings.features.jellyfinEmby` exist in default settings and sanitizer tests.
- [ ] Renderer `Features` page has no install, update, delete, version, publisher, package, or permission UI.
- [ ] Word Lookup, Speech Transcription, and Jellyfin / Emby are each enabled/disabled through fixed feature settings.
- [ ] No JavaScript feature code is loaded from `userData`.
- [ ] No `plugins/` or `plugin-repository/` distribution path remains.
- [ ] Root build and release check do not run plugin packaging.
- [ ] Full typecheck, test, build, and source-boundary searches pass.
