# State Consistency and Session Routing Design

## Scope

This design covers three review findings:

- `apps/desktop-app/src/main/settings/SettingsStore.ts`
- `apps/extension/src/background/desktop/DesktopConnection.ts`
- `apps/desktop-app/src/main/mediaServer/MediaServerSessionHandler.ts`

The project has not shipped. The final implementation must not add compatibility, migration, legacy-data handling, transition layers, or old-code rejection layers.

## Settings Persistence

`SettingsStore` treats the in-memory settings object as the last successfully persisted settings state.

`update(partial)` returns the saved settings only after the merged and sanitized settings have been written to disk successfully. If disk write fails, `update(partial)` throws and `get()` still returns the previous settings object.

The store has no rollback path because it does not mutate `this.data` before persistence succeeds. The save operation accepts the candidate settings object to write; it does not read from `this.data` as implicit input.

Network settings validation remains part of update validation. Invalid updates still throw before any settings are persisted.

## Extension Desktop Connection

The extension does not maintain an offline WebSocket replay queue.

When a desktop WebSocket is not open, outgoing messages are dropped and the connection attempts to connect or reconnect. No historical `time-update`, `playback-rate`, `video-context`, `page-url-changed`, loop, or ended messages are queued for later playback.

When a WebSocket connection opens, the extension sends one current media context to that newly opened connection if a valid media state exists. The selected media state is the same one users would expect from the dashboard ordering: playing media first, then most recently updated media.

The reconnect sync message is a fresh `video-context` message. It contains the current media state from `MediaStateStore` and a new transport envelope. It is not a replayed historical message.

Only one tab is synced on reconnect. The extension does not broadcast every known tab because doing so would arbitrarily switch the desktop active tab to the last replayed context.

Connection snapshots no longer expose `pendingMessages` because there is no pending queue.

## Media Server Session Routing

Media server session matching never uses `nowPlayingItemId` across server boundaries.

For a tab with a known `sessionId`, an exact session id match remains valid.

For a tab with a known `serverConfigId` and `itemId`, item matching requires both `serverConfigId` and `nowPlayingItemId` to match.

For a tab without a known `serverConfigId`, `itemId` alone is not enough to bind or select a media server session.

This applies both to session list updates and to direct media-server `video-context` processing. A known exact `sessionId` can still identify a session, but an unknown server must not fall back to searching all sessions by `nowPlayingItemId`.

The current `video-context` message must resolve to a configured media-server URL before it is handled as media-server traffic. A stale tab context from a previous media-server page is not a valid fallback for classifying an ordinary extension video or for supplying `serverConfigId` during item matching.

When the selected media-server session disappears, automatic replacement is allowed only when the active tab has a known server and a matching session exists on that same server. Otherwise the selected session is cleared and the media server service active session becomes `null`.

When there is no same-server replacement, media-server runtime UI state is cleared even if other sessions still exist on other servers. Other sessions are not a valid fallback for the vanished active session.

The handler must not select `sessions[0]` as a generic fallback for media-server mode. Session selection must come from an exact session id or an explicit same-server match.

## Tests

Tests should verify the final behavior directly:

- `SettingsStore.update()` preserves the previous in-memory settings when disk persistence throws.
- Extension WebSocket sends do not accumulate while disconnected.
- Opening a WebSocket sends at most one fresh `video-context` for the current best media state.
- Media server session handling does not match equal item ids across different `serverConfigId` values.
- Unknown-server tab context does not select a session by item id.
- Unknown-server direct media-server video context does not select a session by item id.
- Stale tab context does not make an ordinary extension video look like a media-server video.
- Stale tab context does not provide `serverConfigId` for direct unknown-server item matching.
- Vanished selected sessions do not fall back to the first available session.
- Vanished selected sessions without a same-server replacement clear stale media-server runtime state.
