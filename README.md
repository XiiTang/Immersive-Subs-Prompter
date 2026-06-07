
# Immersive Subs Prompter

<p align="center">
  <img src="assets/logo.png" alt="Logo" width="128" height="128">
</p>


**A cross-platform subtitle enhancement tool for language learners and immersive viewing.** 🌐🎧

This project combines a browser extension with an Electron desktop app. It extracts subtitles from streaming services such as YouTube, Bilibili, and Douyin, and can extend desktop capabilities through runtime-installed plugins such as word lookup, speech transcription, and Jellyfin / Emby media-library integration. Subtitles are displayed on your desktop in a standalone, scrollable "teleprompter" panel. 🖥️📜

It unlocks the full potential of video subtitles and delivers an exceptional experience for both watching and learning. ✨

## Core Use Cases 🚀

This tool is more than a simple "subtitle viewer" — it transforms how you interact with video content:

- **Language learning (ideal for focused listening) 🎓:**
  - **Bilingual subtitles:** Automatically fetches all available subtitle tracks (including auto-generated ones) and displays two languages side-by-side in the desktop panel (for example, primary English with secondary Chinese) for immersive bilingual comparison.
  - **A–B repeat (single-sentence loop) 🔁:** Spot a tricky sentence? Click the "loop" button beside a subtitle line and the corresponding segment will replay continuously — perfect for listening drills and shadowing.
  - **Precise seeking 🎯:** Click the play button above a subtitle line to jump the video to that exact timestamp for quick review.

- **Plugin-based media-library enhancements 🏠:**
  - **Unified experience:** Install the Jellyfin / Emby plugin to bring the same bilingual subtitles, teleprompter panel, and A–B repeat features to your personal media library.

- **Transcription & note-taking 📝:**
  - **Scrollable transcript:** Present the entire video's subtitles as a searchable, scrollable transcript for fast browsing, locating, and copying.
  - **No window switching:** Keep subtitle content resident in your workflow without flipping between the player and a notes app.

- **Immersive viewing 🎬:**
  - **Clean player:** Remove subtitles from the video surface for an unobstructed picture.
  - **Multitasking:** Minimize the video while keeping the desktop subtitle panel visible so you can listen and glance while working or browsing.

- **Highly customizable ⚙️:**
  - **Profiles:** Configure fonts, sizes, scroll positions, and even `yt-dlp` download options for different sites or learning scenarios.
  - **URL rules:** Automatically activate specific profiles based on the current URL using domain, glob, exact, contains, or `re:` regex patterns. See [URL rule examples](docs/url-rule-patterns.md).

## How it works ⚙️

The extension (`apps/extension/`) runs in the page and continuously collects playback information (URL, play state, timestamp), pushing updates via WebSocket to the local desktop app (`apps/desktop-app/`). The desktop application is the control center and is responsible for:

1. (For web pages) invoking `yt-dlp` to obtain all subtitle tracks for a given URL.
2. (For plugin media sources such as Jellyfin / Emby) receiving adapter events for session matching, subtitle tracks, and playback snapshots.
3. Pairing selected subtitle tracks by cue timing and displaying them in a cue-anchored bilingual reader in the desktop panel.
4. Enabling bidirectional control so clicking to seek, looping a segment, or sending play/pause commands from the subtitle panel can control the browser video.

---

## Directory Structure

```text
apps/desktop-app   # Electron + Vue 3.5 + TypeScript desktop application
apps/extension     # Chromium/Firefox MV3 extension built with TypeScript + esbuild
packages/contracts # Shared desktop-extension transport contracts
```

## Quick Start

### Prerequisites

- Node.js 24+ and pnpm 10
- Install dependencies once from the repository root with `pnpm install`
- Playwright 1.59.1 Chromium for desktop renderer tests: `cd apps/desktop-app && pnpm exec playwright install chromium`
- Supported browsers:
  - **Chrome / Edge / Chromium-based browser**: Version 110+
  - **Firefox**: Version 109+ (Manifest V3 support required)
- The desktop app will automatically download the corresponding platform's `yt-dlp` into the user data directory on first use, and update it on subsequent launches by comparing with the latest Release.

### Start Desktop App

```bash
pnpm install
pnpm --filter @immersive-subs/desktop-app start
```

The desktop app now targets Electron 41 / Chromium 146.

- Linux Wayland keeps the subtitle window fully frameless while benefiting from newer windowing and shortcut fixes.
- Windows Quick Show preserves snapped layouts instead of forcing the panel into a conflicting top-most state.
- Desktop release packaging now runs through Electron Forge with ASAR integrity validation enabled.

By default the app listens on `ws://127.0.0.1:44501/`. Under **Settings → Network**, add explicit listening endpoints such as `127.0.0.1:44501` and `192.168.1.2:44501` when another extension client must connect over your LAN. Non-loopback endpoints are displayed as tokenized URLs such as `ws://192.168.1.2:44501/?token=...`; enter one reachable URL per desktop app instance in the extension popup.

### Test Stack

- `desktop-app` renderer tests run on **Vitest Browser Mode** with **Playwright 1.59.1 Chromium** for component interaction and layout coverage.
- `desktop-app` jsdom tests remain for lightweight renderer unit tests and upgrade/config assertions on **jsdom 29.1.1**.
- `extension` runs on **TypeScript + esbuild**, with **Vitest 4 + jsdom 29.1.1** for tests and `tsc --noEmit` for type checks.

### Load Browser Extension

First, build the extension for your target browser:

```bash
pnpm install
pnpm --filter @immersive-subs/extension typecheck
pnpm --filter @immersive-subs/extension build:chrome
pnpm --filter @immersive-subs/extension build:firefox
pnpm --filter @immersive-subs/extension build
```

**Chrome / Edge / Chromium:**

1. Open `chrome://extensions`
2. Enable "Developer mode"
3. Select "Load unpacked", pointing to the `apps/extension/dist/chrome` directory

**Firefox:**

1. Open `about:debugging#/runtime/this-firefox`
2. Click "Load Temporary Add-on..."
3. Navigate to `apps/extension/dist/firefox` and select `manifest.json`

> **Note**: Firefox temporary add-ons are removed when the browser closes. For persistent installation, the extension needs to be signed through [Firefox Add-ons](https://addons.mozilla.org/).

Then playing any video on Bilibili / YouTube / Douyin will allow you to see the desktop app window download subtitles and sync highlighting.
Use the popup's "Desktop Apps" card to add multiple `ws://` endpoints; playback updates will broadcast to every connected desktop app.

## Feature Overview

- **Real-time Playback Info**: content script monitors video timeline / playback rate / URL, pushing every 300ms to desktop app.
- **Subtitle Aggregation**: Electron side downloads all available subtitle tracks (including auto-generated) via `yt-dlp`, pairs selected tracks by cue timing, and keeps cue actions attached to reading blocks.
- **Track Switching**: UI provides dropdown to select different languages/tracks, and the play button above each subtitle line jumps to the corresponding timestamp.
- **Bidirectional Control**: Desktop app can initiate play / pause / seek commands, extension receives and directly controls video elements.

### Plugins

Desktop capabilities such as word lookup, speech transcription, and Jellyfin / Emby integration are installed as plugins from HTTPS plugin install links. The project-maintained plugins live in `plugins/*`; installable packages and remote manifests are generated into committed `plugin-repository/*` artifacts and served through GitHub raw URLs on the `main` branch. Open Settings -> Plugins, use a recommended entry or paste an install link, review the plugin author, version, package hash, and permissions, then install it. Installed plugins can be enabled, disabled, updated, or deleted. Recommended plugin entries are shortcuts to install links and use the same install, update, permission, and delete flow as any other plugin.

### Desktop Subtitle Reader

The desktop subtitle panel is rendered as a cue-anchored reader rather than a chrome-heavy cue list. Layout is computed in the renderer with `@chenglou/pretext` 0.0.7 using a two-phase pipeline: transcript blocks are measured up front, then visible blocks materialize line text on demand for the virtualized viewport. Subtitle text is prepared with `white-space: pre-wrap` and `word-break: keep-all` so explicit cue breaks are preserved while CJK / Hangul wrapping stays closer to browser behavior. Cue actions are exposed as lightweight anchors on active or hovered reading blocks. The app does not attempt semantic alignment across downloaded subtitle tracks; primary and secondary subtitles are paired by cue timing only, so cue boundaries remain the source of truth.

## Development Scripts

| Location | Command | Description |
| ---- | ---- | ---- |
| `root` | `pnpm build` | Build all workspace packages |
| `root` | `pnpm test` | Run all workspace test suites |
| `root` | `pnpm typecheck` | Run all workspace type checks |
| `root` | `pnpm --filter @immersive-subs/desktop-app start` | Build + start Electron |
| `root` | `pnpm --filter @immersive-subs/desktop-app test:desktop` | Run the desktop app test suite |
| `root` | `pnpm --filter @immersive-subs/desktop-app test:renderer:browser` | Run browser-mode renderer tests |
| `root` | `pnpm --filter @immersive-subs/desktop-app test:renderer:jsdom` | Run jsdom-only desktop renderer tests |
| `root` | `pnpm --filter @immersive-subs/extension typecheck` | Run the extension TypeScript compile check |
| `root` | `pnpm --filter @immersive-subs/extension build` | Type-check and build the extension |
| `root` | `pnpm --filter @immersive-subs/extension test` | Run the extension test suite |
| `root` | `pnpm build:plugins` | Generate committed plugin artifacts under `plugin-repository/*` |
| `root` | `pnpm --filter @immersive-subs/desktop-app dist:win/mac/linux` | Build Electron Forge distributables; run on the matching host platform |

## Deployment and Distribution

For detailed procedures (including extension packaging, Electron Forge distributables, and yt-dlp distribution strategy), refer to [DEPLOYMENT.md](DEPLOYMENT.md).

## Engineering Conventions

### Error handling

Empty catch blocks are banned. `pnpm test` (and the `lint:silent-catches` script) fails the build if any code swallows an error without declaring intent. Use one of these three patterns:

- **Propagate**: let the error bubble — prefer this for anything a caller could recover from.
- **`reportError(err, "scope.operation", { level, extra })`**: log via the shared scoped logger. Use for failures the operator should see but that don't warrant killing the caller.
- **`swallow(err, "scope.operation", "human-readable reason")`**: declare the failure safe to ignore. The reason string appears in debug logs so reviewers can audit every silent failure.

Imports:
- Main process: `import { reportError, swallow } from "./errors.js"` (or the correct relative path)
- Renderer: `import { reportError } from "../utils/errorBus"`
- Extension: `import { swallow } from "../shared/reportError"`

If you genuinely need an empty catch, add a comment ending in `usp-allow-empty-catch` on the line immediately above that specific `catch` block. The check does not allow file-level exemptions.

### Internationalization

Locale dictionaries live in [apps/desktop-app/src/renderer/locales](apps/desktop-app/src/renderer/locales/). Each file is a flat `{ key: "translation" }` map and is imported synchronously by the renderer. To add a new key, edit both `en.json` and `zh.json`; callers use `t("key")` or `t("key", { value })`. Missing keys render as `missing:<key>` during pre-release development.

## Troubleshooting

- **Desktop app shows `yt-dlp not found`**: First use could not download due to no internet, or GitHub is blocked. Place the executable in the `yt-dlp` subdirectory of the user data directory.
- **Extension shows disconnected**: Ensure Electron is running and the WebSocket listening port is not occupied. Check the extension popup's `Desktop Apps` endpoint list first; the default endpoint is configured in `apps/extension/src/background.ts` and persisted through the background endpoint manager.
- **Missing subtitles**: Some videos don't provide subtitles or `yt-dlp` cannot fetch them. Check the desktop app console/terminal logs for `yt-dlp` output.
- **Windows PowerShell log garbled text**:
  - **Cause**: Windows PowerShell defaults to GBK encoding, while the app logs use UTF-8 encoding, causing Chinese characters to display as garbled text.
  - **Temporary solution**: Before running the app, execute the following commands in PowerShell:
    ```powershell
    [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
    [Console]::InputEncoding = [System.Text.Encoding]::UTF8
    $OutputEncoding = [System.Text.Encoding]::UTF8
    ```
  - **Permanent solution**: Edit your PowerShell profile to add the above commands for automatic effect:
    1. Run `notepad $PROFILE` to open the profile (auto-created if not exists)
    2. Add the above three lines
    3. Save and reopen PowerShell
  - **Recommended**: Use Windows Terminal or VS Code built-in terminal, they support UTF-8 encoding by default.

## Tips

### Subtitle Fonts

**Settings → Profiles → Subtitle Font** now uses a curated built-in font list. Pick one of the provided options in the dropdown; free-form font-family input is no longer part of the desktop app.

## License

This example is for internal integration reference only. Before distributing, confirm the license requirements of third-party dependencies (especially `yt-dlp`).
