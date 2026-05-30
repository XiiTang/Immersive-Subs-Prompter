# Project Cleanup Design

## Goal

Remove unused code paths, duplicate configuration logic, obsolete compatibility behavior, and unused generated artifacts called out in `todo.md`.

The project has not shipped. The final implementation must not include compatibility, migration, legacy-data handling, transition layers, deprecated exports, old-code rejection layers, or replacement paths for removed APIs or old settings shapes.

This spec describes the target final state only.

## Scope

This cleanup covers:

- The unused Jellyfin/Emby API helper layer.
- Settings sanitizers for current settings shapes.
- The unused Faster-Whisper list-models IPC and preload API.
- Extension manifest permissions and version source.
- Unreferenced screenshot snapshot PNGs.
- Dead helper exports and default constants.
- Jellyfin/Emby media-server item selection.
- Renderer-side plugin configuration defaults and sanitizing.

The original scoped cleanup covered P3 plus the Jellyfin/Emby subtitle key fix. The follow-up pass also completed the remaining P1/P2 cleanup items in `todo.md`; the final state below includes those outcomes.

## Settings Boundary

The main process is the authoritative settings boundary.

Settings loaded from disk are normalized to the current final structure. Invalid fields use current defaults for that field or section, and saved `defaultProfileId` values are ignored in favor of the fixed fallback profile id. This read path exists to keep a malformed local settings file from discarding unrelated valid settings.

Settings written through `updateSettings` are validated against the current final structure and saved directly after validation. The write path does not call the disk-load sanitizer after validation.

Settings update payloads are exact current shapes. Unknown top-level fields and unknown fields inside current built-in settings sections are errors. Removed settings fields are not carried forward by spreading unrecognized data into the saved settings file.

`updateSettings` validates `profiles` and `rules` as complete current structures. Invalid profile fields, invalid rule targets, dropped rules, missing fallback profile entries, and fallback profiles that are not last are errors rather than sanitizer work.

`defaultProfileId` is owned by the fixed fallback profile invariant and is not changed through settings updates.

Profile font-family and color values written through `updateSettings` must be current, valid settings. Unsupported font-family strings and empty color strings are rejected instead of being silently replaced with defaults.

`global.alwaysOnTop` accepts only:

- `"off"`
- `"floating"`
- `"screen-saver"`

Boolean `alwaysOnTop` values are invalid.

Transcription `extraParams` accepts only a non-array object with non-empty trimmed string keys and string values. String JSON input and non-string values are invalid. Failed JSON parsing is not a settings concern because the final settings shape is already an object.

Jellyfin/Emby `webSocketPath` written through `updateSettings` must already start with `/`; the write path does not prefix it.

Transcription `activeConfigId` written through `updateSettings` must reference an existing current transcription config.

## Plugin Configuration

Renderer plugin settings consume the settings returned by main as already normalized data.

The renderer store does not maintain independent sanitizer logic for Word Lookup, Jellyfin/Emby, or transcription plugin config. It may use narrow typed accessors for known plugin config records, but those accessors do not clamp values, parse legacy shapes, or recreate a second defaulting pipeline.

Shared defaults and lightweight construction helpers that are needed by both renderer and main live under `apps/desktop-app/src/common`. Plugin configuration does not move to `packages/contracts` in this cleanup because these settings are desktop-app internals rather than a cross-package public contract.

Creating a new plugin config record uses the shared current default structure. Reading a missing plugin config relies on main-provided sanitized settings; tests may create complete settings fixtures instead of depending on renderer-side defaulting behavior.

Main-process runtime services consume the already-normalized settings structure. The disk-load sanitizer is not re-run inside MediaServer, Transcription, or Word Lookup service reads.

## Jellyfin/Emby

The old `apps/desktop-app/src/main/jellyfinembyApiClient.ts` helper layer is absent from the final codebase. Production Jellyfin/Emby behavior is owned by `apps/desktop-app/src/main/jellyfinemby/*`.

Only tests covering the active Jellyfin/Emby implementation remain.

Media-server session tracking stores session summaries and the active session id. It does not store sticky item ids or per-item position history.

For the active session, the current `MediaServerSessionSummary.nowPlayingItemId` is the effective item. Playback emission and subtitle loading follow the current session summary directly. If the active session reports no item, subtitles are cleared for that session.

Duplicate subtitle loading for unchanged media remains the responsibility of the subtitle loader's current item-key behavior. There is no additional sticky item selection layer in the tracker.

Clearing the active Jellyfin/Emby subtitle state also invalidates any in-flight subtitle load. A stale subtitle fetch cannot emit tracks after the active session reports no item or the active session changes.

Repeated session snapshots for the same active media do not start duplicate subtitle downloads while a load for that media is already in flight. The loader only records a media key as completed after at least one valid track is parsed.

## Faster-Whisper IPC

The renderer API exposes `getFasterWhisperStatus` for Faster-Whisper status. That status includes downloaded model information.

There is no `listFasterWhisperModels` preload method and no `usp:faster-whisper-list-models` IPC handler.

`FasterWhisperManager.listDownloadedModels()` remains available to main-process code because `getStatus()` uses it.

No compatibility IPC route is kept for the removed renderer API.

Managed Faster-Whisper binary downloads are Windows-only because the bundled assets are Windows `.exe` / `.7z` packages. Non-Windows builds may use a manually configured binary path, but the managed binary download action is disabled and the IPC path rejects it.

## Transcription

Whisper JSON transcription responses must contain timestamped `segments`. Each emitted cue must come from a segment with numeric finite `start` and `end` values where `end` is after `start`. Coercible values such as `null`, empty strings, or numeric strings are invalid. JSON responses with only plain `text` are invalid for subtitle generation and do not receive a synthetic timeline.

Plain text transcription responses are accepted only when they parse as real SRT or VTT subtitle text.

## Extension Manifest

The extension manifests request only permissions used by the extension. The unused `alarms` permission is not present.

`apps/extension/package.json` is the single version source for extension builds.

Chrome and Firefox build output manifests receive their `version` from `package.json` during the build. Source manifests keep platform-specific manifest differences and do not maintain independent version values.

If the package version cannot be read or written to the output manifest, the extension build fails.

## Removed Artifacts And Dead Exports

Unreferenced screenshot PNGs under renderer component `__screenshots__` directories are absent.

No visual-regression baseline workflow is added by this cleanup. If visual regression returns later, it needs an explicit matcher and baseline maintenance process.

`connectionAuth.ts` does not export a `buildAuthenticatedEndpoint` forwarding helper. Call sites use the contracts helper directly when they need endpoint URL construction.

`settings/constants.ts` does not export `DEFAULT_WS_HOST`, `DEFAULT_WS_PORT`, or `DEFAULT_WS_ENDPOINT_ID`. Code that needs default network settings uses `DEFAULT_NETWORK_SETTINGS` or the shared default endpoint list directly.

`GlobalSettings` does not include `closeBehavior`. Window close behavior is not configurable in the current product shape.

## State Consistency

Extension subtitle downloads only write results while the request token still matches, the active source is still `extension`, and the current video URL is still the URL that started the request. A stale extension subtitle request cannot overwrite MediaServer state after a source switch.

Jellyfin/Emby subtitle downloads only emit results while their request token still matches. Clearing the current media-server subtitle state invalidates older fetches, including subtitle metadata refreshes that have not yet resolved.

## Error Handling

Removed APIs and exports are removed plainly. The final codebase does not include deprecation wrappers, compatibility branches, or explicit old-code rejection branches.

Validation failures in settings update paths throw clear errors and rely on the existing renderer rollback behavior.

Build-time manifest version injection fails the build on invalid input instead of using a hardcoded version.

## Tests

Tests verify final behavior directly:

- No production or test code imports the removed Jellyfin/Emby API client.
- Settings update validation rejects boolean `alwaysOnTop`.
- Settings update validation rejects unknown fields in current built-in settings sections instead of writing removed or stray settings.
- Settings update validation rejects string `extraParams` and non-string `extraParams` values.
- Settings update validation rejects unsupported profile font-family values and transcription `activeConfigId` values that do not reference a config.
- Settings update validation rejects invalid `profiles`, invalid `rules`, `defaultProfileId` patches, fallback profile reordering, and write values that only the disk-load sanitizer would normalize.
- Settings disk-load sanitizing normalizes invalid current-shape fields without legacy parsing.
- Faster-Whisper renderer types and IPC handlers expose status, paths, downloads, and progress, but not list-models.
- Extension output manifests use `apps/extension/package.json` as their version source and do not include `alarms`.
- Contracts endpoint URL tests cover authenticated endpoint URL construction without a desktop forwarding helper.
- Jellyfin/Emby active-session processing follows the current reported item id, including a paused first observation of a different item.
- Renderer plugin config accessors do not duplicate main sanitizer behavior.
- Main-window first render does not mount settings-dependent subtitle UI before sanitized settings are available.
- Extension subtitle requests do not write tracks after a MediaServer source switch.
- Jellyfin/Emby subtitle requests do not write tracks after the active session reports no item.
- Jellyfin/Emby subtitle metadata refreshes do not continue into subtitle stream downloads after the active session reports no item.
- Jellyfin/Emby unchanged-media session snapshots do not start duplicate subtitle downloads while a matching load is in flight.
- Whisper JSON transcription rejects responses without timestamped segments.
- Whisper JSON transcription rejects segments whose timestamps are not numbers.
- Faster-Whisper managed binary downloads are unavailable outside Windows.
- `GlobalSettings` has no `closeBehavior` field.

Verification commands:

```bash
pnpm --dir apps/desktop-app exec tsc -p tsconfig.json --noEmit
pnpm --dir apps/desktop-app exec vue-tsc --noEmit -p tsconfig.renderer.json
pnpm --dir apps/extension exec tsc -p tsconfig.json --noEmit
pnpm --dir packages/contracts exec tsc -p tsconfig.json --noEmit
node scripts/check-silent-catches.mjs
pnpm --dir apps/extension run build
pnpm --dir packages/contracts exec vitest run src/network-endpoints.test.ts
pnpm --dir apps/desktop-app exec vitest run --project main
pnpm --dir apps/desktop-app exec vitest run --project jsdom
pnpm --dir apps/desktop-app exec vitest run --project browser
git diff --check
```
