# Extension Manifest Build Unification

## Goal

The browser extension keeps separate Chrome and Firefox output artifacts, but it no longer maintains separate hand-written manifest sources.

The final shape has one source of truth for extension manifest data and two generated browser-specific manifest outputs:

- `apps/extension/dist/chrome/manifest.json`
- `apps/extension/dist/firefox/manifest.json`

The source tree should make the browser difference explicit and small. Shared extension identity, permissions, host permissions, content scripts, popup action, icons, localized manifest keys, and extension version handling live in one manifest source module. Chrome and Firefox only declare the fields that are genuinely browser-specific.

## Non-Goals

- Do not raise the supported browser minimum versions.
- Do not merge Chrome and Firefox into one final browser artifact.
- Do not introduce a WebExtension framework or new bundler.
- Do not change extension runtime behavior.
- Do not keep old manifest source files as compatibility inputs.
- Do not add migration or fallback handling for old build layouts. The project has not launched, so the implementation should delete obsolete source paths instead of preserving them.

## Final Architecture

`apps/extension` owns a typed manifest builder module. The builder exports a function that receives a browser target and package version, then returns the final manifest object for that target.

The target set is exactly:

```ts
type ExtensionBuildTarget = "chrome" | "firefox";
```

The manifest builder has three layers:

1. Common manifest fields shared by every target.
2. A Chrome target patch.
3. A Firefox target patch.

The Chrome output uses a Manifest V3 service worker:

```json
{
  "background": {
    "service_worker": "dist/background.js",
    "type": "module"
  }
}
```

The Firefox output uses a Manifest V3 background script and keeps Gecko-specific publishing metadata:

```json
{
  "background": {
    "scripts": ["dist/background.js"],
    "type": "module"
  },
  "browser_specific_settings": {
    "gecko": {
      "id": "sheixunixitang3@gmail.com",
      "strict_min_version": "109.0"
    }
  }
}
```

Firefox also keeps the extension page content security policy required by the current runtime. Chrome does not receive Firefox-only fields.

## Build Output

The extension build continues to support these target commands:

```bash
pnpm --filter @immersive-subs/extension build:chrome
pnpm --filter @immersive-subs/extension build:firefox
pnpm --filter @immersive-subs/extension build
```

The build script bundles the same three runtime entrypoints for both targets:

- `src/background.ts`
- `src/content/index.ts`
- `src/popup.ts`

The build script writes static assets and the generated target manifest into each output directory. `package.json` remains the version source. Generated manifests include the package version at build time.

The source tree should not contain parallel hand-maintained `manifest.json` and `manifest.firefox.json` files after this change. There should be one manifest source module and generated manifests only in ignored build output.

## Data Flow

Manifest generation is local and deterministic:

1. The build target is selected by the existing build command.
2. The build script reads the extension package version.
3. The manifest builder creates the target manifest object.
4. The build script writes the object to `<target outDir>/manifest.json`.

There is no runtime data migration and no user state migration.

## Error Handling

The manifest builder rejects unknown target names. The build fails if `package.json` does not contain a non-empty version.

Manifest generation should fail loudly for impossible build inputs. It should not silently fall back to Chrome, Firefox, or an old source manifest.

## Tests

The extension test suite should cover the final manifest contract instead of reading two hand-written manifest files.

Required assertions:

- Chrome generated manifest contains `background.service_worker`.
- Firefox generated manifest contains `background.scripts`.
- Firefox generated manifest contains `browser_specific_settings.gecko.id`.
- Shared localized metadata keys remain `__MSG_extensionName__` and `__MSG_extensionDescription__`.
- Common permissions, host permissions, content scripts, action popup, and extension name are identical between targets.
- Generated manifests include the package version supplied to the builder.

Verification commands:

```bash
pnpm --filter @immersive-subs/extension test:app
pnpm --filter @immersive-subs/extension build:app
git diff --check
```

## Documentation

`README.md` and `DEPLOYMENT.md` should continue to document separate Chrome and Firefox output directories. If they mention source manifests directly, update that wording to say browser manifests are generated from a shared manifest source.

The docs should describe the final behavior only. They should not include old-vs-new migration notes or implementation diary details.
