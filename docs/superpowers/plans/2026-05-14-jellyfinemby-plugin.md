# Jellyfin / Emby Plugin Implementation

Status: implemented.

## Final Shape

Jellyfin / Emby support is now an official bundled plugin with id `official.jellyfinemby`.

Persistent server config lives only under:

```ts
settings.plugins["official.jellyfinemby"].config
```

The plugin config is:

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

The host app no longer has persistent `settings.mediaServer`. Runtime desktop state still exposes `desktopState.mediaServer` for connected status, sessions, selected session, and last update time.

## Runtime Behavior

`MediaServerController` always registers the browser-message routing guard, but it starts Jellyfin / Emby service work only when `official.jellyfinemby` is enabled.

When the plugin is disabled:

- Jellyfin / Emby WebSocket connections and polling stop.
- Runtime media-server state is cleared.
- Active media-server routing and pending item state are cleared.
- Browser extension `video-context` messages from configured Jellyfin / Emby origins are marked handled and ignored.
- Ordinary non-Jellyfin / Emby extension videos continue through the normal extension flow.

When the plugin is enabled:

- The plugin activates `MediaServerController`.
- Enabled server entries connect through the existing Jellyfin / Emby service.
- Settings updates refresh media-server connections while the plugin is active.

## Renderer Behavior

The fixed settings navigation no longer includes a host Media Server section.

`SettingsMediaServer.vue` is registered as the plugin settings component for `official.jellyfinemby.settings`. It edits the plugin-owned server list and has no global media-server toggle.

The connection label includes Media Server counts only when `official.jellyfinemby` is enabled.

## Verification

Passing checks:

```bash
pnpm --filter @immersive-subs/desktop-app typecheck
pnpm --filter @immersive-subs/desktop-app test
```
