# Dynamic Plugin System Implementation Plan

This plan is the final-state implementation reference for the dynamic plugin system and repository-backed plugin distribution. It replaces the earlier step-by-step work logs. Keep this document focused on the intended end state, not migration history.

Source design:

- `docs/superpowers/specs/2026-06-07-dynamic-plugin-system-design.md`

## Goal

The desktop app installs, previews, enables, disables, updates, deletes, and runs downloadable plugins. The first project-maintained plugins are distributed from committed repository artifacts under `plugin-repository/*`, with source under `plugins/*`.

The final implementation uses:

- short manifest `id`
- required `author` metadata
- derived `pluginKey = <author.id>/<id>`
- registry, settings, runtime maps, contribution ownership, and lifecycle actions keyed by `pluginKey`
- installed files under `userData/plugins/installed/<author.id>/<id>/<version>/`
- no `official.*` plugin identity, bundled plugin host, old config reader, migration layer, compatibility shim, or old-ID fallback

## Identity And Manifests

Files:

- `apps/desktop-app/src/main/plugins/pluginIdentity.ts`
- `apps/desktop-app/src/main/plugins/pluginManifest.ts`
- `apps/desktop-app/src/main/plugins/pluginTypes.ts`
- `apps/desktop-app/src/main/plugins/pluginPaths.ts`
- `apps/desktop-app/src/main/plugins/pluginRegistryStore.ts`
- `plugins/*/manifest.json`
- `plugin-repository/*/manifest.json`

Required behavior:

- Manifest `id` is the short plugin ID.
- `author.id` is the path-safe publisher ID.
- `author.name` is required display text.
- `author.url` is optional and must be HTTPS when present.
- `derivePluginKey(manifest)` returns `<author.id>/<id>`.
- `splitPluginKey(pluginKey)` returns path-safe author and short plugin segments.
- Short IDs and author IDs allow letters, digits, `_`, and `-`; dotted global IDs are rejected.
- Remote manifests include `package.url` and `package.sha256`.
- Package manifests omit only the remote `package` descriptor and must otherwise match the remote manifest, including `author`.

Focused verification:

```bash
pnpm --filter @immersive-subs/desktop-app exec vitest run src/main/plugins/pluginManifest.test.ts src/main/plugins/pluginRegistryStore.test.ts src/main/plugins/pluginPackageInstaller.test.ts --project main
pnpm --filter @immersive-subs/desktop-app typecheck:main
```

## Installation And Storage

Files:

- `apps/desktop-app/src/main/plugins/pluginPackageInstaller.ts`
- `apps/desktop-app/src/main/plugins/pluginManager.ts`
- `apps/desktop-app/src/main/settings/appSettingsSanitizer.ts`
- `apps/desktop-app/src/main/window/windowController.ts`

Required behavior:

- Install and update use HTTPS manifest links only.
- The renderer must send a confirmed preview manifest to install.
- The main process refetches the manifest and rejects changed manifests before install.
- The package download must be HTTPS and match `sha256`.
- Archive extraction rejects unsafe entries.
- Registry records are keyed by plugin key and include the installed manifest snapshot.
- Settings live under `settings.plugins[pluginKey].config`.
- Installing the same plugin key and same version is rejected.
- Updating must keep the same plugin key.
- Deleting removes installed files, registry record, and current settings config for that plugin key.
- No old settings shape, old `official.*` key, or deleted-config restore path is supported.

Focused verification:

```bash
pnpm --filter @immersive-subs/desktop-app exec vitest run src/main/plugins/pluginPackageInstaller.test.ts src/main/plugins/pluginManager.test.ts src/main/settings/appSettingsSanitizer.test.ts --project main
pnpm --filter @immersive-subs/desktop-app typecheck:main
```

## Runtime And Sandbox

Files:

- `apps/desktop-app/src/main/plugins/pluginRuntimeHost.ts`
- `apps/desktop-app/src/main/plugins/pluginSandbox.ts`
- `apps/desktop-app/src/main/plugins/pluginWorkerEntry.ts`
- `apps/desktop-app/src/main/plugins/pluginPermissionGate.ts`
- `apps/desktop-app/src/main/plugins/pluginContributionRegistry.ts`
- `apps/desktop-app/src/main/mediaSources/mediaSourceController.ts`
- `apps/desktop-app/src/main/pluginTranscriptionController.ts`

Required behavior:

- Runtime inputs use `pluginKey` for the composite identity.
- Contribution registry records word lookup, transcription, and media source providers by plugin key.
- Plugin code runs in an Electron utility process and restricted VM context.
- The VM receives serialized bridge calls, not host objects or constructors.
- Plugin startup code, parent-initiated plugin calls, host calls, and sandbox timer callbacks are bounded by the request timeout.
- Timer callback timeout is a runtime fault, not a silent no-op.
- Runtime faults, crashes, call timeouts, and config refresh failures stop only the affected plugin, clear its contributions, clear active media-source state owned by that plugin, and mark the plugin `broken`.
- Permission checks use concrete permissions only: `network`, `readSelectedFile`, `transcriptionRuntime`, `settingsSchema`, `wordLookupProvider`, `transcriptionProvider`, and `mediaSourceAdapter`.
- Downloaded plugins never receive direct Electron, unrestricted Node, shell, process, arbitrary filesystem, renderer DOM, or arbitrary IPC access.

Focused verification:

```bash
pnpm --filter @immersive-subs/desktop-app exec vitest run src/main/plugins/pluginSandbox.test.ts src/main/plugins/pluginRuntimeHost.test.ts src/main/plugins/pluginWorkerEntry.test.ts src/main/plugins/pluginContributionRegistry.test.ts src/main/mediaSources/mediaSourceController.test.ts src/main/pluginTranscriptionController.test.ts --project main
pnpm --filter @immersive-subs/desktop-app typecheck:main
```

## Renderer Settings UI

Files:

- `apps/desktop-app/src/common/recommendedPlugins.ts`
- `apps/desktop-app/src/renderer/stores/desktop/actions/pluginActions.ts`
- `apps/desktop-app/src/renderer/stores/desktop/types.ts`
- `apps/desktop-app/src/renderer/components/settings/SettingsPlugins.vue`
- `apps/desktop-app/src/renderer/components/settings/PluginSettingsSchema.vue`
- `apps/desktop-app/src/renderer/components/settings/pluginSettingsSectionKey.ts`
- `apps/desktop-app/src/renderer/components/settings/SettingsWindowShell.vue`

Required behavior:

- Recommended plugins are install links only. They do not grant special trust, automatic install, undeletable status, or a separate update channel.
- Plugin lists show display name, `author.name`, version, status, permissions, errors, and lifecycle actions.
- Normal list rows do not repeat `author.id`, short `id`, full source URL, package URL, or package hash.
- Install confirmation shows display name, version, publisher name, plugin key, compatibility, and requested permissions.
- Lifecycle actions use plugin key.
- Plugin settings section keys use `<pluginKey>::<sectionId>`.
- Plugin settings write to `settings.plugins[pluginKey].config`.

Focused verification:

```bash
pnpm --filter @immersive-subs/desktop-app exec vitest run src/renderer/components/settings/SettingsPlugins.test.ts src/renderer/components/settings/PluginSettingsSchema.test.ts --project jsdom
pnpm --filter @immersive-subs/desktop-app typecheck:renderer
```

## Repository Artifacts

Files:

- `plugins/word-lookup/main.js`
- `plugins/transcription/main.js`
- `plugins/jellyfinemby/main.js`
- `scripts/package-plugins.mjs`
- `plugin-repository/word-lookup/manifest.json`
- `plugin-repository/word-lookup/1.0.0.usp-plugin`
- `plugin-repository/transcription/manifest.json`
- `plugin-repository/transcription/1.0.0.usp-plugin`
- `plugin-repository/jellyfinemby/manifest.json`
- `plugin-repository/jellyfinemby/1.0.0.usp-plugin`

Required behavior:

- Source manifests in `plugins/*` omit remote `package`.
- Generated repository manifests include `package.url` and `package.sha256`.
- Generated `.usp-plugin` archives are deterministic for unchanged plugin source.
- Recommended links use raw GitHub URLs under `plugin-repository/*/manifest.json`.
- Distribution artifacts are committed under `plugin-repository/*`, not `dist/`.

Focused verification:

```bash
pnpm build:plugins
git diff -- plugin-repository plugins
```

## Final Verification

Run these before calling the implementation complete:

```bash
pnpm --filter @immersive-subs/desktop-app typecheck:app
pnpm --filter @immersive-subs/desktop-app test:app
pnpm lint:silent-catches
pnpm build:plugins
git diff --check
rg -n "official\\.|pluginIds|plugins/official|registerBundledPlugin|PluginHost|plugins\\.immersive-subs\\.app" apps/desktop-app/src plugins scripts README.md DEPLOYMENT.md
```

Expected old-code scan result: no source or user-facing documentation references to old `official.*` IDs, old bundled plugin paths, the old plugin host, or the old `plugins.immersive-subs.app` host.
