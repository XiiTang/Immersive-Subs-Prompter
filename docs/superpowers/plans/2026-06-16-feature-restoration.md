# Feature Restoration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore full Word Lookup status controls, multi-config Speech Transcription, Faster-Whisper management, and multi-server Jellyfin / Emby settings inside the current fixed built-in feature architecture.

**Architecture:** Keep `settings.features` as the only feature persistence boundary. Main-process behavior stays in explicit first-party services and IPC handlers; renderer settings pages use the current UI foundation and feature actions. The old plugin platform, `settings.plugins`, plugin catalog, plugin runtime, and old data paths stay absent.

**Tech Stack:** Electron main/preload, Vue 3, Pinia, TypeScript, Vitest projects `main`, `jsdom`, and `browser`, existing renderer UI components.

---

## Scope Check

This is one cohesive feature restoration because all four requested surfaces share the same `settings.features` boundary and settings navigation model. The work should not be split into independent specs unless execution needs scheduling separation. Each task below leaves the repo in a testable state and avoids compatibility or migration code.

## File Structure

Create these files:

- `apps/desktop-app/src/main/fasterWhisperManager.ts` - app-managed Faster-Whisper paths, binary/model status, downloads, and progress callbacks.
- `apps/desktop-app/src/main/fasterWhisperManager.test.ts` - manager tests with mocked filesystem/fetch where practical.
- `apps/desktop-app/src/main/ipc/handlers/fasterWhisperHandlers.ts` - explicit IPC handlers for Faster-Whisper status, list, download, and progress.
- `apps/desktop-app/src/main/ipc/handlers/fasterWhisperHandlers.test.ts` - IPC handler result-shape tests with a fake manager.
- `apps/desktop-app/src/renderer/components/settings/transcription/composables/useTranscriptionConfig.ts` - renderer helper for active config, add/delete, field setters, and JSON params.
- `apps/desktop-app/src/renderer/components/settings/transcription/composables/useFasterWhisper.ts` - renderer helper for paths/status/download progress and model selection.
- `apps/desktop-app/src/renderer/components/settings/transcription/FasterWhisperBinariesCard.vue` - binary status and download actions.
- `apps/desktop-app/src/renderer/components/settings/transcription/FasterWhisperModelsCard.vue` - model download and model directory controls.
- `apps/desktop-app/src/renderer/components/settings/transcription/FasterWhisperRuntimeCard.vue` - provider runtime options for downloaded/custom models, device, VAD, Kim2, language, and prompt.
- `apps/desktop-app/src/renderer/components/settings/transcription/TranscriptionConfigList.vue` - left-side transcription config list.
- `apps/desktop-app/src/renderer/components/settings/transcription/WhisperApiForm.vue` - Whisper API fields.

Modify these files:

- `apps/desktop-app/src/main/types.ts` - make `TranscriptionConfig` complete and make `TranscriptionFeatureSettings` a multi-config record.
- `apps/desktop-app/src/common/featureDefaults.ts` - default one complete transcription config and clone config arrays deeply.
- `apps/desktop-app/src/common/transcriptionDefaults.ts` - export a reusable base transcription config with `ytDlpArgs` and `fasterWhisperBinary`.
- `apps/desktop-app/src/main/settings/appSettingsSanitizer.ts` - validate final multi-config transcription shape.
- `apps/desktop-app/src/main/settings/appSettingsSanitizer.test.ts` - final settings-shape tests.
- `apps/desktop-app/src/main/features/transcriptionFeatureConfig.ts` - resolve and validate the active transcription config.
- `apps/desktop-app/src/main/features/transcriptionFeatureService.ts` - use active config and active config name for status/cache.
- `apps/desktop-app/src/main/features/transcriptionFeatureService.test.ts` - active config and runtime rejection tests.
- `apps/desktop-app/src/main/transcriptionService.ts` - honor `ytDlpArgs` and `fasterWhisperBinary`.
- `apps/desktop-app/src/main/transcriptionService.test.ts` - `ytDlpArgs` and `fasterWhisperBinary` tests.
- `apps/desktop-app/src/main/features/wordLookupService.ts` - restore refresh/status behavior.
- `apps/desktop-app/src/main/features/wordLookupService.test.ts` - status and refresh tests.
- `apps/desktop-app/src/main/ipc/ipcRouter.ts` - include Faster-Whisper manager in context and register its handlers.
- `apps/desktop-app/src/main/ipc/handlers/settingsHandlers.ts` - select word-list file.
- `apps/desktop-app/src/main/ipc/handlers/windowHandlers.ts` - Word Lookup refresh/status handlers.
- `apps/desktop-app/src/main/window/windowController.ts` - instantiate Faster-Whisper manager and pass it to IPC.
- `apps/desktop-app/src/preload.cts` - expose Word Lookup and Faster-Whisper first-party APIs.
- `apps/desktop-app/src/renderer/stores/desktop/actions/featureActions.ts` - feature-specific helpers for active transcription config, config list edits, and server list edits.
- `apps/desktop-app/src/renderer/stores/desktop/types.ts` - action types for the new helpers.
- `apps/desktop-app/src/renderer/stores/desktop.test.ts` - store action tests.
- `apps/desktop-app/src/renderer/components/settings/WordLookupFeatureSettings.vue` - file selection, refresh, and status UI.
- `apps/desktop-app/src/renderer/components/settings/TranscriptionFeatureSettings.vue` - split multi-config UI.
- `apps/desktop-app/src/renderer/components/settings/JellyfinEmbyFeatureSettings.vue` - split server-list UI.
- `apps/desktop-app/src/renderer/components/settings/SettingsFeatures.test.ts` - jsdom coverage for all three detail pages.
- `apps/desktop-app/src/renderer/components/subtitle/SubtitleView.vue` - transcription config options and active config selection from feature settings.
- `apps/desktop-app/src/renderer/components/subtitle/SubtitleView.browser.test.ts` - subtitle control config selector tests.
- `apps/desktop-app/src/renderer/locales/en.json` - new feature labels.
- `apps/desktop-app/src/renderer/locales/zh.json` - matching Chinese labels.
- `apps/desktop-app/src/renderer/i18nCoverage.test.ts` - require the new labels in both dictionaries.

Do not create or restore:

- `settings.plugins`
- plugin catalog state or IPC
- plugin lifecycle UI
- plugin runtime host/sandbox
- plugin package/repository files
- old settings migrations or stale data readers

---

### Task 1: Final Multi-Config Feature Settings Model

**Files:**
- Modify: `apps/desktop-app/src/main/types.ts`
- Modify: `apps/desktop-app/src/common/transcriptionDefaults.ts`
- Modify: `apps/desktop-app/src/common/featureDefaults.ts`
- Modify: `apps/desktop-app/src/main/settings/appSettingsSanitizer.ts`
- Test: `apps/desktop-app/src/main/settings/appSettingsSanitizer.test.ts`

- [ ] **Step 1: Write failing sanitizer tests for the final transcription settings shape**

Add these tests inside `describe("sanitizeSettings")` in `apps/desktop-app/src/main/settings/appSettingsSanitizer.test.ts`:

```ts
it("keeps multi-config transcription feature settings", () => {
  const settings = DEFAULT_SETTINGS_FACTORY();

  expect(settings.features.transcription).toEqual({
    enabled: false,
    activeConfigId: "default-transcription",
    configs: [
      expect.objectContaining({
        id: "default-transcription",
        name: "Default Whisper API",
        provider: "whisper-api",
        baseUrl: "https://api.openai.com/v1",
        model: "whisper-1",
        extraParams: {},
        ytDlpArgs: expect.stringContaining("--extract-audio"),
        fasterWhisperBinary: "faster-whisper"
      })
    ]
  });
  expect(sanitizeSettings(settings).features.transcription).toEqual(settings.features.transcription);
});

it("rejects empty transcription config lists", () => {
  const settings = DEFAULT_SETTINGS_FACTORY();

  expect(() =>
    validateSettingsForUpdate(
      {
        features: {
          transcription: {
            enabled: true,
            activeConfigId: null,
            configs: []
          }
        }
      } as never,
      settings
    )
  ).toThrow("features.transcription.configs must include at least one config");
});

it("rejects a transcription active config id that does not exist", () => {
  const settings = DEFAULT_SETTINGS_FACTORY();

  expect(() =>
    validateSettingsForUpdate(
      {
        features: {
          transcription: {
            enabled: true,
            activeConfigId: "missing-config",
            configs: settings.features.transcription.configs
          }
        }
      } as never,
      settings
    )
  ).toThrow("features.transcription.activeConfigId must reference an existing config");
});

it("rejects invalid transcription config fields in the final settings model", () => {
  const settings = DEFAULT_SETTINGS_FACTORY();
  const config = settings.features.transcription.configs[0]!;

  expect(() =>
    validateSettingsForUpdate(
      {
        features: {
          transcription: {
            enabled: true,
            activeConfigId: config.id,
            configs: [
              {
                ...config,
                extraParams: []
              }
            ]
          }
        }
      } as never,
      settings
    )
  ).toThrow("features.transcription.configs.0.extraParams must use the current object setting");

  expect(() =>
    validateSettingsForUpdate(
      {
        features: {
          transcription: {
            enabled: true,
            activeConfigId: config.id,
            configs: [
              {
                ...config,
                fasterWhisperVadThreshold: 2
              }
            ]
          }
        }
      } as never,
      settings
    )
  ).toThrow("features.transcription.configs.0.fasterWhisperVadThreshold must be between 0 and 1");
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app exec vitest run src/main/settings/appSettingsSanitizer.test.ts --project main
```

Expected: FAIL because current `TranscriptionFeatureSettings` still has a single `config` object.

- [ ] **Step 3: Replace the transcription settings types**

In `apps/desktop-app/src/main/types.ts`, replace the current `TranscriptionConfig`, `TranscriptionFeatureConfig`, and `TranscriptionFeatureSettings` definitions with:

```ts
export interface TranscriptionConfig {
  id: string;
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

export interface TranscriptionFeatureSettings {
  enabled: boolean;
  activeConfigId: string | null;
  configs: TranscriptionConfig[];
}
```

Delete the now-unused `TranscriptionFeatureConfig` interface from the file.

- [ ] **Step 4: Define the default complete transcription config**

Replace `apps/desktop-app/src/common/transcriptionDefaults.ts` with:

```ts
import type { TranscriptionConfig } from "../main/types.js";

export const DEFAULT_TRANSCRIPTION_YTDLP_ARGS =
  '--extract-audio --audio-format wav --audio-quality 32K --postprocessor-args "-ac 1 -ar 16000"';

export const DEFAULT_TRANSCRIPTION_CONFIG_ID = "default-transcription";

export const BASE_TRANSCRIPTION_CONFIG: Omit<TranscriptionConfig, "id"> = {
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

export function createDefaultTranscriptionConfig(): TranscriptionConfig {
  return {
    id: DEFAULT_TRANSCRIPTION_CONFIG_ID,
    ...BASE_TRANSCRIPTION_CONFIG,
    extraParams: { ...BASE_TRANSCRIPTION_CONFIG.extraParams }
  };
}
```

- [ ] **Step 5: Update feature defaults and cloning**

In `apps/desktop-app/src/common/featureDefaults.ts`, import the new default and replace the transcription default/clone sections with:

```ts
import { createDefaultTranscriptionConfig, DEFAULT_TRANSCRIPTION_CONFIG_ID } from "./transcriptionDefaults.js";
```

```ts
transcription: {
  enabled: false,
  activeConfigId: DEFAULT_TRANSCRIPTION_CONFIG_ID,
  configs: [createDefaultTranscriptionConfig()]
},
```

```ts
transcription: {
  enabled: settings.transcription.enabled,
  activeConfigId: settings.transcription.activeConfigId,
  configs: settings.transcription.configs.map((config) => ({
    ...config,
    extraParams: { ...config.extraParams }
  }))
},
```

- [ ] **Step 6: Update sanitizer constants and transcription validation**

In `apps/desktop-app/src/main/settings/appSettingsSanitizer.ts`, replace the feature record constants and transcription config keys with:

```ts
const FEATURE_RECORD_KEYS = ["enabled", "config"] as const;
const TRANSCRIPTION_FEATURE_KEYS = ["enabled", "activeConfigId", "configs"] as const;
const TRANSCRIPTION_CONFIG_KEYS = [
  "id",
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

Then replace `validateTranscriptionFeature` with:

```ts
function validateTranscriptionFeature(input: unknown, requireAllKeys: boolean): void {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("features.transcription must use the current object setting");
  }
  const record = input as Record<string, unknown>;
  assertNoUnknownKeys(record, TRANSCRIPTION_FEATURE_KEYS, "features.transcription");
  if (requireAllKeys && !hasRequiredKeys(record, TRANSCRIPTION_FEATURE_KEYS)) {
    throw new Error("features.transcription must include current settings");
  }
  if (Object.prototype.hasOwnProperty.call(record, "enabled")) {
    requireBoolean(record, "enabled", "features.transcription");
  }
  if (Object.prototype.hasOwnProperty.call(record, "activeConfigId")) {
    if (record.activeConfigId !== null && typeof record.activeConfigId !== "string") {
      throw new Error("features.transcription.activeConfigId must be a string or null");
    }
  }
  if (!Object.prototype.hasOwnProperty.call(record, "configs")) {
    if (requireAllKeys) {
      throw new Error("features.transcription.configs must use the current array setting");
    }
    return;
  }
  if (!Array.isArray(record.configs)) {
    throw new Error("features.transcription.configs must use the current array setting");
  }
  if (!record.configs.length) {
    throw new Error("features.transcription.configs must include at least one config");
  }
  const seenIds = new Set<string>();
  record.configs.forEach((config, index) => {
    validateTranscriptionConfigRecord(config, `features.transcription.configs.${index}`, seenIds);
  });
  if (
    typeof record.activeConfigId === "string" &&
    record.activeConfigId &&
    !seenIds.has(record.activeConfigId)
  ) {
    throw new Error("features.transcription.activeConfigId must reference an existing config");
  }
}

function validateTranscriptionConfigRecord(input: unknown, context: string, seenIds: Set<string>): void {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error(`${context} must use the current object setting`);
  }
  const config = input as Record<string, unknown>;
  assertNoUnknownKeys(config, TRANSCRIPTION_CONFIG_KEYS, context);
  if (!hasRequiredKeys(config, TRANSCRIPTION_CONFIG_KEYS)) {
    throw new Error(`${context} must include current settings`);
  }
  for (const key of [
    "id",
    "name",
    "baseUrl",
    "apiKey",
    "model",
    "language",
    "prompt",
    "ytDlpArgs",
    "fasterWhisperBinary",
    "fasterWhisperModel",
    "fasterWhisperModelDir",
    "fasterWhisperVadMethod"
  ] as const) {
    requireString(config, key, context);
  }
  if (!(config.id as string).trim()) {
    throw new Error(`${context}.id must be a non-empty string`);
  }
  if (seenIds.has(config.id as string)) {
    throw new Error(`${context}.id must be unique`);
  }
  seenIds.add(config.id as string);
  if (config.provider !== "whisper-api" && config.provider !== "faster-whisper") {
    throw new Error(`${context}.provider must be whisper-api or faster-whisper`);
  }
  if (config.fasterWhisperDevice !== "cpu" && config.fasterWhisperDevice !== "cuda") {
    throw new Error(`${context}.fasterWhisperDevice must be cpu or cuda`);
  }
  for (const key of [
    "enableWordTimestamps",
    "fasterWhisperVadFilter",
    "fasterWhisperUseKim2"
  ] as const) {
    requireBoolean(config, key, context);
  }
  if (!config.extraParams || typeof config.extraParams !== "object" || Array.isArray(config.extraParams)) {
    throw new Error(`${context}.extraParams must use the current object setting`);
  }
  for (const [key, value] of Object.entries(config.extraParams as Record<string, unknown>)) {
    if (!key.trim() || key !== key.trim()) {
      throw new Error(`${context}.extraParams keys must be non-empty strings without edge whitespace`);
    }
    if (typeof value !== "string") {
      throw new Error(`${context}.extraParams.${key} must use the current string setting`);
    }
  }
  requireNumber(config, "fasterWhisperVadThreshold", context);
  requireNumberRange(config.fasterWhisperVadThreshold, `${context}.fasterWhisperVadThreshold`, 0, 1);
}
```

- [ ] **Step 7: Update merge logic for transcription**

In `mergeFeatureSettings`, replace the transcription branch with:

```ts
transcription: patch.transcription
  ? {
      enabled: patch.transcription.enabled ?? base.transcription.enabled,
      activeConfigId: patch.transcription.activeConfigId ?? base.transcription.activeConfigId,
      configs: patch.transcription.configs
        ? patch.transcription.configs.map((config) => ({
            ...config,
            extraParams: { ...config.extraParams }
          }))
        : base.transcription.configs.map((config) => ({
            ...config,
            extraParams: { ...config.extraParams }
          }))
    }
  : base.transcription,
```

- [ ] **Step 8: Run the focused test and verify it passes**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app exec vitest run src/main/settings/appSettingsSanitizer.test.ts --project main
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add apps/desktop-app/src/main/types.ts apps/desktop-app/src/common/transcriptionDefaults.ts apps/desktop-app/src/common/featureDefaults.ts apps/desktop-app/src/main/settings/appSettingsSanitizer.ts apps/desktop-app/src/main/settings/appSettingsSanitizer.test.ts
git commit -m "feat: restore feature transcription settings model"
```

---

### Task 2: Active Transcription Runtime Config

**Files:**
- Modify: `apps/desktop-app/src/main/features/transcriptionFeatureConfig.ts`
- Modify: `apps/desktop-app/src/main/features/transcriptionFeatureService.ts`
- Modify: `apps/desktop-app/src/main/transcriptionService.ts`
- Test: `apps/desktop-app/src/main/features/transcriptionFeatureService.test.ts`
- Test: `apps/desktop-app/src/main/transcriptionService.test.ts`

- [ ] **Step 1: Write failing tests for active config resolution**

Replace `createFeatureConfig()` in `apps/desktop-app/src/main/features/transcriptionFeatureService.test.ts` with:

```ts
function createRuntimeConfig(overrides: Partial<import("../types.js").TranscriptionConfig> = {}) {
  return {
    id: "config-a",
    name: "Config A",
    provider: "whisper-api" as const,
    baseUrl: "https://api.example.test",
    apiKey: "secret",
    model: "whisper-1",
    language: "en",
    prompt: "technical terms",
    enableWordTimestamps: true,
    extraParams: { temperature: "0" },
    ytDlpArgs: "--extract-audio --audio-format wav",
    fasterWhisperBinary: "faster-whisper",
    fasterWhisperModel: "base",
    fasterWhisperModelDir: "",
    fasterWhisperDevice: "cpu" as const,
    fasterWhisperVadFilter: true,
    fasterWhisperVadThreshold: 0.5,
    fasterWhisperVadMethod: "",
    fasterWhisperUseKim2: false,
    ...overrides
  };
}

function createFeatureSettings(overrides: Partial<import("../types.js").TranscriptionFeatureSettings> = {}) {
  const config = createRuntimeConfig();
  return {
    enabled: true,
    activeConfigId: config.id,
    configs: [config],
    ...overrides
  };
}
```

Add these tests to the `buildFeatureTranscriptionConfig` describe block:

```ts
it("resolves the active config by id", () => {
  const inactive = createRuntimeConfig({ id: "config-b", name: "Config B", model: "other-model" });
  expect(buildFeatureTranscriptionConfig({
    enabled: true,
    activeConfigId: "config-b",
    configs: [createRuntimeConfig(), inactive]
  })).toMatchObject({
    id: "config-b",
    name: "Config B",
    model: "other-model"
  });
});

it("rejects missing active transcription config", () => {
  expect(() =>
    buildFeatureTranscriptionConfig({
      enabled: true,
      activeConfigId: "missing",
      configs: [createRuntimeConfig()]
    })
  ).toThrow("Active transcription config is not available.");
});

it("rejects provider-specific invalid values before runtime transcription", () => {
  expect(() =>
    buildFeatureTranscriptionConfig(createFeatureSettings({
      configs: [createRuntimeConfig({ baseUrl: "" })]
    }))
  ).toThrow("Transcription API base URL is required.");

  expect(() =>
    buildFeatureTranscriptionConfig(createFeatureSettings({
      configs: [createRuntimeConfig({ provider: "faster-whisper", fasterWhisperModel: "" })]
    }))
  ).toThrow("Transcription faster-whisper model is required.");

  expect(() =>
    buildFeatureTranscriptionConfig(createFeatureSettings({
      configs: [createRuntimeConfig({ provider: "faster-whisper", fasterWhisperBinary: "" })]
    }))
  ).toThrow("Transcription faster-whisper executable is required.");
});
```

Update existing `startFeatureTranscription` tests so `getSettings` returns `createFeatureSettings()` instead of `{ enabled, config }`.

- [ ] **Step 2: Write failing tests for `ytDlpArgs` and Faster-Whisper binary**

Add these tests to `apps/desktop-app/src/main/transcriptionService.test.ts`:

```ts
it("uses transcription config yt-dlp args when provided", () => {
  const service = new TranscriptionService(async () => "yt-dlp");
  const buildArgs = (service as unknown as {
    buildArgs(config: { ytDlpArgs: string }, videoUrl: string, baseOutput: string): string[];
  }).buildArgs.bind(service);

  expect(buildArgs(
    { ytDlpArgs: "--extract-audio --audio-format mp3" },
    "https://video.example.test/watch",
    "/tmp/out"
  )).toEqual([
    "--extract-audio",
    "--audio-format",
    "mp3",
    "-o",
    "/tmp/out",
    "https://video.example.test/watch"
  ]);
});

it("uses configured Faster-Whisper executable path", () => {
  const service = new TranscriptionService(async () => "yt-dlp");
  const resolveFasterWhisperBinary = (service as unknown as {
    resolveFasterWhisperBinary(config: { fasterWhisperBinary: string; fasterWhisperDevice: "cpu" | "cuda" }): string;
  }).resolveFasterWhisperBinary.bind(service);

  expect(resolveFasterWhisperBinary({
    fasterWhisperBinary: "/app/bin/faster-whisper",
    fasterWhisperDevice: "cpu"
  })).toBe("/app/bin/faster-whisper");
});
```

- [ ] **Step 3: Run focused tests and verify they fail**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app exec vitest run src/main/features/transcriptionFeatureService.test.ts src/main/transcriptionService.test.ts --project main
```

Expected: FAIL because the runtime still expects a single `config` object and `TranscriptionService.buildArgs` ignores config args.

- [ ] **Step 4: Replace active config conversion**

Replace `apps/desktop-app/src/main/features/transcriptionFeatureConfig.ts` with:

```ts
import type { TranscriptionConfig, TranscriptionFeatureSettings } from "../types.js";

function requireHttpUrl(value: string, fieldName: string): void {
  if (!URL.canParse(value)) {
    throw new Error(`Transcription ${fieldName} must be a valid HTTP(S) URL.`);
  }
  const parsed = new URL(value);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`Transcription ${fieldName} must be a valid HTTP(S) URL.`);
  }
}

function requireTrimmed(value: string, fieldName: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`Transcription ${fieldName} is required.`);
  }
  return trimmed;
}

function cloneConfig(config: TranscriptionConfig): TranscriptionConfig {
  return {
    ...config,
    extraParams: { ...config.extraParams }
  };
}

export function buildFeatureTranscriptionConfig(settings: TranscriptionFeatureSettings): TranscriptionConfig {
  const activeConfigId = settings.activeConfigId;
  const active = activeConfigId
    ? settings.configs.find((config) => config.id === activeConfigId)
    : settings.configs[0];
  if (!active) {
    throw new Error("Active transcription config is not available.");
  }

  const config = cloneConfig(active);
  if (config.provider === "whisper-api") {
    config.baseUrl = requireTrimmed(config.baseUrl, "API base URL");
    requireHttpUrl(config.baseUrl, "API base URL");
    config.model = requireTrimmed(config.model, "model");
  } else if (config.provider === "faster-whisper") {
    config.fasterWhisperModel = requireTrimmed(config.fasterWhisperModel, "faster-whisper model");
    config.fasterWhisperBinary = requireTrimmed(config.fasterWhisperBinary, "faster-whisper executable");
  } else {
    throw new Error("Transcription provider must be whisper-api or faster-whisper.");
  }
  return config;
}
```

- [ ] **Step 5: Update `TranscriptionFeatureService` to pass settings**

In `apps/desktop-app/src/main/features/transcriptionFeatureService.ts`, replace:

```ts
const runtimeConfig = buildFeatureTranscriptionConfig(settings.config);
const cacheVariant = buildFeatureTranscriptionCacheVariant(settings.config);
```

with:

```ts
const runtimeConfig = buildFeatureTranscriptionConfig(settings);
const cacheVariant = buildFeatureTranscriptionCacheVariant(runtimeConfig);
```

Replace every `TRANSCRIPTION_FEATURE_NAME` passed as the config name after config resolution with `runtimeConfig.name`. Keep disabled-feature errors using `TRANSCRIPTION_FEATURE_NAME` because no active config is required for that message.

Replace the cache helper signature with:

```ts
function buildFeatureTranscriptionCacheVariant(config: TranscriptionConfig): string {
  const hash = createHash("sha256").update(JSON.stringify(config)).digest("hex");
  return `feature-transcription:${hash}`;
}
```

Add `TranscriptionConfig` to the type import from `../types.js`.

- [ ] **Step 6: Update `TranscriptionService` argument construction**

In `apps/desktop-app/src/main/transcriptionService.ts`, replace `const args = this.buildArgs(safeVideoUrl, baseOutput);` with:

```ts
const args = this.buildArgs(config, safeVideoUrl, baseOutput);
```

Replace the existing `buildArgs` method with:

```ts
private buildArgs(config: Pick<TranscriptionConfig, "ytDlpArgs">, videoUrl: string, baseOutput: string): string[] {
  const customLine = config.ytDlpArgs.trim() || DEFAULT_TRANSCRIPTION_YTDLP_ARGS;
  const args = splitArgs(customLine);
  return [...args, "-o", baseOutput, videoUrl];
}
```

Add this method:

```ts
private resolveFasterWhisperBinary(config: Pick<TranscriptionConfig, "fasterWhisperBinary" | "fasterWhisperDevice">): string {
  const configured = config.fasterWhisperBinary.trim();
  if (configured) {
    return configured;
  }
  return config.fasterWhisperDevice === "cuda" ? "faster-whisper-xxl" : "faster-whisper";
}
```

In `submitToFasterWhisper`, replace:

```ts
const binary = config.fasterWhisperDevice === "cuda" ? "faster-whisper-xxl" : "faster-whisper";
```

with:

```ts
const binary = this.resolveFasterWhisperBinary(config);
```

- [ ] **Step 7: Run focused tests and verify they pass**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app exec vitest run src/main/features/transcriptionFeatureService.test.ts src/main/transcriptionService.test.ts --project main
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/desktop-app/src/main/features/transcriptionFeatureConfig.ts apps/desktop-app/src/main/features/transcriptionFeatureService.ts apps/desktop-app/src/main/features/transcriptionFeatureService.test.ts apps/desktop-app/src/main/transcriptionService.ts apps/desktop-app/src/main/transcriptionService.test.ts
git commit -m "feat: run transcription from active feature config"
```

---

### Task 3: Faster-Whisper Manager And IPC

**Files:**
- Create: `apps/desktop-app/src/main/fasterWhisperManager.ts`
- Create: `apps/desktop-app/src/main/fasterWhisperManager.test.ts`
- Create: `apps/desktop-app/src/main/ipc/handlers/fasterWhisperHandlers.ts`
- Create: `apps/desktop-app/src/main/ipc/handlers/fasterWhisperHandlers.test.ts`
- Modify: `apps/desktop-app/src/main/ipc/ipcRouter.ts`
- Modify: `apps/desktop-app/src/main/window/windowController.ts`
- Modify: `apps/desktop-app/src/preload.cts`

- [ ] **Step 1: Write manager tests for paths and status**

Create `apps/desktop-app/src/main/fasterWhisperManager.test.ts`:

```ts
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { FasterWhisperManager } from "./fasterWhisperManager.js";

describe("FasterWhisperManager", () => {
  it("reports app-managed paths and missing binaries", async () => {
    const baseDir = await mkdtemp(path.join(tmpdir(), "usp-fw-"));
    const manager = new FasterWhisperManager({ baseDir });

    const status = await manager.getStatus();

    expect(status.paths.binaryDir).toBe(path.join(baseDir, "bin"));
    expect(status.paths.modelsDir).toBe(path.join(baseDir, "models"));
    expect(status.binaries.cpu.exists).toBe(false);
    expect(status.binaries.gpu.exists).toBe(false);
    expect(status.models).toEqual([]);
  });

  it("lists downloaded models with required files", async () => {
    const baseDir = await mkdtemp(path.join(tmpdir(), "usp-fw-"));
    const modelDir = path.join(baseDir, "models", "faster-whisper-base");
    await mkdir(modelDir, { recursive: true });
    await Promise.all(["config.json", "model.bin", "tokenizer.json", "vocabulary.txt"].map((file) =>
      writeFile(path.join(modelDir, file), "{}")
    ));

    const manager = new FasterWhisperManager({ baseDir });
    const result = await manager.listDownloadedModels();

    expect(result.models).toEqual([
      {
        name: "base",
        folder: "faster-whisper-base",
        path: modelDir
      }
    ]);
  });
});
```

- [ ] **Step 2: Run manager tests and verify they fail**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app exec vitest run src/main/fasterWhisperManager.test.ts --project main
```

Expected: FAIL because `fasterWhisperManager.ts` does not exist.

- [ ] **Step 3: Create `FasterWhisperManager`**

Create `apps/desktop-app/src/main/fasterWhisperManager.ts`:

```ts
import { app } from "electron";
import { createWriteStream } from "node:fs";
import { promises as fs } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { createLogger } from "./logger.js";

export type FasterWhisperBinaryVariant = "cpu" | "gpu";
type ProgressCb = (percent: number, status: string) => void;

const REQUIRED_MODEL_FILES = ["config.json", "model.bin", "tokenizer.json", "vocabulary.txt"];
const MODEL_BASES = ["https://hf-mirror.com", "https://huggingface.co", "https://modelscope.cn/models"];
const BINARY_ASSETS: Record<FasterWhisperBinaryVariant, { url: string; archiveName: string; targetName: string }> = {
  cpu: {
    url: "https://modelscope.cn/models/bkfengg/whisper-cpp/resolve/master/whisper-faster.exe",
    archiveName: "faster-whisper.exe.download",
    targetName: "faster-whisper.exe"
  },
  gpu: {
    url: "https://modelscope.cn/models/bkfengg/whisper-cpp/resolve/master/Faster-Whisper-XXL_r245.2_windows.7z",
    archiveName: "faster-whisper-gpu.7z",
    targetName: path.join("Faster-Whisper-XXL", "faster-whisper-xxl.exe")
  }
};

export class FasterWhisperManager {
  private readonly log = createLogger("faster-whisper");
  private readonly baseDir: string;
  private readonly binDir: string;
  private readonly modelsDir: string;

  constructor(options: { baseDir?: string } = {}) {
    this.baseDir = options.baseDir ?? path.join(app.getPath("userData"), "faster-whisper");
    this.binDir = path.join(this.baseDir, "bin");
    this.modelsDir = path.join(this.baseDir, "models");
  }

  async getPaths() {
    await this.ensureDirs();
    return {
      binaryDir: this.binDir,
      modelsDir: this.modelsDir,
      cpuBinaryPath: path.join(this.binDir, BINARY_ASSETS.cpu.targetName),
      gpuBinaryPath: path.join(this.binDir, BINARY_ASSETS.gpu.targetName)
    };
  }

  async getStatus(modelDirOverride?: string) {
    const paths = await this.getPaths();
    const targetModelDir = modelDirOverride?.trim() || paths.modelsDir;
    const [cpuExists, gpuExists, modelList] = await Promise.all([
      this.fileExists(paths.cpuBinaryPath),
      this.fileExists(paths.gpuBinaryPath),
      this.listDownloadedModels(targetModelDir)
    ]);
    return {
      paths,
      binaries: {
        cpu: { exists: cpuExists, path: paths.cpuBinaryPath },
        gpu: { exists: gpuExists, path: paths.gpuBinaryPath }
      },
      models: modelList.models,
      modelsBaseDir: modelList.baseDir
    };
  }

  async listDownloadedModels(modelDirOverride?: string) {
    const targetDir = modelDirOverride?.trim() || this.modelsDir;
    await fs.mkdir(targetDir, { recursive: true });
    const entries = await fs.readdir(targetDir, { withFileTypes: true });
    const models: Array<{ name: string; path: string; folder: string }> = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }
      const folder = entry.name;
      const modelPath = path.join(targetDir, folder);
      if (!(await this.hasRequiredModelFiles(modelPath))) {
        continue;
      }
      models.push({
        name: normalizeModelName(folder),
        path: modelPath,
        folder
      });
    }
    return { models, baseDir: targetDir };
  }

  async downloadBinary(variant: FasterWhisperBinaryVariant, progress?: ProgressCb): Promise<string> {
    await this.ensureDirs();
    const asset = BINARY_ASSETS[variant];
    const targetPath = path.join(this.binDir, asset.targetName);
    if (await this.fileExists(targetPath)) {
      return targetPath;
    }
    const tempPath = path.join(this.binDir, asset.archiveName);
    progress?.(1, `Downloading ${variant.toUpperCase()} binary...`);
    await this.downloadFile(asset.url, tempPath, (percent) =>
      progress?.(Math.max(1, Math.min(99, percent)), `Downloading ${variant.toUpperCase()} binary...`)
    );
    if (variant === "gpu") {
      throw new Error("GPU package downloaded. Extract Faster-Whisper-XXL with 7-Zip and set the executable path in settings.");
    }
    await fs.rename(tempPath, targetPath);
    await this.ensurePermissions(targetPath);
    progress?.(100, "Binary ready");
    return targetPath;
  }

  async downloadModel(model: string, progress?: ProgressCb): Promise<{ path: string; files: string[] }> {
    await this.ensureDirs();
    const normalized = normalizeModelName(model).toLowerCase();
    const repoName = `faster-whisper-${normalized}`;
    const targetDir = path.join(this.modelsDir, repoName);
    await fs.mkdir(targetDir, { recursive: true });
    for (const [index, file] of REQUIRED_MODEL_FILES.entries()) {
      const outPath = path.join(targetDir, file);
      const urls = buildModelFileUrls(repoName, file);
      let lastError: unknown = null;
      for (const url of urls) {
        try {
          await this.downloadFile(url, outPath, (percent) => {
            const base = (index / REQUIRED_MODEL_FILES.length) * 100;
            const span = 100 / REQUIRED_MODEL_FILES.length;
            progress?.(Math.min(99, Math.round(base + (percent / 100) * span)), `Downloading model (${file})`);
          });
          lastError = null;
          break;
        } catch (error) {
          lastError = error;
          this.log.warn(`Failed to download ${file} from ${url}`, error);
        }
      }
      if (lastError) {
        throw lastError;
      }
    }
    progress?.(100, "Model ready");
    return { path: targetDir, files: [...REQUIRED_MODEL_FILES] };
  }

  private async ensureDirs() {
    await fs.mkdir(this.binDir, { recursive: true });
    await fs.mkdir(this.modelsDir, { recursive: true });
  }

  private async fileExists(target: string) {
    try {
      await fs.access(target);
      return true;
    } catch {
      return false;
    }
  }

  private async hasRequiredModelFiles(modelPath: string): Promise<boolean> {
    try {
      await Promise.all(REQUIRED_MODEL_FILES.map((file) => fs.access(path.join(modelPath, file))));
      return true;
    } catch {
      return false;
    }
  }

  private async downloadFile(url: string, targetPath: string, progress?: (percent: number) => void) {
    const response = await fetch(url);
    if (!response.ok || !response.body) {
      throw new Error(`Download failed: ${response.status} ${response.statusText}`);
    }
    const total = Number(response.headers.get("content-length") ?? 0);
    const readable = Readable.fromWeb(response.body as never);
    let downloaded = 0;
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await new Promise<void>((resolve, reject) => {
      const fileStream = createWriteStream(targetPath);
      fileStream.on("error", reject);
      fileStream.on("finish", resolve);
      readable.on("data", (chunk: Buffer) => {
        downloaded += chunk.length;
        if (progress && total > 0) {
          progress(Math.min(99, Math.round((downloaded / total) * 100)));
        }
      });
      readable.on("error", reject);
      readable.pipe(fileStream);
    });
    progress?.(100);
  }

  private async ensurePermissions(targetPath: string) {
    if (process.platform !== "win32") {
      await fs.chmod(targetPath, 0o755);
    }
  }
}

function normalizeModelName(name: string) {
  const trimmed = name.trim();
  return trimmed.startsWith("faster-whisper-") ? trimmed.replace(/^faster-whisper-/, "") : trimmed;
}

function buildModelFileUrls(repoName: string, fileName: string): string[] {
  const hfPath = `Systran/${repoName}/resolve/main/${fileName}`;
  const msPath = `pengzhendong/${repoName}/resolve/master/${fileName}`;
  return [
    `${MODEL_BASES[0]}/${hfPath}`,
    `${MODEL_BASES[1]}/${hfPath}`,
    `${MODEL_BASES[2]}/${msPath}`
  ];
}
```

This restores status and model downloads without reintroducing the old `decompress` dependency. GPU package download returns a clear error requiring the user to point `fasterWhisperBinary` at an extracted executable.

- [ ] **Step 4: Add IPC handlers**

Create `apps/desktop-app/src/main/ipc/handlers/fasterWhisperHandlers.ts`:

```ts
import { ipcMain } from "electron";
import type { IpcContext } from "../ipcRouter.js";
import type { FasterWhisperBinaryVariant } from "../../fasterWhisperManager.js";

type BinaryPayload = { variant: FasterWhisperBinaryVariant; jobId?: string };
type ModelPayload = { model: string; jobId?: string };

export function registerFasterWhisperHandlers(context: IpcContext) {
  ipcMain.handle("usp:faster-whisper-paths", () => context.fasterWhisperManager.getPaths());

  ipcMain.handle("usp:faster-whisper-status", async (_event, modelDir?: string) => {
    try {
      return { ok: true, ...(await context.fasterWhisperManager.getStatus(modelDir)) };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      context.logger.error("Failed to get Faster-Whisper status", error);
      return { ok: false, error: message };
    }
  });

  ipcMain.handle("usp:faster-whisper-list-models", async (_event, modelDir?: string) => {
    try {
      return { ok: true, ...(await context.fasterWhisperManager.listDownloadedModels(modelDir)) };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      context.logger.error("Failed to list Faster-Whisper models", error);
      return { ok: false, error: message };
    }
  });

  ipcMain.handle("usp:faster-whisper-download-binary", async (event, payload: BinaryPayload) => {
    const downloadId = payload.jobId || `fw-bin-${Date.now()}`;
    const progress = (percent: number, status: string) => {
      event.sender.send("usp:faster-whisper-download-progress", {
        id: downloadId,
        type: "binary",
        variant: payload.variant,
        percent,
        status
      });
    };
    try {
      const binaryPath = await context.fasterWhisperManager.downloadBinary(payload.variant, progress);
      return { ok: true, id: downloadId, path: binaryPath };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      context.logger.error("Faster-Whisper binary download failed", error);
      progress(0, `Error: ${message}`);
      return { ok: false, id: downloadId, error: message };
    }
  });

  ipcMain.handle("usp:faster-whisper-download-model", async (event, payload: ModelPayload) => {
    const downloadId = payload.jobId || `fw-model-${Date.now()}`;
    const progress = (percent: number, status: string) => {
      event.sender.send("usp:faster-whisper-download-progress", {
        id: downloadId,
        type: "model",
        model: payload.model,
        percent,
        status
      });
    };
    try {
      const result = await context.fasterWhisperManager.downloadModel(payload.model, progress);
      return { ok: true, id: downloadId, ...result };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      context.logger.error("Faster-Whisper model download failed", error);
      progress(0, `Error: ${message}`);
      return { ok: false, id: downloadId, error: message };
    }
  });
}
```

- [ ] **Step 5: Add IPC handler tests**

Create `apps/desktop-app/src/main/ipc/handlers/fasterWhisperHandlers.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { registerFasterWhisperHandlers } from "./fasterWhisperHandlers.js";

const handle = vi.fn();

vi.mock("electron", () => ({
  ipcMain: {
    handle
  }
}));

function registeredHandler(channel: string) {
  const call = handle.mock.calls.find(([registeredChannel]) => registeredChannel === channel);
  if (!call) {
    throw new Error(`Missing handler for ${channel}`);
  }
  return call[1] as (...args: unknown[]) => Promise<unknown>;
}

describe("registerFasterWhisperHandlers", () => {
  beforeEach(() => {
    handle.mockReset();
  });

  it("returns Faster-Whisper status through IPC", async () => {
    const status = {
      paths: { binaryDir: "/bin", modelsDir: "/models", cpuBinaryPath: "/bin/cpu", gpuBinaryPath: "/bin/gpu" },
      binaries: {
        cpu: { exists: false, path: "/bin/cpu" },
        gpu: { exists: false, path: "/bin/gpu" }
      },
      models: [],
      modelsBaseDir: "/models"
    };
    registerFasterWhisperHandlers({
      fasterWhisperManager: {
        getStatus: vi.fn().mockResolvedValue(status),
        getPaths: vi.fn(),
        listDownloadedModels: vi.fn(),
        downloadBinary: vi.fn(),
        downloadModel: vi.fn()
      },
      logger: { error: vi.fn() }
    } as never);

    await expect(registeredHandler("usp:faster-whisper-status")({}, "/models")).resolves.toEqual({
      ok: true,
      ...status
    });
  });

  it("converts Faster-Whisper status failures into IPC errors", async () => {
    registerFasterWhisperHandlers({
      fasterWhisperManager: {
        getStatus: vi.fn().mockRejectedValue(new Error("disk failed")),
        getPaths: vi.fn(),
        listDownloadedModels: vi.fn(),
        downloadBinary: vi.fn(),
        downloadModel: vi.fn()
      },
      logger: { error: vi.fn() }
    } as never);

    await expect(registeredHandler("usp:faster-whisper-status")({}, "/models")).resolves.toEqual({
      ok: false,
      error: "disk failed"
    });
  });
});
```

- [ ] **Step 6: Wire manager through IPC context**

In `apps/desktop-app/src/main/ipc/ipcRouter.ts`, import and register the new handler:

```ts
import type { FasterWhisperManager } from "../fasterWhisperManager.js";
import { registerFasterWhisperHandlers } from "./handlers/fasterWhisperHandlers.js";
```

Add to `IpcContext`:

```ts
fasterWhisperManager: FasterWhisperManager;
```

Add in `register()`:

```ts
registerFasterWhisperHandlers(this.context);
```

In `apps/desktop-app/src/main/window/windowController.ts`, import and instantiate:

```ts
import { FasterWhisperManager } from "../fasterWhisperManager.js";
```

```ts
private readonly fasterWhisperManager: FasterWhisperManager;
```

Inside the constructor before `this.ipcRouter = new IpcRouter(...)`:

```ts
this.fasterWhisperManager = new FasterWhisperManager();
```

Pass it into the router context:

```ts
fasterWhisperManager: this.fasterWhisperManager,
```

- [ ] **Step 7: Expose preload APIs**

In `apps/desktop-app/src/preload.cts`, add these API entries:

```ts
getFasterWhisperPaths: (): Promise<{
  binaryDir: string;
  modelsDir: string;
  cpuBinaryPath: string;
  gpuBinaryPath: string;
}> => ipcRenderer.invoke("usp:faster-whisper-paths"),
getFasterWhisperStatus: (modelDir?: string): Promise<any> =>
  ipcRenderer.invoke("usp:faster-whisper-status", modelDir),
listFasterWhisperModels: (modelDir?: string): Promise<any> =>
  ipcRenderer.invoke("usp:faster-whisper-list-models", modelDir),
downloadFasterWhisperBinary: (payload: { variant: "cpu" | "gpu"; jobId?: string }): Promise<any> =>
  ipcRenderer.invoke("usp:faster-whisper-download-binary", payload),
downloadFasterWhisperModel: (payload: { model: string; jobId?: string }): Promise<any> =>
  ipcRenderer.invoke("usp:faster-whisper-download-model", payload),
onFasterWhisperDownloadProgress: (listener: Listener<any>) =>
  subscribe("usp:faster-whisper-download-progress", listener),
```

- [ ] **Step 8: Run focused checks**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app exec vitest run src/main/fasterWhisperManager.test.ts --project main
pnpm --filter @immersive-subs/desktop-app exec vitest run src/main/ipc/handlers/fasterWhisperHandlers.test.ts --project main
pnpm --filter @immersive-subs/desktop-app typecheck:main
pnpm --filter @immersive-subs/desktop-app typecheck:preload
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add apps/desktop-app/src/main/fasterWhisperManager.ts apps/desktop-app/src/main/fasterWhisperManager.test.ts apps/desktop-app/src/main/ipc/handlers/fasterWhisperHandlers.ts apps/desktop-app/src/main/ipc/handlers/fasterWhisperHandlers.test.ts apps/desktop-app/src/main/ipc/ipcRouter.ts apps/desktop-app/src/main/window/windowController.ts apps/desktop-app/src/preload.cts
git commit -m "feat: add faster whisper feature manager"
```

---

### Task 4: Word Lookup Status, Refresh, And File Selection

**Files:**
- Modify: `apps/desktop-app/src/main/features/wordLookupService.ts`
- Modify: `apps/desktop-app/src/main/features/wordLookupService.test.ts`
- Modify: `apps/desktop-app/src/main/ipc/handlers/settingsHandlers.ts`
- Modify: `apps/desktop-app/src/main/ipc/handlers/windowHandlers.ts`
- Modify: `apps/desktop-app/src/preload.cts`
- Modify: `apps/desktop-app/src/renderer/components/settings/WordLookupFeatureSettings.vue`
- Test: `apps/desktop-app/src/renderer/components/settings/SettingsFeatures.test.ts`

- [ ] **Step 1: Write failing service tests**

Add to `apps/desktop-app/src/main/features/wordLookupService.test.ts`:

```ts
it("reports status after refresh", async () => {
  const file = await writeWordList([
    { word: "test", content: "A test entry" }
  ]);
  const service = new WordLookupService(() => ({
    enabled: true,
    config: {
      wordListPath: file,
      modifierKey: "alt",
      panelWidth: 360,
      panelHeight: 300
    }
  }));

  const status = await service.refresh();

  expect(status.ok).toBe(true);
  expect(status.wordListPath).toBe(file);
  expect(status.entryCount).toBe(1);
  expect(status.fileMtimeMs).toEqual(expect.any(Number));
  expect(status.loadedAt).toEqual(expect.any(Number));
  expect(status.error).toBeNull();
  expect(service.getStatus()).toEqual(status);
});

it("reports refresh errors without throwing", async () => {
  const service = new WordLookupService(() => ({
    enabled: true,
    config: {
      wordListPath: "/path/that/does/not/exist.jsonl",
      modifierKey: "alt",
      panelWidth: 360,
      panelHeight: 300
    }
  }));

  const status = await service.refresh();

  expect(status.ok).toBe(false);
  expect(status.wordListPath).toBe("/path/that/does/not/exist.jsonl");
  expect(status.error).toBeTruthy();
});
```

- [ ] **Step 2: Run service tests and verify they fail**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app exec vitest run src/main/features/wordLookupService.test.ts --project main
```

Expected: FAIL because `refresh()` and `getStatus()` do not exist.

- [ ] **Step 3: Add service status methods**

In `apps/desktop-app/src/main/features/wordLookupService.ts`, add:

```ts
export interface WordLookupStatus {
  ok: boolean;
  wordListPath: string;
  entryCount: number;
  fileMtimeMs: number | null;
  loadedAt: number | null;
  error: string | null;
}
```

Add this field to the class:

```ts
private status: WordLookupStatus = {
  ok: false,
  wordListPath: "",
  entryCount: 0,
  fileMtimeMs: null,
  loadedAt: null,
  error: null
};
```

Add these public methods:

```ts
async refresh(): Promise<WordLookupStatus> {
  return this.load(true);
}

getStatus(): WordLookupStatus {
  const wordListPath = normalizeSurface(this.getSettings().config.wordListPath);
  if (wordListPath !== this.status.wordListPath) {
    return {
      ...this.status,
      ok: false,
      wordListPath,
      error: wordListPath ? "Word list path changed. Refresh to load it." : null
    };
  }
  return this.status;
}
```

Replace `ensureLoaded` with a `load(force: boolean)` method that catches errors for refresh and throws for lookup:

```ts
private async load(force: boolean): Promise<WordLookupStatus> {
  const wordListPath = normalizeSurface(this.getSettings().config.wordListPath);
  if (!wordListPath) {
    this.loaded = null;
    this.status = {
      ok: false,
      wordListPath: "",
      entryCount: 0,
      fileMtimeMs: null,
      loadedAt: null,
      error: "Word Lookup word list path is not configured."
    };
    return this.status;
  }
  if (!force && this.loaded?.wordListPath === wordListPath) {
    return this.status;
  }
  try {
    const stat = await fs.stat(wordListPath);
    if (!stat.isFile()) {
      throw new Error("Configured word list path is not a file.");
    }
    const raw = await fs.readFile(wordListPath, "utf-8");
    const entries = parseWordList(raw);
    this.loaded = {
      wordListPath,
      entries,
      index: buildIndex(entries),
      loadedAt: Date.now()
    };
    this.status = {
      ok: true,
      wordListPath,
      entryCount: entries.length,
      fileMtimeMs: stat.mtimeMs,
      loadedAt: this.loaded.loadedAt,
      error: null
    };
    return this.status;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    this.loaded = null;
    this.status = {
      ok: false,
      wordListPath,
      entryCount: 0,
      fileMtimeMs: null,
      loadedAt: null,
      error: message
    };
    return this.status;
  }
}
```

Update `lookup()` so after `await this.load(false)` it throws when `this.status.ok` is false:

```ts
await this.load(false);
if (!this.loaded || !this.status.ok) {
  throw new Error(this.status.error ?? "Word Lookup word list is not loaded.");
}
const loaded = this.loaded;
```

- [ ] **Step 4: Add file selection and status IPC**

In `apps/desktop-app/src/main/ipc/handlers/settingsHandlers.ts`, import `dialog`:

```ts
import { dialog, ipcMain, shell } from "electron";
```

Add:

```ts
ipcMain.handle("usp:select-word-list-file", async () => {
  const result = await dialog.showOpenDialog({
    title: "Select Word List",
    properties: ["openFile"],
    filters: [
      { name: "JSONL", extensions: ["jsonl"] },
      { name: "JSON", extensions: ["json"] },
      { name: "All Files", extensions: ["*"] }
    ]
  });
  return {
    canceled: result.canceled,
    path: result.canceled ? null : result.filePaths[0] ?? null
  };
});
```

In `apps/desktop-app/src/main/ipc/handlers/windowHandlers.ts`, add:

```ts
ipcMain.handle("usp:word-lookup-refresh", () => context.wordLookupService.refresh());
ipcMain.handle("usp:word-lookup-status", () => context.wordLookupService.getStatus());
```

In `apps/desktop-app/src/preload.cts`, add:

```ts
selectWordListFile: (): Promise<{ canceled: boolean; path: string | null }> =>
  ipcRenderer.invoke("usp:select-word-list-file"),
refreshWordLookup: (): Promise<any> => ipcRenderer.invoke("usp:word-lookup-refresh"),
getWordLookupStatus: (): Promise<any> => ipcRenderer.invoke("usp:word-lookup-status"),
```

- [ ] **Step 5: Update Word Lookup settings UI**

In `apps/desktop-app/src/renderer/components/settings/WordLookupFeatureSettings.vue`, import `ref` and UI actions:

```ts
import { computed, onMounted, ref, watch } from "vue";
import { UiBadge, UiButton, UiInput, UiSelect, UiSettingRow } from "../ui";
import { IconRefresh, IconFolderOpen } from "../icons";
```

Add local state:

```ts
const status = ref<any | null>(null);
const isRefreshing = ref(false);
const statusLabel = computed(() => {
  if (!status.value) {
    return t("feature-word-lookup-status-not-loaded");
  }
  return status.value.ok
    ? t("feature-word-lookup-status-ready")
    : (status.value.error || t("feature-word-lookup-status-error"));
});
```

Add methods:

```ts
async function loadStatus() {
  status.value = await window.usp.getWordLookupStatus();
}

async function refresh() {
  isRefreshing.value = true;
  try {
    status.value = await window.usp.refreshWordLookup();
  } finally {
    isRefreshing.value = false;
  }
}

async function selectFile() {
  const result = await window.usp.selectWordListFile();
  if (result.canceled || !result.path) {
    return;
  }
  await update({ wordListPath: result.path });
  await refresh();
}

function formatTimestamp(value: number | null | undefined) {
  return value ? new Date(value).toLocaleString() : "-";
}

onMounted(loadStatus);
watch(() => config.value.wordListPath, loadStatus);
```

Update the path row to include file selection, and add a refresh/status block:

```vue
<div class="word-lookup-path-row">
  <UiInput
    :model-value="config.wordListPath"
    data-testid="feature-word-lookup-path"
    @update:model-value="update({ wordListPath: String($event) })"
  />
  <UiButton size="sm" variant="secondary" data-testid="feature-word-lookup-select-file" @click="selectFile">
    <IconFolderOpen size="sm" />
    {{ t("button-select") }}
  </UiButton>
</div>
```

```vue
<div class="word-lookup-actions">
  <UiButton size="sm" data-testid="feature-word-lookup-refresh" :disabled="isRefreshing" @click="refresh">
    <IconRefresh size="sm" />
    {{ isRefreshing ? t("feature-word-lookup-refreshing") : t("feature-word-lookup-refresh") }}
  </UiButton>
</div>
<dl class="word-lookup-status" data-testid="feature-word-lookup-status">
  <div>
    <dt>{{ t("feature-word-lookup-status") }}</dt>
    <dd><UiBadge :tone="status?.ok ? 'success' : 'danger'">{{ statusLabel }}</UiBadge></dd>
  </div>
  <div>
    <dt>{{ t("feature-word-lookup-entry-count") }}</dt>
    <dd>{{ status?.entryCount ?? 0 }}</dd>
  </div>
  <div>
    <dt>{{ t("feature-word-lookup-file-modified") }}</dt>
    <dd>{{ formatTimestamp(status?.fileMtimeMs) }}</dd>
  </div>
  <div>
    <dt>{{ t("feature-word-lookup-loaded-at") }}</dt>
    <dd>{{ formatTimestamp(status?.loadedAt) }}</dd>
  </div>
</dl>
```

- [ ] **Step 6: Add jsdom test for refresh**

In `apps/desktop-app/src/renderer/components/settings/SettingsFeatures.test.ts`, add:

```ts
it("refreshes and displays Word Lookup status", async () => {
  seedStore();
  const refreshWordLookup = vi.fn().mockResolvedValue({
    ok: true,
    wordListPath: "/tmp/words.jsonl",
    entryCount: 2,
    fileMtimeMs: 1000,
    loadedAt: 2000,
    error: null
  });
  vi.stubGlobal("window", {
    ...window,
    usp: {
      ...(window as any).usp,
      getWordLookupStatus: vi.fn().mockResolvedValue(null),
      refreshWordLookup,
      selectWordListFile: vi.fn()
    }
  });
  const wrapper = mount(WordLookupFeatureSettings);

  await wrapper.get('[data-testid="feature-word-lookup-refresh"]').trigger("click");
  await wrapper.vm.$nextTick();

  expect(refreshWordLookup).toHaveBeenCalled();
  expect(wrapper.get('[data-testid="feature-word-lookup-status"]').text()).toContain("2");
});
```

- [ ] **Step 7: Run focused checks**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app exec vitest run src/main/features/wordLookupService.test.ts --project main
pnpm --filter @immersive-subs/desktop-app exec vitest run src/renderer/components/settings/SettingsFeatures.test.ts --project jsdom
pnpm --filter @immersive-subs/desktop-app typecheck:app
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/desktop-app/src/main/features/wordLookupService.ts apps/desktop-app/src/main/features/wordLookupService.test.ts apps/desktop-app/src/main/ipc/handlers/settingsHandlers.ts apps/desktop-app/src/main/ipc/handlers/windowHandlers.ts apps/desktop-app/src/preload.cts apps/desktop-app/src/renderer/components/settings/WordLookupFeatureSettings.vue apps/desktop-app/src/renderer/components/settings/SettingsFeatures.test.ts
git commit -m "feat: restore word lookup status controls"
```

---

### Task 5: Renderer Feature Actions And Speech Settings UI

**Files:**
- Create: `apps/desktop-app/src/renderer/components/settings/transcription/composables/useTranscriptionConfig.ts`
- Create: `apps/desktop-app/src/renderer/components/settings/transcription/composables/useFasterWhisper.ts`
- Create: `apps/desktop-app/src/renderer/components/settings/transcription/FasterWhisperBinariesCard.vue`
- Create: `apps/desktop-app/src/renderer/components/settings/transcription/FasterWhisperModelsCard.vue`
- Create: `apps/desktop-app/src/renderer/components/settings/transcription/FasterWhisperRuntimeCard.vue`
- Create: `apps/desktop-app/src/renderer/components/settings/transcription/TranscriptionConfigList.vue`
- Create: `apps/desktop-app/src/renderer/components/settings/transcription/WhisperApiForm.vue`
- Modify: `apps/desktop-app/src/renderer/stores/desktop/actions/featureActions.ts`
- Modify: `apps/desktop-app/src/renderer/stores/desktop/types.ts`
- Modify: `apps/desktop-app/src/renderer/components/settings/TranscriptionFeatureSettings.vue`
- Test: `apps/desktop-app/src/renderer/stores/desktop.test.ts`
- Test: `apps/desktop-app/src/renderer/components/settings/SettingsFeatures.test.ts`

- [ ] **Step 1: Write failing store tests for transcription actions**

Add to `apps/desktop-app/src/renderer/stores/desktop.test.ts`:

```ts
it("sets active transcription config", async () => {
  const store = useDesktopStore();
  store.settings = createSettings();
  const updateSettings = vi.spyOn(store, "updateSettings").mockResolvedValue();

  await store.setActiveTranscriptionConfig("config-b");

  expect(updateSettings).toHaveBeenCalledWith({
    features: {
      transcription: {
        ...store.settings!.features.transcription,
        activeConfigId: "config-b"
      }
    }
  });
});

it("updates transcription configs as a complete list", async () => {
  const store = useDesktopStore();
  store.settings = createSettings();
  const updateSettings = vi.spyOn(store, "updateSettings").mockResolvedValue();
  const nextConfig = {
    ...store.settings!.features.transcription.configs[0]!,
    name: "Updated"
  };

  await store.setTranscriptionConfigs([nextConfig], nextConfig.id);

  expect(updateSettings).toHaveBeenCalledWith({
    features: {
      transcription: {
        enabled: store.settings!.features.transcription.enabled,
        activeConfigId: nextConfig.id,
        configs: [nextConfig]
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

Expected: FAIL because `setActiveTranscriptionConfig` and `setTranscriptionConfigs` do not exist.

- [ ] **Step 3: Add feature actions**

In `apps/desktop-app/src/renderer/stores/desktop/actions/featureActions.ts`, add:

```ts
export async function setActiveTranscriptionConfig(this: DesktopStoreThis, configId: string | null) {
  if (!this.settings) {
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

export async function setTranscriptionConfigs(
  this: DesktopStoreThis,
  configs: FeatureSettings["transcription"]["configs"],
  activeConfigId: string | null
) {
  if (!this.settings) {
    return;
  }
  await this.updateSettings({
    features: {
      transcription: {
        enabled: this.settings.features.transcription.enabled,
        activeConfigId,
        configs
      }
    } as Partial<FeatureSettings>
  } as Partial<AppSettings>);
}
```

Add them to `featureActions`:

```ts
setActiveTranscriptionConfig,
setTranscriptionConfigs,
```

In `apps/desktop-app/src/renderer/stores/desktop/types.ts`, add:

```ts
setActiveTranscriptionConfig(configId: string | null): Promise<void>;
setTranscriptionConfigs(
  configs: FeatureSettings["transcription"]["configs"],
  activeConfigId: string | null
): Promise<void>;
```

- [ ] **Step 4: Create the transcription config composable**

Create `apps/desktop-app/src/renderer/components/settings/transcription/composables/useTranscriptionConfig.ts` with:

```ts
import { computed, ref, type ComputedRef, type Ref, type WritableComputedRef } from "vue";
import type { TranscriptionConfig } from "../../../../../main/types";
import { BASE_TRANSCRIPTION_CONFIG } from "../../../../../common/transcriptionDefaults";
import { useDesktopStore } from "../../../../stores/desktop";

export interface UseTranscriptionConfigReturn {
  transcriptionConfigs: ComputedRef<TranscriptionConfig[]>;
  activeConfigId: WritableComputedRef<string>;
  activeConfig: ComputedRef<TranscriptionConfig | null>;
  updateConfig: (patch: Partial<TranscriptionConfig>) => void;
  handleAddConfig: () => void;
  handleDeleteConfig: () => void;
  extraParamsText: WritableComputedRef<string>;
  extraParamsError: Ref<string | null>;
}

function createTranscriptionConfigId() {
  return `transcription-${crypto.randomUUID()}`;
}

function createTranscriptionConfig(): TranscriptionConfig {
  return {
    id: createTranscriptionConfigId(),
    ...BASE_TRANSCRIPTION_CONFIG,
    extraParams: { ...BASE_TRANSCRIPTION_CONFIG.extraParams }
  };
}

export function useTranscriptionConfig(t: (key: string) => string): UseTranscriptionConfigReturn {
  const store = useDesktopStore();
  const extraParamsError = ref<string | null>(null);
  const transcriptionFeature = computed(() => store.settings?.features.transcription ?? null);
  const transcriptionConfigs = computed(() => transcriptionFeature.value?.configs ?? []);
  const activeConfigId = computed({
    get: () => transcriptionFeature.value?.activeConfigId ?? transcriptionConfigs.value[0]?.id ?? "",
    set: (value: string) => {
      void store.setActiveTranscriptionConfig(value || null);
    }
  });
  const activeConfig = computed(() =>
    transcriptionConfigs.value.find((config) => config.id === activeConfigId.value) ?? transcriptionConfigs.value[0] ?? null
  );

  function writeConfigs(configs: TranscriptionConfig[], nextActiveId = activeConfigId.value) {
    void store.setTranscriptionConfigs(configs, nextActiveId || configs[0]?.id ?? null);
  }

  function updateConfig(patch: Partial<TranscriptionConfig>) {
    if (!activeConfig.value) {
      return;
    }
    writeConfigs(
      transcriptionConfigs.value.map((config) =>
        config.id === activeConfig.value?.id
          ? { ...config, ...patch, extraParams: patch.extraParams ? { ...patch.extraParams } : config.extraParams }
          : config
      )
    );
  }

  function handleAddConfig() {
    const next = createTranscriptionConfig();
    writeConfigs([...transcriptionConfigs.value, next], next.id);
  }

  function handleDeleteConfig() {
    if (!activeConfig.value) {
      return;
    }
    let nextConfigs = transcriptionConfigs.value.filter((config) => config.id !== activeConfig.value?.id);
    if (!nextConfigs.length) {
      nextConfigs = [createTranscriptionConfig()];
    }
    writeConfigs(nextConfigs, nextConfigs[0]?.id ?? null);
  }

  const extraParamsText = computed({
    get: () => JSON.stringify(activeConfig.value?.extraParams ?? {}, null, 2),
    set: (value: string) => {
      const trimmed = value.trim();
      if (!trimmed) {
        updateConfig({ extraParams: {} });
        extraParamsError.value = null;
        return;
      }
      try {
        const parsed = JSON.parse(trimmed);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          extraParamsError.value = t("feature-transcription-extra-params-invalid");
          return;
        }
        const params: Record<string, string> = {};
        for (const [key, raw] of Object.entries(parsed)) {
          if (typeof raw !== "string") {
            extraParamsError.value = t("feature-transcription-extra-params-invalid");
            return;
          }
          params[key] = raw;
        }
        updateConfig({ extraParams: params });
        extraParamsError.value = null;
      } catch (error) {
        extraParamsError.value = error instanceof Error ? error.message : t("feature-transcription-extra-params-invalid");
      }
    }
  });

  return {
    transcriptionConfigs,
    activeConfigId,
    activeConfig,
    updateConfig,
    handleAddConfig,
    handleDeleteConfig,
    extraParamsText,
    extraParamsError
  };
}
```

- [ ] **Step 5: Create UI subcomponents by adapting old commit assets**

Use `579bc6f5e0b14c40934dda106921ee1e45833abd` as a reference for these files, but update imports to current UI components and current `settings.features` data:

```bash
git show 579bc6f5e0b14c40934dda106921ee1e45833abd:apps/desktop-app/src/renderer/components/settings/transcription/TranscriptionConfigList.vue
git show 579bc6f5e0b14c40934dda106921ee1e45833abd:apps/desktop-app/src/renderer/components/settings/transcription/WhisperApiForm.vue
git show 579bc6f5e0b14c40934dda106921ee1e45833abd:apps/desktop-app/src/renderer/components/settings/transcription/FasterWhisperBinariesCard.vue
git show 579bc6f5e0b14c40934dda106921ee1e45833abd:apps/desktop-app/src/renderer/components/settings/transcription/FasterWhisperModelsCard.vue
git show 579bc6f5e0b14c40934dda106921ee1e45833abd:apps/desktop-app/src/renderer/components/settings/transcription/FasterWhisperRuntimeCard.vue
```

Required current imports in those components:

```ts
import { UiBadge, UiButton, UiEmptyState, UiField, UiIconButton, UiInput, UiListItem, UiSelect, UiSwitch, UiTextarea } from "../../ui";
import { IconAdd, IconDelete, IconDownload, IconFolderOpen, IconRefresh } from "../../icons";
```

Required behavior:

- `TranscriptionConfigList` emits `add`, `delete`, and `select`.
- `WhisperApiForm` exposes `v-model:base-url`, `v-model:api-key`, `v-model:model`, `v-model:language-field`, and `v-model:prompt`.
- Faster-Whisper cards receive state from `useFasterWhisper` and emit download/open actions.
- No component imports plugin IDs, plugin store helpers, or `settings.plugins`.

- [ ] **Step 6: Create `useFasterWhisper`**

Create `apps/desktop-app/src/renderer/components/settings/transcription/composables/useFasterWhisper.ts` by adapting the old commit's composable, with current API calls:

```ts
const status = await window.usp.getFasterWhisperStatus(targetDir);
const result = await window.usp.downloadFasterWhisperBinary({ variant, jobId });
const result = await window.usp.downloadFasterWhisperModel({ model, jobId });
unsubscribeDownloadProgress = window.usp.onFasterWhisperDownloadProgress(handleDownloadProgress);
```

The composable must update the active config through `updateConfig({ fasterWhisperBinary: result.path })`, `updateConfig({ fasterWhisperModel: model })`, and `updateConfig({ fasterWhisperModelDir: targetDir })`; it must not call plugin actions.

- [ ] **Step 7: Replace `TranscriptionFeatureSettings.vue` with the split editor**

Replace `apps/desktop-app/src/renderer/components/settings/TranscriptionFeatureSettings.vue` with a settings split layout that uses the composables and subcomponents:

```vue
<template>
  <div class="settings-split transcription-feature-settings">
    <TranscriptionConfigList
      :transcription-configs="transcriptionConfigs"
      :active-config-id="activeConfigId"
      :t="t"
      @add="handleAddConfig"
      @delete="handleDeleteConfig"
      @select="(id) => (activeConfigId = id)"
    />
    <div v-if="activeConfig" class="settings-split__editor">
      <UiSettingRow id="feature-transcription-name" :label="t('feature-transcription-config-name')" control-width="field">
        <UiInput :model-value="activeConfig.name" @update:model-value="updateConfig({ name: String($event) })" />
      </UiSettingRow>
      <UiSettingRow id="feature-transcription-provider" :label="t('feature-transcription-provider')" control-width="field">
        <UiSelect :model-value="activeConfig.provider" :options="providerOptions" @update:model-value="updateConfig({ provider: $event as any })" />
      </UiSettingRow>
      <WhisperApiForm
        v-if="activeConfig.provider === 'whisper-api'"
        :t="t"
        :base-url="activeConfig.baseUrl"
        :api-key="activeConfig.apiKey"
        :model="activeConfig.model"
        :language-field="activeConfig.language"
        :prompt="activeConfig.prompt"
        @update:base-url="updateConfig({ baseUrl: $event })"
        @update:api-key="updateConfig({ apiKey: $event })"
        @update:model="updateConfig({ model: $event })"
        @update:language-field="updateConfig({ language: $event })"
        @update:prompt="updateConfig({ prompt: $event })"
      />
      <div v-else class="feature-transcription-faster">
        <FasterWhisperBinariesCard v-bind="fasterWhisperBindings" @download-binary="handleDownloadBinary" @open-path="openPath" />
        <FasterWhisperModelsCard v-bind="fasterWhisperBindings" @download-model="handleDownloadModel" @open-path="openPath" />
        <FasterWhisperRuntimeCard
          :active-config="activeConfig"
          :available-models="availableModels"
          :selected-downloaded-model="selectedDownloadedModel"
          :custom-model-input="customModelInput"
          @update:selected-downloaded-model="selectedDownloadedModel = $event"
          @update:custom-model-input="customModelInput = $event"
          @update:config="updateConfig($event)"
        />
      </div>
      <UiSettingRow id="feature-transcription-extra-params" :label="t('feature-transcription-extra-params')" control-width="editor" stacked>
        <UiTextarea :model-value="extraParamsText" :rows="4" @update:model-value="extraParamsText = $event" />
        <p v-if="extraParamsError" class="settings-error">{{ extraParamsError }}</p>
      </UiSettingRow>
      <UiSettingRow id="feature-transcription-ytdlp" :label="t('feature-transcription-ytdlp-args')" control-width="editor" stacked>
        <UiTextarea :model-value="activeConfig.ytDlpArgs" :rows="3" @update:model-value="updateConfig({ ytDlpArgs: $event })" />
      </UiSettingRow>
    </div>
    <UiEmptyState v-else :message="t('feature-transcription-no-config')" />
  </div>
</template>
```

Keep the script focused: compute language, `t`, `providerOptions`, destructure `useTranscriptionConfig`, and destructure `useFasterWhisper`. Avoid plugin imports.

The script must define the binding object used by the Faster-Whisper cards:

```ts
const fasterWhisperBindings = computed(() => ({
  t,
  paths: paths.value,
  binaryStatus: binaryStatus.value,
  availableModels: availableModels.value,
  selectedModel: selectedModel.value,
  modelsBaseDir: modelsBaseDir.value,
  isBusy: isBusy.value,
  downloadProgress: downloadProgress.value,
  downloadMessage: downloadMessage.value,
  downloadError: downloadError.value
}));
```

- [ ] **Step 8: Add jsdom tests for multi-config UI**

In `apps/desktop-app/src/renderer/components/settings/SettingsFeatures.test.ts`, add:

```ts
it("adds and selects speech transcription configs", async () => {
  const store = seedStore();
  vi.spyOn(store, "setTranscriptionConfigs").mockResolvedValue();
  const wrapper = mount(TranscriptionFeatureSettings);

  await wrapper.get('[data-testid="feature-transcription-add-config"]').trigger("click");

  expect(store.setTranscriptionConfigs).toHaveBeenCalledWith(
    expect.arrayContaining([expect.objectContaining({ name: "Default Whisper API" })]),
    expect.stringMatching(/^transcription-/)
  );
});

it("edits active speech transcription config fields", async () => {
  const store = seedStore();
  store.settings!.features.transcription.enabled = true;
  vi.spyOn(store, "setTranscriptionConfigs").mockResolvedValue();
  const wrapper = mount(TranscriptionFeatureSettings);

  await wrapper.get('[data-testid="feature-transcription-config-name"]').setValue("Fast local");

  expect(store.setTranscriptionConfigs).toHaveBeenCalledWith(
    [expect.objectContaining({ name: "Fast local" })],
    store.settings!.features.transcription.activeConfigId
  );
});
```

- [ ] **Step 9: Run focused checks**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app exec vitest run src/renderer/stores/desktop.test.ts src/renderer/components/settings/SettingsFeatures.test.ts --project jsdom
pnpm --filter @immersive-subs/desktop-app typecheck:renderer
```

Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add apps/desktop-app/src/renderer/stores/desktop/actions/featureActions.ts apps/desktop-app/src/renderer/stores/desktop/types.ts apps/desktop-app/src/renderer/stores/desktop.test.ts apps/desktop-app/src/renderer/components/settings/TranscriptionFeatureSettings.vue apps/desktop-app/src/renderer/components/settings/transcription apps/desktop-app/src/renderer/components/settings/SettingsFeatures.test.ts
git commit -m "feat: restore speech transcription settings"
```

---

### Task 6: Jellyfin / Emby Split Server Editor

**Files:**
- Modify: `apps/desktop-app/src/renderer/stores/desktop/actions/featureActions.ts`
- Modify: `apps/desktop-app/src/renderer/stores/desktop/types.ts`
- Modify: `apps/desktop-app/src/renderer/components/settings/JellyfinEmbyFeatureSettings.vue`
- Test: `apps/desktop-app/src/renderer/stores/desktop.test.ts`
- Test: `apps/desktop-app/src/renderer/components/settings/SettingsFeatures.test.ts`

- [ ] **Step 1: Write failing store tests for server helpers**

Add to `apps/desktop-app/src/renderer/stores/desktop.test.ts`:

```ts
it("adds Jellyfin / Emby server configs", async () => {
  const store = useDesktopStore();
  store.settings = createSettings();
  const updateSettings = vi.spyOn(store, "updateSettings").mockResolvedValue();

  const id = await store.addJellyfinEmbyServer();

  expect(id).toMatch(/^jellyfin-emby-/);
  expect(updateSettings).toHaveBeenCalledWith({
    features: {
      jellyfinEmby: {
        enabled: store.settings!.features.jellyfinEmby.enabled,
        config: {
          servers: [
            {
              id,
              name: "Server 1",
              serverUrl: "",
              apiKey: "",
              enabled: true
            }
          ]
        }
      }
    }
  });
});

it("updates Jellyfin / Emby server configs", async () => {
  const store = useDesktopStore();
  store.settings = createSettings();
  store.settings!.features.jellyfinEmby.config.servers = [
    { id: "server-1", name: "Home", serverUrl: "", apiKey: "", enabled: true }
  ];
  const updateSettings = vi.spyOn(store, "updateSettings").mockResolvedValue();

  await store.updateJellyfinEmbyServer("server-1", { serverUrl: "https://media.example.test" });

  expect(updateSettings).toHaveBeenCalledWith({
    features: {
      jellyfinEmby: {
        enabled: store.settings!.features.jellyfinEmby.enabled,
        config: {
          servers: [
            { id: "server-1", name: "Home", serverUrl: "https://media.example.test", apiKey: "", enabled: true }
          ]
        }
      }
    }
  });
});
```

- [ ] **Step 2: Add server helper actions**

In `apps/desktop-app/src/renderer/stores/desktop/actions/featureActions.ts`, add:

```ts
function createId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

async function writeJellyfinEmbyServers(this: DesktopStoreThis, servers: FeatureSettings["jellyfinEmby"]["config"]["servers"]) {
  if (!this.settings) {
    return;
  }
  await this.updateSettings({
    features: {
      jellyfinEmby: {
        enabled: this.settings.features.jellyfinEmby.enabled,
        config: { servers }
      }
    } as Partial<FeatureSettings>
  } as Partial<AppSettings>);
}

export async function addJellyfinEmbyServer(this: DesktopStoreThis): Promise<string | null> {
  if (!this.settings) {
    return null;
  }
  const servers = this.settings.features.jellyfinEmby.config.servers;
  const id = createId("jellyfin-emby");
  await writeJellyfinEmbyServers.call(this, [
    ...servers,
    {
      id,
      name: `Server ${servers.length + 1}`,
      serverUrl: "",
      apiKey: "",
      enabled: true
    }
  ]);
  return id;
}

export async function updateJellyfinEmbyServer(
  this: DesktopStoreThis,
  serverId: string,
  patch: Partial<FeatureSettings["jellyfinEmby"]["config"]["servers"][number]>
) {
  if (!this.settings) {
    return;
  }
  await writeJellyfinEmbyServers.call(
    this,
    this.settings.features.jellyfinEmby.config.servers.map((server) =>
      server.id === serverId ? { ...server, ...patch } : server
    )
  );
}

export async function deleteJellyfinEmbyServer(this: DesktopStoreThis, serverId: string) {
  if (!this.settings) {
    return;
  }
  await writeJellyfinEmbyServers.call(
    this,
    this.settings.features.jellyfinEmby.config.servers.filter((server) => server.id !== serverId)
  );
}
```

Add these methods to `featureActions` and to `DesktopStoreActions`.

- [ ] **Step 3: Replace Jellyfin / Emby settings with split editor**

Replace `apps/desktop-app/src/renderer/components/settings/JellyfinEmbyFeatureSettings.vue` with a split editor that keeps only real runtime fields:

```vue
<template>
  <div class="settings-split jellyfin-emby-settings">
    <aside class="settings-split__sidebar">
      <div class="settings-split__sidebar-header">
        <span class="ui-field__label">{{ t("feature-jellyfin-emby-server-list") }}</span>
        <div class="settings-split__sidebar-buttons">
          <UiIconButton :label="t('button-add')" data-testid="feature-jellyfin-emby-add-server" @click="addServer">
            <IconAdd size="sm" />
          </UiIconButton>
          <UiIconButton :label="t('button-delete')" variant="danger" :disabled="!selectedServerId" @click="removeSelectedServer">
            <IconDelete size="sm" />
          </UiIconButton>
        </div>
      </div>
      <div v-if="servers.length" class="ui-list">
        <UiListItem
          v-for="server in servers"
          :key="server.id"
          as="button"
          :selected="server.id === selectedServerId"
          :data-testid="`feature-jellyfin-emby-server-${server.id}`"
          @click="selectedServerId = server.id"
        >
          <div class="ui-list-item__title">{{ server.name || server.serverUrl || t("feature-jellyfin-emby-untitled") }}</div>
          <UiBadge :tone="server.enabled ? 'success' : 'neutral'">
            {{ server.enabled ? t("feature-enabled") : t("feature-disabled") }}
          </UiBadge>
        </UiListItem>
      </div>
      <UiEmptyState v-else :message="t('feature-jellyfin-emby-empty')" />
    </aside>
    <section v-if="selectedServer" class="settings-split__editor">
      <UiSettingRow id="feature-jellyfin-emby-server-name" :label="t('feature-jellyfin-emby-server-name')" control-width="wide">
        <UiInput :model-value="selectedServer.name" @update:model-value="updateSelectedServer({ name: String($event) })" />
      </UiSettingRow>
      <UiSettingRow id="feature-jellyfin-emby-server-url" :label="t('feature-jellyfin-emby-server-url')" control-width="wide">
        <UiInput :model-value="selectedServer.serverUrl" @update:model-value="updateSelectedServer({ serverUrl: String($event) })" />
      </UiSettingRow>
      <UiSettingRow id="feature-jellyfin-emby-api-key" :label="t('feature-jellyfin-emby-api-key')" control-width="wide">
        <UiInput :model-value="selectedServer.apiKey" type="password" @update:model-value="updateSelectedServer({ apiKey: String($event) })" />
      </UiSettingRow>
      <UiSettingRow id="feature-jellyfin-emby-server-enabled" :label="t('feature-jellyfin-emby-server-enabled')" control-width="compact">
        <UiSwitch :model-value="selectedServer.enabled" :label="t('feature-jellyfin-emby-server-enabled')" @update:model-value="updateSelectedServer({ enabled: $event })" />
      </UiSettingRow>
      <div v-if="serverErrors(selectedServer).length" class="server-errors" role="status">
        <p v-for="error in serverErrors(selectedServer)" :key="error" class="server-errors__item">{{ error }}</p>
      </div>
    </section>
    <UiEmptyState v-else class="settings-split__editor" :message="t('feature-jellyfin-emby-empty')" />
  </div>
</template>
```

Script requirements:

```ts
const selectedServerId = ref<string | null>(null);
const servers = computed(() => store.settings?.features.jellyfinEmby.config.servers ?? []);
const selectedServer = computed(() => servers.value.find((server) => server.id === selectedServerId.value) ?? null);
```

Methods:

```ts
async function addServer() {
  selectedServerId.value = await store.addJellyfinEmbyServer();
}

function updateSelectedServer(patch: Partial<JellyfinEmbyServerConfig>) {
  if (selectedServerId.value) {
    void store.updateJellyfinEmbyServer(selectedServerId.value, patch);
  }
}

async function removeSelectedServer() {
  const id = selectedServerId.value;
  if (!id) {
    return;
  }
  await store.deleteJellyfinEmbyServer(id);
  selectedServerId.value = servers.value.find((server) => server.id !== id)?.id ?? null;
}
```

Keep the existing `serverErrors()` logic and the current no-`webSocketPath` field list.

- [ ] **Step 4: Add jsdom tests for split editor**

In `apps/desktop-app/src/renderer/components/settings/SettingsFeatures.test.ts`, replace the old add-server row test with:

```ts
it("adds and edits Jellyfin / Emby servers through the split editor", async () => {
  const store = seedStore();
  vi.spyOn(store, "addJellyfinEmbyServer").mockImplementation(async () => {
    store.settings!.features.jellyfinEmby.config.servers.push({
      id: "server-1",
      name: "Server 1",
      serverUrl: "",
      apiKey: "",
      enabled: true
    });
    return "server-1";
  });
  vi.spyOn(store, "updateJellyfinEmbyServer").mockResolvedValue();
  const wrapper = mount(JellyfinEmbyFeatureSettings);

  await wrapper.get('[data-testid="feature-jellyfin-emby-add-server"]').trigger("click");
  await wrapper.vm.$nextTick();
  await wrapper.get("#feature-jellyfin-emby-server-url").setValue("https://media.example.test");

  expect(store.updateJellyfinEmbyServer).toHaveBeenCalledWith("server-1", {
    serverUrl: "https://media.example.test"
  });
});
```

- [ ] **Step 5: Run focused checks**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app exec vitest run src/renderer/stores/desktop.test.ts src/renderer/components/settings/SettingsFeatures.test.ts --project jsdom
pnpm --filter @immersive-subs/desktop-app typecheck:renderer
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/desktop-app/src/renderer/stores/desktop/actions/featureActions.ts apps/desktop-app/src/renderer/stores/desktop/types.ts apps/desktop-app/src/renderer/stores/desktop.test.ts apps/desktop-app/src/renderer/components/settings/JellyfinEmbyFeatureSettings.vue apps/desktop-app/src/renderer/components/settings/SettingsFeatures.test.ts
git commit -m "feat: restore jellyfin emby server editor"
```

---

### Task 7: Subtitle Transcription Config Selection And Locales

**Files:**
- Modify: `apps/desktop-app/src/renderer/components/subtitle/SubtitleView.vue`
- Modify: `apps/desktop-app/src/renderer/components/subtitle/SubtitleView.browser.test.ts`
- Modify: `apps/desktop-app/src/renderer/locales/en.json`
- Modify: `apps/desktop-app/src/renderer/locales/zh.json`
- Modify: `apps/desktop-app/src/renderer/i18nCoverage.test.ts`

- [ ] **Step 1: Write failing browser test for transcription config options**

In `apps/desktop-app/src/renderer/components/subtitle/SubtitleView.browser.test.ts`, add:

```ts
it("shows transcription configs from feature settings and updates the active config", async () => {
  const { wrapper, store } = mountSubtitleView();
  store.settings.features.transcription = {
    enabled: true,
    activeConfigId: "fast-local",
    configs: [
      {
        id: "fast-local",
        name: "Fast local",
        provider: "faster-whisper",
        baseUrl: "",
        apiKey: "",
        model: "",
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
        fasterWhisperUseKim2: false
      }
    ]
  };
  vi.spyOn(store, "setActiveTranscriptionConfig").mockResolvedValue();
  await wrapper.vm.$nextTick();

  expect(wrapper.text()).toContain("Fast local");
});
```

- [ ] **Step 2: Update `SubtitleView.vue` transcription derivation**

In `apps/desktop-app/src/renderer/components/subtitle/SubtitleView.vue`, replace the fixed single-option computed block with:

```ts
const transcriptionConfigs = computed(() => (
  transcriptionEnabled.value
    ? transcriptionFeature.value?.configs.map((config) => ({ id: config.id, name: config.name })) ?? []
    : []
));
```

Replace `activeTranscriptionId` computed with:

```ts
const activeTranscriptionId = computed({
  get: () => transcriptionFeature.value?.activeConfigId ?? transcriptionConfigs.value[0]?.id ?? "",
  set: (value: string) => {
    if (!transcriptionConfigs.value.some((config) => config.id === value)) {
      return;
    }
    void store.setActiveTranscriptionConfig(value);
  }
});
```

Keep `startTranscription()` as a no-argument call. The main process reads the active config from settings.

- [ ] **Step 3: Add locale keys**

Add English keys in `apps/desktop-app/src/renderer/locales/en.json`:

```json
"button-select": "Select",
"feature-word-lookup-refresh": "Refresh",
"feature-word-lookup-refreshing": "Refreshing...",
"feature-word-lookup-status": "Status",
"feature-word-lookup-status-not-loaded": "Not loaded",
"feature-word-lookup-status-ready": "Ready",
"feature-word-lookup-status-error": "Error",
"feature-word-lookup-entry-count": "Entries",
"feature-word-lookup-file-modified": "File modified",
"feature-word-lookup-loaded-at": "Loaded",
"feature-transcription-config-name": "Config name",
"feature-transcription-ytdlp-args": "yt-dlp audio args",
"feature-transcription-extra-params-invalid": "Extra params must be a JSON object with string values.",
"feature-transcription-no-config": "No transcription config",
"feature-jellyfin-emby-server-list": "Server list",
"feature-jellyfin-emby-untitled": "Untitled"
```

Add matching Chinese keys in `apps/desktop-app/src/renderer/locales/zh.json`:

```json
"button-select": "选择",
"feature-word-lookup-refresh": "刷新",
"feature-word-lookup-refreshing": "正在刷新...",
"feature-word-lookup-status": "状态",
"feature-word-lookup-status-not-loaded": "未加载",
"feature-word-lookup-status-ready": "就绪",
"feature-word-lookup-status-error": "错误",
"feature-word-lookup-entry-count": "词条数",
"feature-word-lookup-file-modified": "文件修改时间",
"feature-word-lookup-loaded-at": "加载时间",
"feature-transcription-config-name": "配置名称",
"feature-transcription-ytdlp-args": "yt-dlp 音频参数",
"feature-transcription-extra-params-invalid": "额外参数必须是字符串值的 JSON 对象。",
"feature-transcription-no-config": "没有语音转录配置",
"feature-jellyfin-emby-server-list": "服务器列表",
"feature-jellyfin-emby-untitled": "未命名"
```

Add these keys to `requiredKeys` in `apps/desktop-app/src/renderer/i18nCoverage.test.ts`.

- [ ] **Step 4: Run focused browser/jsdom checks**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app exec vitest run src/renderer/components/subtitle/SubtitleView.browser.test.ts --project browser
pnpm --filter @immersive-subs/desktop-app exec vitest run src/renderer/i18nCoverage.test.ts --project jsdom
pnpm --filter @immersive-subs/desktop-app typecheck:renderer
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop-app/src/renderer/components/subtitle/SubtitleView.vue apps/desktop-app/src/renderer/components/subtitle/SubtitleView.browser.test.ts apps/desktop-app/src/renderer/locales/en.json apps/desktop-app/src/renderer/locales/zh.json apps/desktop-app/src/renderer/i18nCoverage.test.ts
git commit -m "feat: use feature transcription config selection"
```

---

### Task 8: Final Verification And Documentation Sync

**Files:**
- Modify: `docs/superpowers/specs/2026-06-16-feature-restoration-design.md` only if implementation reveals a final-state detail that the spec misstated.
- Modify: `docs/superpowers/plans/2026-06-16-feature-restoration.md` only if a task changes during execution and the checked-in plan must match the actual final state.

- [ ] **Step 1: Search for forbidden restored plugin paths**

Run:

```bash
rg -n "settings\\.plugins|pluginCatalog|getPluginCatalog|enablePlugin|disablePlugin|PluginSettings|PluginSettingsSchema|settings/plugins|plugin runtime|plugin lifecycle" apps/desktop-app/src docs/superpowers/specs/2026-06-16-feature-restoration-design.md docs/superpowers/plans/2026-06-16-feature-restoration.md
```

Expected: no hits in active source. Hits in the spec/plan are acceptable only where they explicitly say those paths are not restored.

- [ ] **Step 2: Run focused main tests**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app exec vitest run src/main/settings/appSettingsSanitizer.test.ts src/main/features/wordLookupService.test.ts src/main/features/transcriptionFeatureService.test.ts src/main/transcriptionService.test.ts src/main/fasterWhisperManager.test.ts src/main/features/jellyfinEmbyMediaSource.test.ts --project main
```

Expected: PASS.

- [ ] **Step 3: Run focused renderer tests**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app exec vitest run src/renderer/stores/desktop.test.ts src/renderer/components/settings/SettingsFeatures.test.ts src/renderer/i18nCoverage.test.ts --project jsdom
pnpm --filter @immersive-subs/desktop-app exec vitest run src/renderer/components/settings/SettingsWindowShell.browser.test.ts src/renderer/components/subtitle/SubtitleView.browser.test.ts --project browser
```

Expected: PASS.

- [ ] **Step 4: Run typecheck and build**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app typecheck:app
pnpm --filter @immersive-subs/desktop-app build:app
git diff --check
```

Expected: PASS and no whitespace errors.

- [ ] **Step 5: Run full repo checks if focused checks are clean**

Run:

```bash
pnpm lint:silent-catches
pnpm test
pnpm build
```

Expected: PASS.

- [ ] **Step 6: Commit final doc/test sync if needed**

If Task 8 changes only docs or test alignment, commit:

```bash
git add docs/superpowers/specs/2026-06-16-feature-restoration-design.md docs/superpowers/plans/2026-06-16-feature-restoration.md
git commit -m "docs: sync feature restoration final state"
```

If no docs changed, do not create an empty commit.
