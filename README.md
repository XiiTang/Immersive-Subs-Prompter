
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
3. Parsing and merging subtitle tracks (e.g., primary + secondary) and displaying them in a scrollable teleprompter panel.
4. Enabling bidirectional control so clicking to seek, looping a segment, or sending play/pause commands from the subtitle panel can control the browser video.

---

## Directory Structure

```
extension/     # Chromium MV3 plugin source code, responsible for browser-side injection and communication
desktop-app/   # Electron + TypeScript desktop application
```

## Quick Start

### Prerequisites

- Node.js 18+ and npm
- Chrome / Edge / Chromium-based browser for loading extensions
- The desktop app will automatically download the corresponding platform's `yt-dlp` on first run, and automatically update it on subsequent launches by comparing with the latest Release. If unable to connect to the internet, you can pre-stage the binary according to the deployment guide.

### Start Desktop App

```bash
cd desktop-app
npm install
npm run start   # Build TypeScript and start Electron
```

By default the app listens on `ws://127.0.0.1:44501`; adjust the bind address and port under **Settings → Network** if you want phones/tablets on your LAN to connect.

### Load Browser Extension

1. Open `chrome://extensions`
2. Enable "Developer mode"
3. Select "Load unpacked", pointing to the `extension/` directory in the repository

Then playing any video on Bilibili / YouTube / Douyin will allow you to see the desktop app window download subtitles and sync highlighting.
Use the popup's "Desktop Apps" card to add multiple `ws://` endpoints; playback updates will broadcast to every connected desktop app.

## Feature Overview

- **Real-time Playback Info**: content script monitors video timeline / playback rate / URL, pushing every 300ms to desktop app.
- **Subtitle Aggregation**: Electron side downloads all available subtitle tracks (including auto-generated) via `yt-dlp`, parsing into a unified VTT cue list.
- **Track Switching**: UI provides dropdown to select different languages/tracks, clicking subtitle lines jumps to corresponding timestamp.
- **Bidirectional Control**: Desktop app can initiate play / pause / seek commands, extension receives and directly controls video elements.

## Development Scripts

| Location | Command | Description |
| ---- | ---- | ---- |
| `desktop-app` | `npm run start` | Build + start Electron (watch-free) |
| `desktop-app` | `npm run build` | Build TypeScript and static assets to `dist/` only |
| `desktop-app` | `npm run dist:win/mac/linux` | Generate installation package for the corresponding platform using electron-builder (Win version installer allows free path selection) |
| `desktop-app` | `npm run dist:all` | Package Win/Mac/Linux simultaneously (must run on respective platforms) |

The extension part has no build script yet and uses the source directory directly.

## Deployment and Distribution

For detailed procedures (including extension packaging, Electron installer, yt-dlp distribution strategy), refer to [DEPLOYMENT.md](DEPLOYMENT.md).

## Troubleshooting

- **Desktop app shows `yt-dlp not found`**: First launch unable to download due to no internet, or GitHub is blocked. You can manually place the binary in `desktop-app/resources/yt-dlp/` and repackage, or place the executable in the `yt-dlp` subdirectory of the user data directory.
- **Extension shows disconnected**: Ensure Electron is running and WebSocket listening port is not occupied. If necessary, modify `WS_ENDPOINT` in `extension/background.js` to match the desktop app.
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

## License

This example is for internal integration reference only. Before distributing, confirm the license requirements of third-party dependencies (especially `yt-dlp`).
