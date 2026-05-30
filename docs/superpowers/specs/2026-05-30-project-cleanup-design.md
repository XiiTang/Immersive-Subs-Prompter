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

P1 and P2 items in `todo.md` are outside this cleanup unless they are directly required by the scoped changes above.

## Settings Boundary

The main process is the authoritative settings boundary.

Settings loaded from disk are normalized to the current final structure. Invalid fields use current defaults for that field or section. This read path exists to keep a malformed local settings file from discarding unrelated valid settings.

Settings written through `updateSettings` are validated against the current final structure and rejected when the shape is invalid.

`global.alwaysOnTop` accepts only:

- `"off"`
- `"floating"`
- `"screen-saver"`

Boolean `alwaysOnTop` values are invalid.

Transcription `extraParams` accepts only a non-array object whose entries can be normalized to string values. String JSON input is invalid. Failed JSON parsing is not a settings concern because the final settings shape is already an object.

## Plugin Configuration

Renderer plugin settings consume the settings returned by main as already normalized data.

The renderer store does not maintain independent sanitizer logic for Word Lookup, Jellyfin/Emby, or transcription plugin config. It may use narrow typed accessors for known plugin config records, but those accessors do not clamp values, parse legacy shapes, or recreate a second defaulting pipeline.

Shared defaults and lightweight construction helpers that are needed by both renderer and main live under `apps/desktop-app/src/common`. Plugin configuration does not move to `packages/contracts` in this cleanup because these settings are desktop-app internals rather than a cross-package public contract.

Creating a new plugin config record uses the shared current default structure. Reading a missing plugin config relies on main-provided sanitized settings; tests may create complete settings fixtures instead of depending on renderer-side defaulting behavior.

## Jellyfin/Emby

The old `apps/desktop-app/src/main/jellyfinembyApiClient.ts` helper layer is absent from the final codebase. Production Jellyfin/Emby behavior is owned by `apps/desktop-app/src/main/jellyfinemby/*`.

Only tests covering the active Jellyfin/Emby implementation remain.

Media-server session tracking stores session summaries and the active session id. It does not store sticky item ids or per-item position history.

For the active session, the current `MediaServerSessionSummary.nowPlayingItemId` is the effective item. Playback emission and subtitle loading follow the current session summary directly. If the active session reports no item, subtitles are cleared for that session.

Duplicate subtitle loading for unchanged media remains the responsibility of the subtitle loader's current item-key behavior. There is no additional sticky item selection layer in the tracker.

## Faster-Whisper IPC

The renderer API exposes `getFasterWhisperStatus` for Faster-Whisper status. That status includes downloaded model information.

There is no `listFasterWhisperModels` preload method and no `usp:faster-whisper-list-models` IPC handler.

`FasterWhisperManager.listDownloadedModels()` remains available to main-process code because `getStatus()` uses it.

No compatibility IPC route is kept for the removed renderer API.

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

## Error Handling

Removed APIs and exports are removed plainly. The final codebase does not include deprecation wrappers, compatibility branches, or explicit old-code rejection branches.

Validation failures in settings update paths throw clear errors and rely on the existing renderer rollback behavior.

Build-time manifest version injection fails the build on invalid input instead of using a hardcoded version.

## Tests

Tests verify final behavior directly:

- No production or test code imports the removed Jellyfin/Emby API client.
- Settings update validation rejects boolean `alwaysOnTop`.
- Settings update validation rejects string `extraParams`.
- Settings disk-load sanitizing normalizes invalid current-shape fields without legacy parsing.
- Faster-Whisper renderer types and IPC handlers expose status, paths, downloads, and progress, but not list-models.
- Extension output manifests use `apps/extension/package.json` as their version source and do not include `alarms`.
- Contracts endpoint URL tests cover authenticated endpoint URL construction without a desktop forwarding helper.
- Jellyfin/Emby active-session processing follows the current reported item id, including a paused first observation of a different item.
- Renderer plugin config accessors do not duplicate main sanitizer behavior.

Verification commands:

```bash
pnpm --dir apps/desktop-app exec tsc -p tsconfig.json --noEmit
pnpm --dir apps/desktop-app exec vue-tsc --noEmit -p tsconfig.renderer.json
pnpm --dir apps/extension exec tsc -p tsconfig.json --noEmit
pnpm --dir packages/contracts exec tsc -p tsconfig.json --noEmit
node scripts/check-silent-catches.mjs
```
