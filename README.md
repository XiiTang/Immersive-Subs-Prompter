# Universal Subtitle Plugin

A "Subtitle Messenger" system composed of a browser extension and an Electron desktop app. The extension resides on YouTube / Bilibili / Douyin and other sites, collecting video playback information in real-time and pushing it to the local desktop application via WebSocket; the desktop app is responsible for fetching subtitles (via `yt-dlp`), displaying a scrolling subtitle panel, and supporting jumping within the subtitle list or controlling the browser player.

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

The app will listen on `ws://127.0.0.1:44501` locally, waiting for the extension to connect.

### Load Browser Extension

1. Open `chrome://extensions`
2. Enable "Developer mode"
3. Select "Load unpacked", pointing to the `extension/` directory in the repository

Then playing any video on Bilibili / YouTube / Douyin will allow you to see the desktop app window download subtitles and sync highlighting.

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
