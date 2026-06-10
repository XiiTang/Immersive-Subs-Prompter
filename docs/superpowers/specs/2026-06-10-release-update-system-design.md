# Release And Update System Design

## Goal

Build the first complete release system for Immersive Subs Prompter.

The release system covers the desktop app and browser extension as one product version. A release produces desktop installers, Chrome and Firefox extension ZIP files, a GitHub Release, and a machine-readable release manifest used by the desktop app to check for updates.

This project has not launched yet. The design intentionally does not preserve old release metadata, old asset names, old update readers, old version schemes, or migration paths for unpublished builds.

## Reference Project

The local reference project is:

```text
/Users/cq-laptop/Projects/referrence projects/cherry-studio
```

Cherry Studio uses `electron-builder`, `electron-updater`, GitHub Release assets, generated updater metadata such as `latest*.yml`, and a separate remote `app-upgrade-config.json` that selects the correct updater feed before calling `autoUpdater.checkForUpdates()`.

This project uses a lighter final shape:

- GitHub Releases host downloadable desktop and extension artifacts.
- `releases/latest.json` is the single update manifest read by the desktop app.
- The desktop app opens the release page or platform download link instead of auto-downloading or installing updates.
- Browser extension updates remain owned by Chrome Web Store and Firefox AMO after store submission.

The Cherry Studio reference is useful for the separation of release assets, update metadata, app-side update state, and release automation. Its multi-mirror, channel, staged-upgrade, and auto-install complexity is out of scope for this first release system.

## Product Version Model

The repository has one product version per release.

These package versions must match for every release:

```text
package.json
apps/desktop-app/package.json
apps/extension/package.json
```

Release tags use:

```text
vX.Y.Z
```

The extension does not have an independent public version in this design. Chrome and Firefox extension manifests are generated from `apps/extension/package.json`, so the generated extension version matches the product version.

## Final Release Artifacts

Each release publishes these artifact groups to a GitHub Release:

- desktop macOS artifacts from Electron Forge
- desktop Windows artifacts from Electron Forge
- desktop Linux artifacts from Electron Forge
- `immersive-subs-prompter-chrome-vX.Y.Z.zip`
- `immersive-subs-prompter-firefox-vX.Y.Z.zip`
- checksum file containing SHA-256 for every uploaded artifact
- release notes in the GitHub Release body

The desktop artifact names must include the product name, version, platform, architecture, and extension. CI treats unknown or duplicate artifact names as release errors.

The extension ZIP files are upload-ready packages for store submission and manual review. They are not the live update channel for installed browser extensions.

## Release Manifest

The update manifest lives in:

```text
releases/latest.json
```

The desktop app reads the manifest from:

```text
https://raw.githubusercontent.com/XiiTang/Immersive-Subs-Prompter/main/releases/latest.json
```

The manifest is the only machine-readable update contract for the desktop app. The app does not parse GitHub Release API responses, scrape release pages, or infer downloads from asset names.

First-version schema:

```json
{
  "schemaVersion": 1,
  "version": "1.2.0",
  "releasedAt": "2026-06-10T12:00:00Z",
  "releaseUrl": "https://github.com/XiiTang/Immersive-Subs-Prompter/releases/tag/v1.2.0",
  "minimumSupportedVersion": "1.0.0",
  "notes": {
    "en": "Desktop and extension release notes.",
    "zh": "桌面端和扩展端发布说明。"
  },
  "desktop": {
    "darwin-arm64": {
      "fileName": "Immersive-Subs-Prompter-1.2.0-darwin-arm64.dmg",
      "url": "https://github.com/XiiTang/Immersive-Subs-Prompter/releases/download/v1.2.0/Immersive-Subs-Prompter-1.2.0-darwin-arm64.dmg",
      "sha256": "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      "signed": false
    },
    "win32-x64": {
      "fileName": "Immersive-Subs-Prompter-1.2.0-win32-x64.exe",
      "url": "https://github.com/XiiTang/Immersive-Subs-Prompter/releases/download/v1.2.0/Immersive-Subs-Prompter-1.2.0-win32-x64.exe",
      "sha256": "1123456789abcdef1123456789abcdef1123456789abcdef1123456789abcdef",
      "signed": false
    },
    "linux-x64": {
      "fileName": "Immersive-Subs-Prompter-1.2.0-linux-x64.AppImage",
      "url": "https://github.com/XiiTang/Immersive-Subs-Prompter/releases/download/v1.2.0/Immersive-Subs-Prompter-1.2.0-linux-x64.AppImage",
      "sha256": "2123456789abcdef2123456789abcdef2123456789abcdef2123456789abcdef",
      "signed": false
    }
  },
  "extension": {
    "chrome": {
      "version": "1.2.0",
      "artifactUrl": "https://github.com/XiiTang/Immersive-Subs-Prompter/releases/download/v1.2.0/immersive-subs-prompter-chrome-v1.2.0.zip",
      "sha256": "3123456789abcdef3123456789abcdef3123456789abcdef3123456789abcdef",
      "storeStatus": "manual-review"
    },
    "firefox": {
      "version": "1.2.0",
      "artifactUrl": "https://github.com/XiiTang/Immersive-Subs-Prompter/releases/download/v1.2.0/immersive-subs-prompter-firefox-v1.2.0.zip",
      "sha256": "4123456789abcdef4123456789abcdef4123456789abcdef4123456789abcdef",
      "storeStatus": "manual-review"
    }
  }
}
```

The checksum values above are schema examples. Generated manifests must use the real SHA-256 of each release asset.

Allowed `extension.*.storeStatus` values:

- `not-submitted`
- `manual-review`
- `published`
- `rejected`

The manifest is replaced in full for each release. No old manifest schema reader is required.

## Desktop Update Check

The desktop app has a main-process release service with these responsibilities:

- read the current app version from Electron
- fetch `releases/latest.json`
- validate `schemaVersion: 1`
- validate required URLs, versions, notes, platform entries, and checksums
- validate desktop signing metadata
- compare the remote version with the current version using semantic version rules
- select the current platform key from `process.platform` and `process.arch`
- expose update state to renderer through IPC
- open `releaseUrl` or the selected platform artifact URL in the system browser

The renderer exposes update controls in Settings, in the global or about area:

- current version
- automatic update check switch, enabled by default
- manual "Check for updates" action
- latest available version
- localized notes
- release date
- "Open download page" primary action
- optional platform artifact name and SHA-256

Automatic checking runs after app startup and is rate-limited to once per 24 hours. Manual checking ignores the rate limit. Network failure, invalid JSON, unknown schema version, and missing platform artifacts are shown as non-fatal update errors in Settings.

When the manifest version is newer but the current platform artifact is missing, the app still offers the GitHub Release page. It does not invent a download URL.

The first release system does not include automatic desktop download, differential update, background install, quit-and-install, Squirrel auto-update, Electron Builder updater metadata, or mandatory update enforcement.

## Extension Release

The extension release output is store-submission ready:

- Chrome output is built from the existing Chrome target and zipped.
- Firefox output is built from the existing Firefox target and zipped.
- Both generated `manifest.json` files use the unified product version.
- Both ZIP files are uploaded to the GitHub Release.
- The release manifest records each store status.

Chrome Web Store and Firefox AMO submission remain manual in this design. Store API credentials, automated submission, and review-result polling are out of scope.

## GitHub Actions Release Shape

The repository has a release workflow that can run from a `vX.Y.Z` tag or manual dispatch.

The workflow final state is:

- validate the tag and unified package versions
- install dependencies with pnpm
- run repository type checks
- run repository tests
- regenerate plugin repository artifacts with the existing plugin packaging command and fail if generated artifacts are stale
- build desktop artifacts on macOS, Windows, and Linux runners
- build Chrome and Firefox extension ZIP files
- calculate SHA-256 checksums
- create or update a draft GitHub Release for the tag
- upload all artifacts and checksums
- generate `releases/latest.json`
- open a pull request to update `releases/latest.json` on `main`

The workflow does not publish a broken update manifest directly to `main`. The manifest becomes active only after the pull request is reviewed and merged.

Signing and notarization are optional capabilities controlled by CI secrets. When signing secrets are absent, CI may produce unsigned artifacts, but the GitHub Release body and manifest metadata must not present unsigned artifacts as signed.

## Local Release Scripts

The release system includes focused scripts:

- `release:prepare <version>` updates the three package versions and validates the requested semantic version.
- `release:check` validates version consistency, manifest schema, artifact naming, and checksum shape.
- `release:manifest <tag>` generates `releases/latest.json` from release assets and checksum data.

Scripts fail on stale generated plugin artifacts, mismatched package versions, invalid SemVer, missing required release URLs, duplicate platform keys, missing checksums, and invalid extension store status.

Scripts do not preserve older draft formats or update legacy release metadata.

## Plugin Boundary

Plugin distribution remains separate.

Project-maintained plugins continue to use:

```text
plugin-repository/
```

and HTTPS plugin manifests generated by `pnpm build:plugins`.

GitHub Releases are not the plugin package update channel. The desktop app release manifest does not list plugin packages, plugin versions, plugin install URLs, or plugin update status.

## Error Handling

Update check errors are explicit and non-fatal:

- `network-error`
- `invalid-manifest`
- `unsupported-schema`
- `not-newer`
- `platform-artifact-missing`
- `open-url-failed`

The release service reports enough detail for Settings and logs, but does not silently downgrade to GitHub API parsing, old manifest formats, or inferred asset URLs.

## Testing

Required coverage:

- release manifest schema validation
- version comparison
- platform key selection
- update state transitions for checking, unavailable, available, and error
- automatic check rate limiting
- manual check bypassing rate limit
- renderer display for no update, update available, invalid manifest, and network error
- release script checks for version consistency
- release script checks for duplicate or missing platform artifacts
- extension ZIP naming and generated manifest version
- checksum generation and manifest checksum wiring

Release acceptance requires:

- GitHub Release contains desktop artifacts for the intended platforms.
- GitHub Release contains Chrome and Firefox extension ZIP files.
- Published checksums match uploaded artifacts.
- `releases/latest.json` points to the same release tag.
- A packaged desktop app can read the manifest and report the latest version.
- Chrome and Firefox ZIP files can be loaded locally before store submission.

## Non-Goals

The first release system does not include:

- app auto-download
- app auto-install
- differential updates
- beta, rc, canary, or staged rollout channels
- mirror selection
- China-specific update hosts
- minimum-version forced upgrades
- store API submission automation
- store review webhooks
- plugin release management
- compatibility with unpublished historical release metadata
- migration from old update settings
- old asset-name aliases
- legacy manifest schema readers
