# Jellyfin / Emby Plugin Design

## Goal

Jellyfin / Emby support is an official bundled plugin named `official.jellyfinemby`. Users control this integration from the plugin manager. When the plugin is disabled, the desktop app does not connect to Jellyfin / Emby servers, does not track Jellyfin / Emby playback, and does not treat Jellyfin / Emby browser videos as normal extension videos.

The project has not shipped, so this design targets the final shape directly.

## Non-Goals

- Support Plex or other media servers.
- Implement server discovery, login flows, or API-key generation.
- Keep a host-level Media Server settings section.
- Keep a separate host-level media-server enable switch.
- Delete subtitle cache entries when the plugin is disabled.

## User Experience

The plugin manager lists `official.jellyfinemby` as an official plugin with the display name `Jellyfin / Emby`.

When the plugin is disabled:

- The Jellyfin / Emby settings section is hidden.
- No WebSocket connection, reconnect timer, keepalive, or session polling runs.
- Runtime Jellyfin / Emby session state is empty.
- Browser extension messages from configured Jellyfin / Emby origins are acknowledged and ignored by the desktop app.
- Non-Jellyfin / Emby browser videos continue to use the normal extension flow.

When the plugin is enabled:

- The Jellyfin / Emby settings section appears in settings navigation.
- Users can add, edit, enable, disable, and delete server entries.
- Enabled server entries connect through the existing Jellyfin / Emby WebSocket and REST APIs.
- Session tracking, subtitle loading, playback sync, track selection, A-B repeat, and transcript display use the existing media-server behavior.

## Plugin Manifest

`official.jellyfinemby` has a bundled manifest:

- `id`: `official.jellyfinemby`
- `displayName`: `Jellyfin / Emby`
- `description`: `Sync playback and subtitles from Jellyfin or Emby media servers.`
- `settings`: one section with id `official.jellyfinemby.settings` and anchor `settings-section-plugin-official-jellyfinemby`

The plugin contributes main-process lifecycle behavior. It does not expose user-facing commands.

## Settings Model

Plugin enabled state lives only in the plugin registry, the same as other official plugins.

Jellyfin / Emby configuration lives under:

```ts
settings.plugins["official.jellyfinemby"].config
```

The plugin config shape is:

```ts
interface JellyfinembyPluginConfig {
  servers: JellyfinembyServerConfig[];
}

interface JellyfinembyServerConfig {
  id: string;
  name: string;
  serverUrl: string;
  apiKey: string;
  webSocketPath: string;
  enabled: boolean;
}
```

`serverUrl` is the Jellyfin / Emby server base URL. `apiKey` is stored locally in the settings file. `webSocketPath` defaults to `/socket`. A server entry with `enabled: false` remains editable but does not connect.

Default settings contain an empty plugin config:

```json
{
  "plugins": {
    "official.jellyfinemby": {
      "config": {
        "servers": []
      }
    }
  }
}
```

The host app does not have `settings.mediaServer` as persistent user settings. Runtime desktop state may still expose `mediaServer` for connected status, sessions, selected session, and last update time.

## Main Process Architecture

The existing Jellyfin / Emby protocol code remains the implementation core:

- `JellyfinembySubtitleService`
- `JellyfinembyConnection`
- `JellyfinembyWebSocketTransport`
- `JellyfinembySessionManager`
- `JellyfinembySessionTracker`
- `JellyfinembySubtitleLoader`
- `MediaServerUrlResolver`
- `MediaServerSessionHandler`
- `MediaServerMessageHandler`
- `MediaServerStatusHandler`

`MediaServerController` is a lifecycle-managed service owned by the Jellyfin / Emby plugin contribution. It has explicit active and inactive states.

When active, the controller:

- Reads server config from `settings.plugins["official.jellyfinemby"].config`.
- Registers or enables media-server message handling.
- Starts `JellyfinembySubtitleService`.
- Connects only enabled server entries with non-empty URL and API key.
- Refreshes service connections when Jellyfin / Emby plugin config changes.
- Emits media-server status, sessions, playback, subtitles, and errors into `StateManager`.

When inactive, the controller:

- Stops all Jellyfin / Emby service work.
- Closes WebSocket connections.
- Clears reconnect, keepalive, burst, and continuous polling timers.
- Clears active media-server session routing.
- Clears runtime media-server state in `StateManager`.
- Leaves subtitle cache data untouched.

`JellyfinembySubtitleService` treats missing URL or API key as a per-server connection problem, not a plugin load failure. It logs the skipped connection and keeps the plugin enabled.

## Desktop Routing Guard

The desktop app has a lightweight routing guard for browser extension `video-context` messages. The guard runs before the normal extension subtitle-loading path.

If the message URL, page URL, or video source URL matches a configured Jellyfin / Emby server origin:

- If `official.jellyfinemby` is enabled, the message is handled by the media-server controller.
- If `official.jellyfinemby` is disabled, the message is marked handled and ignored.

This prevents disabled Jellyfin / Emby support from falling back to ordinary extension handling. The browser extension may still detect the video element; the desktop app is the authority for whether Jellyfin / Emby integration is active.

If the message does not match a configured Jellyfin / Emby origin, the normal extension video flow continues unchanged.

## Renderer Settings

The fixed host settings navigation does not include a Media Server section.

`SettingsMediaServer.vue` is registered as the plugin settings component for `official.jellyfinemby.settings`.

The settings section contains:

- Server list.
- Add server button.
- Delete server button.
- Server name field.
- Server URL field.
- API key field.
- WebSocket path field.
- Per-server enabled toggle.

The section does not contain a global media-server toggle. Users enable or disable the entire integration from the plugin manager.

When there are no server entries, the section shows an empty state and the add button. Deleting the last server is allowed because plugin enabled state is independent from server count.

## Runtime State

Desktop runtime state keeps a media-server panel state:

```ts
interface MediaServerPanelState {
  connected: boolean;
  sessions: MediaServerSessionSummary[];
  selectedSessionId: string | null;
  lastUpdated: number | null;
}
```

This is runtime state, not persisted settings.

When the plugin is disabled, the runtime state is:

- `connected: false`
- `sessions: []`
- `selectedSessionId: null`
- `lastUpdated: null`

If the active source is media server when the plugin is disabled, the desktop state exits media-server mode. If a browser extension connection exists, the app returns to extension waiting behavior. If no extension connection exists, the app returns to idle behavior. Subtitle tracks and pending media-server item state are cleared.

The main window connection label displays Media Server counts only when `official.jellyfinemby` is enabled.

## Error Handling

Plugin load errors are reserved for structural failures, such as the plugin factory throwing during initialization.

Per-server runtime failures do not mark the plugin broken:

- Missing API key.
- Missing server URL.
- WebSocket connection failure.
- REST request failure.
- Subtitle download failure.
- No subtitle streams in the active session.

These failures are logged and surfaced through existing media-server status or subtitle error paths where appropriate.

Disabling the plugin is not an error condition. It intentionally silences Jellyfin / Emby processing.

## Tests

Main-process tests cover:

- Plugin catalog includes `official.jellyfinemby`.
- The plugin is disabled by default.
- Enabling the plugin activates `MediaServerController`.
- Disabling the plugin deactivates `MediaServerController` and clears runtime media-server state.
- Settings updates refresh media-server connections only while the plugin is active.
- Matching Jellyfin / Emby `video-context` messages are ignored when the plugin is disabled.
- Matching Jellyfin / Emby `video-context` messages enter the media-server flow when the plugin is enabled.
- Non-Jellyfin / Emby `video-context` messages still enter the normal extension flow.
- Empty URL or API key skips a server connection without marking the plugin broken.

Renderer tests cover:

- Settings navigation does not contain a fixed host Media Server section.
- The Jellyfin / Emby settings section appears only when `official.jellyfinemby` is enabled.
- `SettingsMediaServer.vue` has no global media-server toggle.
- Server entries can be added, edited, enabled, disabled, and deleted.
- Deleting the last server is allowed.
- The connection label includes Media Server counts only when the plugin is enabled.

## Acceptance Criteria

- Fresh default settings contain no preconfigured Jellyfin / Emby servers.
- The app starts without opening any Jellyfin / Emby connection when the plugin is disabled.
- Enabling `official.jellyfinemby` exposes server settings and starts media-server tracking for enabled server entries.
- Disabling `official.jellyfinemby` closes active connections, stops polling, clears runtime media-server state, and hides the settings section.
- With the plugin disabled, browser extension messages from configured Jellyfin / Emby origins are ignored by the desktop app and do not run ordinary extension subtitle handling.
- With the plugin enabled, Jellyfin / Emby playback and subtitle behavior matches the existing media-server experience.
- Ordinary browser-extension video sites continue to work independently of the Jellyfin / Emby plugin state.
