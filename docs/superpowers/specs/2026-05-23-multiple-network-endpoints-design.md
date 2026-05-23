# Multiple Network Endpoints Design

Date: 2026-05-23

## Goal

Allow the desktop app to listen on multiple explicit WebSocket bind endpoints at the same time.

Users can configure entries such as:

- `127.0.0.1:44501`
- `192.168.1.2:44501`
- `192.168.1.3:44502`

The app should not require `0.0.0.0` when the user wants LAN access through one or more specific interfaces.

## Product Constraints

- The project has not launched. No compatibility layer, migration path, legacy setting support, or old data handling is required.
- The spec describes the target final shape only.
- The old single `network.host` and `network.port` model is not part of the final product.
- Existing extension support for multiple desktop app endpoints remains useful, but users should normally add only one reachable URL per desktop app instance.

## Settings Model

`NetworkSettings` contains a list of structured endpoints and one shared auth token:

```ts
export interface NetworkEndpoint {
  id: string;
  host: string;
  port: number;
}

export interface NetworkSettings {
  endpoints: NetworkEndpoint[];
  authToken: string;
}
```

Default network settings:

```ts
{
  endpoints: [
    { id: "default", host: "127.0.0.1", port: 44501 }
  ],
  authToken: createConnectionAuthToken()
}
```

Rules:

- At least one endpoint is required.
- Endpoint identity is stored in `id`.
- Runtime uniqueness is based on normalized `host:port`.
- Ports must be explicit integers from `1` through `65535`.
- Invalid endpoints are rejected rather than silently clamped.
- Settings updates with invalid or duplicate endpoints preserve the current network settings and surface an error.
- Invalid stored network settings fall back to default network settings on app startup.
- The auth token is shared by every non-loopback endpoint.

## Endpoint Parsing

The settings UI accepts these input forms:

- `127.0.0.1:44501`
- `192.168.1.2:44501`
- `localhost:44501`
- `[::1]:44501`
- `ws://127.0.0.1:44501/`
- `ws://192.168.1.2:44501/?token=...`

The parser extracts and validates:

- `host`
- `port`

The parser does not persist URL tokens, path segments, query parameters, fragments, or protocol details in `NetworkEndpoint`.

Canonical display URLs are generated from the structured endpoint and current `authToken`.

## Authentication

Loopback endpoints accept trusted browser-extension origins without a token.

Loopback hosts:

- `127.0.0.1`
- `localhost`
- `::1`
- `[::1]`

Non-loopback endpoints require the shared token in the WebSocket URL query string:

```text
ws://192.168.1.2:44501/?token=<authToken>
```

All endpoints still reject non-extension origins.

## Settings UI

The Network section uses the same pill-list interaction pattern as subtitle priority editing.

Final shape:

- A field labeled for listening endpoints.
- Existing endpoints render as compact, read-only pills that display the generated extension URL.
- The draft pill at the end accepts new endpoint text.
- Pressing Enter or blurring the draft input parses and adds the endpoint.
- Existing endpoint pills are not editable in place.
- Each persisted pill can be removed through a small hover/focus `x` control.
- The last remaining endpoint cannot be removed.

Examples of non-editing pill display:

```text
ws://127.0.0.1:44501/
ws://192.168.1.2:44501/?token=...
```

Validation:

- Empty draft input is ignored.
- Invalid endpoint text shows an inline error and does not update settings.
- Duplicate `host:port` entries are rejected.
- Invalid ports are rejected.

## Desktop Listener Runtime

`ConnectionManager` manages one listener per configured endpoint.

Conceptual runtime state:

```ts
type ListenerRecord = {
  endpoint: NetworkEndpoint;
  server: WebSocketServer;
  clients: Set<WebSocket>;
  status: "listening" | "error";
  error: string | null;
};
```

Runtime behavior:

- Each endpoint starts its own `WebSocketServer`.
- Each listener binds to its endpoint's `host` and `port`.
- All listeners share the same connection message handling.
- All listeners share the same heartbeat behavior.
- All listeners share tab-to-socket routing for playback controls.
- Closing an endpoint closes only that endpoint's server and clients.
- A single endpoint bind failure does not stop other endpoints.
- A failed endpoint remains visible in settings so the user can edit or remove it.
- Changing the shared auth token restarts all listeners.

The desktop app should expose enough listener status for the settings UI to show which endpoint is active or failed.

## Extension Behavior

The browser extension continues to support multiple desktop app URLs in its popup.

Recommended user behavior:

- Add one reachable URL per desktop app instance.
- Do not add multiple URLs that point to different listeners of the same desktop app instance unless duplicate message fan-out is intentional.

The desktop settings UI displays URL values that can be entered into the extension popup.

## Error Handling

Configuration errors are surfaced in the settings UI before saving.

Listener startup errors are tracked per endpoint:

- Port already in use.
- Address not available on this machine.
- Permission or platform bind failure.
- Unexpected WebSocket server startup failure.

Error handling rules:

- Failed endpoints do not roll back automatically.
- Other endpoints keep running.
- The failed endpoint pill shows an error state.
- Adding a replacement endpoint starts its listener.
- Removing the failed endpoint clears its listener error state.

## Tests

Main process tests should cover:

- Network settings sanitization accepts valid endpoint lists.
- Network settings update validation rejects invalid or empty endpoint lists without changing current settings.
- Network settings update validation rejects duplicate normalized `host:port` entries without changing current settings.
- Startup sanitization falls back to default network settings when stored network settings are invalid.
- Endpoint URL generation omits tokens for loopback and includes tokens for non-loopback.
- Auth rejects non-extension origins on every endpoint.
- Auth requires token for non-loopback endpoints.
- Connection manager starts multiple listeners.
- One bind failure does not prevent other listeners from starting.
- Removing an endpoint closes only that endpoint's server and clients.
- Updating an endpoint restarts only that endpoint.
- Updating the auth token restarts all listeners.

Renderer tests should cover:

- Endpoint pills render generated URLs.
- Draft input accepts `host:port` and `ws://host:port/?token=...`.
- Blurring the draft input adds the endpoint and displays the generated extension URL.
- Invalid input shows an error and does not update settings.
- Duplicate input shows an error and does not update settings.
- Existing pills are read-only and can be removed.
- The final endpoint cannot be removed.

Documentation should describe:

- Multiple explicit bind endpoints.
- Avoiding `0.0.0.0` by listing concrete addresses.
- Tokenized URLs for non-loopback endpoints.
- Extension-side guidance to add only one reachable URL per desktop app instance.

## Out Of Scope

- Compatibility with old `network.host` and `network.port` settings.
- Migration of existing settings files.
- Automatic network interface discovery.
- Automatic firewall configuration.
- Per-endpoint auth tokens.
- Per-endpoint access control lists.
- Extension-side deduplication of multiple URLs that point to the same desktop app instance.
