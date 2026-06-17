# Media URL SSRF and Jellyfin / Emby URL Design

## Goal

Close the page-to-desktop media URL SSRF issue while preserving the intended Jellyfin / Emby local-network workflow.

The final app does not let arbitrary page-controlled `pageUrl` or `videoSrc` values drive desktop `yt-dlp` network requests. Localhost, loopback, private-network, link-local, multicast, and metadata-service URLs are blocked from the generic `yt-dlp` subtitle path.

Jellyfin / Emby remains able to use localhost, loopback, and private-network URLs, but only through server URLs explicitly configured by the user in the built-in Jellyfin / Emby settings.

This design describes the final state only. The project has not launched, so the implementation does not preserve legacy persisted endpoint data, add migration code, keep compatibility aliases, or retain transitional fallback behavior.

## Scope

In scope:

- extension-to-desktop media URL resolution for generic subtitle downloads
- main-process defense before invoking `yt-dlp`
- Jellyfin / Emby settings shape
- Jellyfin / Emby URL matching and API request target selection
- settings sanitizer, renderer settings UI, and focused tests for the final model

Out of scope:

- the already removed generic `openExternal` bridge
- the already hardened `ytDlpArgs` policy
- Faster-Whisper executable/model path hardening
- plugin-platform SSRF findings from the removed plugin architecture
- adding a compatibility layer for old Jellyfin / Emby settings snapshots

## Generic `yt-dlp` Media URL Boundary

The generic subtitle-download path treats extension media context as untrusted input. A page can influence `pageUrl`, `videoSrc`, title, timing, and media state, so those fields are never sufficient by themselves to authorize a desktop network request.

The final generic `yt-dlp` path accepts only public HTTP(S) page URLs from product-recognized media site identities. The current recognized generic site identities are `youtube`, `bilibili`, and `douyin`. It does not use unknown-site `videoSrc` or unknown-site `pageUrl` as an automatic fallback. Unknown pages may still update playback state, but they do not start desktop subtitle downloads through `yt-dlp`.

Recognized site identity is bound to the page URL hostname in the desktop main process. `youtube` only matches `youtube.com` and its subdomains, `bilibili` only matches `bilibili.com` and its subdomains, and `douyin` only matches `douyin.com` and its subdomains. Lookalike hosts such as `notyoutube.com` or `youtube.com.evil.example` are not recognized. The extension uses the same exact-or-subdomain rule when reporting site identity, but desktop validation is the authoritative boundary.

Before invoking `yt-dlp`, the main process validates the resolved URL again. The validation rejects:

- non-HTTP(S) schemes
- localhost and `*.localhost`, including DNS root-dot forms such as `localhost.`
- loopback addresses
- private IPv4 ranges
- carrier-grade NAT ranges
- link-local addresses
- multicast/reserved ranges
- IPv6 loopback, unique-local, link-local, and multicast ranges
- metadata-service hosts such as `169.254.169.254` and `metadata.google.internal`, including DNS root-dot forms

This runtime guard is defense-in-depth. The generic path must not rely only on renderer checks, extension checks, or profile UI state.

The generic `yt-dlp` path does not use browser-cookie extraction for untrusted origins. Browser-cookie access is not a generic capability controlled by page input.

## Jellyfin / Emby Settings Model

Jellyfin / Emby keeps the current built-in feature shape under `settings.features.jellyfinEmby`, but each server row uses one comma-separated URL field:

```ts
interface JellyfinEmbyFeatureSettings {
  enabled: boolean;
  config: {
    servers: JellyfinEmbyServerConfig[];
  };
}

interface JellyfinEmbyServerConfig {
  id: string;
  name: string;
  serverUrls: string;
  apiKey: string;
  enabled: boolean;
}
```

`serverUrls` is the only Jellyfin / Emby endpoint field. There is no primary URL, alias URL, fallback URL, or parallel endpoint field in the final model.

The settings UI shows one server URL input. Users enter all equivalent addresses for the same Jellyfin / Emby server in that input, separated by commas:

```text
http://localhost:8096, http://127.0.0.1:8096, http://192.168.1.45:8096
```

All URLs in the field are equal. The field is ordered only for deterministic matching when more than one configured URL could match the same browser media context.

## Jellyfin / Emby URL Validation

The sanitizer parses `serverUrls` as a comma-separated list.

Rules:

- enabled server rows require at least one URL.
- every non-empty entry must be a valid HTTP(S) URL.
- edge whitespace around each entry is ignored.
- empty entries created by repeated or trailing commas are ignored.
- URL path, query, and hash are not part of runtime endpoint identity.
- the normalized endpoint identity is the configured URL origin.
- localhost, loopback, and private-network origins are allowed only in this Jellyfin / Emby settings field.

Rows with invalid `serverUrls` are rejected before persistence. Runtime code does not silently skip invalid enabled rows that have already crossed the settings boundary.

Disabled rows may keep empty `serverUrls` and empty `apiKey` values. Disabled rows do not participate in matching or runtime requests.

## Jellyfin / Emby Runtime Matching

`JellyfinEmbyMediaSource` reads enabled complete server rows from `settings.features.jellyfinEmby.config.servers`.

For each enabled row, runtime code parses the ordered `serverUrls` list into normalized endpoints. When extension media context arrives, the media source compares the parsed `pageUrl` and `videoSrc` candidates against configured endpoints.

Matching behavior:

- `blob:<url>` media sources are matched against the URL inside the `blob:` prefix.
- matching uses configured endpoint origin, not path, query, or hash.
- the first matching configured URL in server-list order and URL-list order wins.
- matching a URL authorizes Jellyfin / Emby requests only to that matched configured URL.
- unconfigured localhost, loopback, private-network, and metadata URLs do not match.
- if no Jellyfin / Emby row matches, the media source does not claim the message.

This keeps Jellyfin / Emby local-network access explicit. A malicious ordinary page cannot introduce a new private-network request target by placing a URL in `videoSrc`; the target must already be present in `serverUrls`.

## Jellyfin / Emby API Requests

After a configured URL matches, the matched configured URL is used as the Jellyfin / Emby API base for that runtime interaction.

All URLs in a row share the row's API key and server identity. The user is responsible for listing equivalent addresses that point at the same Jellyfin / Emby server. If a row contains URLs for different servers, the app treats them as one configured server row because that is what the settings express.

Session cache keys remain tied to the server row ID. A settings change clears Jellyfin / Emby media-source runtime state and cached sessions.

Subtitle stream URLs are constructed from the matched configured API base and server-provided item/session metadata. Subtitle requests are never constructed from raw page-provided URL strings.

## Settings UI

The Jellyfin / Emby page keeps the existing split layout and profile-list-style server rows.

The server detail pane contains:

- server URL input with comma-separated multi-URL support
- API key input

The server list summary shows the first configured URL when one URL is present, and a compact multi-URL summary when more than one URL is present.

The URL field uses a local string draft. Invalid comma-separated input stays in the UI draft and is not persisted. The field shows a validation error until the list is empty on a disabled row or every non-empty entry is valid HTTP(S).

## Error Handling

Generic `yt-dlp` URL rejection produces a configuration/runtime error that explains the blocked URL class without leaking secrets from the full URL.

Invalid Jellyfin / Emby `serverUrls` errors identify the server row and the invalid list entry. They do not silently fall back to another URL or accept a partial list.

Jellyfin / Emby network and subtitle-stream failures remain media-source runtime errors. They do not fall through to generic `yt-dlp` subtitle download.

## Testing

Required tests:

- generic media URL resolution does not accept localhost, loopback, private-network, link-local, multicast, metadata, or unknown-site HTTP(S) URLs for `yt-dlp`
- `SubtitleService` rejects direct local and private URLs before resolving or spawning `yt-dlp`
- Jellyfin / Emby settings accept a comma-separated `serverUrls` list containing localhost, loopback, and private-network HTTP(S) URLs
- Jellyfin / Emby settings reject invalid URL entries in `serverUrls`
- the default Jellyfin / Emby settings snapshot uses the final `serverUrls` field
- one Jellyfin / Emby server row can match `localhost:8096`, `127.0.0.1:8096`, and `192.168.1.45:8096`
- when `127.0.0.1:8096` matches, Jellyfin / Emby fetches `/Sessions` and subtitle streams from the matching configured `127.0.0.1:8096` endpoint
- unconfigured private-network URLs are not claimed by Jellyfin / Emby and do not enter generic `yt-dlp`
- disabled Jellyfin / Emby rows do not match
- enabled Jellyfin / Emby rows missing required runtime fields are rejected instead of silently skipped
- the renderer Jellyfin / Emby URL input persists valid comma-separated lists and keeps invalid lists local
- changing Jellyfin / Emby settings clears cached media-source state

Verification should include focused main-process tests for connection URL resolution, subtitle service URL safety, settings sanitization, and Jellyfin / Emby media-source behavior, plus renderer tests for the Jellyfin / Emby settings UI and the normal package typecheck/test commands.
