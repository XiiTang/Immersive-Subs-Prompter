
# Immersive Subs Prompter

<p align="center">
  <img src="assets/logo.png" alt="Logo" width="128" height="128">
</p>


**A cross-platform subtitle enhancement tool for language learners and immersive viewing.** 🌐🎧

This project combines a browser extension with an Electron desktop app. It extracts subtitles from streaming services — YouTube, Bilibili, Douyin, and even Jellyfinemby — and displays them on your desktop in a standalone, scrollable "teleprompter" panel. 🖥️📜

It unlocks the full potential of video subtitles and delivers an exceptional experience for both watching and learning. ✨

## Core Use Cases 🚀

This tool is more than a simple "subtitle viewer" — it transforms how you interact with video content:

- **Language learning (ideal for focused listening) 🎓:**
  - **Bilingual subtitles:** Automatically fetches all available subtitle tracks (including auto-generated ones) and displays two languages side-by-side in the desktop panel (for example, primary English with secondary Chinese) for immersive bilingual comparison.
  - **A–B repeat (single-sentence loop) 🔁:** Spot a tricky sentence? Click the "loop" button beside a subtitle line and the corresponding segment will replay continuously — perfect for listening drills and shadowing.
  - **Precise seeking 🎯:** Click any line in the subtitle panel to jump the video to that exact timestamp for quick review.

- **Jellyfinemby media-library enhancements 🏠:**
  - **Unified experience:** Not limited to web players — deep Jellyfinemby integration brings the same bilingual subtitles, teleprompter panel, and A–B repeat features to your personal media library.

- **Transcription & note-taking 📝:**
  - **Scrollable transcript:** Present the entire video's subtitles as a searchable, scrollable transcript for fast browsing, locating, and copying.
  - **No window switching:** Keep subtitle content resident in your workflow without flipping between the player and a notes app.

- **Immersive viewing 🎬:**
  - **Clean player:** Remove subtitles from the video surface for an unobstructed picture.
  - **Multitasking:** Minimize the video while keeping the desktop subtitle panel visible so you can listen and glance while working or browsing.

- **Highly customizable ⚙️:**
  - **Profiles:** Configure fonts, sizes, scroll positions, and even `yt-dlp` download options for different sites or learning scenarios.
  - **URL rules:** Automatically activate specific profiles based on the current URL.

## How it works ⚙️

The extension (`extension/`) runs in the page and continuously collects playback information (URL, play state, timestamp), pushing updates via WebSocket to the local desktop app (`desktop-app/`). The desktop application is the control center and is responsible for:

1. (For web pages) invoking `yt-dlp` to obtain all subtitle tracks for a given URL.
2. (For Jellyfinemby) synchronizing session and subtitle information in real time via a WebSocket API.
3. Pairing selected subtitle tracks by cue timing and displaying them in a cue-anchored bilingual reader in the desktop panel.
4. Enabling bidirectional control so clicking to seek, looping a segment, or sending play/pause commands from the subtitle panel can control the browser video.

---

## Directory Structure

```
extension/     # Chromium/Firefox MV3 extension built with TypeScript + esbuild
desktop-app/   # Electron + Vue 3.5 + TypeScript desktop application
```

## Quick Start

### Prerequisites

- Node.js 24+ and npm
- Direct dependencies in both apps are pinned to exact versions; prefer `npm ci` over `npm install`
- Playwright 1.59.1 Chromium for desktop renderer tests: `cd desktop-app && npx playwright install chromium`
- Supported browsers:
  - **Chrome / Edge / Chromium-based browser**: Version 110+
  - **Firefox**: Version 109+ (Manifest V3 support required)
- The desktop app will automatically download the corresponding platform's `yt-dlp` on first run, and automatically update it on subsequent launches by comparing with the latest Release. If unable to connect to the internet, you can pre-stage the binary according to the deployment guide.

### Start Desktop App

```bash
cd desktop-app
npm ci
npm run start   # Build TypeScript and start Electron
```

The desktop app now targets Electron 41 / Chromium 146.

- Linux Wayland keeps the subtitle window fully frameless while benefiting from newer windowing and shortcut fixes.
- Windows Quick Show preserves snapped layouts instead of forcing the panel into a conflicting top-most state.
- Desktop release packaging now runs through Electron Forge with ASAR integrity validation enabled.

By default the app listens on `ws://127.0.0.1:44501`; adjust the bind address and port under **Settings → Network** if you want phones/tablets on your LAN to connect.

### Test Stack

- `desktop-app` renderer tests run on **Vitest Browser Mode** with **Playwright 1.59.1 Chromium** for component interaction, layout, and visual regression coverage.
- `desktop-app` jsdom tests remain for lightweight renderer unit tests and upgrade/config assertions on **jsdom 29.0.2**.
- `extension` runs on **TypeScript + esbuild**, with **Vitest 4 + jsdom 29.0.2** for tests and `tsc --noEmit` for type checks.
- Browser-mode screenshot baselines live in `__screenshots__/` directories next to the browser test files that own them.

### Load Browser Extension

First, build the extension for your target browser:

```bash
cd extension
npm ci
npm run typecheck      # TypeScript compile check
npm run build:chrome   # For Chrome/Edge/Chromium
npm run build:firefox  # For Firefox
npm run build:all      # Build both versions
```

**Chrome / Edge / Chromium:**

1. Open `chrome://extensions`
2. Enable "Developer mode"
3. Select "Load unpacked", pointing to the `extension/dist/chrome` directory

**Firefox:**

1. Open `about:debugging#/runtime/this-firefox`
2. Click "Load Temporary Add-on..."
3. Navigate to `extension/dist/firefox` and select `manifest.json`

> **Note**: Firefox temporary add-ons are removed when the browser closes. For persistent installation, the extension needs to be signed through [Firefox Add-ons](https://addons.mozilla.org/).

Then playing any video on Bilibili / YouTube / Douyin will allow you to see the desktop app window download subtitles and sync highlighting.
Use the popup's "Desktop Apps" card to add multiple `ws://` endpoints; playback updates will broadcast to every connected desktop app.

## Feature Overview

- **Real-time Playback Info**: content script monitors video timeline / playback rate / URL, pushing every 300ms to desktop app.
- **Subtitle Aggregation**: Electron side downloads all available subtitle tracks (including auto-generated) via `yt-dlp`, pairs selected tracks by cue timing, and keeps cue actions attached to reading blocks.
- **Track Switching**: UI provides dropdown to select different languages/tracks, clicking subtitle lines jumps to corresponding timestamp.
- **Bidirectional Control**: Desktop app can initiate play / pause / seek commands, extension receives and directly controls video elements.

### Desktop Subtitle Reader

The desktop subtitle panel is rendered as a cue-anchored reader rather than a chrome-heavy cue list. Layout is computed in the renderer with `@chenglou/pretext` 0.0.5 using a two-phase pipeline: transcript blocks are measured up front, then visible blocks materialize line text on demand for the virtualized viewport. Subtitle text is prepared with `white-space: pre-wrap` and `word-break: keep-all` so explicit cue breaks are preserved while CJK / Hangul wrapping stays closer to browser behavior. Cue actions are exposed as lightweight anchors on active or hovered reading blocks. The app does not attempt semantic alignment across downloaded subtitle tracks; primary and secondary subtitles are paired by cue timing only, so cue boundaries remain the source of truth.

## Development Scripts

| Location | Command | Description |
| ---- | ---- | ---- |
| `desktop-app` | `npm run start` | Build + start Electron (watch-free) |
| `desktop-app` | `npm run build` | Build TypeScript and static assets to `dist/` only |
| `desktop-app` | `npm run test:renderer` | Run the full renderer suite across Vitest Browser Mode and jsdom |
| `desktop-app` | `npm run test:renderer:browser` | Run browser-mode renderer tests in Playwright 1.59.1 Chromium, including visual regression checks |
| `desktop-app` | `npm run test:renderer:jsdom` | Run jsdom-only renderer unit tests |
| `desktop-app` | `npm run typecheck:renderer` | Run `vue-tsc` against the renderer app source before packaging or larger refactors |
| `desktop-app` | `npm run package` | Build the app and create an unpacked Electron Forge package in `out/` |
| `desktop-app` | `npm run make` | Build the app and generate Electron Forge distributables for the current host platform |
| `desktop-app` | `npm run dist:win/mac/linux` | Build the app and run `electron-forge make` for that target; run on the matching host platform |
| `extension` | `npm run typecheck` | Run the extension TypeScript compile check |
| `extension` | `npm run build` | Type-check and build both Chrome and Firefox extension bundles |
| `extension` | `npm run build:chrome` | Build Chrome/Edge/Chromium extension to `dist/chrome/` |
| `extension` | `npm run build:firefox` | Build Firefox extension to `dist/firefox/` |
| `extension` | `npm run build:all` | Build both Chrome and Firefox versions |
| `extension` | `npm run test` | Run the extension test suite on Vitest 4 + jsdom 29.0.2 |

## Deployment and Distribution

For detailed procedures (including extension packaging, Electron Forge distributables, and yt-dlp distribution strategy), refer to [DEPLOYMENT.md](DEPLOYMENT.md).

## Troubleshooting

- **Desktop app shows `yt-dlp not found`**: First launch unable to download due to no internet, or GitHub is blocked. You can manually place the binary in `desktop-app/resources/yt-dlp/` and repackage, or place the executable in the `yt-dlp` subdirectory of the user data directory.
- **Extension shows disconnected**: Ensure Electron is running and the WebSocket listening port is not occupied. Check the extension popup's `Desktop Apps` endpoint list first; the default endpoint is configured in `extension/src/background.ts` and persisted through the background endpoint manager, rather than a hard-coded legacy `extension/background.js` file.
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
