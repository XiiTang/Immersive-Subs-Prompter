# Dynamic Plugin System And Repository Distribution Implementation Plan

Merged from:

- `docs/superpowers/plans/2026-06-05-dynamic-plugin-system.md`
- `docs/superpowers/plans/2026-06-06-plugin-repository-distribution.md`

Conflict rule: the 2026-06-06 repository distribution plan is newer and wins for plugin identity, install paths, registry keys, settings keys, recommended links, source manifests, repository artifacts, and unsupported old-plugin behavior.

This is the fused implementation plan. It intentionally removes the appendix-style source dump and rewrites the work as one final-state plan, so the two source plan files can be deleted after review.

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` or `superpowers:executing-plans` before implementing this plan task-by-task. Track execution with checkbox (`- [ ]`) items.

## Goal

Replace the bundled-only plugin toggle model with downloadable, deletable, isolated runtime plugins, then distribute the first three project-maintained plugins from this repository through GitHub raw HTTPS manifests.

The final system uses:

- short manifest IDs
- required author metadata
- derived `<author.id>/<id>` plugin keys
- registry and settings records keyed by plugin key
- installed files under `installed/<author.id>/<id>/<version>/`
- committed `plugin-repository/*` artifacts
- recommended Settings entries that point to raw GitHub manifests

## Merge Resolution

The original 2026-06-05 plan established the broad dynamic plugin architecture. The 2026-06-06 plan updates the identity and distribution model. This merged plan keeps the broad architecture and rewrites all affected implementation details to the 2026-06-06 final model.

Use these final decisions everywhere:

- `pluginKey = <author.id>/<id>` is the runtime identity.
- Manifest `id` is a short plugin ID, not an `official.*` or globally unique dotted ID.
- `author` is required in all remote and package manifests.
- Registry records include `pluginKey`, `id`, and `author`.
- Plugin config lives under `settings.plugins[pluginKey]`.
- Catalog rows and renderer actions use `pluginKey`.
- Install paths expand the plugin key into path segments.
- Recommended entries use GitHub raw manifest URLs under `plugin-repository`.
- Source manifests in `plugins/*` must not include the remote `package` descriptor.
- Package manifests must match remote manifests except for the remote-only `package` descriptor.
- No old `official.*` compatibility, old config migration, old ID mapping, old config reader, `file://` install, GitHub Releases, GitHub Pages, automatic preinstall, or background automatic updates should be added.

## File Structure

Create or modify these focused units:

- `apps/desktop-app/src/main/plugins/pluginIdentity.ts`
- `apps/desktop-app/src/main/plugins/pluginManifest.ts`
- `apps/desktop-app/src/main/plugins/pluginTypes.ts`
- `apps/desktop-app/src/main/plugins/pluginPaths.ts`
- `apps/desktop-app/src/main/plugins/pluginRegistryStore.ts`
- `apps/desktop-app/src/main/plugins/pluginPackageInstaller.ts`
- `apps/desktop-app/src/main/plugins/pluginRuntimeHost.ts`
- `apps/desktop-app/src/main/plugins/pluginSandbox.ts`
- `apps/desktop-app/src/main/plugins/pluginWorkerEntry.ts`
- `apps/desktop-app/src/main/plugins/pluginPermissionGate.ts`
- `apps/desktop-app/src/main/plugins/pluginContributionRegistry.ts`
- `apps/desktop-app/src/main/plugins/pluginManager.ts`
- `apps/desktop-app/src/main/mediaSources/mediaSourceController.ts`
- `apps/desktop-app/src/main/ipc/handlers/pluginHandlers.ts`
- `apps/desktop-app/src/main/settings/appSettingsSanitizer.ts`
- `apps/desktop-app/src/main/window/windowController.ts`
- `apps/desktop-app/src/preload.cts`
- `apps/desktop-app/src/common/recommendedPlugins.ts`
- `apps/desktop-app/src/renderer/stores/desktop/actions/pluginActions.ts`
- `apps/desktop-app/src/renderer/stores/desktop/types.ts`
- `apps/desktop-app/src/renderer/components/settings/SettingsPlugins.vue`
- `apps/desktop-app/src/renderer/components/settings/pluginSettingsSectionKey.ts`
- `apps/desktop-app/src/renderer/components/settings/PluginSettingsSchema.vue`
- `apps/desktop-app/src/renderer/components/settings/SettingsWindowShell.vue`
- `plugins/word-lookup/manifest.json`
- `plugins/transcription/manifest.json`
- `plugins/jellyfinemby/manifest.json`
- `scripts/package-plugins.mjs`
- `plugin-repository/word-lookup/manifest.json`
- `plugin-repository/word-lookup/1.0.0.usp-plugin`
- `plugin-repository/transcription/manifest.json`
- `plugin-repository/transcription/1.0.0.usp-plugin`
- `plugin-repository/jellyfinemby/manifest.json`
- `plugin-repository/jellyfinemby/1.0.0.usp-plugin`
- `README.md`
- `DEPLOYMENT.md`

## Task 1: Manifest, Author Identity, And Plugin Key

**Files:**

- Create: `apps/desktop-app/src/main/plugins/pluginIdentity.ts`
- Modify: `apps/desktop-app/src/main/plugins/pluginManifest.ts`
- Modify: `apps/desktop-app/src/main/plugins/pluginManifest.test.ts`

- [ ] Add manifest tests for required author metadata, derived plugin key, unsafe author IDs, non-HTTPS author URLs, and package manifest author mismatch.
- [ ] Add `PluginAuthor`, `PluginKeyParts`, path-safe identity validation, `derivePluginKey`, and `splitPluginKey`.
- [ ] Replace any manifest ID validation that assumes a globally unique dotted ID with shared path-safe segment validation.
- [ ] Require `author` in every valid manifest.
- [ ] Validate `author.id`, `author.name`, and optional HTTPS `author.url`.
- [ ] Include `author` in exact manifest keys, package manifest keys, and comparable package-manifest fields.
- [ ] Add author metadata to every valid manifest test fixture.

Required identity helper shape:

```ts
export interface PluginAuthor {
  id: string;
  name: string;
  url?: string;
}

export interface PluginKeyParts {
  authorId: string;
  pluginId: string;
}

export function derivePluginKey(input: { author: Pick<PluginAuthor, "id">; id: string }): string {
  return `${input.author.id}/${input.id}`;
}
```

Manifest validation must accept a final manifest like:

```json
{
  "id": "word-lookup",
  "author": {
    "id": "xiitang",
    "name": "XiiTang",
    "url": "https://github.com/XiiTang"
  },
  "version": "1.0.0",
  "displayName": "Word Lookup",
  "description": "Looks up subtitle words.",
  "appCompatibility": { "minVersion": "1.0.0" },
  "package": {
    "url": "https://raw.githubusercontent.com/XiiTang/Immersive-Subs-Prompter/main/plugin-repository/word-lookup/1.0.0.usp-plugin",
    "sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
  },
  "entry": { "main": "main.js" },
  "permissions": ["settingsSchema", "wordLookupProvider"],
  "contributions": { "settings": [], "wordLookup": true }
}
```

Focused verification:

```bash
pnpm --filter @immersive-subs/desktop-app exec vitest run src/main/plugins/pluginManifest.test.ts --project main
pnpm --filter @immersive-subs/desktop-app typecheck:main
```

Suggested commit:

```bash
git add apps/desktop-app/src/main/plugins/pluginIdentity.ts apps/desktop-app/src/main/plugins/pluginManifest.ts apps/desktop-app/src/main/plugins/pluginManifest.test.ts
git commit -m "feat: add plugin author identity"
```

## Task 2: Registry Records, Catalog Types, And Install Paths

**Files:**

- Modify: `apps/desktop-app/src/main/plugins/pluginTypes.ts`
- Modify: `apps/desktop-app/src/main/plugins/pluginPaths.ts`
- Modify: `apps/desktop-app/src/main/plugins/pluginRegistryStore.ts`
- Modify: `apps/desktop-app/src/main/plugins/pluginRegistryStore.test.ts`
- Create: `apps/desktop-app/src/main/plugins/pluginPaths.test.ts`

- [ ] Add tests proving registry records are keyed by plugin key.
- [ ] Add tests rejecting records whose `pluginKey` does not match `author.id` plus `id`.
- [ ] Add path tests proving `xiitang/word-lookup` expands to `installed/xiitang/word-lookup/<version>/`.
- [ ] Update installed record, catalog row, and recommended entry types to carry `pluginKey`, short `id`, and `author`.
- [ ] Update registry validation to require `pluginKey`, `id`, `author`, `version`, `sourceUrl`, `enabled`, `status`, `permissions`, `error`, `installedAt`, and `updatedAt`.
- [ ] Rename registry operation parameters from `pluginId` to `pluginKey`.
- [ ] Ensure `getPlugin`, `writePlugin`, `updatePlugin`, and `deletePlugin` preserve the record key and reject mismatched identity.

Final type shape:

```ts
export interface InstalledPluginRecord {
  pluginKey: string;
  id: PluginManifest["id"];
  author: PluginAuthor;
  version: string;
  sourceUrl: string;
  enabled: boolean;
  status: LocalPluginStatus;
  permissions: PluginPermission[];
  error: string | null;
  installedAt: string;
  updatedAt: string;
}

export interface PluginCatalogRow {
  pluginKey: string;
  id: PluginManifest["id"];
  author: PluginAuthor;
  version: string;
  displayName: string;
  description: string;
  sourceUrl: string;
  status: LocalPluginStatus;
  enabled: boolean;
  error: string | null;
  permissions: PluginPermission[];
  settings?: PluginSettingsContribution[];
  contributions?: PluginContributionDeclarations;
}
```

Final path helper behavior:

```ts
getPluginInstallPath(root, "xiitang/word-lookup", "1.0.0")
// root/installed/xiitang/word-lookup/1.0.0
```

Focused verification:

```bash
pnpm --filter @immersive-subs/desktop-app exec vitest run src/main/plugins/pluginRegistryStore.test.ts src/main/plugins/pluginPaths.test.ts --project main
pnpm --filter @immersive-subs/desktop-app typecheck:main
```

Suggested commit:

```bash
git add apps/desktop-app/src/main/plugins/pluginTypes.ts apps/desktop-app/src/main/plugins/pluginPaths.ts apps/desktop-app/src/main/plugins/pluginPaths.test.ts apps/desktop-app/src/main/plugins/pluginRegistryStore.ts apps/desktop-app/src/main/plugins/pluginRegistryStore.test.ts
git commit -m "refactor: key plugin registry by author identity"
```

## Task 3: Package Download, Hash, Extraction, And Atomic Install

**Files:**

- Modify: `apps/desktop-app/src/main/plugins/pluginPackageInstaller.ts`
- Modify: `apps/desktop-app/src/main/plugins/pluginPackageInstaller.test.ts`

- [ ] Keep `defaultFetchBytes` HTTPS-only.
- [ ] Add installer tests for author-aware package manifest validation.
- [ ] Add installer tests proving same short ID from different authors installs into separate directories.
- [ ] Add installer tests for hash mismatch, unsafe archive paths, missing entry files, package manifest mismatch, and replacement rollback.
- [ ] Use `derivePluginKey(remoteManifest)` to compute install paths.
- [ ] Keep source/package manifests free of the remote-only `package` field.
- [ ] Verify package manifest matches remote manifest except `package`.
- [ ] Reject same plugin key and same version before replacement.
- [ ] Keep the old version running until the new package passes validation.
- [ ] Restore the previous enabled record/runtime if replacement startup fails after the old runtime was stopped.

Final install path creation:

```ts
const installDir = getPluginInstallPath(
  rootDir,
  derivePluginKey(remoteManifest),
  remoteManifest.version
);
```

Focused verification:

```bash
pnpm --filter @immersive-subs/desktop-app exec vitest run src/main/plugins/pluginPackageInstaller.test.ts --project main
pnpm --filter @immersive-subs/desktop-app typecheck:main
```

Suggested commit:

```bash
git add apps/desktop-app/src/main/plugins/pluginPackageInstaller.ts apps/desktop-app/src/main/plugins/pluginPackageInstaller.test.ts
git commit -m "refactor: install plugin packages by author key"
```

## Task 4: Runtime RPC And Restricted Plugin Worker

**Files:**

- Create or modify: `apps/desktop-app/src/main/plugins/pluginRuntimeHost.ts`
- Create or modify: `apps/desktop-app/src/main/plugins/pluginSandbox.ts`
- Create or modify: `apps/desktop-app/src/main/plugins/pluginWorkerEntry.ts`
- Create or modify matching runtime and sandbox tests

- [ ] Implement `pluginWorkerEntry.ts` as only the Electron utility-process message adapter around the sandbox.
- [ ] Run downloaded plugin code in an isolated utility process, not in Electron main and not in renderer Vue.
- [ ] Execute plugin code inside a restricted VM context.
- [ ] Expose only serialized RPC-backed `usp` APIs.
- [ ] Do not pass host functions, host constructors, timer callback ownership, provider objects, Electron APIs, unrestricted Node APIs, or renderer DOM into plugin code.
- [ ] Recreate safe wrapper objects from serialized host data inside the plugin context.
- [ ] Mark only the affected plugin `broken` on crashes and timeouts.
- [ ] Keep the desktop app running if one plugin fails.
- [ ] Support runtime config refresh after settings changes.

Focused verification:

```bash
pnpm --filter @immersive-subs/desktop-app exec vitest run src/main/plugins/pluginSandbox.test.ts src/main/plugins/pluginRuntimeHost.test.ts --project main
pnpm --filter @immersive-subs/desktop-app typecheck:main
```

## Task 5: Permission Gate And Contribution Registry

**Files:**

- Create or modify: `apps/desktop-app/src/main/plugins/pluginPermissionGate.ts`
- Create or modify: `apps/desktop-app/src/main/plugins/pluginContributionRegistry.ts`
- Create or modify matching tests

- [ ] Enforce concrete permissions only: `network`, `readSelectedFile`, `transcriptionRuntime`, `settingsSchema`, `wordLookupProvider`, `transcriptionProvider`, and `mediaSourceAdapter`.
- [ ] Deny runtime API calls when required permissions are missing.
- [ ] Derive network grants from `network.allowedHosts` plus URL hosts present in the plugin's current config.
- [ ] Derive readable-file grants from schema `file` fields under the plugin's own config.
- [ ] Register word lookup, transcription, and media source adapter contributions by plugin key.
- [ ] Support async contribution registration after plugin startup.
- [ ] Clear all contributions for a plugin key on disable, delete, crash, timeout, or config refresh failure.
- [ ] Keep provider selection and provider calls host-owned through the contribution registry.

Focused verification:

```bash
pnpm --filter @immersive-subs/desktop-app exec vitest run src/main/plugins/pluginPermissionGate.test.ts src/main/plugins/pluginContributionRegistry.test.ts --project main
pnpm --filter @immersive-subs/desktop-app typecheck:main
```

Suggested commit:

```bash
git add apps/desktop-app/src/main/plugins/pluginPermissionGate.ts apps/desktop-app/src/main/plugins/pluginContributionRegistry.ts apps/desktop-app/src/main/plugins/pluginPermissionGate.test.ts apps/desktop-app/src/main/plugins/pluginContributionRegistry.test.ts
git commit -m "feat: gate plugin contributions by permission"
```

## Task 6: PluginManager Lifecycle

**Files:**

- Modify: `apps/desktop-app/src/main/plugins/pluginManager.ts`
- Modify: `apps/desktop-app/src/main/plugins/pluginManager.test.ts`

- [ ] Use `pluginKey` for registry lookups, runtime maps, settings records, contribution cleanup, and catalog rows.
- [ ] Keep install input as `sourceUrl` plus optional confirmed manifest.
- [ ] Preview and install must refetch and reject if the manifest changed after confirmation.
- [ ] Compute candidate and installed keys with `derivePluginKey`.
- [ ] Reject update manifests whose derived key differs from the installed plugin key.
- [ ] Reject same key plus same version.
- [ ] Write registry records with `pluginKey`, short `id`, `author`, version, `sourceUrl`, status, permissions, error, and timestamps.
- [ ] Create default config under `settings.plugins[pluginKey]` from manifest settings schema.
- [ ] Delete config under `settings.plugins[pluginKey]` on uninstall.
- [ ] Start runtimes from `getPluginInstallPath(rootDir, pluginKey, version)`.
- [ ] Mark enable failures as `broken` with an error message.
- [ ] On runtime crash, timeout, or config refresh failure, stop only that plugin, clear its contributions, clear active media-source state owned by that plugin, and mark it `broken`.
- [ ] Broadcast plugin catalog changes after install, update, enable, disable, delete, and runtime status changes.

Required public action signatures:

```ts
async update(pluginKey: string): Promise<PluginCatalogRow[]>
async enable(pluginKey: string): Promise<PluginCatalogRow[]>
async disable(pluginKey: string): Promise<PluginCatalogRow[]>
async delete(pluginKey: string): Promise<PluginCatalogRow[]>
```

Required catalog row identity:

```ts
{
  pluginKey: record.pluginKey,
  id: record.id,
  author: record.author,
  version: record.version,
  displayName: manifest.displayName,
  description: manifest.description
}
```

Focused verification:

```bash
pnpm --filter @immersive-subs/desktop-app exec vitest run src/main/plugins/pluginManager.test.ts --project main
pnpm --filter @immersive-subs/desktop-app typecheck:main
```

Suggested commit:

```bash
git add apps/desktop-app/src/main/plugins/pluginManager.ts apps/desktop-app/src/main/plugins/pluginManager.test.ts
git commit -m "refactor: manage plugins by derived key"
```

## Task 7: IPC, Preload, Store Actions, And Settings Sanitizer

**Files:**

- Modify: `apps/desktop-app/src/main/ipc/handlers/pluginHandlers.ts`
- Modify: `apps/desktop-app/src/preload.cts`
- Modify: `apps/desktop-app/src/renderer/stores/desktop/actions/pluginActions.ts`
- Modify: `apps/desktop-app/src/renderer/stores/desktop/types.ts`
- Modify: `apps/desktop-app/src/main/settings/appSettingsSanitizer.ts`
- Modify matching tests

- [ ] Route update, delete, enable, and disable IPC parameters as `pluginKey`.
- [ ] Keep preview/install APIs using HTTPS source URLs and the confirmed manifest contract.
- [ ] Rename preload and renderer store parameters from `pluginId` to `pluginKey`.
- [ ] Update `setPluginConfig` and `isPluginEnabled` to use plugin keys.
- [ ] Validate generic plugin config records without official ID assumptions.
- [ ] Preserve action error projection for installed plugin actions.

Final renderer action shape:

```ts
export async function updatePlugin(this: DesktopStoreThis, pluginKey: string) {
  this.pluginCatalog = await window.usp.updatePlugin(pluginKey);
}

export function setPluginConfig(this: DesktopStoreThis, pluginKey: string, config: PluginSettingsRecord["config"]) {
  if (!this.settings) return;
  this.updateSettings({
    plugins: {
      [pluginKey]: { config }
    }
  });
}
```

Focused verification:

```bash
pnpm --filter @immersive-subs/desktop-app exec vitest run src/renderer/stores/desktop.test.ts --project jsdom
pnpm --filter @immersive-subs/desktop-app typecheck:preload
pnpm --filter @immersive-subs/desktop-app typecheck:renderer
```

## Task 8: Plugin Management UI And Schema Settings

**Files:**

- Modify: `apps/desktop-app/src/common/recommendedPlugins.ts`
- Modify: `apps/desktop-app/src/renderer/components/settings/SettingsPlugins.vue`
- Modify: `apps/desktop-app/src/renderer/components/settings/SettingsPlugins.test.ts`
- Create: `apps/desktop-app/src/renderer/components/settings/pluginSettingsSectionKey.ts`
- Create: `apps/desktop-app/src/renderer/components/settings/pluginSettingsSectionKey.test.ts`
- Modify: `apps/desktop-app/src/renderer/components/settings/SettingsWindowShell.vue`
- Modify: `apps/desktop-app/src/renderer/components/settings/SettingsWindowShell.test.ts`
- Modify: `apps/desktop-app/src/renderer/components/settings/PluginSettingsSchema.vue`
- Modify: `apps/desktop-app/src/renderer/components/settings/PluginSettingsSchema.test.ts`

- [ ] Recommended entries include `pluginKey`, short `id`, `author`, display name, description, and raw GitHub manifest `sourceUrl`.
- [ ] Recommended entries are filtered by installed `pluginKey`, not short `id`.
- [ ] Installed rows show author metadata and use plugin keys for lifecycle actions.
- [ ] Install confirmation includes author, plugin key, compatibility, permissions, package URL, and sha256.
- [ ] Recommended install buttons use stable test IDs containing the plugin key.
- [ ] Plugin settings sections are encoded as `<pluginKey>::<sectionId>`.
- [ ] Settings navigation resolves enabled plugin settings through composite keys.
- [ ] `PluginSettingsSchema` reads and writes config under `settings.plugins[pluginKey]`.
- [ ] No plugin-provided Vue components, plugin localization registry, official settings registry, or old section ID assumptions are reintroduced.

Recommended links:

```ts
const RAW_PLUGIN_REPOSITORY_BASE =
  "https://raw.githubusercontent.com/XiiTang/Immersive-Subs-Prompter/main/plugin-repository";

const XIITANG_AUTHOR = {
  id: "xiitang",
  name: "XiiTang",
  url: "https://github.com/XiiTang"
};
```

Composite settings key helper:

```ts
const SEPARATOR = "::";

export function toPluginSettingsSectionKey(pluginKey: string, sectionId: string): string {
  return `${pluginKey}${SEPARATOR}${sectionId}`;
}

export function parsePluginSettingsSectionKey(sectionKey: string) {
  const index = sectionKey.indexOf(SEPARATOR);
  if (index <= 0) return null;
  const pluginKey = sectionKey.slice(0, index);
  const sectionId = sectionKey.slice(index + SEPARATOR.length);
  return pluginKey && sectionId ? { pluginKey, sectionId } : null;
}
```

Install confirmation should include this identity line:

```text
ID: xiitang/word-lookup
Author: XiiTang (xiitang) https://github.com/XiiTang
```

Focused verification:

```bash
pnpm --filter @immersive-subs/desktop-app exec vitest run src/renderer/components/settings/SettingsPlugins.test.ts src/renderer/components/settings/pluginSettingsSectionKey.test.ts src/renderer/components/settings/SettingsWindowShell.test.ts src/renderer/components/settings/PluginSettingsSchema.test.ts src/renderer/stores/desktop.test.ts --project jsdom
pnpm --filter @immersive-subs/desktop-app typecheck:renderer
```

Suggested commit:

```bash
git add apps/desktop-app/src/common/recommendedPlugins.ts apps/desktop-app/src/renderer/stores/desktop/actions/pluginActions.ts apps/desktop-app/src/renderer/stores/desktop/types.ts apps/desktop-app/src/renderer/components/settings/pluginSettingsSectionKey.ts apps/desktop-app/src/renderer/components/settings/pluginSettingsSectionKey.test.ts apps/desktop-app/src/renderer/components/settings/SettingsPlugins.vue apps/desktop-app/src/renderer/components/settings/SettingsPlugins.test.ts apps/desktop-app/src/renderer/components/settings/SettingsWindowShell.vue apps/desktop-app/src/renderer/components/settings/SettingsWindowShell.test.ts apps/desktop-app/src/renderer/components/settings/PluginSettingsSchema.vue apps/desktop-app/src/renderer/components/settings/PluginSettingsSchema.test.ts apps/desktop-app/src/renderer/stores/desktop.test.ts
git commit -m "feat: route plugin UI actions by author key"
```

## Task 9: Replace Bundled PluginHost In WindowController

**Files:**

- Modify: `apps/desktop-app/src/main/window/windowController.ts`
- Delete or stop using old bundled plugin host modules
- Modify matching window/controller startup tests

- [ ] Instantiate `PluginManager` using `PluginRegistryStore(getRegistryPath())`.
- [ ] Load enabled installed plugins from the registry on startup.
- [ ] Mark only failed plugin records as `broken` during startup.
- [ ] Remove the runtime path that registers bundled plugin code.
- [ ] Remove fixed official plugin ID helpers from runtime and UI paths.
- [ ] Keep app state, subtitle projection, playback sync, and renderer UI host-owned.

Residue scan:

```bash
rg -n "official\\.|pluginIds|plugins/official|registerBundledPlugin|PluginHost" apps/desktop-app/src
```

Expected: no runtime source matches. Design docs and retained historical plans may mention `official.*` only as unsupported behavior until they are deleted.

## Task 10: Word Lookup Plugin Cutover

**Files:**

- Modify host word lookup routing
- Modify subtitle hover integration as needed
- Modify `apps/desktop-app/src/main/plugins/pluginContributionRegistry.ts`
- Modify `plugins/word-lookup/*`
- Modify matching tests

- [ ] Move dictionary loading and lookup logic into the downloadable `word-lookup` plugin.
- [ ] Register lookup behavior through `wordLookupProvider`.
- [ ] Keep subtitle token hover behavior in the host.
- [ ] Keep floating lookup window, sizing, positioning, and markdown rendering in the host.
- [ ] Store word lookup config under `settings.plugins["xiitang/word-lookup"]`.
- [ ] Render word lookup settings through schema contributions.
- [ ] Remove old official word lookup runtime assumptions.

Final source manifest identity:

```json
{
  "id": "word-lookup",
  "author": {
    "id": "xiitang",
    "name": "XiiTang",
    "url": "https://github.com/XiiTang"
  },
  "version": "1.0.0",
  "displayName": "Word Lookup",
  "permissions": ["settingsSchema", "readSelectedFile", "wordLookupProvider"]
}
```

Focused verification:

```bash
pnpm --filter @immersive-subs/desktop-app exec vitest run src/main/plugins/pluginContributionRegistry.test.ts src/renderer/components/subtitle/SubtitleView.test.ts --project jsdom
pnpm --filter @immersive-subs/desktop-app typecheck:app
```

## Task 11: Transcription Plugin Cutover

**Files:**

- Modify `apps/desktop-app/src/main/ipc/handlers/transcriptionHandlers.ts`
- Modify transcription UI actions as needed
- Modify `apps/desktop-app/src/main/plugins/pluginContributionRegistry.ts`
- Modify `plugins/transcription/*`
- Modify matching tests

- [ ] Move provider-specific transcription logic into the downloadable `transcription` plugin.
- [ ] Register transcription behavior through `transcriptionProvider`.
- [ ] Replace hard-coded official transcription command lookup with contribution-registry lookup.
- [ ] Keep active video state, transcription status projection, cache placement, subtitle track injection/replacement, track selection, and renderer updates in the host.
- [ ] Store config under `settings.plugins["xiitang/transcription"]`.
- [ ] Use settings contribution ID `transcription.settings`.

Focused verification:

```bash
pnpm --filter @immersive-subs/desktop-app exec vitest run src/main/plugins/pluginContributionRegistry.test.ts src/main/ipc/handlers/transcriptionHandlers.test.ts --project main
pnpm --filter @immersive-subs/desktop-app typecheck:app
```

## Task 12: Generic Media Source Adapter Host

**Files:**

- Create or modify: `apps/desktop-app/src/main/mediaSources/mediaSourceController.ts`
- Create or modify: `apps/desktop-app/src/main/mediaSources/mediaSourceController.test.ts`
- Modify: `apps/desktop-app/src/main/window/windowController.ts`
- Modify: `apps/desktop-app/src/main/plugins/pluginManager.ts`
- Modify: `apps/desktop-app/src/main/plugins/pluginContributionRegistry.ts`

- [ ] Add a host-owned media source controller for external adapter events.
- [ ] Keep `DesktopState`, `PlaybackState`, `activeSource`, profile selection, subtitle priority selection, subtitle projection, browser extension playback sync, yt-dlp subtitle loading, and playback command routing in the host.
- [ ] Accept adapter events: `sourceMatched`, `sessionsChanged`, `subtitleTracksLoaded`, `playbackSnapshot`, `sourceDisconnected`, and `error`.
- [ ] Wait for media-source adapter handling before falling back to browser-extension subtitle handling.
- [ ] Mark adapter-handled playback events so extension playback updates do not overwrite adapter-projected state.
- [ ] Clear active media-source state when a new browser video context no longer matches an adapter.
- [ ] Clear active media-source state owned by a plugin when that plugin stops, crashes, times out, or fails config refresh.

Focused verification:

```bash
pnpm --filter @immersive-subs/desktop-app exec vitest run src/main/mediaSources/mediaSourceController.test.ts src/main/plugins/pluginManager.test.ts --project main
pnpm --filter @immersive-subs/desktop-app typecheck:main
```

## Task 13: Jellyfin/Emby Plugin Cutover

**Files:**

- Modify `plugins/jellyfinemby/*`
- Modify media source adapter registration tests
- Modify renderer settings schema tests if server settings change

- [ ] Move Jellyfin/Emby URL and item detection into the downloadable plugin.
- [ ] Move server connections, session aggregation, subtitle stream fetching, and playback snapshot conversion into the plugin.
- [ ] Register adapter behavior through `mediaSourceAdapter`.
- [ ] Keep host-owned media state projection and UI behavior outside the plugin.
- [ ] Use `serverList` settings schema for server records.
- [ ] Store config under `settings.plugins["xiitang/jellyfinemby"]`.
- [ ] Use settings contribution ID `jellyfinemby.settings`.

Final server config field shape:

```json
{
  "id": "servers",
  "label": "Servers",
  "type": "serverList",
  "defaultValue": []
}
```

Focused verification:

```bash
pnpm --filter @immersive-subs/desktop-app exec vitest run src/main/mediaSources/mediaSourceController.test.ts src/main/plugins/pluginManager.test.ts src/renderer/components/settings/PluginSettingsSchema.test.ts --project jsdom
pnpm --filter @immersive-subs/desktop-app typecheck:app
```

## Task 14: Remove Official Plugin Residue

**Files:**

- Delete or stop referencing old official plugin modules
- Modify settings shell and plugin UI modules
- Modify docs and tests as needed

- [ ] Remove `plugins/official/*` runtime assumptions.
- [ ] Remove `pluginIds.ts` and fixed official ID helpers from runtime source.
- [ ] Remove `registerBundledPlugin()` paths.
- [ ] Remove pass-through plugin localization registries and official settings registries.
- [ ] Render plugin display names, descriptions, and settings titles directly from manifest/catalog rows.
- [ ] Do not add old ID to new key mapping.
- [ ] Do not add old config reader, conversion, or migration.
- [ ] Do not actively delete leftover `settings.plugins["official.*"]`; those records are inert because no runtime, catalog row, settings page, recommendation, or command path references them.

Residue scan:

```bash
rg -n "official\\.|pluginIds|plugins/official|registerBundledPlugin|PluginHost|plugins\\.immersive-subs\\.app" apps/desktop-app/src plugins scripts README.md DEPLOYMENT.md
```

Expected: no source or user-facing documentation references to old plugin IDs, old bundled plugin paths, the old plugin host, or the old `plugins.immersive-subs.app` host.

## Task 15: Source Manifests And Repository Artifacts

**Files:**

- Modify: `plugins/word-lookup/manifest.json`
- Modify: `plugins/transcription/manifest.json`
- Modify: `plugins/jellyfinemby/manifest.json`
- Modify: `apps/desktop-app/src/main/plugins/pluginSourceManifests.test.ts`
- Modify: `scripts/package-plugins.mjs`
- Create or update: `plugin-repository/word-lookup/manifest.json`
- Create or update: `plugin-repository/word-lookup/1.0.0.usp-plugin`
- Create or update: `plugin-repository/transcription/manifest.json`
- Create or update: `plugin-repository/transcription/1.0.0.usp-plugin`
- Create or update: `plugin-repository/jellyfinemby/manifest.json`
- Create or update: `plugin-repository/jellyfinemby/1.0.0.usp-plugin`

- [ ] Add source manifest tests proving all three source manifests use short plugin IDs and `xiitang` author metadata.
- [ ] Change source manifest IDs to `word-lookup`, `transcription`, and `jellyfinemby`.
- [ ] Add author metadata to each source manifest.
- [ ] Keep source manifests free of remote `package`.
- [ ] Use settings contribution IDs `word-lookup.settings`, `transcription.settings`, and `jellyfinemby.settings`.
- [ ] Change packaging output root to `plugin-repository`.
- [ ] Change default public base URL to `https://raw.githubusercontent.com/XiiTang/Immersive-Subs-Prompter/main/plugin-repository`.
- [ ] Keep `USP_PLUGIN_BASE_URL` only as an intentional override for another HTTPS repository location.
- [ ] Run `pnpm build:plugins` and commit generated manifests and packages.
- [ ] Verify `plugin-repository` is not git-ignored.

Packaging script final constants:

```js
const outputRoot = path.join(repoRoot, "plugin-repository");
const publicBaseUrl = (
  process.env.USP_PLUGIN_BASE_URL ??
  "https://raw.githubusercontent.com/XiiTang/Immersive-Subs-Prompter/main/plugin-repository"
).replace(/\/+$/, "");
```

Focused verification:

```bash
pnpm --filter @immersive-subs/desktop-app exec vitest run src/main/plugins/pluginSourceManifests.test.ts --project main
pnpm build:plugins
find plugin-repository -maxdepth 2 -type f | sort
rg -n "raw.githubusercontent.com/XiiTang/Immersive-Subs-Prompter/main/plugin-repository" plugin-repository
git check-ignore plugin-repository/word-lookup/manifest.json
```

Expected generated files:

```text
plugin-repository/jellyfinemby/1.0.0.usp-plugin
plugin-repository/jellyfinemby/manifest.json
plugin-repository/transcription/1.0.0.usp-plugin
plugin-repository/transcription/manifest.json
plugin-repository/word-lookup/1.0.0.usp-plugin
plugin-repository/word-lookup/manifest.json
```

Expected `git check-ignore` result: no output and exit code 1.

Suggested commit:

```bash
git add plugins/word-lookup/manifest.json plugins/transcription/manifest.json plugins/jellyfinemby/manifest.json apps/desktop-app/src/main/plugins/pluginSourceManifests.test.ts scripts/package-plugins.mjs plugin-repository
git commit -m "feat: publish plugins from repository artifacts"
```

## Task 16: Documentation And Final Verification

**Files:**

- Modify: `README.md`
- Modify: `DEPLOYMENT.md`
- Modify current design and plan docs only if implementation behavior intentionally differs from this final merged plan.

- [ ] Update README to describe dynamic plugins as HTTPS install links.
- [ ] Document that Settings -> Plugins shows recommended entries for the project-maintained plugins.
- [ ] Document that recommended entries point to raw GitHub manifests committed under `plugin-repository/*`.
- [ ] Document that recommendations use the same preview, permission confirmation, install, update, enable, disable, and delete flow as any other plugin.
- [ ] Update DEPLOYMENT to describe `pnpm build:plugins`.
- [ ] Document generated `plugin-repository/<plugin-folder>/<version>.usp-plugin` and `plugin-repository/<plugin-folder>/manifest.json`.
- [ ] Document the default raw GitHub base URL.
- [ ] Document `USP_PLUGIN_BASE_URL` only for intentional alternate HTTPS repository locations.
- [ ] Document that generated `plugin-repository/*` files must be committed with plugin source changes.
- [ ] Do not document GitHub Release assets, auto-preinstalled default plugins, old `official.*` compatibility, or migration.

README plugin paragraph:

```md
Desktop capabilities such as word lookup, speech transcription, and Jellyfin / Emby integration are installed as dynamic plugins from HTTPS plugin install links. Settings -> Plugins shows the project-maintained plugins as recommended entries. These recommendations point to raw GitHub manifests committed under `plugin-repository/*` in this repository, and they use the same preview, permission confirmation, install, update, enable, disable, and delete flow as any other plugin.
```

DEPLOYMENT plugin package paragraph:

```md
Plugin package artifacts are not bundled as privileged desktop code and are not published through GitHub Releases. Generate the repository-distributed plugin manifests and packages with `pnpm build:plugins`.

The command writes `plugin-repository/<plugin-folder>/<version>.usp-plugin` and `plugin-repository/<plugin-folder>/manifest.json`. The default manifest base URL is `https://raw.githubusercontent.com/XiiTang/Immersive-Subs-Prompter/main/plugin-repository`. Set `USP_PLUGIN_BASE_URL` only when intentionally generating manifests for another HTTPS repository location.

Commit the generated `plugin-repository/*` files with the plugin source changes. The desktop app installs plugins into the user data directory at runtime and rejects non-HTTPS install or package URLs.
```

Focused verification:

```bash
pnpm --filter @immersive-subs/desktop-app exec vitest run src/main/plugins/pluginManifest.test.ts src/main/plugins/pluginPaths.test.ts src/main/plugins/pluginRegistryStore.test.ts src/main/plugins/pluginPackageInstaller.test.ts src/main/plugins/pluginManager.test.ts src/main/plugins/pluginSourceManifests.test.ts --project main
pnpm --filter @immersive-subs/desktop-app exec vitest run src/renderer/components/settings/SettingsPlugins.test.ts src/renderer/components/settings/pluginSettingsSectionKey.test.ts src/renderer/components/settings/SettingsWindowShell.test.ts src/renderer/components/settings/PluginSettingsSchema.test.ts src/renderer/stores/desktop.test.ts --project jsdom
pnpm --filter @immersive-subs/desktop-app typecheck:app
pnpm build:plugins
git diff --check
```

Broad verification:

```bash
pnpm test
pnpm typecheck
pnpm build
```

Suggested commit:

```bash
git add README.md DEPLOYMENT.md docs/superpowers/specs/2026-06-07-dynamic-plugin-system-design.md docs/superpowers/plans/2026-06-07-dynamic-plugin-system-implementation-design.md plugin-repository
git commit -m "docs: describe repository plugin distribution"
```

## Detailed Step-by-Step Execution Plan

The task sections above define ownership and final behavior. This section expands them into executable TDD steps so the original source plans can be deleted without losing step-level implementation guidance. These steps are fused to the 2026-06-06 identity and repository-distribution model; do not copy older single-ID or `official.*` examples back into the implementation.

### Detailed Task 1: Manifest, Author Identity, And Plugin Key

**Files:**
- `apps/desktop-app/src/main/plugins/pluginIdentity.ts`
- `apps/desktop-app/src/main/plugins/pluginManifest.ts`
- `apps/desktop-app/src/main/plugins/pluginManifest.test.ts`

- [ ] **Step 1: Read the task-local files and source expectations**

Open the files listed above and compare them with the final identity rules in this merged plan. Do not preserve old single-ID, `official.*`, bundled-host, migration, or fallback behavior.

- [ ] **Step 2: Write the failing tests**

- Write tests that accept short IDs with required author metadata.
- Write tests that reject missing author metadata.
- Write tests that reject unsafe author IDs such as ../xiitang.
- Write tests that reject non-HTTPS author URLs.
- Write tests that verify package manifests compare author metadata, not only short ID.

Identity helper contract:

```ts
export interface PluginAuthor {
  id: string;
  name: string;
  url?: string;
}

export interface PluginKeyParts {
  authorId: string;
  pluginId: string;
}

const SAFE_ID_PATTERN = /^[a-z0-9][a-z0-9._-]*$/i;

export function derivePluginKey(input: { author: Pick<PluginAuthor, "id">; id: string }): string {
  return `${input.author.id}/${input.id}`;
}
```

Manifest identity fixture:

```ts
const XIITANG_AUTHOR = {
  id: "xiitang",
  name: "XiiTang",
  url: "https://github.com/XiiTang"
};

const manifest = validatePluginManifest({
  id: "word-lookup",
  author: XIITANG_AUTHOR,
  version: "1.0.0",
  displayName: "Word Lookup",
  description: "Looks up subtitle words.",
  appCompatibility: { minVersion: "1.0.0" },
  package: {
    url: "https://raw.githubusercontent.com/XiiTang/Immersive-Subs-Prompter/main/plugin-repository/word-lookup/1.0.0.usp-plugin",
    sha256: "a".repeat(64)
  },
  entry: { main: "main.js" },
  permissions: ["settingsSchema", "wordLookupProvider"],
  contributions: { settings: [], wordLookup: true }
});

expect(derivePluginKey(manifest)).toBe("xiitang/word-lookup");
```

- [ ] **Step 3: Run the failing test command**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app exec vitest run src/main/plugins/pluginManifest.test.ts --project main
```

Expected: FAIL because pluginIdentity.js does not exist, author is not validated, or package manifest comparison ignores author.

- [ ] **Step 4: Implement the final-state behavior**

- Create pluginIdentity.ts with path-safe segment validation.
- Import identity helpers into pluginManifest.ts.
- Add author to PluginManifest and exact manifest key validation.
- Add author to package manifest comparable fields.
- Update all existing valid fixtures with author metadata.
- Keep implementation aligned to `pluginKey = <author.id>/<id>` wherever identity crosses file, process, IPC, settings, registry, or UI boundaries.
- Do not add compatibility readers, migration branches, old-name aliases, catch-all fallbacks, or old host wrappers unless this plan explicitly asks for them.

- [ ] **Step 5: Update all affected fixtures and mocks**

- Manifest fixtures must include `author`.
- Catalog fixtures must include `pluginKey`, short `id`, and `author`.
- Registry fixtures must be keyed by `pluginKey`.
- Settings fixtures must use `settings.plugins[pluginKey]`.
- Recommended plugin fixtures must point to `raw.githubusercontent.com/.../plugin-repository/.../manifest.json`.

- [ ] **Step 6: Run focused verification until it passes**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app exec vitest run src/main/plugins/pluginManifest.test.ts --project main
pnpm --filter @immersive-subs/desktop-app typecheck:app
```

Expected: PASS for the focused tests and typecheck, or a specific failure that belongs to a later task and is documented before continuing.

- [ ] **Step 7: Run task-specific residue checks**

Run:

```bash
rg -n "official\.|pluginIds|plugins/official|registerBundledPlugin|PluginHost|plugins\.immersive-subs\.app" apps/desktop-app/src plugins scripts README.md DEPLOYMENT.md
```

Expected: no runtime or user-facing old-model references introduced by this task. Mentions in current merged design docs are allowed only when explicitly stating that the old model is unsupported.

- [ ] **Step 8: Commit the task**

Use the task file list above as the staging scope. Commit message:

```bash
git commit -m "feat: add plugin author identity"
```

- [ ] **Step 9: Record task completion evidence**

- Record the focused command output in the implementation notes or PR description.
- Record any intentional docs-only old-model mentions.
- Record whether broad verification was deferred to Task 16.

### Detailed Task 2: Registry Records, Catalog Types, And Install Paths

**Files:**
- `apps/desktop-app/src/main/plugins/pluginTypes.ts`
- `apps/desktop-app/src/main/plugins/pluginPaths.ts`
- `apps/desktop-app/src/main/plugins/pluginRegistryStore.ts`
- `apps/desktop-app/src/main/plugins/pluginRegistryStore.test.ts`
- `apps/desktop-app/src/main/plugins/pluginPaths.test.ts`

- [ ] **Step 1: Read the task-local files and source expectations**

Open the files listed above and compare them with the final identity rules in this merged plan. Do not preserve old single-ID, `official.*`, bundled-host, migration, or fallback behavior.

- [ ] **Step 2: Write the failing tests**

- Write a registry test that stores a xiitang/word-lookup record keyed by pluginKey.
- Write a registry test that rejects a map key whose record.pluginKey differs.
- Write a registry test that rejects pluginKey values not derived from author.id plus id.
- Write pluginPaths.test.ts for installed/<author.id>/<id>/<version>.
- Update InstalledPluginRecord and PluginCatalogRow type shapes.

Plugin record shape:

```ts
export interface InstalledPluginRecord {
  pluginKey: string;
  id: PluginManifest["id"];
  author: PluginAuthor;
  version: string;
  sourceUrl: string;
  enabled: boolean;
  status: LocalPluginStatus;
  permissions: PluginPermission[];
  error: string | null;
  installedAt: string;
  updatedAt: string;
}
```

Path helper behavior:

```ts
expect(getPluginInstallPath(root, "xiitang/word-lookup", "1.0.0")).toBe(
  path.join(root, "installed", "xiitang", "word-lookup", "1.0.0")
);
```

- [ ] **Step 3: Run the failing test command**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app exec vitest run src/main/plugins/pluginRegistryStore.test.ts src/main/plugins/pluginPaths.test.ts --project main
```

Expected: FAIL because records do not include pluginKey/author or install paths still use one ID segment.

- [ ] **Step 4: Implement the final-state behavior**

- Update RecommendedPluginInstallLink to include pluginKey and author.
- Update getPluginInstallPath and getPluginVersionsPath to split pluginKey.
- Update registry validation keys and exact record validation.
- Rename registry method parameters from pluginId to pluginKey.
- Update old registry test fixtures from community.word-lookup to community/word-lookup.
- Keep implementation aligned to `pluginKey = <author.id>/<id>` wherever identity crosses file, process, IPC, settings, registry, or UI boundaries.
- Do not add compatibility readers, migration branches, old-name aliases, catch-all fallbacks, or old host wrappers unless this plan explicitly asks for them.

- [ ] **Step 5: Update all affected fixtures and mocks**

- Manifest fixtures must include `author`.
- Catalog fixtures must include `pluginKey`, short `id`, and `author`.
- Registry fixtures must be keyed by `pluginKey`.
- Settings fixtures must use `settings.plugins[pluginKey]`.
- Recommended plugin fixtures must point to `raw.githubusercontent.com/.../plugin-repository/.../manifest.json`.

- [ ] **Step 6: Run focused verification until it passes**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app exec vitest run src/main/plugins/pluginRegistryStore.test.ts src/main/plugins/pluginPaths.test.ts --project main
pnpm --filter @immersive-subs/desktop-app typecheck:app
```

Expected: PASS for the focused tests and typecheck, or a specific failure that belongs to a later task and is documented before continuing.

- [ ] **Step 7: Run task-specific residue checks**

Run:

```bash
rg -n "official\.|pluginIds|plugins/official|registerBundledPlugin|PluginHost|plugins\.immersive-subs\.app" apps/desktop-app/src plugins scripts README.md DEPLOYMENT.md
```

Expected: no runtime or user-facing old-model references introduced by this task. Mentions in current merged design docs are allowed only when explicitly stating that the old model is unsupported.

- [ ] **Step 8: Commit the task**

Use the task file list above as the staging scope. Commit message:

```bash
git commit -m "refactor: key plugin registry by author identity"
```

- [ ] **Step 9: Record task completion evidence**

- Record the focused command output in the implementation notes or PR description.
- Record any intentional docs-only old-model mentions.
- Record whether broad verification was deferred to Task 16.

### Detailed Task 3: Package Download, Hash, Extraction, And Atomic Install

**Files:**
- `apps/desktop-app/package.json`
- `pnpm-lock.yaml`
- `apps/desktop-app/src/main/plugins/pluginPackageInstaller.ts`
- `apps/desktop-app/src/main/plugins/pluginPackageInstaller.test.ts`

- [ ] **Step 1: Read the task-local files and source expectations**

Open the files listed above and compare them with the final identity rules in this merged plan. Do not preserve old single-ID, `official.*`, bundled-host, migration, or fallback behavior.

- [ ] **Step 2: Write the failing tests**

- Confirm fflate is present in apps/desktop-app/package.json and pnpm-lock.yaml.
- Write a package test with remote and package manifests that both include author.
- Write a test for same short plugin ID from two different authors.
- Write a test that package manifest author mismatch is rejected.
- Write tests for hash mismatch and unsafe zip entries.

Install directory computation:

```ts
const installDir = getPluginInstallPath(
  this.options.rootDir,
  derivePluginKey(remoteManifest),
  remoteManifest.version
);
```

Two authors same short ID test assertion:

```ts
expect(leftResult.installDir).toBe(path.join(root, "installed", "left", "word-lookup", "1.0.0"));
expect(rightResult.installDir).toBe(path.join(root, "installed", "right", "word-lookup", "1.0.0"));
```

- [ ] **Step 3: Run the failing test command**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app exec vitest run src/main/plugins/pluginPackageInstaller.test.ts --project main
```

Expected: FAIL because installer is missing author-aware fixtures, package paths, or package manifest author comparison.

- [ ] **Step 4: Implement the final-state behavior**

- Write a replacement rollback test using installed/community/word-lookup/<version>.
- Keep defaultFetchBytes HTTPS-only; do not add file:// support.
- Use validatePluginPackageManifest against remote manifest excluding package only.
- Install into plugin-key-derived paths.
- Update every package installer fixture to include author metadata.
- Keep implementation aligned to `pluginKey = <author.id>/<id>` wherever identity crosses file, process, IPC, settings, registry, or UI boundaries.
- Do not add compatibility readers, migration branches, old-name aliases, catch-all fallbacks, or old host wrappers unless this plan explicitly asks for them.

- [ ] **Step 5: Update all affected fixtures and mocks**

- Manifest fixtures must include `author`.
- Catalog fixtures must include `pluginKey`, short `id`, and `author`.
- Registry fixtures must be keyed by `pluginKey`.
- Settings fixtures must use `settings.plugins[pluginKey]`.
- Recommended plugin fixtures must point to `raw.githubusercontent.com/.../plugin-repository/.../manifest.json`.

- [ ] **Step 6: Run focused verification until it passes**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app exec vitest run src/main/plugins/pluginPackageInstaller.test.ts --project main
pnpm --filter @immersive-subs/desktop-app typecheck:app
```

Expected: PASS for the focused tests and typecheck, or a specific failure that belongs to a later task and is documented before continuing.

- [ ] **Step 7: Run task-specific residue checks**

Run:

```bash
rg -n "official\.|pluginIds|plugins/official|registerBundledPlugin|PluginHost|plugins\.immersive-subs\.app" apps/desktop-app/src plugins scripts README.md DEPLOYMENT.md
```

Expected: no runtime or user-facing old-model references introduced by this task. Mentions in current merged design docs are allowed only when explicitly stating that the old model is unsupported.

- [ ] **Step 8: Commit the task**

Use the task file list above as the staging scope. Commit message:

```bash
git commit -m "refactor: install plugin packages by author key"
```

- [ ] **Step 9: Record task completion evidence**

- Record the focused command output in the implementation notes or PR description.
- Record any intentional docs-only old-model mentions.
- Record whether broad verification was deferred to Task 16.

### Detailed Task 4: Runtime RPC And Restricted Plugin Worker

**Files:**
- `apps/desktop-app/src/main/plugins/pluginRuntimeHost.ts`
- `apps/desktop-app/src/main/plugins/pluginSandbox.ts`
- `apps/desktop-app/src/main/plugins/pluginWorkerEntry.ts`
- `apps/desktop-app/src/main/plugins/pluginRuntimeHost.test.ts`
- `apps/desktop-app/src/main/plugins/pluginSandbox.test.ts`

- [ ] **Step 1: Read the task-local files and source expectations**

Open the files listed above and compare them with the final identity rules in this merged plan. Do not preserve old single-ID, `official.*`, bundled-host, migration, or fallback behavior.

- [ ] **Step 2: Write the failing tests**

- Write sandbox tests denying process, require, Electron, DOM, and host constructors.
- Write sandbox tests allowing only serialized usp bridge calls.
- Write runtime host tests for timeout and crash isolation.
- Implement startPluginSandbox as shared sandbox entry.
- Implement pluginWorkerEntry as the utility-process adapter only.

Forbidden access test shape:

```ts
await expect(runPluginCode("module.exports = () => process.cwd()")).rejects.toThrow();
await expect(runPluginCode("module.exports = () => require('electron')")).rejects.toThrow();
```

Worker boundary expectation:

```ts
// pluginWorkerEntry.ts is only the utility-process message adapter.
// Plugin code receives serialized RPC messages and a limited usp object, not ipcMain or Electron objects.
```

- [ ] **Step 3: Run the failing test command**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app exec vitest run src/main/plugins/pluginSandbox.test.ts src/main/plugins/pluginRuntimeHost.test.ts --project main
```

Expected: FAIL because sandbox/worker files do not exist or plugin code can access forbidden host objects.

- [ ] **Step 4: Implement the final-state behavior**

- Implement PluginRuntimeHost using utilityProcess.fork.
- Serialize provider calls and responses across the boundary.
- Recreate safe URL/response wrappers inside plugin context from serialized data.
- Kill only the failing plugin worker on runtime faults.
- Expose onRuntimeExit so PluginManager can mark the plugin broken.
- Keep implementation aligned to `pluginKey = <author.id>/<id>` wherever identity crosses file, process, IPC, settings, registry, or UI boundaries.
- Do not add compatibility readers, migration branches, old-name aliases, catch-all fallbacks, or old host wrappers unless this plan explicitly asks for them.

- [ ] **Step 5: Update all affected fixtures and mocks**

- Manifest fixtures must include `author`.
- Catalog fixtures must include `pluginKey`, short `id`, and `author`.
- Registry fixtures must be keyed by `pluginKey`.
- Settings fixtures must use `settings.plugins[pluginKey]`.
- Recommended plugin fixtures must point to `raw.githubusercontent.com/.../plugin-repository/.../manifest.json`.

- [ ] **Step 6: Run focused verification until it passes**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app exec vitest run src/main/plugins/pluginSandbox.test.ts src/main/plugins/pluginRuntimeHost.test.ts --project main
pnpm --filter @immersive-subs/desktop-app typecheck:app
```

Expected: PASS for the focused tests and typecheck, or a specific failure that belongs to a later task and is documented before continuing.

- [ ] **Step 7: Run task-specific residue checks**

Run:

```bash
rg -n "official\.|pluginIds|plugins/official|registerBundledPlugin|PluginHost|plugins\.immersive-subs\.app" apps/desktop-app/src plugins scripts README.md DEPLOYMENT.md
```

Expected: no runtime or user-facing old-model references introduced by this task. Mentions in current merged design docs are allowed only when explicitly stating that the old model is unsupported.

- [ ] **Step 8: Commit the task**

Use the task file list above as the staging scope. Commit message:

```bash
git commit -m "feat: isolate plugin runtime workers"
```

- [ ] **Step 9: Record task completion evidence**

- Record the focused command output in the implementation notes or PR description.
- Record any intentional docs-only old-model mentions.
- Record whether broad verification was deferred to Task 16.

### Detailed Task 5: Permission Gate And Contribution Registry

**Files:**
- `apps/desktop-app/src/main/plugins/pluginPermissionGate.ts`
- `apps/desktop-app/src/main/plugins/pluginPermissionGate.test.ts`
- `apps/desktop-app/src/main/plugins/pluginContributionRegistry.ts`
- `apps/desktop-app/src/main/plugins/pluginContributionRegistry.test.ts`

- [ ] **Step 1: Read the task-local files and source expectations**

Open the files listed above and compare them with the final identity rules in this merged plan. Do not preserve old single-ID, `official.*`, bundled-host, migration, or fallback behavior.

- [ ] **Step 2: Write the failing tests**

- Write permission tests denying undeclared network hosts.
- Write permission tests deriving network hosts from current serverList config.
- Write permission tests denying file reads outside schema file fields.
- Write contribution tests registering providers by pluginKey.
- Write contribution tests clearing all providers for a pluginKey.

Permission constants:

```ts
const REQUIRED_PROVIDER_PERMISSIONS = {
  wordLookup: "wordLookupProvider",
  transcription: "transcriptionProvider",
  mediaSource: "mediaSourceAdapter"
} as const;
```

Contribution cleanup test shape:

```ts
registry.registerWordLookupProvider("xiitang/word-lookup", "main", async () => ({ markdown: "ok" }));
registry.clearPlugin("xiitang/word-lookup");
await expect(registry.lookupWord("hello")).rejects.toThrow("No enabled word lookup provider");
```

- [ ] **Step 3: Run the failing test command**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app exec vitest run src/main/plugins/pluginPermissionGate.test.ts src/main/plugins/pluginContributionRegistry.test.ts --project main
```

Expected: FAIL because permission gate and contribution registry do not exist or are not keyed by pluginKey.

- [ ] **Step 4: Implement the final-state behavior**

- Implement permission gate for all seven concrete permissions.
- Implement plugin-keyed contribution maps.
- Support async contribution registration after startup.
- Clear media-source adapter state through a callback when adapter owner is cleared.
- Keep provider selection host-owned.
- Keep implementation aligned to `pluginKey = <author.id>/<id>` wherever identity crosses file, process, IPC, settings, registry, or UI boundaries.
- Do not add compatibility readers, migration branches, old-name aliases, catch-all fallbacks, or old host wrappers unless this plan explicitly asks for them.

- [ ] **Step 5: Update all affected fixtures and mocks**

- Manifest fixtures must include `author`.
- Catalog fixtures must include `pluginKey`, short `id`, and `author`.
- Registry fixtures must be keyed by `pluginKey`.
- Settings fixtures must use `settings.plugins[pluginKey]`.
- Recommended plugin fixtures must point to `raw.githubusercontent.com/.../plugin-repository/.../manifest.json`.

- [ ] **Step 6: Run focused verification until it passes**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app exec vitest run src/main/plugins/pluginPermissionGate.test.ts src/main/plugins/pluginContributionRegistry.test.ts --project main
pnpm --filter @immersive-subs/desktop-app typecheck:app
```

Expected: PASS for the focused tests and typecheck, or a specific failure that belongs to a later task and is documented before continuing.

- [ ] **Step 7: Run task-specific residue checks**

Run:

```bash
rg -n "official\.|pluginIds|plugins/official|registerBundledPlugin|PluginHost|plugins\.immersive-subs\.app" apps/desktop-app/src plugins scripts README.md DEPLOYMENT.md
```

Expected: no runtime or user-facing old-model references introduced by this task. Mentions in current merged design docs are allowed only when explicitly stating that the old model is unsupported.

- [ ] **Step 8: Commit the task**

Use the task file list above as the staging scope. Commit message:

```bash
git commit -m "feat: gate plugin contributions by permission"
```

- [ ] **Step 9: Record task completion evidence**

- Record the focused command output in the implementation notes or PR description.
- Record any intentional docs-only old-model mentions.
- Record whether broad verification was deferred to Task 16.

### Detailed Task 6: PluginManager Lifecycle

**Files:**
- `apps/desktop-app/src/main/plugins/pluginManager.ts`
- `apps/desktop-app/src/main/plugins/pluginManager.test.ts`

- [ ] **Step 1: Read the task-local files and source expectations**

Open the files listed above and compare them with the final identity rules in this merged plan. Do not preserve old single-ID, `official.*`, bundled-host, migration, or fallback behavior.

- [ ] **Step 2: Write the failing tests**

- Write failing install test asserting registry, settings, and catalog use pluginKey.
- Write coexistence test for same short ID from two authors.
- Write update identity test rejecting a manifest with a different derived key.
- Write same-version reinstall rejection test.
- Write enabled replacement rollback test.

Manager catalog assertion:

```ts
expect(catalog[0]).toMatchObject({
  pluginKey: "community/word-lookup",
  id: "word-lookup",
  author: { id: "community", name: "Community" }
});
```

Lifecycle signatures:

```ts
async update(pluginKey: string): Promise<PluginCatalogRow[]>
async enable(pluginKey: string): Promise<PluginCatalogRow[]>
async disable(pluginKey: string): Promise<PluginCatalogRow[]>
async delete(pluginKey: string): Promise<PluginCatalogRow[]>
```

- [ ] **Step 3: Run the failing test command**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app exec vitest run src/main/plugins/pluginManager.test.ts --project main
```

Expected: FAIL because PluginManager is missing or still addresses records/settings by manifest id.

- [ ] **Step 4: Implement the final-state behavior**

- Import derivePluginKey into pluginManager.ts.
- Use pluginKey for runtimes map keys.
- Write InstalledPluginRecord with pluginKey/id/author.
- Read installed manifests from plugin-key-derived install paths.
- Ensure and delete settings under settings.plugins[pluginKey].
- Project install, enable, update, delete, crash, timeout, and config refresh errors into catalog rows.
- Broadcast catalog updates after every lifecycle transition.
- Keep implementation aligned to `pluginKey = <author.id>/<id>` wherever identity crosses file, process, IPC, settings, registry, or UI boundaries.
- Do not add compatibility readers, migration branches, old-name aliases, catch-all fallbacks, or old host wrappers unless this plan explicitly asks for them.

- [ ] **Step 5: Update all affected fixtures and mocks**

- Manifest fixtures must include `author`.
- Catalog fixtures must include `pluginKey`, short `id`, and `author`.
- Registry fixtures must be keyed by `pluginKey`.
- Settings fixtures must use `settings.plugins[pluginKey]`.
- Recommended plugin fixtures must point to `raw.githubusercontent.com/.../plugin-repository/.../manifest.json`.

- [ ] **Step 6: Run focused verification until it passes**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app exec vitest run src/main/plugins/pluginManager.test.ts --project main
pnpm --filter @immersive-subs/desktop-app typecheck:app
```

Expected: PASS for the focused tests and typecheck, or a specific failure that belongs to a later task and is documented before continuing.

- [ ] **Step 7: Run task-specific residue checks**

Run:

```bash
rg -n "official\.|pluginIds|plugins/official|registerBundledPlugin|PluginHost|plugins\.immersive-subs\.app" apps/desktop-app/src plugins scripts README.md DEPLOYMENT.md
```

Expected: no runtime or user-facing old-model references introduced by this task. Mentions in current merged design docs are allowed only when explicitly stating that the old model is unsupported.

- [ ] **Step 8: Commit the task**

Use the task file list above as the staging scope. Commit message:

```bash
git commit -m "refactor: manage plugins by derived key"
```

- [ ] **Step 9: Record task completion evidence**

- Record the focused command output in the implementation notes or PR description.
- Record any intentional docs-only old-model mentions.
- Record whether broad verification was deferred to Task 16.

### Detailed Task 7: IPC, Preload, Store Actions, And Settings Sanitizer

**Files:**
- `apps/desktop-app/src/main/ipc/handlers/pluginHandlers.ts`
- `apps/desktop-app/src/preload.cts`
- `apps/desktop-app/src/renderer/stores/desktop/actions/pluginActions.ts`
- `apps/desktop-app/src/renderer/stores/desktop/types.ts`
- `apps/desktop-app/src/main/settings/appSettingsSanitizer.ts`

- [ ] **Step 1: Read the task-local files and source expectations**

Open the files listed above and compare them with the final identity rules in this merged plan. Do not preserve old single-ID, `official.*`, bundled-host, migration, or fallback behavior.

- [ ] **Step 2: Write the failing tests**

- Write sanitizer tests accepting arbitrary pluginKey config records.
- Write sanitizer tests rejecting malformed plugin config values.
- Write store tests that call update/delete/enable/disable with xiitang/word-lookup.
- Change plugin IPC handler parameters to pluginKey.
- Change preload parameter names and typings to pluginKey.

Preload action shape:

```ts
updatePlugin: (pluginKey: string): Promise<any[]> =>
  ipcRenderer.invoke("usp:update-plugin", pluginKey),
deletePlugin: (pluginKey: string): Promise<any[]> =>
  ipcRenderer.invoke("usp:delete-plugin", pluginKey),
```

Store config write:

```ts
export function setPluginConfig(this: DesktopStoreThis, pluginKey: string, config: PluginSettingsRecord["config"]) {
  if (!this.settings) return;
  this.updateSettings({ plugins: { [pluginKey]: { config } } });
}
```

- [ ] **Step 3: Run the failing test command**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app exec vitest run src/renderer/stores/desktop.test.ts --project jsdom
```

Expected: FAIL because update/delete/enable/disable actions still accept pluginId or settings sanitizer rejects pluginKey keys.

- [ ] **Step 4: Implement the final-state behavior**

- Change renderer store action signatures to pluginKey.
- Change setPluginConfig to write settings.plugins[pluginKey].
- Change isPluginEnabled to compare plugin.pluginKey.
- Update mocks in desktop store tests.
- Run typecheck for preload and renderer.
- Keep implementation aligned to `pluginKey = <author.id>/<id>` wherever identity crosses file, process, IPC, settings, registry, or UI boundaries.
- Do not add compatibility readers, migration branches, old-name aliases, catch-all fallbacks, or old host wrappers unless this plan explicitly asks for them.

- [ ] **Step 5: Update all affected fixtures and mocks**

- Manifest fixtures must include `author`.
- Catalog fixtures must include `pluginKey`, short `id`, and `author`.
- Registry fixtures must be keyed by `pluginKey`.
- Settings fixtures must use `settings.plugins[pluginKey]`.
- Recommended plugin fixtures must point to `raw.githubusercontent.com/.../plugin-repository/.../manifest.json`.

- [ ] **Step 6: Run focused verification until it passes**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app exec vitest run src/renderer/stores/desktop.test.ts --project jsdom
pnpm --filter @immersive-subs/desktop-app typecheck:app
```

Expected: PASS for the focused tests and typecheck, or a specific failure that belongs to a later task and is documented before continuing.

- [ ] **Step 7: Run task-specific residue checks**

Run:

```bash
rg -n "official\.|pluginIds|plugins/official|registerBundledPlugin|PluginHost|plugins\.immersive-subs\.app" apps/desktop-app/src plugins scripts README.md DEPLOYMENT.md
```

Expected: no runtime or user-facing old-model references introduced by this task. Mentions in current merged design docs are allowed only when explicitly stating that the old model is unsupported.

- [ ] **Step 8: Commit the task**

Use the task file list above as the staging scope. Commit message:

```bash
git commit -m "feat: expose plugin-key lifecycle ipc"
```

- [ ] **Step 9: Record task completion evidence**

- Record the focused command output in the implementation notes or PR description.
- Record any intentional docs-only old-model mentions.
- Record whether broad verification was deferred to Task 16.

### Detailed Task 8: Plugin Management UI And Schema Settings

**Files:**
- `apps/desktop-app/src/common/recommendedPlugins.ts`
- `apps/desktop-app/src/renderer/components/settings/SettingsPlugins.vue`
- `apps/desktop-app/src/renderer/components/settings/SettingsPlugins.test.ts`
- `apps/desktop-app/src/renderer/components/settings/pluginSettingsSectionKey.ts`
- `apps/desktop-app/src/renderer/components/settings/pluginSettingsSectionKey.test.ts`
- `apps/desktop-app/src/renderer/components/settings/SettingsWindowShell.vue`
- `apps/desktop-app/src/renderer/components/settings/PluginSettingsSchema.vue`

- [ ] **Step 1: Read the task-local files and source expectations**

Open the files listed above and compare them with the final identity rules in this merged plan. Do not preserve old single-ID, `official.*`, bundled-host, migration, or fallback behavior.

- [ ] **Step 2: Write the failing tests**

- Write SettingsPlugins tests with preview manifest author metadata.
- Assert install confirmation contains Author: XiiTang (xiitang).
- Assert update/delete/enable/disable call store methods with xiitang/word-lookup.
- Write pluginSettingsSectionKey tests preserving slashes in pluginKey.
- Update recommendedPlugins.ts to raw GitHub manifest URLs.

Recommended plugin base:

```ts
const RAW_PLUGIN_REPOSITORY_BASE =
  "https://raw.githubusercontent.com/XiiTang/Immersive-Subs-Prompter/main/plugin-repository";
```

Composite settings key helper:

```ts
const SEPARATOR = "::";

export function toPluginSettingsSectionKey(pluginKey: string, sectionId: string): string {
  return pluginKey + SEPARATOR + sectionId;
}
```

- [ ] **Step 3: Run the failing test command**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app exec vitest run src/renderer/components/settings/SettingsPlugins.test.ts src/renderer/components/settings/pluginSettingsSectionKey.test.ts src/renderer/components/settings/SettingsWindowShell.test.ts src/renderer/components/settings/PluginSettingsSchema.test.ts --project jsdom
```

Expected: FAIL because UI rows do not expose author/pluginKey or composite settings keys are missing.

- [ ] **Step 4: Implement the final-state behavior**

- Filter recommended entries by installed pluginKey.
- Render author metadata for installed and recommended rows.
- Use plugin.pluginKey in button test IDs and action handlers.
- Build SettingsWindowShell plugin sections with <pluginKey>::<sectionId>.
- Resolve PluginSettingsSchema config and section by composite key.
- Write schema updates under settings.plugins[pluginKey].
- Remove plugin localization and official settings registry assumptions.
- Keep implementation aligned to `pluginKey = <author.id>/<id>` wherever identity crosses file, process, IPC, settings, registry, or UI boundaries.
- Do not add compatibility readers, migration branches, old-name aliases, catch-all fallbacks, or old host wrappers unless this plan explicitly asks for them.

- [ ] **Step 5: Update all affected fixtures and mocks**

- Manifest fixtures must include `author`.
- Catalog fixtures must include `pluginKey`, short `id`, and `author`.
- Registry fixtures must be keyed by `pluginKey`.
- Settings fixtures must use `settings.plugins[pluginKey]`.
- Recommended plugin fixtures must point to `raw.githubusercontent.com/.../plugin-repository/.../manifest.json`.

- [ ] **Step 6: Run focused verification until it passes**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app exec vitest run src/renderer/components/settings/SettingsPlugins.test.ts src/renderer/components/settings/pluginSettingsSectionKey.test.ts src/renderer/components/settings/SettingsWindowShell.test.ts src/renderer/components/settings/PluginSettingsSchema.test.ts --project jsdom
pnpm --filter @immersive-subs/desktop-app typecheck:app
```

Expected: PASS for the focused tests and typecheck, or a specific failure that belongs to a later task and is documented before continuing.

- [ ] **Step 7: Run task-specific residue checks**

Run:

```bash
rg -n "official\.|pluginIds|plugins/official|registerBundledPlugin|PluginHost|plugins\.immersive-subs\.app" apps/desktop-app/src plugins scripts README.md DEPLOYMENT.md
```

Expected: no runtime or user-facing old-model references introduced by this task. Mentions in current merged design docs are allowed only when explicitly stating that the old model is unsupported.

- [ ] **Step 8: Commit the task**

Use the task file list above as the staging scope. Commit message:

```bash
git commit -m "feat: route plugin UI actions by author key"
```

- [ ] **Step 9: Record task completion evidence**

- Record the focused command output in the implementation notes or PR description.
- Record any intentional docs-only old-model mentions.
- Record whether broad verification was deferred to Task 16.

### Detailed Task 9: Replace Bundled PluginHost In WindowController

**Files:**
- `apps/desktop-app/src/main/window/windowController.ts`
- `apps/desktop-app/src/main/window/windowController.test.ts`
- `apps/desktop-app/src/main/plugins/pluginManager.ts`

- [ ] **Step 1: Read the task-local files and source expectations**

Open the files listed above and compare them with the final identity rules in this merged plan. Do not preserve old single-ID, `official.*`, bundled-host, migration, or fallback behavior.

- [ ] **Step 2: Write the failing tests**

- Write integration expectation that WindowController constructs PluginManager.
- Write expectation that no bundled register path is called.
- Change IpcContext from pluginHost to pluginManager.
- Instantiate PluginRegistryStore with getRegistryPath().
- Instantiate PluginManager with settings accessors and media source callbacks.

WindowController wiring shape:

```ts
const registryStore = new PluginRegistryStore(getRegistryPath());
this.pluginManager = new PluginManager({
  rootDir: getPluginsRootPath(),
  registryStore,
  getSettings: () => this.stateManager.getSettings(),
  replaceSettings: (next) => this.stateManager.replaceSettings(next)
});
```

Startup load behavior:

```ts
await this.pluginManager.loadEnabledPlugins();
await this.pushPluginCatalog();
```

- [ ] **Step 3: Run the failing test command**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app exec vitest run src/main/window/windowController.test.ts src/main/plugins/pluginManager.test.ts --project main
```

Expected: FAIL because WindowController still registers bundled plugins or passes PluginHost into IPC context.

- [ ] **Step 4: Implement the final-state behavior**

- Call loadEnabledPlugins during startup.
- Mark only failed plugin records broken during startup.
- Delete old bundled host imports and constructor paths.
- Run residue scan for PluginHost and registerBundledPlugin.
- Update tests that mocked the old host.
- Keep implementation aligned to `pluginKey = <author.id>/<id>` wherever identity crosses file, process, IPC, settings, registry, or UI boundaries.
- Do not add compatibility readers, migration branches, old-name aliases, catch-all fallbacks, or old host wrappers unless this plan explicitly asks for them.

- [ ] **Step 5: Update all affected fixtures and mocks**

- Manifest fixtures must include `author`.
- Catalog fixtures must include `pluginKey`, short `id`, and `author`.
- Registry fixtures must be keyed by `pluginKey`.
- Settings fixtures must use `settings.plugins[pluginKey]`.
- Recommended plugin fixtures must point to `raw.githubusercontent.com/.../plugin-repository/.../manifest.json`.

- [ ] **Step 6: Run focused verification until it passes**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app exec vitest run src/main/window/windowController.test.ts src/main/plugins/pluginManager.test.ts --project main
pnpm --filter @immersive-subs/desktop-app typecheck:app
```

Expected: PASS for the focused tests and typecheck, or a specific failure that belongs to a later task and is documented before continuing.

- [ ] **Step 7: Run task-specific residue checks**

Run:

```bash
rg -n "official\.|pluginIds|plugins/official|registerBundledPlugin|PluginHost|plugins\.immersive-subs\.app" apps/desktop-app/src plugins scripts README.md DEPLOYMENT.md
```

Expected: no runtime or user-facing old-model references introduced by this task. Mentions in current merged design docs are allowed only when explicitly stating that the old model is unsupported.

- [ ] **Step 8: Commit the task**

Use the task file list above as the staging scope. Commit message:

```bash
git commit -m "refactor: replace bundled plugin host"
```

- [ ] **Step 9: Record task completion evidence**

- Record the focused command output in the implementation notes or PR description.
- Record any intentional docs-only old-model mentions.
- Record whether broad verification was deferred to Task 16.

### Detailed Task 10: Word Lookup Plugin Cutover

**Files:**
- `apps/desktop-app/src/main/ipc/handlers/pluginHandlers.ts`
- `apps/desktop-app/src/renderer/components/subtitle/SubtitleView.vue`
- `apps/desktop-app/src/main/plugins/pluginContributionRegistry.ts`
- `plugins/word-lookup/manifest.json`
- `plugins/word-lookup/main.ts`

- [ ] **Step 1: Read the task-local files and source expectations**

Open the files listed above and compare them with the final identity rules in this merged plan. Do not preserve old single-ID, `official.*`, bundled-host, migration, or fallback behavior.

- [ ] **Step 2: Write the failing tests**

- Write failing test that word lookup IPC routes through PluginContributionRegistry.
- Write renderer test that enable checks depend on wordLookupProvider permission, not official ID.
- Create downloadable word-lookup plugin manifest with xiitang author.
- Move dictionary loading and lookup logic into plugin source.
- Register wordLookupProvider contribution through usp API.

Word lookup provider test shape:

```ts
registry.registerWordLookupProvider("xiitang/word-lookup", "main", async (token) => ({
  markdown: `# ${token}`
}));
await expect(registry.lookupWord("hello")).resolves.toEqual({ markdown: "# hello" });
```

Manifest identity:

```json
{
  "id": "word-lookup",
  "author": { "id": "xiitang", "name": "XiiTang", "url": "https://github.com/XiiTang" },
  "permissions": ["settingsSchema", "readSelectedFile", "wordLookupProvider"]
}
```

- [ ] **Step 3: Run the failing test command**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app exec vitest run src/main/plugins/pluginContributionRegistry.test.ts src/renderer/components/subtitle/SubtitleView.test.ts --project jsdom
```

Expected: FAIL because word lookup still checks a hard-coded official ID or provider bridge is missing.

- [ ] **Step 4: Implement the final-state behavior**

- Keep hover, floating panel, markdown rendering, sizing, and positioning in the host.
- Store config under settings.plugins["xiitang/word-lookup"].
- Add bridge wrapper in PluginManager for provider calls.
- Remove hard-coded word lookup ID checks.
- Run focused UI and contribution tests.
- Keep implementation aligned to `pluginKey = <author.id>/<id>` wherever identity crosses file, process, IPC, settings, registry, or UI boundaries.
- Do not add compatibility readers, migration branches, old-name aliases, catch-all fallbacks, or old host wrappers unless this plan explicitly asks for them.

- [ ] **Step 5: Update all affected fixtures and mocks**

- Manifest fixtures must include `author`.
- Catalog fixtures must include `pluginKey`, short `id`, and `author`.
- Registry fixtures must be keyed by `pluginKey`.
- Settings fixtures must use `settings.plugins[pluginKey]`.
- Recommended plugin fixtures must point to `raw.githubusercontent.com/.../plugin-repository/.../manifest.json`.

- [ ] **Step 6: Run focused verification until it passes**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app exec vitest run src/main/plugins/pluginContributionRegistry.test.ts src/renderer/components/subtitle/SubtitleView.test.ts --project jsdom
pnpm --filter @immersive-subs/desktop-app typecheck:app
```

Expected: PASS for the focused tests and typecheck, or a specific failure that belongs to a later task and is documented before continuing.

- [ ] **Step 7: Run task-specific residue checks**

Run:

```bash
rg -n "official\.|pluginIds|plugins/official|registerBundledPlugin|PluginHost|plugins\.immersive-subs\.app" apps/desktop-app/src plugins scripts README.md DEPLOYMENT.md
```

Expected: no runtime or user-facing old-model references introduced by this task. Mentions in current merged design docs are allowed only when explicitly stating that the old model is unsupported.

- [ ] **Step 8: Commit the task**

Use the task file list above as the staging scope. Commit message:

```bash
git commit -m "feat: route word lookup through plugin providers"
```

- [ ] **Step 9: Record task completion evidence**

- Record the focused command output in the implementation notes or PR description.
- Record any intentional docs-only old-model mentions.
- Record whether broad verification was deferred to Task 16.

### Detailed Task 11: Transcription Plugin Cutover

**Files:**
- `apps/desktop-app/src/main/ipc/handlers/transcriptionHandlers.ts`
- `apps/desktop-app/src/renderer/components/top-panel/TopControlPanel.vue`
- `apps/desktop-app/src/main/plugins/pluginContributionRegistry.ts`
- `plugins/transcription/manifest.json`
- `plugins/transcription/main.ts`

- [ ] **Step 1: Read the task-local files and source expectations**

Open the files listed above and compare them with the final identity rules in this merged plan. Do not preserve old single-ID, `official.*`, bundled-host, migration, or fallback behavior.

- [ ] **Step 2: Write the failing tests**

- Write failing test for PluginContributionRegistry transcription provider selection.
- Write failing handler test for no provider enabled.
- Route transcriptionHandlers through contribution registry.
- Keep active video state and cache placement in host code.
- Keep status projection and subtitle track injection in host code.

Transcription provider lookup:

```ts
const provider = contributionRegistry.getTranscriptionProvider();
if (!provider) {
  throw new Error("No enabled transcription provider");
}
const result = await provider.transcribe(activeMediaContext);
```

Manifest identity:

```json
{
  "id": "transcription",
  "author": { "id": "xiitang", "name": "XiiTang", "url": "https://github.com/XiiTang" },
  "permissions": ["settingsSchema", "transcriptionProvider", "transcriptionRuntime"]
}
```

- [ ] **Step 3: Run the failing test command**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app exec vitest run src/main/plugins/pluginContributionRegistry.test.ts src/main/ipc/handlers/transcriptionHandlers.test.ts --project main
```

Expected: FAIL because transcription handler still uses official.transcription or no provider is registered.

- [ ] **Step 4: Implement the final-state behavior**

- Move provider-specific transcription logic into plugins/transcription.
- Use settings contribution ID transcription.settings.
- Store config under settings.plugins["xiitang/transcription"].
- Update renderer enable checks to use permissions.
- Remove official.transcription command lookup.
- Keep implementation aligned to `pluginKey = <author.id>/<id>` wherever identity crosses file, process, IPC, settings, registry, or UI boundaries.
- Do not add compatibility readers, migration branches, old-name aliases, catch-all fallbacks, or old host wrappers unless this plan explicitly asks for them.

- [ ] **Step 5: Update all affected fixtures and mocks**

- Manifest fixtures must include `author`.
- Catalog fixtures must include `pluginKey`, short `id`, and `author`.
- Registry fixtures must be keyed by `pluginKey`.
- Settings fixtures must use `settings.plugins[pluginKey]`.
- Recommended plugin fixtures must point to `raw.githubusercontent.com/.../plugin-repository/.../manifest.json`.

- [ ] **Step 6: Run focused verification until it passes**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app exec vitest run src/main/plugins/pluginContributionRegistry.test.ts src/main/ipc/handlers/transcriptionHandlers.test.ts --project main
pnpm --filter @immersive-subs/desktop-app typecheck:app
```

Expected: PASS for the focused tests and typecheck, or a specific failure that belongs to a later task and is documented before continuing.

- [ ] **Step 7: Run task-specific residue checks**

Run:

```bash
rg -n "official\.|pluginIds|plugins/official|registerBundledPlugin|PluginHost|plugins\.immersive-subs\.app" apps/desktop-app/src plugins scripts README.md DEPLOYMENT.md
```

Expected: no runtime or user-facing old-model references introduced by this task. Mentions in current merged design docs are allowed only when explicitly stating that the old model is unsupported.

- [ ] **Step 8: Commit the task**

Use the task file list above as the staging scope. Commit message:

```bash
git commit -m "feat: route transcription through plugin providers"
```

- [ ] **Step 9: Record task completion evidence**

- Record the focused command output in the implementation notes or PR description.
- Record any intentional docs-only old-model mentions.
- Record whether broad verification was deferred to Task 16.

### Detailed Task 12: Generic Media Source Adapter Host

**Files:**
- `apps/desktop-app/src/main/mediaSources/mediaSourceController.ts`
- `apps/desktop-app/src/main/mediaSources/mediaSourceController.test.ts`
- `apps/desktop-app/src/main/window/windowController.ts`
- `apps/desktop-app/src/main/plugins/pluginManager.ts`
- `apps/desktop-app/src/main/plugins/pluginContributionRegistry.ts`

- [ ] **Step 1: Read the task-local files and source expectations**

Open the files listed above and compare them with the final identity rules in this merged plan. Do not preserve old single-ID, `official.*`, bundled-host, migration, or fallback behavior.

- [ ] **Step 2: Write the failing tests**

- Write tests for sourceMatched projecting active media source.
- Write tests for subtitleTracksLoaded projecting tracks into renderer state.
- Write tests for playbackSnapshot updating playback without extension overwrite.
- Write tests for unmatched browser context clearing active media-source state.
- Write tests for clearing plugin-owned media-source state on plugin stop.

Adapter event union:

```ts
type MediaSourceAdapterEvent =
  | { type: "sourceMatched"; pluginKey: string; sourceId: string }
  | { type: "sessionsChanged"; pluginKey: string; sessions: unknown[] }
  | { type: "subtitleTracksLoaded"; pluginKey: string; tracks: unknown[] }
  | { type: "playbackSnapshot"; pluginKey: string; snapshot: unknown }
  | { type: "sourceDisconnected"; pluginKey: string }
  | { type: "error"; pluginKey: string; message: string };
```

Handled playback rule:

```ts
if (await mediaSourceController.handleBrowserVideoContext(context)) {
  return;
}
await extensionSubtitleController.handleBrowserVideoContext(context);
```

- [ ] **Step 3: Run the failing test command**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app exec vitest run src/main/mediaSources/mediaSourceController.test.ts src/main/plugins/pluginManager.test.ts --project main
```

Expected: FAIL because mediaSourceController does not exist or adapter events are not projected into host state.

- [ ] **Step 4: Implement the final-state behavior**

- Create MediaSourceController with host-owned StateManager updates.
- Route adapter events from PluginManager into MediaSourceController.
- Wait for adapter handling before extension fallback.
- Mark adapter playback events handled.
- Keep command routing and subtitle priority selection host-owned.
- Keep implementation aligned to `pluginKey = <author.id>/<id>` wherever identity crosses file, process, IPC, settings, registry, or UI boundaries.
- Do not add compatibility readers, migration branches, old-name aliases, catch-all fallbacks, or old host wrappers unless this plan explicitly asks for them.

- [ ] **Step 5: Update all affected fixtures and mocks**

- Manifest fixtures must include `author`.
- Catalog fixtures must include `pluginKey`, short `id`, and `author`.
- Registry fixtures must be keyed by `pluginKey`.
- Settings fixtures must use `settings.plugins[pluginKey]`.
- Recommended plugin fixtures must point to `raw.githubusercontent.com/.../plugin-repository/.../manifest.json`.

- [ ] **Step 6: Run focused verification until it passes**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app exec vitest run src/main/mediaSources/mediaSourceController.test.ts src/main/plugins/pluginManager.test.ts --project main
pnpm --filter @immersive-subs/desktop-app typecheck:app
```

Expected: PASS for the focused tests and typecheck, or a specific failure that belongs to a later task and is documented before continuing.

- [ ] **Step 7: Run task-specific residue checks**

Run:

```bash
rg -n "official\.|pluginIds|plugins/official|registerBundledPlugin|PluginHost|plugins\.immersive-subs\.app" apps/desktop-app/src plugins scripts README.md DEPLOYMENT.md
```

Expected: no runtime or user-facing old-model references introduced by this task. Mentions in current merged design docs are allowed only when explicitly stating that the old model is unsupported.

- [ ] **Step 8: Commit the task**

Use the task file list above as the staging scope. Commit message:

```bash
git commit -m "feat: add media source adapter host"
```

- [ ] **Step 9: Record task completion evidence**

- Record the focused command output in the implementation notes or PR description.
- Record any intentional docs-only old-model mentions.
- Record whether broad verification was deferred to Task 16.

### Detailed Task 13: Jellyfin/Emby Plugin Cutover

**Files:**
- `plugins/jellyfinemby/manifest.json`
- `plugins/jellyfinemby/main.ts`
- `apps/desktop-app/src/renderer/components/settings/PluginSettingsSchema.test.ts`
- `apps/desktop-app/src/main/mediaSources/mediaSourceController.test.ts`

- [ ] **Step 1: Read the task-local files and source expectations**

Open the files listed above and compare them with the final identity rules in this merged plan. Do not preserve old single-ID, `official.*`, bundled-host, migration, or fallback behavior.

- [ ] **Step 2: Write the failing tests**

- Run existing Jellyfin/Emby behavior tests before moving code.
- Create xiitang/jellyfinemby source manifest.
- Use settings contribution ID jellyfinemby.settings.
- Change server config field to serverList.
- Move URL matching and item identity into plugin source.

serverList schema:

```json
{
  "id": "servers",
  "label": "Servers",
  "type": "serverList",
  "defaultValue": []
}
```

Manifest identity:

```json
{
  "id": "jellyfinemby",
  "author": { "id": "xiitang", "name": "XiiTang", "url": "https://github.com/XiiTang" },
  "permissions": ["settingsSchema", "network", "mediaSourceAdapter"]
}
```

- [ ] **Step 3: Run the failing test command**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app exec vitest run src/main/mediaSources/mediaSourceController.test.ts src/main/plugins/pluginManager.test.ts src/renderer/components/settings/PluginSettingsSchema.test.ts --project jsdom
```

Expected: FAIL because Jellyfin/Emby behavior is still host-specific or server settings are JSON text instead of serverList.

- [ ] **Step 4: Implement the final-state behavior**

- Move server connections and session aggregation into plugin source.
- Move subtitle stream fetching into plugin source.
- Move playback snapshot conversion into plugin source.
- Register mediaSourceAdapter contribution.
- Remove host activation wrapper and old fixed ID behavior.
- Keep implementation aligned to `pluginKey = <author.id>/<id>` wherever identity crosses file, process, IPC, settings, registry, or UI boundaries.
- Do not add compatibility readers, migration branches, old-name aliases, catch-all fallbacks, or old host wrappers unless this plan explicitly asks for them.

- [ ] **Step 5: Update all affected fixtures and mocks**

- Manifest fixtures must include `author`.
- Catalog fixtures must include `pluginKey`, short `id`, and `author`.
- Registry fixtures must be keyed by `pluginKey`.
- Settings fixtures must use `settings.plugins[pluginKey]`.
- Recommended plugin fixtures must point to `raw.githubusercontent.com/.../plugin-repository/.../manifest.json`.

- [ ] **Step 6: Run focused verification until it passes**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app exec vitest run src/main/mediaSources/mediaSourceController.test.ts src/main/plugins/pluginManager.test.ts src/renderer/components/settings/PluginSettingsSchema.test.ts --project jsdom
pnpm --filter @immersive-subs/desktop-app typecheck:app
```

Expected: PASS for the focused tests and typecheck, or a specific failure that belongs to a later task and is documented before continuing.

- [ ] **Step 7: Run task-specific residue checks**

Run:

```bash
rg -n "official\.|pluginIds|plugins/official|registerBundledPlugin|PluginHost|plugins\.immersive-subs\.app" apps/desktop-app/src plugins scripts README.md DEPLOYMENT.md
```

Expected: no runtime or user-facing old-model references introduced by this task. Mentions in current merged design docs are allowed only when explicitly stating that the old model is unsupported.

- [ ] **Step 8: Commit the task**

Use the task file list above as the staging scope. Commit message:

```bash
git commit -m "feat: move jellyfin emby to media source plugin"
```

- [ ] **Step 9: Record task completion evidence**

- Record the focused command output in the implementation notes or PR description.
- Record any intentional docs-only old-model mentions.
- Record whether broad verification was deferred to Task 16.

### Detailed Task 14: Remove Official Plugin Residue

**Files:**
- `apps/desktop-app/src/main/plugins/*`
- `apps/desktop-app/src/renderer/components/settings/*`
- `apps/desktop-app/src/common/recommendedPlugins.ts`
- `README.md`
- `DEPLOYMENT.md`

- [ ] **Step 1: Read the task-local files and source expectations**

Open the files listed above and compare them with the final identity rules in this merged plan. Do not preserve old single-ID, `official.*`, bundled-host, migration, or fallback behavior.

- [ ] **Step 2: Write the failing tests**

- Run residue scan and record every match.
- Classify matches as runtime source, test fixture, or explicit unsupported-model docs.
- Delete old bundled host modules if no longer imported.
- Delete pluginIds.ts if it only carries fixed official IDs.
- Remove registerBundledPlugin call paths.

Residue scan:

```bash
rg -n "official\\.|pluginIds|plugins/official|registerBundledPlugin|PluginHost|plugins\\.immersive-subs\\.app" apps/desktop-app/src plugins scripts README.md DEPLOYMENT.md
```

Allowed old-model wording:

```ts
The old official.* identities are unsupported.
No old ID mapping, old config reader, or migration is added.
```

- [ ] **Step 3: Run the failing test command**

Run:

```bash
rg -n "official\.|pluginIds|plugins/official|registerBundledPlugin|PluginHost|plugins\.immersive-subs\.app" apps/desktop-app/src plugins scripts README.md DEPLOYMENT.md
```

Expected: FAIL if old plugin model references remain outside explicit unsupported-model documentation.

- [ ] **Step 4: Implement the final-state behavior**

- Remove plugin localization wrappers keyed by official IDs.
- Remove official settings registry wrappers.
- Update tests to use pluginKey catalog rows.
- Run residue scan again.
- Run affected typechecks and focused tests.
- Keep implementation aligned to `pluginKey = <author.id>/<id>` wherever identity crosses file, process, IPC, settings, registry, or UI boundaries.
- Do not add compatibility readers, migration branches, old-name aliases, catch-all fallbacks, or old host wrappers unless this plan explicitly asks for them.

- [ ] **Step 5: Update all affected fixtures and mocks**

- Manifest fixtures must include `author`.
- Catalog fixtures must include `pluginKey`, short `id`, and `author`.
- Registry fixtures must be keyed by `pluginKey`.
- Settings fixtures must use `settings.plugins[pluginKey]`.
- Recommended plugin fixtures must point to `raw.githubusercontent.com/.../plugin-repository/.../manifest.json`.

- [ ] **Step 6: Run focused verification until it passes**

Run:

```bash
rg -n "official\.|pluginIds|plugins/official|registerBundledPlugin|PluginHost|plugins\.immersive-subs\.app" apps/desktop-app/src plugins scripts README.md DEPLOYMENT.md
pnpm --filter @immersive-subs/desktop-app typecheck:app
```

Expected: PASS for the focused tests and typecheck, or a specific failure that belongs to a later task and is documented before continuing.

- [ ] **Step 7: Run task-specific residue checks**

Run:

```bash
rg -n "official\.|pluginIds|plugins/official|registerBundledPlugin|PluginHost|plugins\.immersive-subs\.app" apps/desktop-app/src plugins scripts README.md DEPLOYMENT.md
```

Expected: no runtime or user-facing old-model references introduced by this task. Mentions in current merged design docs are allowed only when explicitly stating that the old model is unsupported.

- [ ] **Step 8: Commit the task**

Use the task file list above as the staging scope. Commit message:

```bash
git commit -m "refactor: remove official plugin residue"
```

- [ ] **Step 9: Record task completion evidence**

- Record the focused command output in the implementation notes or PR description.
- Record any intentional docs-only old-model mentions.
- Record whether broad verification was deferred to Task 16.

### Detailed Task 15: Source Manifests And Repository Artifacts

**Files:**
- `plugins/word-lookup/manifest.json`
- `plugins/transcription/manifest.json`
- `plugins/jellyfinemby/manifest.json`
- `apps/desktop-app/src/main/plugins/pluginSourceManifests.test.ts`
- `scripts/package-plugins.mjs`
- `plugin-repository/*`

- [ ] **Step 1: Read the task-local files and source expectations**

Open the files listed above and compare them with the final identity rules in this merged plan. Do not preserve old single-ID, `official.*`, bundled-host, migration, or fallback behavior.

- [ ] **Step 2: Write the failing tests**

- Write source manifest tests for word-lookup short ID and xiitang author.
- Write source manifest tests for transcription short ID and xiitang author.
- Write source manifest tests for jellyfinemby short ID and xiitang author.
- Change all source manifests to short IDs.
- Add author metadata to all source manifests.

Packaging constants:

```ts
const outputRoot = path.join(repoRoot, "plugin-repository");
const publicBaseUrl = (
  process.env.USP_PLUGIN_BASE_URL ??
  "https://raw.githubusercontent.com/XiiTang/Immersive-Subs-Prompter/main/plugin-repository"
).replace(/\/+$/, "");
```

Manifest identity check command:

```bash
node -e 'const fs=require("fs"); for (const name of ["word-lookup","transcription","jellyfinemby"]) { const m=JSON.parse(fs.readFileSync(`plugin-repository/${name}/manifest.json`,"utf8")); console.log(`${m.author.id}/${m.id} ${m.package.url}`); }'
```

- [ ] **Step 3: Run the failing test command**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app exec vitest run src/main/plugins/pluginSourceManifests.test.ts --project main
```

Expected: FAIL because source manifests still use old IDs or lack author metadata.

- [ ] **Step 4: Implement the final-state behavior**

- Remove package descriptor from source manifests.
- Use final settings section IDs.
- Update packaging output root to plugin-repository.
- Update default public base URL to GitHub raw plugin-repository.
- Run pnpm build:plugins and inspect generated artifacts.
- Verify raw GitHub package URLs in generated manifests.
- Verify plugin-repository files are not ignored.
- Keep implementation aligned to `pluginKey = <author.id>/<id>` wherever identity crosses file, process, IPC, settings, registry, or UI boundaries.
- Do not add compatibility readers, migration branches, old-name aliases, catch-all fallbacks, or old host wrappers unless this plan explicitly asks for them.

- [ ] **Step 5: Update all affected fixtures and mocks**

- Manifest fixtures must include `author`.
- Catalog fixtures must include `pluginKey`, short `id`, and `author`.
- Registry fixtures must be keyed by `pluginKey`.
- Settings fixtures must use `settings.plugins[pluginKey]`.
- Recommended plugin fixtures must point to `raw.githubusercontent.com/.../plugin-repository/.../manifest.json`.

- [ ] **Step 6: Run focused verification until it passes**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app exec vitest run src/main/plugins/pluginSourceManifests.test.ts --project main
pnpm --filter @immersive-subs/desktop-app typecheck:app
```

Expected: PASS for the focused tests and typecheck, or a specific failure that belongs to a later task and is documented before continuing.

- [ ] **Step 7: Run task-specific residue checks**

Run:

```bash
rg -n "official\.|pluginIds|plugins/official|registerBundledPlugin|PluginHost|plugins\.immersive-subs\.app" apps/desktop-app/src plugins scripts README.md DEPLOYMENT.md
```

Expected: no runtime or user-facing old-model references introduced by this task. Mentions in current merged design docs are allowed only when explicitly stating that the old model is unsupported.

- [ ] **Step 8: Commit the task**

Use the task file list above as the staging scope. Commit message:

```bash
git commit -m "feat: publish plugins from repository artifacts"
```

- [ ] **Step 9: Record task completion evidence**

- Record the focused command output in the implementation notes or PR description.
- Record any intentional docs-only old-model mentions.
- Record whether broad verification was deferred to Task 16.

### Detailed Task 16: Documentation And Final Verification

**Files:**
- `README.md`
- `DEPLOYMENT.md`
- `docs/superpowers/specs/2026-06-07-dynamic-plugin-system-design.md`
- `docs/superpowers/plans/2026-06-07-dynamic-plugin-system-implementation-design.md`

- [ ] **Step 1: Read the task-local files and source expectations**

Open the files listed above and compare them with the final identity rules in this merged plan. Do not preserve old single-ID, `official.*`, bundled-host, migration, or fallback behavior.

- [ ] **Step 2: Write the failing tests**

- Update README with final HTTPS install-link model.
- Update README with recommended raw GitHub manifest behavior.
- Update DEPLOYMENT with pnpm build:plugins.
- Update DEPLOYMENT with plugin-repository generated artifacts.
- Document USP_PLUGIN_BASE_URL only as an intentional alternate HTTPS location.

README paragraph:

```md
Desktop capabilities such as word lookup, speech transcription, and Jellyfin / Emby integration are installed as dynamic plugins from HTTPS plugin install links. Settings -> Plugins shows the project-maintained plugins as recommended entries. These recommendations point to raw GitHub manifests committed under `plugin-repository/*` in this repository, and they use the same preview, permission confirmation, install, update, enable, disable, and delete flow as any other plugin.
```

Broad verification commands:

```bash
pnpm test
pnpm typecheck
pnpm build
```

- [ ] **Step 3: Run the failing test command**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app typecheck:app
```

Expected: FAIL if docs still describe release assets, auto-preinstalled plugins, old official compatibility, or old distribution host.

- [ ] **Step 4: Implement the final-state behavior**

- Remove docs that imply GitHub Release plugin assets.
- Remove docs that imply auto-preinstalled default plugins.
- Run focused main plugin tests.
- Run focused renderer settings tests.
- Run typecheck:app and pnpm build:plugins.
- Run broad pnpm test, pnpm typecheck, pnpm build.
- Run final old-model residue scan.
- Keep implementation aligned to `pluginKey = <author.id>/<id>` wherever identity crosses file, process, IPC, settings, registry, or UI boundaries.
- Do not add compatibility readers, migration branches, old-name aliases, catch-all fallbacks, or old host wrappers unless this plan explicitly asks for them.

- [ ] **Step 5: Update all affected fixtures and mocks**

- Manifest fixtures must include `author`.
- Catalog fixtures must include `pluginKey`, short `id`, and `author`.
- Registry fixtures must be keyed by `pluginKey`.
- Settings fixtures must use `settings.plugins[pluginKey]`.
- Recommended plugin fixtures must point to `raw.githubusercontent.com/.../plugin-repository/.../manifest.json`.

- [ ] **Step 6: Run focused verification until it passes**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app typecheck:app
pnpm --filter @immersive-subs/desktop-app typecheck:app
```

Expected: PASS for the focused tests and typecheck, or a specific failure that belongs to a later task and is documented before continuing.

- [ ] **Step 7: Run task-specific residue checks**

Run:

```bash
rg -n "official\.|pluginIds|plugins/official|registerBundledPlugin|PluginHost|plugins\.immersive-subs\.app" apps/desktop-app/src plugins scripts README.md DEPLOYMENT.md
```

Expected: no runtime or user-facing old-model references introduced by this task. Mentions in current merged design docs are allowed only when explicitly stating that the old model is unsupported.

- [ ] **Step 8: Commit the task**

Use the task file list above as the staging scope. Commit message:

```bash
git commit -m "docs: describe repository plugin distribution"
```

- [ ] **Step 9: Record task completion evidence**

- Record the focused command output in the implementation notes or PR description.
- Record any intentional docs-only old-model mentions.
- Record whether broad verification was deferred to Task 16.


## Final Integration Check

- [ ] Confirm no old plugin model was reintroduced.

```bash
rg -n "official\\.|pluginIds|plugins/official|registerBundledPlugin|PluginHost|plugins\\.immersive-subs\\.app" apps/desktop-app/src plugins scripts README.md DEPLOYMENT.md
```

Expected: no source or user-facing documentation references to old plugin IDs, old bundled plugin paths, the old plugin host, or the old `plugins.immersive-subs.app` host.

- [ ] Confirm plugin repository manifests contain the final identity.

```bash
node -e 'const fs=require("fs"); for (const name of ["word-lookup","transcription","jellyfinemby"]) { const m=JSON.parse(fs.readFileSync(`plugin-repository/${name}/manifest.json`,"utf8")); console.log(`${m.author.id}/${m.id} ${m.package.url}`); }'
```

Expected:

```text
xiitang/word-lookup https://raw.githubusercontent.com/XiiTang/Immersive-Subs-Prompter/main/plugin-repository/word-lookup/1.0.0.usp-plugin
xiitang/transcription https://raw.githubusercontent.com/XiiTang/Immersive-Subs-Prompter/main/plugin-repository/transcription/1.0.0.usp-plugin
xiitang/jellyfinemby https://raw.githubusercontent.com/XiiTang/Immersive-Subs-Prompter/main/plugin-repository/jellyfinemby/1.0.0.usp-plugin
```

- [ ] Confirm no obsolete source-plan assumptions remain in current implementation docs.

```bash
rg -n "plugins\\.immersive-subs\\.example|installed/<plugin-id>|official\\.transcription|official\\.word-lookup|official\\.jellyfinemby|registerBundledPlugin\\(\\)|GitHub Releases for plugins|file:// plugin" docs/superpowers/specs/2026-06-07-dynamic-plugin-system-design.md docs/superpowers/plans/2026-06-07-dynamic-plugin-system-implementation-design.md
```

Expected: no matches except explicit unsupported-old-model examples where useful.

- [ ] Confirm working tree state.

```bash
git status --short
```

Expected: only intentional changes before commit, clean after commit.

## Self-Review Checklist

- [ ] Manifest schema, package schema, author identity, plugin key, and package-manifest comparison are covered.
- [ ] Runtime install links, HTTPS enforcement, confirmed-manifest validation, sha256, package extraction, atomic replacement, and rollback are covered.
- [ ] User data storage, registry state, lifecycle actions, catalog rows, runtime maps, contribution ownership, and settings records use plugin keys.
- [ ] Isolated runtime and permission enforcement avoid Electron, unrestricted Node, renderer DOM, host functions, and host constructors in plugin code.
- [ ] Settings UI, recommended links, author display, permission confirmation, schema rendering, and plugin actions use plugin keys.
- [ ] There is no official privilege path, bundled-only host, old ID mapping, old config migration, local file install, GitHub Releases, GitHub Pages, auto preinstall, or background automatic update.
- [ ] Word lookup, transcription, and Jellyfin/Emby are normal downloadable plugins.
- [ ] Media-source adapter handling covers awaited adapter matching, handled playback events, active-source clearing, async contribution registration, strict manifest validation, and installed-plugin action error reporting.
