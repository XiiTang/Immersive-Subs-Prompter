# Privacy Policy for Immersive Subs Prompter

**Last Updated: May 31, 2026**

## Overview

Immersive Subs Prompter is a browser extension that works together with the Immersive Subs Prompter desktop application to provide an immersive subtitle learning experience.

## Data Collection

Immersive Subs Prompter does not collect personal information.

To provide the extension features, the browser extension may read:

- Current page URL and title
- Video element metadata, playback position, player state, and media source URL
- Extension preferences, endpoint lists, and blacklist rules stored locally in your browser

### What We Do NOT Collect
- Personal identification information
- Passwords or login credentials
- Cookies
- Form input
- Page contents unrelated to media detection
- Browsing history as a separate history record

## Data Usage

The extension uses this data only for:

1. Synchronizing subtitle display with video playback
2. Communicating with the configured Immersive Subs Prompter desktop application endpoints via WebSocket
3. Requesting subtitles, transcription, and word lookup features from the companion desktop application

## Data Storage

- All data is stored locally on your device
- Extension preferences and endpoint lists are stored locally in your browser
- Desktop app settings and caches are stored locally by the desktop application
- Playback and page metadata is sent only to desktop application WebSocket endpoints that you configure

## Data Sharing

We do not sell, trade, or transfer your data to third parties.

The extension communicates only with Immersive Subs Prompter desktop app WebSocket endpoints you add, such as `ws://127.0.0.1:44501/` or a LAN endpoint you explicitly configure.

The desktop app may contact services you configure for features such as Whisper-compatible transcription APIs, media servers, or subtitle downloads. Those requests are initiated by the desktop app according to your settings, not by a hosted Immersive Subs Prompter service.

## Permissions Explained

| Permission | Why We Need It |
|------------|----------------|
| `<all_urls>` | To detect video playback and page URL changes on pages where the extension runs |
| `storage` | To save your extension preferences locally |

## Your Rights

You can:
- Disable or uninstall the extension at any time
- Clear all stored data by uninstalling the extension

## Contact

If you have questions about this privacy policy, please contact:
- Email: sheixunixitang3@gmail.com
- GitHub: https://github.com/XiiTang/Immersive-Subs-Prompter

## Changes to This Policy

We may update this privacy policy from time to time. Any changes will be reflected in the "Last Updated" date above.
