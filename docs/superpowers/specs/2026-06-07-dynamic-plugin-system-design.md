# Dynamic Plugin System And Repository Distribution Design

Merged from:

- `docs/superpowers/specs/2026-06-05-dynamic-plugin-system-design.md`
- `docs/superpowers/specs/2026-06-06-plugin-repository-distribution-design.md`

Conflict rule: the 2026-06-06 repository distribution design is newer and wins for plugin identity, repository publishing, recommended links, install paths, registry keys, settings keys, and old `official.*` behavior.

This document is the single merged design. It intentionally fuses the two source specs instead of preserving them as appendices, so the old source specs can be deleted after review.

## Goal

Build a real desktop plugin system for Immersive Subs Prompter.

Plugins are installed from HTTPS runtime download links, can be enabled, disabled, updated, and deleted, and are not divided into official and third-party runtime classes. Recommended plugins may appear in Settings, but a recommendation is only a prefilled install link. It does not grant special trust, special permissions, automatic installation, undeletable status, a separate update channel, or privileged runtime behavior.

The first project-maintained plugins are:

- `word-lookup`
- `transcription`
- `jellyfinemby`

These three capabilities are exposed through normal downloadable plugins, and each can be deleted like any other plugin. `word-lookup` and `jellyfinemby` own their provider-specific runtime logic inside the downloaded plugin package. `transcription` is a downloadable provider and settings plugin for the host-owned transcription runtime, because audio extraction, Whisper-compatible uploads, and Faster-Whisper process execution stay in the desktop host instead of granting downloaded plugins process or unrestricted filesystem access.

## Final-State Decisions

- Use HTTPS install links that resolve to remote plugin manifests.
- Use this repository as the distribution source for the first three plugins.
- Publish installable artifacts under committed `plugin-repository/*` files.
- Use GitHub raw URLs for recommended install manifests.
- Keep plugin source under `plugins/*`.
- Keep generated distribution artifacts out of `dist/`.
- Require plugin manifests to use short plugin IDs plus author metadata.
- Derive stable runtime identity as `<author.id>/<id>`.
- Key registry records, settings, catalog actions, runtime maps, contribution ownership, lifecycle operations, and installed paths by plugin key.
- Treat `author.id` as identity and path metadata; normal Settings lists display `author.name` only.
- Allow plugins with the same short ID from different authors to coexist.
- Reject same plugin key plus same version as already installed.
- Do not support the old `official.*` plugin identities, old bundled plugin host, or old config migration.

## Scope Boundaries

The first version does not include:

- a central marketplace
- GitHub Releases for plugins
- GitHub Pages for plugins
- local `file://` plugin installation
- installation from source directories
- bundled privileged plugin installation
- automatic first-run plugin installation
- background automatic plugin updates
- official versus third-party trust tiers
- arbitrary renderer component injection
- direct Electron or unrestricted Node access for plugins
- menu, tray, arbitrary window, or status bar contribution APIs
- keeping deleted plugin config hidden for later restore
- compatibility or migration for old `official.*` plugin identities

## Plugin Identity

Plugin manifests use a short plugin ID and an author object:

```json
{
  "id": "word-lookup",
  "author": {
    "id": "xiitang",
    "name": "XiiTang",
    "url": "https://github.com/XiiTang"
  }
}
```

`id` is the plugin short name. `author.id` is the publisher short name. Both must be path-safe strings using letters, digits, `_`, or `-`; globally dotted plugin IDs are rejected. `author.name` is required display text. `author.url` is optional, but when present it must be an HTTPS URL.

The desktop app derives the internal plugin key:

```text
<author.id>/<id>
```

The project-maintained plugins use these keys:

- `xiitang/word-lookup`
- `xiitang/transcription`
- `xiitang/jellyfinemby`

The plugin key is the stable runtime identity. The manifest `id` remains a short display and package identity field, but all host-owned records and action routes use the plugin key.

## Repository Distribution

Plugin source stays in:

```text
plugins/
  word-lookup/
  transcription/
  jellyfinemby/
```

Installable plugin artifacts are generated into:

```text
plugin-repository/
  word-lookup/
    manifest.json
    1.0.0.usp-plugin
  transcription/
    manifest.json
    1.0.0.usp-plugin
  jellyfinemby/
    manifest.json
    1.0.0.usp-plugin
```

`dist/plugins` is not a distribution directory because `dist/` is disposable build output and is ignored by git.

The default package base URL is:

```text
https://raw.githubusercontent.com/XiiTang/Immersive-Subs-Prompter/main/plugin-repository
```

The recommended plugin install URLs are:

```text
https://raw.githubusercontent.com/XiiTang/Immersive-Subs-Prompter/main/plugin-repository/word-lookup/manifest.json
https://raw.githubusercontent.com/XiiTang/Immersive-Subs-Prompter/main/plugin-repository/transcription/manifest.json
https://raw.githubusercontent.com/XiiTang/Immersive-Subs-Prompter/main/plugin-repository/jellyfinemby/manifest.json
```

Each generated `manifest.json` includes the package descriptor with `url` and `sha256`. Package source manifests inside `.usp-plugin` archives do not include `package`, because the package hash cannot self-reference the archive that contains it.

Updating a project-maintained plugin means changing plugin source, regenerating `plugin-repository/*`, and committing both the package and generated manifest. The manifest hash must match the committed `.usp-plugin`.

## User Experience

Settings -> Plugins shows:

- installed plugins with display name, `author.name`, version, status, permissions, errors, and lifecycle actions
- recommended plugin entries for the three project-maintained plugins
- an install action that accepts an HTTPS plugin manifest link

Install flow:

1. The user enters an install link or clicks a recommended plugin entry.
2. The renderer fetches and validates the remote manifest for preview.
3. The confirmation shows display name, version, `author.name`, plugin key, compatibility, and requested permissions.
4. The confirmed manifest is sent to the main process with the source URL.
5. The main process rejects install requests that do not include the confirmed manifest, refetches the manifest, and rejects the install if the freshly fetched manifest differs from the confirmed manifest.
6. The app downloads, verifies, extracts, and installs the package.
7. The Settings page updates with installed status or an actionable error.

New users do not receive these plugins automatically. They manually install recommended plugins from Settings, then enable and configure them.

Install, update, enable, disable, and delete failures are shown in the Settings plugin page instead of relying on silent renderer-side promise failures.

Deleting a plugin stops it, removes installed files, removes the registry record, and deletes that plugin's current config. The first version does not retain deleted plugin config for restore.

## Manifest Contract

The remote manifest includes:

- `id`
- `author`
- `version`
- `displayName`
- `description`
- `appCompatibility`
- `package.url`
- `package.sha256`
- `entry.main`
- `permissions`
- optional `network`
- optional `contributions`

Manifest validation is exact-shape validation. Unknown fields are rejected. Required fields must have the current expected type. Contribution declarations must be booleans or typed contribution objects as appropriate. Settings default values must match their field types.

`author.id`, `id`, `version`, and `entry.main` must be safe before they are used for filesystem paths. Package extraction rejects unsafe archive entries that escape the prepared directory.

Package manifest validation compares the package manifest against the remote manifest after excluding only the remote `package` descriptor. Package manifest comparison includes `author`; matching only the short plugin ID is not enough.

## Install And Update Behavior

Install flow:

1. Fetch the remote manifest over HTTPS.
2. Validate exact manifest shape, app compatibility, author, safe `author.id`, safe `id`, safe version, safe entry, permissions, network declarations, and contributions.
3. Reject install if the confirmed manifest is missing or the manifest changed after user confirmation.
4. Reject same plugin key and same version.
5. Download the package over HTTPS into `userData/plugins/tmp/<job-id>/`.
6. Verify `sha256`.
7. Extract the package and validate package manifest consistency.
8. If an older version of the same plugin key exists, keep it running until the new package has passed validation.
9. Install to `userData/plugins/installed/<author.id>/<id>/<version>/`.
10. Stop the old runtime only when the new package is ready for replacement.
11. Write registry state keyed by plugin key and push catalog updates to renderer windows.
12. If a replacement runtime cannot start, restore the previous enabled registry record and restart the previous runtime.

Update uses the stored `sourceUrl`. The fetched update manifest must derive the same plugin key as the installed plugin. A new version replaces the old version through the same validated replacement path.

There is no official update channel.

## Storage Model

Use the user data directory:

```text
userData/plugins/
  registry.json
  tmp/<job-id>/
  installed/<author.id>/<id>/<version>/
    manifest.json
    main.js
    renderer/
```

Registry records store:

- `pluginKey`
- `manifest`
- `sourceUrl`
- `enabled`
- `status`
- `error`
- `installedAt`
- `updatedAt`

The stored manifest is the current installed manifest snapshot. Catalog rows are rendered from this snapshot, so a failed partial delete can still show an actionable broken row even when files under `installed/` are incomplete.

Supported statuses:

- `disabled`
- `enabled`
- `updating`
- `broken`

Plugin config is stored under `settings.plugins[pluginKey]`.

## Runtime Architecture

The desktop app keeps a main-process `PluginManager`. It owns:

- install, update, enable, disable, delete, and restart orchestration
- registry reads and writes
- runtime startup and shutdown
- permission enforcement
- contribution registration and cleanup
- config default creation and deletion
- plugin catalog broadcasting

Enabled plugins run in an Electron utility-process host. Downloaded plugin code is not loaded into the Electron main process and is not injected as arbitrary Vue code into the renderer.

Plugin communication uses RPC. The plugin process receives a limited `usp` API based on its manifest permissions. The plugin cannot access Electron, `ipcMain`, renderer DOM, or unrestricted Node APIs. The VM context receives only serialized bridge calls. Provider objects, timer callbacks, host constructors, and host response objects stay on their owning side of the boundary. The plugin context recreates safe wrapper objects from serialized data.

Plugin startup code, parent-initiated provider calls, host calls, and sandbox timer callbacks are bounded by the plugin request timeout. A timeout is a runtime fault: only that plugin is stopped, its contributions are cleared, and its catalog row is marked `broken`.

If a plugin crashes or times out, only that plugin moves to `broken`. The desktop app remains running.

When plugin settings change, the host pushes current plugin config and recomputed access grants into enabled runtimes. Network grants are limited to manifest `network.allowedHosts` plus `serverList` `serverUrl` hosts. File grants come from schema `file` fields in the saved plugin config. Plugins do not keep a stale startup-only config snapshot.

Contribution registration can happen during startup or later async initialization. When a runtime announces a new contribution, `PluginManager` updates the contribution registry for that enabled plugin key.

## Permissions

The first version uses concrete permissions only:

- `network`: access manifest-declared hosts through `network.allowedHosts` or hosts from schema `serverList` records in the plugin's saved config
- `readSelectedFile`: read files configured through schema `file` fields under the plugin's own config
- `transcriptionRuntime`: call the host-managed transcription service for active media; the runtime accepts only the target video URL and host-normalizes the saved plugin settings
- `settingsSchema`: contribute a schema-rendered settings page
- `wordLookupProvider`: register a word lookup provider
- `transcriptionProvider`: register a transcription provider
- `mediaSourceAdapter`: register an external media source adapter

Runtime API calls are denied when the manifest did not grant the required permission.

## Plugin Contributions

### Settings

Plugins declare settings pages through manifest schema contributions. The renderer uses host-owned components to render the schema. The first version does not allow plugin-provided Vue components and does not expose a runtime `usp.registerSettings` API.

Plugin settings sections use composite navigation keys:

```text
<pluginKey>::<sectionId>
```

This prevents collisions when two authors publish the same short plugin ID or settings section ID.

Supported schema field types are:

- `string`
- `number`
- `boolean`
- `select`
- `file`
- `textarea`
- `serverList`

Media-server plugins use `serverList` for structured records with `id`, `name`, `serverUrl`, `apiKey`, and `enabled`. They do not use JSON text blobs for server configuration, so network grants can be computed from the same structured config the plugin receives. Manifest `serverList` defaults must be empty; hosts are granted only after they are present in saved plugin config.

### Word Lookup

Word lookup plugins register a provider that accepts a token and optional context, then returns text or markdown lookup results.

The host owns:

- subtitle token hover behavior
- the floating lookup window
- window sizing and positioning
- markdown rendering

The plugin owns dictionary loading, lookup logic, and config interpretation.

### Transcription

Transcription plugins register a provider that accepts the active media context and plugin config, then returns a `SubtitleTrack` or an error.

The host owns:

- current video state
- transcription status projection into `StateManager`
- cache placement
- subtitle track insertion and replacement
- track selection
- renderer updates
- audio extraction
- Whisper-compatible API uploads
- Faster-Whisper process execution

The plugin owns provider registration and settings schema. The host owns transcription config normalization before it starts audio extraction, API upload, or Faster-Whisper execution, and plugins cannot pass custom `yt-dlp` args, API base URLs, or executable paths directly through the runtime bridge.

### Media Source Adapter

Media server plugins register an external media source adapter. This is not a replacement for the app's core subtitle and playback state machine.

The host owns:

- `DesktopState` and `PlaybackState`
- `activeSource` transitions
- profile selection
- subtitle priority selection
- subtitle track projection into the renderer
- browser extension playback sync
- yt-dlp subtitle loading
- playback command routing

The adapter owns only source-specific protocol behavior:

- recognizing whether a browser video context belongs to the media source
- resolving media item identity from source URLs or browser payloads
- connecting to the external media server
- aggregating external sessions
- mapping sessions to the active tab or item context
- loading subtitle streams from the external source
- converting external playback state into host playback snapshots

Adapters emit standard events:

- `sourceMatched`
- `sessionsChanged`
- `subtitleTracksLoaded`
- `playbackSnapshot`
- `sourceDisconnected`
- `error`

The host consumes those events and updates the shared state machine. Connection messages wait for media-source adapter handling before falling back to the browser-extension subtitle path. Events from the active media-source adapter are marked handled so extension playback updates do not overwrite adapter-projected playback. A new browser video context that no longer matches any media-source adapter clears active media-source state and then falls through to normal extension handling.

## Existing Capability Cutover

`word-lookup` becomes a normal downloadable word lookup provider plugin. The host keeps hover, floating UI, markdown rendering, and resize behavior.

`transcription` becomes a normal downloadable transcription provider and settings plugin. The host keeps active video state, cache integration, status updates, subtitle track injection, audio extraction, Whisper-compatible API uploads, and Faster-Whisper process execution.

`jellyfinemby` becomes a normal downloadable media source adapter plugin. It owns Jellyfin/Emby URL and item detection, server connections, sessions, subtitle stream fetching, and playback snapshot conversion. The host keeps state projection and UI behavior.

Recommended entries for these plugins are GitHub raw manifest links under `plugin-repository/*`.

## Old Plugin Model

The old plugin identities are not supported:

- `official.transcription`
- `official.word-lookup`
- `official.jellyfinemby`

The old bundled plugin model remains removed:

- no `plugins/official/*`
- no `pluginIds.ts`
- no `registerBundledPlugin()` path
- no privileged `PluginHost`
- no old ID to new key mapping
- no old config reader
- no old config to new config conversion
- no hidden backup of old plugin config

The app does not actively delete leftover `settings.plugins["official.*"]` records in this design. Those keys are inert because no runtime, catalog row, settings page, recommendation, or command path references them.

## Error Handling

Install failures do not create installed plugin records.

Enable failures keep the plugin installed, mark it `broken` with the error message, and broadcast the updated plugin catalog.

Runtime crashes and plugin call timeouts stop only the affected plugin, clear its registered handlers, clear any active media-source state owned by that plugin, and mark it `broken`.

Runtime config refresh failures, including media-source adapter settings refresh failures, stop only the affected plugin, clear its registered handlers, clear any active media-source state owned by that plugin, and mark it `broken`.

Update failures before replacement keep the current installed version active. If replacement fails after the old plugin was stopped, the host restarts the previous version when it was enabled before the update.

Delete stops the plugin first, then removes installed files, registry state, and config. If file deletion fails, the UI reports the error and the registry is not silently rewritten as deleted; if the stopped runtime cannot be restored because the install directory is incomplete, the catalog keeps a readable `broken` row with the delete and restore errors.

## Documentation

Project docs should describe only the final install model:

- plugin source lives in `plugins/*`
- installable artifacts live in committed `plugin-repository/*`
- recommended links use GitHub raw URLs
- users install recommended plugins manually from Settings
- no GitHub Release assets are used for plugins
- no auto-preinstalled default plugins
- no old `official.*` plugin compatibility or migration

## Testing

Focused coverage should include:

- manifest validation requires `author.id` and `author.name`
- manifest validation accepts optional HTTPS `author.url`
- `author.id`, `id`, `version`, and entry paths must be path-safe
- plugin key is derived as `<author.id>/<id>`
- same short ID with different author IDs can coexist
- same key and same version is rejected as already installed
- install paths expand to `installed/<author.id>/<id>/<version>/`
- registry records, settings records, runtime maps, contribution ownership, and catalog actions use plugin key
- package manifest validation compares author and ID, not only short ID
- package hash and package manifest consistency
- atomic install and replacement
- delete cleanup of install directory, registry, and plugin config
- registry transitions for install, enable, disable, update, delete, broken, and crash
- Settings UI error reporting for install, update, enable, disable, and delete
- Settings UI install link entry, recommended entries, permission confirmation, update, delete, and schema rendering
- runtime config refresh after plugin settings updates
- runtime contribution registration during async plugin initialization
- permission denial for undeclared file, network, and contribution calls
- plugin process crash isolation
- plugin timeout isolation
- recommended plugin URLs point to `raw.githubusercontent.com/.../plugin-repository/.../manifest.json`
- `plugin-repository` manifests contain package URLs under the same raw base URL
- `pnpm build:plugins` regenerates deterministic installable artifacts in `plugin-repository`
- word lookup plugin cutover behavior
- transcription plugin cutover behavior, including cache and subtitle track injection
- Jellyfin/Emby media source adapter behavior, including session matching, subtitle event projection, and playback snapshot projection
- media-source adapter handoff behavior, including handled playback events and clearing active media-source state when a new video context no longer matches an adapter

Verification commands:

```bash
pnpm --filter @immersive-subs/desktop-app test:app
pnpm --filter @immersive-subs/desktop-app typecheck:app
pnpm test
pnpm typecheck
pnpm build
```
