# Deployment and Distribution Guide

This document covers three parts: browser extension packaging, Electron desktop app installation package creation, and cross-platform distribution strategy for `yt-dlp`.

## 1. Browser Extension

### 1.1 Build / Package

The extension is based on Manifest V3 with no additional packaging steps, you can directly compress the source:

```bash
cd extension
zip -r ../immersive-subs-prompter.zip .
```

The generated `immersive-subs-prompter.zip` can be used for Chrome Web Store / Edge Add-ons submission. Before submission, please ensure:

- Information like `name`, `description`, `version`, `icons` in `manifest.json` meets publication requirements;
- Required domains are listed in `host_permissions`;
- If internationalization is needed, add `_locales` directory (required by MV3).

### 1.2 Internal Distribution

If only used within the company, you can directly share the `extension/` directory and let users manually "Load unpacked" in `chrome://extensions`. You can also configure CRX auto-distribution in the enterprise management platform.

## 2. Electron Desktop Application

Requires Node.js `20.19+` or `22.12+` because the desktop renderer now builds with Vite 8.

### 2.1 Pure Build (Development / Beta Testing)

```bash
cd desktop-app
npm install
npm run build   # Output to dist/
electron .
```

The `dist/` directory contains compiled main process, preload script, and renderer process static assets, ready to run directly with source code.

### 2.2 Official Installation Package (Recommended: electron-builder)

The project already includes `electron-builder` configuration and scripts, just run directly:

```bash
cd desktop-app
npm install
npm run dist:win    # or dist:mac / dist:linux / dist:all
```

The build process will first execute `npm run build`, then pack contents from `dist/` into the installation package (output to `desktop-app/release/`). To customize icons, signing, Bundle Identifier, modify the `build` field in `package.json`.

- Windows uses NSIS installer by default with `oneClick: false` and `allowToChangeInstallationDirectory: true` enabled, allowing users to freely choose the installation directory and decide whether to create desktop/start menu shortcuts.

> If you prefer `electron-packager`, you can substitute it. The core steps remain the same: first `npm run build`, then pack `dist/` and `node_modules` into the platform-specific directory.

### 2.3 Code Signing (Optional)

- macOS: Requires Apple Developer ID to `codesign` and `notarize` the `.app`.
- Windows: Recommended to sign `.exe` / `.msi` with EV/OV certificates to avoid SmartScreen warnings.
- Linux: Usually no signing required, you can provide SHA256 checksums.

## 3. `yt-dlp` Bundle Strategy

The desktop app now comes with automatic download and auto-update mechanism: when the subtitle service runs, it checks for the `yt-dlp/<platform>` executable in the user data directory, and fetches the latest version number via GitHub Release API. If missing locally or outdated, it automatically downloads the latest binary and updates the cache. If update fails, an error is shown in the UI while keeping the old version as fallback.

For offline installation or intranet environments, you can pre-place official binaries in `desktop-app/resources/yt-dlp/`, electron-builder will copy them into the app's `resources/yt-dlp` directory during packaging, runtime will also prioritize checking files in that directory (priority: user data cache > resources/yt-dlp > system PATH).

## 4. Pre-Release Checklist

| Item | Check |
| --- | --- |
| Communication Port | Are `WS_ENDPOINT` / `USP_WS_PORT` between extension and desktop consistent, not exposed on untrusted networks |
| Platform Testing | Run through Windows / macOS / Linux once, verify subtitle download, track switching, control commands work correctly |
| Permissions | Are extension `host_permissions` and background scripts minimized, add privacy notice if necessary |
| Subtitle Cache | Is the temporary subtitle directory on Electron side deleted after download, avoid remnants |
| `yt-dlp` Version | If bundled for distribution, confirm version and license (Unlicense/MIT) information; show on About page if necessary |

After completing the above steps, you can release to users: ① Plugin ZIP, ② Installation packages for each platform, ③ Corresponding release notes together.***
