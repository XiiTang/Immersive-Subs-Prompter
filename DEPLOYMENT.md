# Deployment and Distribution Guide

This repository is a pnpm workspace. Run packaging commands from the repository root unless a command explicitly says otherwise.

## Prerequisites

- Node.js 24+
- pnpm 10
- Dependencies installed once with `pnpm install`
- Playwright Chromium installed for renderer browser tests:

```bash
pnpm --filter @immersive-subs/desktop-app exec playwright install chromium
```

## Browser Extension

Build browser-specific extension artifacts:

```bash
pnpm --filter @immersive-subs/extension build:chrome
pnpm --filter @immersive-subs/extension build:firefox
```

Outputs:

- Chrome / Edge / Chromium: `apps/extension/dist/chrome`
- Firefox temporary add-on: `apps/extension/dist/firefox`

For Chrome Web Store or Edge Add-ons, zip the Chrome output directory after a successful build:

```bash
cd apps/extension/dist/chrome
zip -r ../immersive-subs-prompter-chrome.zip .
```

Before submission, verify `apps/extension/manifest.json`, `_locales`, icons, permissions, and store listing text match the current feature set.

## Desktop Application

Development build:

```bash
pnpm --filter @immersive-subs/desktop-app build
```

Run the app from source:

```bash
pnpm --filter @immersive-subs/desktop-app start
```

Create Electron Forge packages:

```bash
pnpm --filter @immersive-subs/desktop-app package
pnpm --filter @immersive-subs/desktop-app dist:mac
pnpm --filter @immersive-subs/desktop-app dist:win
pnpm --filter @immersive-subs/desktop-app dist:linux
```

Build each target on its matching host platform. Forge configuration lives at `apps/desktop-app/forge.config.mjs`; app resources live in `apps/desktop-app/resources`.

## Network Endpoints

The desktop app listens on endpoints configured in Settings -> Network. The default is `127.0.0.1:44501`. Add LAN endpoints explicitly when another browser profile or device must connect over the network.

The extension popup stores one or more `ws://host:port` desktop app URLs. Non-loopback desktop endpoints use tokenized URLs shown by the desktop settings UI.

## yt-dlp

The desktop app downloads and updates the platform-specific `yt-dlp` binary in the user data directory when needed. If the download fails, the user must place the executable in the `yt-dlp` subdirectory of the user data directory.

## Pre-Release Checklist

- Run `pnpm typecheck`.
- Run `pnpm test`.
- Build extension artifacts and load them in Chrome/Edge and Firefox.
- Package the desktop app on each target platform.
- Verify extension endpoint setup, subtitle download, track switching, A-B loop, and browser control commands.
- Confirm privacy policy and store listing describe LAN endpoints and optional configured transcription API usage accurately.
