# Deployment and Distribution Guide

This repository is a pnpm workspace. Run packaging commands from the repository root unless a command explicitly says otherwise.

## Prerequisites

- Node.js 24+
- pnpm 11
- Dependencies installed once with `pnpm install`
- Playwright Chromium installed for renderer browser tests:

```bash
pnpm --filter @immersive-subs/desktop-app exec playwright install chromium
```

## Product Release

Desktop and extension releases use one product version. Before creating a tag, run:

```bash
pnpm release:prepare 1.2.0
pnpm release:check
pnpm typecheck
pnpm test
```

Configure these GitHub Actions secrets before publishing macOS desktop releases:

- `CSC_LINK`
- `CSC_KEY_PASSWORD`
- `APPLE_API_KEY`
- `APPLE_API_KEY_ID`
- `APPLE_API_ISSUER`

Create and push a release tag:

```bash
git tag v1.2.0
git push origin v1.2.0
```

The release workflow builds desktop packages with electron-builder, uploads updater metadata such as `latest.yml`, `latest-mac.yml`, and `latest-linux.yml`, uploads platform release assets, builds Chrome and Firefox extension ZIP files, creates a checksum file, and creates or updates the published GitHub Release for the tag. The macOS release job fails before packaging if signing or notarization secrets are missing. Updater metadata must reference uploaded release asset filenames, not arbitrary absolute URLs.

The desktop app uses electron-updater in the main process. It checks the GitHub Release updater feed, downloads updates only after the user clicks "Download update", reports progress to Settings, and installs only after the user clicks "Install and restart".

Chrome Web Store and Firefox AMO submission remain manual. Extension store updates are handled by the browser stores, not by the desktop updater.

## Browser Extension

Build browser-specific extension artifacts:

```bash
pnpm --filter @immersive-subs/extension build:chrome
pnpm --filter @immersive-subs/extension build:firefox
```

Outputs:

- Chrome / Edge / Chromium: `apps/extension/dist/chrome`
- Firefox temporary add-on: `apps/extension/dist/firefox`

For store submission ZIP files, run both extension builds and then:

```bash
pnpm release:zip-extension
```

Outputs:

- `release-artifacts/extension/immersive-subs-prompter-chrome-vX.Y.Z.zip`
- `release-artifacts/extension/immersive-subs-prompter-firefox-vX.Y.Z.zip`

Before submission, verify the generated target manifest, `_locales`, icons, permissions, and store listing text match the current feature set. Browser-specific manifests are generated from the shared manifest builder during extension builds.

## Desktop Application

Development build:

```bash
pnpm --filter @immersive-subs/desktop-app build
```

Run the app from source:

```bash
pnpm --filter @immersive-subs/desktop-app start
```

Create desktop packages:

```bash
pnpm --filter @immersive-subs/desktop-app package
pnpm --filter @immersive-subs/desktop-app dist:mac
pnpm --filter @immersive-subs/desktop-app dist:win
pnpm --filter @immersive-subs/desktop-app dist:linux
```

Build each target on its matching host platform. Electron-builder configuration lives at `apps/desktop-app/electron-builder.yml`. Desktop artifact filenames use the `Immersive-Subs-Prompter` slug; updater metadata must reference files present in the release upload set. Local updater feed testing can use `apps/desktop-app/dev-app-update.yml`.

## Network Endpoints

The desktop app listens on endpoints configured in Settings -> Network. The default is `127.0.0.1:44501`. Add LAN endpoints explicitly when another browser profile or device must connect over the network.

The extension popup stores one or more `ws://host:port` desktop app URLs. Non-loopback desktop endpoints use tokenized URLs shown by the desktop settings UI.

## yt-dlp

The desktop app downloads and updates the platform-specific `yt-dlp` binary in the user data directory when needed. If the download fails, the user must place the executable in the `yt-dlp` subdirectory of the user data directory.

## Built-In Features

Word Lookup, Speech Transcription, and Jellyfin / Emby ship inside the desktop app as first-party features. They do not produce separate package artifacts, repository manifests, install URLs, update channels, or runtime install flows.

## Pre-Release Checklist

- Run `pnpm typecheck`.
- Run `pnpm test`.
- Build extension artifacts and load them in Chrome/Edge and Firefox.
- Package the desktop app on each target platform.
- Verify extension endpoint setup, subtitle download, track switching, A-B loop, and browser control commands.
- Verify built-in Features settings for Word Lookup, Speech Transcription, and Jellyfin / Emby.
- Confirm privacy policy and store listing describe LAN endpoints and optional configured transcription API usage accurately.
