# Feature Restoration Final State Record

> Current source is authoritative. This file records the final feature-restoration state; it is not a step-by-step execution plan. Do not use it to reintroduce subagents, worktrees, compatibility layers, migrations, or the removed plugin platform.

## Goal

Restore the first-party feature surfaces inside the fixed built-in feature architecture:

- Word Lookup status, refresh, and word-list selection.
- Speech Transcription multi-config settings and runtime active-config selection.
- Faster-Whisper binary/model management.
- Jellyfin / Emby multi-server settings.

The project has not launched, so old plugin data, old settings shapes, and unpublished runtime paths are not supported or migrated.

## Final Architecture

Feature persistence is fixed under `settings.features`:

- `settings.features.wordLookup`
- `settings.features.transcription`
- `settings.features.jellyfinEmby`

The main process owns explicit first-party services:

- `WordLookupService`
- `TranscriptionFeatureService`
- `FasterWhisperManager`
- `JellyfinEmbyMediaSource`

The renderer uses current UI foundation components and feature actions. It must not expose plugin lifecycle concepts such as install, update, package version, permissions, marketplace, source URL, or delete. Product renderer styles use the current `--ui-*` token set; stale `--color-*` and `--text-*` renderer tokens are rejected by the UI boundary check.

These paths remain absent from active source:

- `settings.plugins`
- plugin catalog state or IPC
- plugin runtime host or sandbox
- plugin package or repository distribution paths
- old settings migrations or stale data readers

## Final Behavior

- `FasterWhisperManager` resolves model downloads through the official Faster-Whisper model map or a strict Hugging Face `owner/repo` ID. It reads the Hugging Face repository file tree and downloads the current CTranslate2 model files: `config.json`, `model.bin`, `tokenizer.json`, optional `preprocessor_config.json`, and at least one `vocabulary.*` file. It no longer assumes every model lives under a generated Systran repository name or that every model has `vocabulary.txt`.
- Downloaded-model discovery accepts current model directories with either `vocabulary.txt` or `vocabulary.json`. Official aliases such as `tiny.en`, `large-v3`, `distil-large-v3.5`, and `large-v3-turbo` stay valid, including aliases that map outside `Systran/faster-whisper-*`.
- `WordLookupService.getStatus()` reports the currently configured word-list path without stale entry counts, file mtimes, or load timestamps after the path changes.
- The settings sanitizer rejects transcription configs with an empty or whitespace-only `name`, matching runtime validation before invalid settings can be persisted.
- `TranscriptionFeatureService.startFeatureTranscription()` returns `{ ok: false, error }` for provider-specific active-config validation failures, updates transcription status with the error, and does not start cache or transcription side effects.
- The speech transcription configuration list reuses the profile-list sidebar, list item, editable name action, and inline compact input pattern. Config names are edited in the list, not duplicated in the right-side editor.
- The speech transcription configuration list has add, duplicate, and delete toolbar actions. Runtime activation is controlled by a fixed-size hollow circle on the right side of each config row; clicking it updates `activeConfigId` without changing the selected-for-editing row. The right-side editor does not duplicate active-state controls.
- The speech transcription config name editor keeps empty edits local and only persists non-empty names, so clearing the field for retyping no longer bounces through rejected settings updates.
- The Jellyfin / Emby server list reuses the profile-list sidebar, list item, editable name action, and inline compact input pattern. Server names are edited in the list, not duplicated in the right-side editor.
- The Jellyfin / Emby server list has add, duplicate, and delete toolbar actions. Server enablement is controlled by a fixed-size hollow circle on the right side of each server row; clicking it toggles `enabled` without changing the selected-for-editing row. The right-side editor does not duplicate enablement controls.
- The profile list marks the profile currently selected in the settings editor with the same right-side hollow circle. The marker is the existing editing selection, not a URL-rule runtime override or `defaultProfileId` mutation.
- Word Lookup panel dimensions use the same compact field grid and slider treatment as profile layout controls.
- Number inputs that can be cleared for retyping keep local drafts and persist only valid bounded numbers. This covers Faster-Whisper VAD threshold, cache retention days, and profile auto-scroll timeout.
- Selecting an already downloaded Faster-Whisper model persists both `fasterWhisperModel` and the detected model base directory, so runtime local transcription receives the matching model directory without requiring a fresh download.

## Source Evidence

Primary source surfaces for this final state:

- `apps/desktop-app/src/main/settings/appSettingsSanitizer.ts`
- `apps/desktop-app/src/main/features/wordLookupService.ts`
- `apps/desktop-app/src/main/fasterWhisperManager.ts`
- `apps/desktop-app/src/main/features/transcriptionFeatureConfig.ts`
- `apps/desktop-app/src/main/features/transcriptionFeatureService.ts`
- `apps/desktop-app/src/main/transcriptionService.ts`
- `apps/desktop-app/src/main/features/jellyfinEmbyMediaSource.ts`
- `apps/desktop-app/src/main/ipc/handlers/fasterWhisperHandlers.ts`
- `apps/desktop-app/src/preload.cts`
- `apps/desktop-app/src/renderer/components/settings/SettingsFeatures.vue`
- `apps/desktop-app/src/renderer/components/settings/TranscriptionFeatureSettings.vue`
- `apps/desktop-app/src/renderer/components/settings/transcription/TranscriptionConfigList.vue`
- `apps/desktop-app/src/renderer/components/settings/profiles/ProfileList.vue`
- `apps/desktop-app/src/renderer/components/settings/WordLookupFeatureSettings.vue`
- `apps/desktop-app/src/renderer/components/settings/JellyfinEmbyFeatureSettings.vue`
- `apps/desktop-app/src/renderer/components/settings/numericDraft.ts`
- `apps/desktop-app/src/renderer/components/ui/UiInput.vue`
- `apps/desktop-app/src/renderer/components/subtitle/SubtitleView.vue`
- `scripts/check-ui-boundaries.mjs`

Regression coverage lives in:

- `apps/desktop-app/src/main/settings/appSettingsSanitizer.test.ts`
- `apps/desktop-app/src/main/features/wordLookupService.test.ts`
- `apps/desktop-app/src/main/fasterWhisperManager.test.ts`
- `apps/desktop-app/src/main/features/transcriptionFeatureService.test.ts`
- `apps/desktop-app/src/main/transcriptionService.test.ts`
- `apps/desktop-app/src/main/features/jellyfinEmbyMediaSource.test.ts`
- `apps/desktop-app/src/main/ipc/handlers/fasterWhisperHandlers.test.ts`
- `apps/desktop-app/src/renderer/stores/desktop.test.ts`
- `apps/desktop-app/src/renderer/components/settings/SettingsFeatures.test.ts`
- `apps/desktop-app/src/renderer/components/settings/SettingsFeatures.browser.test.ts`
- `apps/desktop-app/src/renderer/components/ui/UiComponents.test.ts`
- `apps/desktop-app/src/renderer/components/subtitle/SubtitleView.browser.test.ts`
- `apps/desktop-app/src/renderer/i18nCoverage.test.ts`
- `scripts/check-ui-boundaries.test.mjs`

## Verification Gate

Before claiming this feature-restoration work complete, run:

```bash
rg -n "settings\\.plugins|pluginCatalog|getPluginCatalog|enablePlugin|disablePlugin|PluginSettings|PluginSettingsSchema|settings/plugins|plugin runtime|plugin lifecycle" apps/desktop-app/src docs/superpowers/specs/2026-06-16-feature-restoration-design.md docs/superpowers/plans/2026-06-16-feature-restoration.md
bash -lc '! rg -n --glob "!*.test.*" -- "--color-|--text-" apps packages scripts'
pnpm --filter @immersive-subs/desktop-app exec vitest run src/main/settings/appSettingsSanitizer.test.ts src/main/features/wordLookupService.test.ts src/main/features/transcriptionFeatureService.test.ts src/main/transcriptionService.test.ts src/main/fasterWhisperManager.test.ts src/main/ipc/handlers/fasterWhisperHandlers.test.ts src/main/features/jellyfinEmbyMediaSource.test.ts --project main
pnpm --filter @immersive-subs/desktop-app exec vitest run src/renderer/stores/desktop.test.ts src/renderer/components/settings/SettingsFeatures.test.ts src/renderer/components/ui/UiComponents.test.ts src/renderer/i18nCoverage.test.ts --project jsdom
pnpm --filter @immersive-subs/desktop-app exec vitest run src/renderer/components/settings/SettingsWindowShell.browser.test.ts src/renderer/components/settings/SettingsFeatures.browser.test.ts src/renderer/components/settings/SettingsProfiles.browser.test.ts src/renderer/components/subtitle/SubtitleView.browser.test.ts --project browser
pnpm --filter @immersive-subs/desktop-app typecheck:app
pnpm --filter @immersive-subs/desktop-app build:app
node --test scripts/check-ui-boundaries.test.mjs
pnpm lint:ui-boundaries
pnpm lint:silent-catches
pnpm --filter @immersive-subs/desktop-app test:app
git diff --check
```

The boundary search may hit this document or the spec only where those strings explicitly describe paths that remain absent.

## Verification Run

The previous verification record from 2026-06-16 was source-incomplete for renderer final-state UI alignment. The current final state must include the UI list/style reuse, Word Lookup compact dimension controls, and numeric-draft checks above before it is considered verified.

Latest verification on 2026-06-17 after the settings UI alignment follow-up:

- `pnpm --filter @immersive-subs/desktop-app exec vitest run src/renderer/components/settings/SettingsFeatures.test.ts --project jsdom`: 1 file, 27 tests passed.
- `pnpm --filter @immersive-subs/desktop-app exec vitest run src/renderer/stores/desktop.test.ts --project jsdom`: 1 file, 15 tests passed.
- `pnpm --filter @immersive-subs/desktop-app exec vitest run src/renderer/components/settings/profiles/ProfileList.test.ts --project jsdom`: 1 file, 2 tests passed.
- `pnpm --filter @immersive-subs/desktop-app exec vitest run src/renderer/components/settings/SettingsFeatures.browser.test.ts --project browser`: 1 file, 3 tests passed.
- `pnpm --filter @immersive-subs/desktop-app exec vitest run src/renderer/components/settings/SettingsProfiles.browser.test.ts --project browser`: 1 file, 25 tests passed.
- `pnpm --filter @immersive-subs/desktop-app typecheck:app`: passed.
- `pnpm --filter @immersive-subs/desktop-app test:app`: 62 files, 404 tests passed.
- `pnpm --filter @immersive-subs/desktop-app build:app`: passed.
- `node --test scripts/check-ui-boundaries.test.mjs`: 10 tests passed.
- `pnpm lint:ui-boundaries`: passed.
- `pnpm lint:silent-catches`: passed.
- `git diff --check`: passed.
- `rg -n --glob '!*.test.*' --glob '!*.browser.test.*' "settings\\.plugins|pluginCatalog|getPluginCatalog|enablePlugin|disablePlugin|PluginSettings|PluginSettingsSchema|settings/plugins|plugin runtime|plugin lifecycle" apps/desktop-app/src`: no active source matches.
- `rg -n --glob '!*.test.mjs' --glob '!*.test.ts' --glob '!*.browser.test.ts' -- "--color-|--text-" apps packages scripts`: no active source matches.
