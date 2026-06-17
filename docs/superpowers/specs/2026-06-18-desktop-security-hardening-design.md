# Desktop Security Hardening Design

## Goal

Close the selected security-hardening work while preserving the product model that explicit user configuration is trusted.

The final app protects code-execution and resource-exhaustion boundaries without turning `yt-dlp` into a sandboxed network proxy and without blocking user-selected local Whisper-compatible services.

This design describes the final state only. It intentionally omits implementation sequencing. The project has not launched, so implementation does not preserve legacy unsafe data, migrate old persisted settings, keep compatibility aliases, or retain transitional fallback behavior.

## Scope

In scope:

- Faster-Whisper app-managed executable download integrity
- Whisper API `baseUrl` validation semantics
- `yt-dlp` network-boundary positioning for subtitle and transcription media retrieval
- process output and subtitle parsing resource limits
- `openPath` renderer-to-main hardening
- custom subtitle cache path hardening
- focused tests for the final behavior

Out of scope:

- a local proxy for all `yt-dlp` network traffic
- enumerating all `yt-dlp` supported sites or final media hosts
- DNS-rebinding or redirect enforcement inside `yt-dlp`
- migration of old cache files, old settings snapshots, or old app-managed binary downloads
- UI for advanced resource-limit tuning

## Trust Model

User-owned settings are trusted product configuration. The app allows users to configure local and LAN Whisper-compatible services, custom cache paths, and app-managed tool paths.

Renderer input is still not trusted as proof of provenance. The main process owns validation, canonicalization, path selection, executable-download verification, and process/resource limits.

Remote media and subtitle data are untrusted. The app does not try to fully police every request that `yt-dlp` makes internally, but it does bound the resources that untrusted media data can consume after it reaches the app.

## Faster-Whisper Executable Integrity

The final app never installs an app-managed Faster-Whisper executable unless the downloaded bytes match trusted metadata.

Each app-managed executable asset has explicit metadata:

```ts
interface FasterWhisperBinaryAsset {
  url: string;
  fileName: string;
  expectedSha256: string;
  allowedFinalHosts: string[];
}
```

The CPU Windows asset uses a stable versioned asset URL rather than a mutable `master` or moving-latest URL. If a stable asset and trusted hash are not available, app-managed download for that variant is disabled and the user must configure a manually installed executable path.

Download behavior:

- fetch the asset URL
- reject non-2xx responses and missing response bodies
- reject final response URLs whose protocol is not HTTPS or whose host is outside `allowedFinalHosts`
- stream bytes to an app-owned temporary file
- compute SHA-256 over the completed temporary file
- reject hash mismatch and remove the temporary file
- rename the temporary file into the executable path only after verification succeeds
- apply executable permissions only after verification succeeds

Existing downloaded binaries are not trusted through migration logic. If an executable is already present at the app-managed target path, the final app verifies it against the current trusted metadata before reporting the app-managed binary as ready. A missing, unverified, or mismatched executable is not used as an app-managed binary.

## Whisper API Base URL Semantics

Whisper API `baseUrl` is explicit user configuration. The final app allows HTTP(S) URLs for user-selected Whisper-compatible endpoints, including localhost, loopback, private IPv4 ranges, and LAN hostnames.

Validation for `provider: "whisper-api"` requires:

- `baseUrl` is non-empty
- `baseUrl` parses as a URL
- protocol is `http:` or `https:`
- the value can be normalized to a stable URL string

Validation does not reject localhost, loopback, private-network, or LAN endpoints for Whisper API. This preserves support for local OpenAI-compatible gateways, local Whisper servers, reverse proxies, and user-operated LAN services.

The final app does not use the public-only URL guard for Whisper API `baseUrl`. The public-only helper remains appropriate for generic untrusted media URLs, but user-configured API endpoints use a separate HTTP(S)-only validator with a name that reflects its semantics.

## `yt-dlp` Network Boundary

`yt-dlp` is treated as a general-purpose media extractor and downloader. The final app does not claim to control every network request that `yt-dlp` makes after it receives an entry URL.

Final behavior:

- the app keeps existing basic URL and argument controls before invoking `yt-dlp`
- the app does not enumerate all supported `yt-dlp` sites
- the app does not maintain a final media-host allowlist
- the app does not add a local proxy in this pass
- the app does not claim SSRF-complete protection for `yt-dlp` internal redirects, manifests, extractor API calls, or media segment fetches

This is an explicit product tradeoff. `yt-dlp` compatibility depends on allowing extractors to follow site-specific URL chains. Network containment for `yt-dlp` would require a separate proxy, process sandbox, firewall, or OS-level egress policy design.

## Resource Limits

The final app keeps long-video workflows working. Limits are intentionally broad and target abnormal resource exhaustion, not normal long subtitles.

### Subtitle Content Limit

Subtitle file reads and parser entry points enforce a 100 MiB text limit.

```ts
const MAX_SUBTITLE_TEXT_BYTES = 100 * 1024 * 1024;
```

Before reading a subtitle file, the service checks file size. If the file is larger than the limit, parsing is skipped and the user receives a clear error.

`parseSubtitle` also validates the byte size of direct string input so internal callers cannot bypass the file-size check. The parser does not impose a normal-video duration limit.

### Parser Shape Limits

Parser limits are broad defensive caps:

- maximum input text bytes: 100 MiB
- maximum parsed line count: 1,000,000
- maximum emitted cue count: 1,000,000

These limits are high enough for normal long-form usage and exist to prevent pathological inputs from consuming unbounded memory.

### Process Output Limit

`runCommand` stores bounded stdout and stderr buffers.

```ts
const MAX_PROCESS_STDOUT_BYTES = 8 * 1024 * 1024;
const MAX_PROCESS_STDERR_BYTES = 8 * 1024 * 1024;
```

If either stream exceeds its limit, the child process is terminated and the operation fails with a resource-limit error. This does not limit media duration, downloaded media size, or subtitle length. It only prevents abnormal process output from growing memory without bound.

### Timeout Policy

The final app does not add an aggressive wall-clock timeout for `yt-dlp` subtitle retrieval or transcription audio extraction. Long videos and slow networks remain supported.

The process-output and subtitle-text limits are the required resource controls for this pass.

## `openPath` Hardening

The final preload does not expose a generic `openPath(targetPath)` method that accepts arbitrary renderer-provided paths.

Renderer code uses narrow, main-owned operations:

- `openCacheFolder()`
- `openFasterWhisperBinaryFolder()`
- `openFasterWhisperModelsFolder(configId?)`

The main process resolves the path for each operation from current settings, app-managed Faster-Whisper paths, or validated user configuration. Renderer code may identify a setting or config record, but it does not send the raw filesystem path to open.

The main process canonicalizes the selected path before creating/opening it. Invalid, empty, or unresolved paths return a structured error. `shell.openPath` remains the operating-system opener, but only after main-process path resolution.

## Cache Path Hardening

The final app keeps custom cache directories as user-controlled configuration. Local, external, and LAN-mounted paths are allowed when the user configures them.

The cache manager canonicalizes the configured cache path before use. Empty cache path means the app-owned default cache directory.

Cache files use an app-owned filename prefix:

```text
usp-cache-<sha256>.json
```

Cleanup and stats only operate on files matching that prefix and expected JSON cache-entry shape. The cache manager does not delete arbitrary `.json` files in a user-selected directory.

Remote URL-derived data never becomes a path component. Cache keys remain SHA-256-derived.

No migration is provided for old cache filenames. Because the project has not launched, final behavior can ignore old cache files and write only the new prefixed cache format.

## Error Handling

Download integrity failures report that the binary could not be verified. The error does not offer an unsafe continue-anyway path.

Whisper API `baseUrl` errors distinguish invalid URL syntax from unsupported protocols. Local and LAN HTTP(S) URLs are valid.

Resource-limit errors identify the exceeded limit class:

- process stdout too large
- process stderr too large
- subtitle file too large
- subtitle parser input too large
- subtitle parser line or cue cap exceeded

Path-opening errors identify the requested operation, not an arbitrary renderer-supplied path channel.

Cache cleanup skips files outside the final cache filename/shape instead of treating all `.json` files as cache-owned.

## Testing

Required Faster-Whisper tests:

- app-managed binary download rejects unexpected final hosts
- app-managed binary download rejects SHA-256 mismatch
- app-managed binary download removes temporary files after verification failure
- app-managed binary download renames into place only after verification succeeds
- unavailable asset metadata disables app-managed download instead of installing unverified bytes

Required Whisper API URL tests:

- Whisper API config accepts `https://api.openai.com/v1`
- Whisper API config accepts `http://127.0.0.1:8080/v1`
- Whisper API config accepts `http://localhost:8080/v1`
- Whisper API config accepts `http://192.168.1.20:8080/v1`
- Whisper API config rejects non-HTTP(S) schemes
- transcription builds the Whisper endpoint from the HTTP(S)-only validator, not from the public-only media URL guard

Required `yt-dlp` boundary tests:

- subtitle and transcription `ytDlpArgs` policy remains enforced
- media URL validation tests continue to cover the product's current generic media-entry rules
- no test claims that all internal `yt-dlp` final destinations are allowlisted

Required resource-limit tests:

- subtitle service rejects a subtitle file larger than 100 MiB before reading it
- parser rejects direct input larger than 100 MiB
- parser rejects pathological inputs above line or cue caps
- `runCommand` terminates and fails when stdout exceeds 8 MiB
- `runCommand` terminates and fails when stderr exceeds 8 MiB
- normal subtitle service and parser tests still pass with ordinary SRT/VTT content

Required path-hardening tests:

- preload no longer exposes generic `openPath`
- renderer settings use narrow open-folder APIs
- main process opens cache folder through `cacheManager.getCachePath()`
- main process opens Faster-Whisper binary/model folders through Faster-Whisper manager paths or validated config references
- arbitrary renderer-provided raw paths do not cross IPC for path opening

Required cache tests:

- cache writes use `usp-cache-<sha256>.json`
- cache stats count only matching cache-owned files
- cleanup deletes only expired matching cache-owned entries
- cleanup skips unrelated `.json` files in the configured cache directory
- custom cache path remains allowed and canonicalized

Verification should include focused desktop-app tests for Faster-Whisper manager, transcription config validation, transcription service, subtitle service, subtitle parser, cache manager, preload IPC surface, and settings UI call sites, plus the normal desktop-app typecheck/test command.
