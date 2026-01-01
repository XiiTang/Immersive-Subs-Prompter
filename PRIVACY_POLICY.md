# Privacy Policy for Immersive Subs Prompter

**Last Updated: January 1, 2026**

## Overview

Immersive Subs Prompter is a browser extension that works together with the Immersive Subs Prompter desktop application to provide an immersive subtitle learning experience.

## Data Collection

### What We Collect
- **Video playback information**: Current video URL, playback position, and player state from supported video websites
- **User preferences**: Extension settings stored locally in your browser

### What We Do NOT Collect
- Personal identification information
- Browsing history unrelated to video playback
- Passwords or login credentials
- Any data from websites other than video platforms

## Data Usage

All collected data is used solely for:
1. Synchronizing subtitle display with video playback
2. Communicating with the local desktop application via WebSocket (localhost only)

## Data Storage

- All data is stored locally on your device
- No data is transmitted to external servers
- Data is only shared with the companion desktop application running on your local machine

## Data Sharing

We do not sell, trade, or transfer your data to third parties. The extension only communicates with:
- The Immersive Subs Prompter desktop application on your local machine (via `wss://127.0.0.1:44501`)

## Permissions Explained

| Permission | Why We Need It |
|------------|----------------|
| `<all_urls>` | To detect video playback on supported video websites |
| `storage` | To save your extension preferences locally |
| `alarms` | To maintain connection with the desktop application |

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
