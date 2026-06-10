# Validation Report: USP-CAND-007

## Finding

All-frames subframes can replace tab-level media state and control routing

## Decision

- Status: reportable
- Severity hypothesis: medium
- Confidence: medium

## Affected Lines

- `apps/extension/src/manifest.ts:59-64`
- `apps/extension/src/background/messaging/ContentMessageRouter.ts:135-149`
- `apps/extension/src/background/tabs/TabRegistry.ts:24-31`
- `apps/extension/src/background/tabs/MediaStateStore.ts:42-58`
- `apps/extension/src/background/desktop/DesktopMessageHandler.ts:21-46`

## Method And Evidence

Reviewed manifest.ts, ContentMessageRouter.ts, TabRegistry.ts, MediaStateStore.ts, DesktopMessageHandler.ts, and supporting tests. The transport test command passed with 4 files and 16 tests. Static counterevidence shows tabId comes from Chrome port metadata, so cross-tab spoofing is suppressed; the remaining gap is within the same tab across frames.

## Dataflow

Subframe content script port -> handlePort captures tabId and frameId -> video-context calls rememberActiveFrame(tabId, frameId) and setState(tabId, patch) -> desktop command receives tabId -> getPreferredFrameId returns the last media frame -> postMessage sends the control command to that frame.

## Counterevidence And Proof Gaps

A third-party iframe or nested same-tab frame with a qualifying video can compete with the top frame when all_frames is enabled. The result is wrong media state, possible subtitle downloads for the frame URL, and controls delivered to the wrong frame. Counterevidence: the attacker cannot choose another tabId from content messages.
