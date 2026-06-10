# Security Review: Immersive-Subs-Prompter

## Scope

- Scan mode: repository-wide Codex Security scan.
- Repository root: `/Users/cq-laptop/Projects/Immersive-Subs-Prompter`.
- Repository-persisted scan bundle: `docs/security-scans/2026-06-10-codex-full-repo-scan`.
- Original transient scan bundle: `/tmp/codex-security-scans/Immersive-Subs-Prompter/529b57e2ed1b_20260610T155830Z`.
- Threat model: generated during Phase 1 and copied to `/tmp/codex-security-scans/Immersive-Subs-Prompter/529b57e2ed1b_20260610T155830Z/artifacts/01_context/threat_model.md`.
- Ranking inputs: 529 file rows in `/tmp/codex-security-scans/Immersive-Subs-Prompter/529b57e2ed1b_20260610T155830Z/artifacts/02_discovery/rank_input.csv` and `/tmp/codex-security-scans/Immersive-Subs-Prompter/529b57e2ed1b_20260610T155830Z/artifacts/02_discovery/deep_review_input.csv`.
- Validation included focused static review, existing focused vitest suites, and one Node fetch redirect probe.
- Exclusions and limitations: no repository source files were modified; no browser iframe harness, malicious extension harness, or live private-network SSRF harness was run. Two existing focused tests failed because Electron app mocks were not active before app.getPath/app.isReady usage.

### Scan Summary

| Field | Value |
|---|---|
| Reportable findings | 9 |
| Severity mix | critical 0, high 1, medium 7, low 1 |
| Confidence mix | high 5, medium 4, low 0 |
| Coverage | 529 ranked rows closed in `/tmp/codex-security-scans/Immersive-Subs-Prompter/529b57e2ed1b_20260610T155830Z/artifacts/03_coverage/worklist_row_closures.jsonl`; high-risk runtime surfaces deeply reviewed |
| Validation mode | Static source review plus focused tests and a local redirect probe |
| Markdown report | `docs/security-scans/2026-06-10-codex-full-repo-scan/report.md` |
| HTML report | `docs/security-scans/2026-06-10-codex-full-repo-scan/report.html` |

## Threat Model

# Immersive Subs Prompter Repository Threat Model

## Overview

Immersive Subs Prompter is a local-first subtitle companion made of three primary runtime surfaces:

- `apps/desktop-app`: an Electron desktop application with a main process, preload bridge, Vue renderer, settings persistence, WebSocket listeners, `yt-dlp` based subtitle retrieval, transcription orchestration, plugin installation, and plugin runtime hosting.
- `apps/extension`: a Chromium/Firefox Manifest V3 browser extension that runs content scripts on all URLs, tracks media state, connects to the desktop WebSocket endpoint, and relays video control commands back to page video elements.
- `packages/contracts`: shared TypeScript transport contracts and URL/network helpers used by the desktop app and extension.

The most security-sensitive assets are local filesystem access from the Electron main process, user settings and plugin configuration, browser page/video context observed by the extension, local network WebSocket connectivity to the desktop app, downloaded plugin packages and manifests, generated plugin repository artifacts, and runtime downloads or invocations such as `yt-dlp`.

The repository is not a hosted multi-tenant service. Most realistic attacker stories involve malicious or compromised web pages seen by the extension, local-network clients that can reach configured desktop listeners, malicious or compromised plugin install/update sources, compromised plugin packages, malformed subtitle/media metadata from remote services, or renderer/plugin code attempting to cross Electron process boundaries.

## Threat Model, Trust Boundaries, and Assumptions

Primary trust boundaries:

- Browser page to extension content script: every page matching `<all_urls>` is attacker-controlled. Page DOM, video metadata, URL, title, timing data, and media state are untrusted inputs. The extension should not leak privileged extension state into the page and should not let page content cause unauthorized desktop control.
- Extension to desktop WebSocket server: messages arriving at `apps/desktop-app/src/main/connectionManager.ts` are untrusted transport input even when they claim `source: "usp-extension"`. `apps/desktop-app/src/main/connectionAuth.ts` is the primary network authentication control. Loopback endpoints require a trusted extension origin; non-loopback endpoints also require a token in the WebSocket URL.
- Desktop renderer to Electron main process: `apps/desktop-app/src/preload.cts` exposes a bounded `window.usp` API through `contextBridge`, and the main process registers IPC handlers under `apps/desktop-app/src/main/ipc/handlers`. Renderer-controlled values are untrusted and must be validated before file, shell, network, settings, plugin, window, or cache operations.
- Plugin source to local runtime: plugin manifests and packages fetched by `apps/desktop-app/src/main/plugins/pluginPackageInstaller.ts` are untrusted until validated. Controls include HTTPS-only fetches, manifest confirmation, package SHA-256 checks, ZIP path traversal rejection, package manifest validation, install-directory replacement with restore on failure, and plugin identity derivation.
- Plugin code to host capabilities: plugin code is untrusted, even for project-maintained plugins, once installed or updated from a remote source. `apps/desktop-app/src/main/plugins/pluginRuntimeHost.ts` runs plugins in an Electron utility process and `pluginSandbox.ts` constrains the runtime surface with explicit permissions, VM string/WASM code-generation disabled, network host allow lists, selected-file allow lists, request timeouts, and provider registration gates.
- Filesystem/user data boundary: settings, plugin registry, plugin installation directories, subtitle caches, and downloaded binaries live under app-controlled user data or resource paths. Inputs that influence paths or file operations must remain inside intended directories and must not permit arbitrary overwrite, deletion, or disclosure.
- External download and execution boundary: `yt-dlp` download/update, plugin package downloads, and remote subtitle/media URLs are outside the trust boundary. Hash/signature validation, protocol restrictions, path normalization, and safe process invocation are the key controls.

Attacker-controlled inputs include page URLs and titles, content-script media observations, WebSocket payload JSON, plugin source URLs entered or selected by the user, remote plugin manifests and ZIP packages, plugin code, plugin settings fields, allowed plugin network hosts/files selected through settings, remote subtitle data fetched through `yt-dlp`, media server adapter messages, and stored extension endpoints/blacklist values.

Operator-controlled inputs include local settings, configured WebSocket listeners and tokens, plugin install confirmation decisions, selected files granted to plugins, subtitle profile rules, keyboard shortcuts, cache settings, release/update choices, and desktop packaging configuration.

Developer-controlled inputs include committed project plugins in `plugins/*`, generated `plugin-repository/*` artifacts, build scripts, tests, docs, and package metadata. Developer-only scripts are lower risk unless they are part of packaging, update generation, plugin distribution, or release automation.

Assumptions:

- The desktop app runs with the current user's OS privileges. Any main-process arbitrary code execution is high impact because it can access local files, launch processes, modify app state, and control trusted plugin/update paths.
- Browser pages are untrusted even when the extension is installed intentionally. The extension has `<all_urls>` visibility, so privacy leaks and confused-deputy message flows matter.
- Installed plugins are user-approved but not inherently trusted. A malicious plugin should be limited to declared capabilities and configured hosts/files.
- Loopback WebSocket access is intended for local extension clients. Non-loopback access is an explicit operator choice and depends on token secrecy.
- Test files, docs, and local development utilities are normally out of runtime scope unless they generate shipped artifacts, control package contents, or encode security-critical assumptions.

## Attack Surface, Mitigations, and Attacker Stories

High-priority runtime attack surfaces:

- WebSocket listener and message handling in `connectionManager.ts`. Important controls are extension-origin verification, non-loopback token validation, JSON parsing, source checks, active tab tracking, URL normalization, and profile/subtitle loading side effects.
- Browser extension content/background messaging. The extension runs on all pages and must keep page-controlled data separated from extension privileges. Desktop commands received over WebSocket should only affect the intended tab/frame and video element.
- Electron preload and IPC handlers. `preload.cts` exposes settings, file-opening, external URL opening, cache, plugin, transcription, and window actions. Main-process handlers must validate types, constrain paths, avoid command injection, avoid unsafe `shell.openExternal` schemes, and prevent renderer-controlled arbitrary filesystem actions.
- Plugin installation and update. `pluginPackageInstaller.ts`, `pluginManifest.ts`, `pluginManager.ts`, and generated `plugin-repository/*` artifacts must prevent manifest/package swap attacks, path traversal in ZIP extraction, plugin identity confusion, unsafe protocols, update rollback failures, and stale enabled-runtime state after failed updates/deletes.
- Plugin runtime sandbox and utility process bridge. `pluginSandbox.ts`, `pluginRuntimeHost.ts`, and `pluginWorkerEntry.ts` must enforce declared permissions on network, file reads, transcription runtime, and provider registration; preserve timeouts; kill faulted workers; and avoid exposing Node/Electron primitives into plugin code.
- Subtitle retrieval, parsing, caching, and transcription. `subtitleService.ts`, `subtitleParser.ts`, `subtitleCacheManager.ts`, `ytDlpManager.ts`, and `transcriptionService.ts` consume remote media metadata and files. Risks include command/process argument injection, cache/path traversal, resource exhaustion, malformed subtitle parsing, privacy leakage through logs, and untrusted content rendered in the Vue UI.
- Settings sanitization and persistence. `SettingsStore.ts` and sanitizers under `apps/desktop-app/src/main/settings/sanitizers` define the boundary between user-editable settings and runtime behavior. Incorrect sanitization can expand network listeners, plugin grants, profile URL rules, cache paths, or UI-driven filesystem access.
- Release, packaging, and update workflow. Electron Forge packaging, ASAR integrity, extension manifest generation, plugin package generation, release-update specs, and dependency overrides affect shipped trust boundaries and supply-chain risk.

Existing mitigations visible in the repository include:

- WebSocket auth token generation and timing-safe comparison for non-loopback endpoints, plus extension-origin checks in `connectionAuth.ts`.
- Preload-based IPC exposure instead of direct renderer access to Electron/Node APIs.
- Manifest validation with exact keys, HTTPS author URLs, relative plugin entry constraints, known permission lists, structured settings schema validation, and app compatibility validation.
- HTTPS-only plugin downloads, manifest re-fetch confirmation at install time, SHA-256 package verification, package manifest validation, ZIP path traversal rejection, and restore-on-failure install replacement.
- Plugin runtime isolation in a utility process plus VM sandbox controls, disabled string/WASM code generation, capability gates, host allow lists, selected-file allow lists, and bounded request timeouts.
- Repository-level lint against empty catches, structured error reporting patterns, and tests around many security-sensitive managers.

Realistic attacker stories:

- A malicious page causes the extension to send crafted page/video metadata. Impact depends on whether desktop URL normalization, subtitle fetching, profile selection, logging, and rendering safely handle the data.
- A local-network attacker tries to connect to a non-loopback desktop listener. A finding is high severity if token checks or origin checks can be bypassed and the attacker can drive subtitle downloads, playback state, or plugin/media-source actions.
- A malicious plugin source presents one manifest during preview and a different package during install/update. Controls should reject manifest changes, identity changes, hash mismatch, and ZIP traversal.
- A plugin with limited permissions attempts to read arbitrary files, fetch arbitrary hosts, register undeclared provider types, hang the runtime, or reach host transcription functionality without permission.
- A compromised renderer or malicious subtitle/plugin-rendered data attempts to call privileged IPC methods with path, URL, or settings payloads that escape intended constraints.
- A malformed subtitle file or media-server message causes parser failure, resource exhaustion, unsafe rendering, or incorrect command dispatch.

Lower-priority or out-of-scope stories:

- Public web server vulnerabilities such as CSRF against a hosted web app are generally not applicable because the product is local desktop plus extension rather than a server-side multi-user application.
- Tenant isolation, RBAC, and server-side session management are normally out of scope unless a plugin or future update system adds remote account semantics.
- Developer-only docs and tests are lower priority unless they generate shipped plugin repository artifacts, release assets, extension manifests, or packaging config.

## Severity Calibration (Critical, High, Medium, Low)

Critical:

- A remote web page, local-network client, or plugin install/update source can achieve arbitrary code execution in the Electron main process or plugin host without user-approved plugin installation.
- A plugin package can escape installation directories and overwrite app/runtime files despite manifest and ZIP validation.
- A compromised update, packaging, or plugin repository path can persistently replace shipped executable code for users without integrity checks.

High:

- Non-loopback WebSocket authentication can be bypassed, allowing an attacker on the network to drive desktop actions or plugin/media-source flows.
- A renderer-to-main IPC handler permits arbitrary file read/write/delete, unrestricted process launch, or unsafe external URL/scheme opening from attacker-controlled renderer data.
- Plugin sandbox permission enforcement can be bypassed to read arbitrary files, access undeclared network hosts, invoke transcription runtime without permission, or obtain Node/Electron primitives.
- A malicious plugin update can replace a different plugin identity or keep a broken/stale runtime enabled after failed rollback.

Medium:

- Malformed remote subtitle/media data causes denial of service, unbounded resource use, cache poisoning inside the app's own directories, or persistent bad state requiring user cleanup.
- Privacy-sensitive page URLs, media titles, tokens, plugin API keys, file paths, or subtitle contents are logged or exposed across extension/desktop/plugin boundaries.
- Extension command routing lets one tab/frame affect another tab's playback without a stronger same-tab or active-source check.
- Settings sanitization mistakes allow unsafe but non-code-executing network listener, profile, cache, shortcut, or plugin grant state.

Low:

- A malformed but local-only setting degrades UI behavior without privilege expansion or data disclosure.
- Test-only or docs-only inputs produce misleading development output but do not ship to runtime artifacts.
- Renderer layout or transcript display issues that do not execute code, leak sensitive data, or cross a trust boundary.

Severity should be adjusted downward when the attack requires explicit local user approval, already-declared plugin permissions, physical/local account access, or developer-only commands that are not part of packaging or runtime. Severity should be adjusted upward when a flaw crosses from page/plugin/renderer input into Electron main-process privileges, local filesystem access, persistent plugin/update state, or non-loopback network control.


## Findings

| # | Finding | Severity | Confidence | Category |
|---|---|---|---|---|
| 1 | [Plugin-controlled transcription config reaches host network and process execution](#1-plugin-controlled-transcription-config-reaches-host-network-and-process-execution) | high | medium | Plugin sandbox escape / host subprocess abuse |
| 2 | [Loopback desktop WebSocket trusts any extension origin without the auth token](#2-loopback-desktop-websocket-trusts-any-extension-origin-without-the-auth-token) | medium | high | Authentication bypass / confused deputy |
| 3 | [Plugin network allowlist is bypassed by fetch redirects](#3-plugin-network-allowlist-is-bypassed-by-fetch-redirects) | medium | high | Server-side request forgery / allowlist bypass |
| 4 | [Manifest file defaults are treated as user-selected readable files](#4-manifest-file-defaults-are-treated-as-user-selected-readable-files) | medium | high | Plugin file permission bypass |
| 5 | [Plugin config strings silently expand network host grants](#5-plugin-config-strings-silently-expand-network-host-grants) | medium | high | Plugin sandbox authorization bypass / SSRF |
| 6 | [Page-controlled media URLs can drive desktop yt-dlp requests](#6-page-controlled-media-urls-can-drive-desktop-yt-dlp-requests) | medium | medium | SSRF / page-to-desktop confused deputy |
| 7 | [All-frames subframes can replace tab-level media state and control routing](#7-all-frames-subframes-can-replace-tab-level-media-state-and-control-routing) | medium | medium | Frame confusion / confused deputy |
| 8 | [yt-dlp updater executes downloaded assets without content verification](#8-yt-dlp-updater-executes-downloaded-assets-without-content-verification) | medium | high | Unverified executable download / supply-chain risk |
| 9 | [Blacklist URL changes are broadcast before blacklist re-evaluation](#9-blacklist-url-changes-are-broadcast-before-blacklist-re-evaluation) | low | medium | Information exposure / privacy leak |

### Confidence Scale

| Label | Meaning |
|---|---|
| high | Direct source, configuration, or runtime evidence supports the finding, with no material unresolved reachability or exploitability blocker. |
| medium | Source evidence supports a plausible issue, but runtime behavior, deployment configuration, role reachability, type constraints, or exploit reliability still need proof. |
| low | Weak or incomplete evidence; included only when follow-up value remains. |

### [1] Plugin-controlled transcription config reaches host network and process execution

| Field | Value |
|---|---|
| Severity | high |
| Confidence | medium |
| Confidence rationale | Static source evidence shows plugin-controlled config reaches host fetch and subprocess arguments; a live yt-dlp command-execution harness was not run in this read-only scan. |
| Category | Plugin sandbox escape / host subprocess abuse |
| CWE | CWE-78 Improper Neutralization of Special Elements used in an OS Command; CWE-284 Improper Access Control |
| Affected lines | `apps/desktop-app/src/main/plugins/pluginSandbox.ts:318-321`; `apps/desktop-app/src/main/plugins/pluginSandbox.ts:484-493`; `apps/desktop-app/src/main/plugins/pluginRuntimeHost.ts:280-284`; `apps/desktop-app/src/main/window/windowController.ts:105-108`; `apps/desktop-app/src/main/transcriptionService.ts:66-69`; `apps/desktop-app/src/main/transcriptionService.ts:94-139`; `apps/desktop-app/src/main/transcriptionService.ts:161-179` |

#### Summary

A plugin with transcriptionRuntime permission can supply the complete TranscriptionConfig object to the host. The host forwards that object into TranscriptionService, where config.ytDlpArgs becomes yt-dlp argv, config.baseUrl receives the uploaded audio and bearer token, and config.fasterWhisperBinary is used as the executable for runCommand.

#### Validation

Reviewed pluginSandbox.ts, pluginWorkerEntry.ts, pluginRuntimeHost.ts, windowController.ts, and transcriptionService.ts. The command `pnpm exec vitest run apps/desktop-app/src/main/plugins/pluginSandbox.test.ts apps/desktop-app/src/main/plugins/pluginRuntimeHost.test.ts apps/desktop-app/src/main/plugins/pluginWorkerEntry.test.ts apps/desktop-app/src/main/plugins/pluginManager.test.ts apps/desktop-app/src/main/plugins/pluginManifest.test.ts apps/desktop-app/src/main/plugins/pluginPackageInstaller.test.ts apps/desktop-app/src/main/plugins/pluginSourceManifests.test.ts` passed with 7 files and 60 tests. `transcriptionService.test.ts` also passed independently. No dedicated exploit harness was run for yt-dlp --exec.

#### Dataflow

Plugin code calls usp.transcriptionRuntime.transcribe(videoUrl, config) -> pluginSandbox hostValueAsync -> pluginRuntimeHost.handleHostCall passes source.config -> windowController transcriptionRuntime calls TranscriptionService.transcribe -> buildArgs splits config.ytDlpArgs and appends videoUrl -> runCommand executes yt-dlp; for faster-whisper, config.fasterWhisperBinary is passed directly to runCommand; for Whisper API, buildTranscriptionUrl(config.baseUrl) receives the audio upload and optional Authorization bearer token.

#### Reachability

The attacker must get a malicious or compromised plugin installed and enabled with transcriptionRuntime permission. That is an in-scope plugin boundary per the threat model. The abuse crosses from sandboxed plugin code into host network and subprocess primitives with the desktop user privileges. Counterevidence: the permission is explicit and plugin installation is user-approved, so this is not unauthenticated remote code execution. It remains reportable because a single host runtime permission grants more authority than the plugin network and process sandbox imply.

#### Severity

High. The impact is host command/process execution or sensitive audio/API token exfiltration from a plugin sandbox boundary. Likelihood is reduced by the need for plugin installation and a declared transcriptionRuntime permission, but the security consequence is stronger than ordinary plugin networking. A live demonstration of yt-dlp command execution would raise confidence; proving yt-dlp cannot execute attacker-controlled commands from the supplied argv would lower severity.

#### Remediation

Do not accept arbitrary TranscriptionConfig from plugins. Bind transcriptionRuntime calls to a named, user-saved transcription profile, filter ytDlpArgs to a safe allowlist, disallow plugin-supplied fasterWhisperBinary, validate baseUrl against an explicit user-approved host list, and add regression tests for rejected --exec, custom binary, and off-allowlist baseUrl values.

### [2] Loopback desktop WebSocket trusts any extension origin without the auth token

| Field | Value |
|---|---|
| Severity | medium |
| Confidence | high |
| Confidence rationale | The auth predicate and existing tests directly assert tokenless loopback acceptance for arbitrary chrome-extension and moz-extension origins. |
| Category | Authentication bypass / confused deputy |
| CWE | CWE-287 Improper Authentication; CWE-441 Unintended Proxy or Intermediary |
| Affected lines | `apps/desktop-app/src/main/connectionAuth.ts:27-42`; `packages/contracts/src/core/network-endpoints.ts:31-35`; `apps/desktop-app/src/main/connectionManager.ts:252-265`; `apps/desktop-app/src/main/connectionManager.ts:331-350`; `apps/desktop-app/src/main/connectionManager.ts:467-469` |

#### Summary

The loopback WebSocket auth path checks only that Origin matches a generic browser-extension URL and then returns true for loopback endpoints. The default endpoint URL also omits the token for loopback, so any local extension-origin client can impersonate the real extension.

#### Validation

Reviewed connectionAuth.ts, network-endpoints.ts, connectionManager.ts, and extension transport code. The focused transport command passed: 4 test files and 16 tests. Existing connectionAuth tests assert arbitrary chrome-extension and moz-extension origins are allowed on loopback without token, web origins are rejected, and non-loopback endpoints require the token.

#### Dataflow

WebSocket handshake Origin -> connectionManager verifyClient -> isAuthorizedDesktopClient -> isTrustedExtensionOrigin generic regex -> isLoopbackHost returns true -> handleSocketMessage accepts source usp-extension messages -> rememberTabSocket and subtitleService.getSubtitles can be driven by the socket payload.

#### Reachability

A malicious installed extension or a local client that can forge an extension-looking Origin can connect to ws://127.0.0.1 without the secret token. Ordinary web origins are rejected and non-loopback endpoints still require a token, so exposure is local/extension rather than internet-wide.

#### Severity

Medium. The issue crosses the browser-extension to Electron desktop boundary and can drive desktop state and network/subtitle side effects, but it is loopback-scoped and requires a malicious local extension or equivalent local client. Pinning the extension id and requiring the token on loopback would lower likelihood significantly.

#### Remediation

Require the shared token on all endpoints, including loopback, and pin accepted Origin values to the configured extension IDs. Add tests proving random extension IDs fail and only the bundled extension ID plus token can connect.

### [3] Plugin network allowlist is bypassed by fetch redirects

| Field | Value |
|---|---|
| Severity | medium |
| Confidence | high |
| Confidence rationale | Static source evidence and a local Node fetch probe show default fetch follows redirects and returns the final unallowed response. |
| Category | Server-side request forgery / allowlist bypass |
| CWE | CWE-918 Server-Side Request Forgery |
| Affected lines | `apps/desktop-app/src/main/plugins/pluginSandbox.ts:466-475`; `apps/desktop-app/src/main/plugins/pluginManager.ts:541-550`; `apps/desktop-app/src/main/plugins/pluginManifest.ts:324-335` |

#### Summary

The plugin sandbox checks the original request host against allowedNetworkHosts, then calls fetch with the default redirect-following behavior. If an allowed host redirects to a disallowed host, the plugin receives the final response body, URL, and headers anyway.

#### Validation

Reviewed pluginSandbox.ts and pluginManager.ts. A local validation artifact at artifacts/05_findings/USP-CAND-003/validation_artifacts/node_fetch_redirect_probe.json shows Node fetch returned status 200, finalUrl /secret, and body internal-response after requesting /redirect. Existing sandbox tests prove direct off-allowlist fetches are blocked before fetch is called.

#### Dataflow

Plugin usp.fetch(input) -> pluginSandbox network.fetch -> getFetchHost(input) checks only initial host -> fetch(input, init) follows redirect -> response.url/bodyText from final host are returned to plugin code.

#### Reachability

The attacker needs an installed plugin with network permission and at least one allowed host that the plugin controls or can cause to redirect. That is a realistic plugin boundary. Counterevidence: plugins with network permission are user-approved, but host allowlists are explicitly intended to confine that permission.

#### Severity

Medium. The bug bypasses a declared sandbox network host control and can reach localhost, LAN, or metadata-style endpoints if an allowed host redirects there. The need for an installed network-capable plugin keeps likelihood below high. A browser/Node fetch mode that prevents redirects or validates final response hosts would lower severity.

#### Remediation

Set redirect: manual for sandbox fetches or validate every redirect hop/final response URL against allowedNetworkHosts. Add a sandbox regression test with a local redirect server to prove redirects to unallowed hosts fail.

### [4] Manifest file defaults are treated as user-selected readable files

| Field | Value |
|---|---|
| Severity | medium |
| Confidence | high |
| Confidence rationale | The source trace is direct and existing plugin tests show readableFiles grants are consumed by the sandbox readFile sink. |
| Category | Plugin file permission bypass |
| CWE | CWE-284 Improper Access Control; CWE-200 Exposure of Sensitive Information |
| Affected lines | `apps/desktop-app/src/main/plugins/pluginManifest.ts:257-261`; `apps/desktop-app/src/main/plugins/pluginManager.ts:477-489`; `apps/desktop-app/src/main/plugins/pluginManager.ts:508-520`; `apps/desktop-app/src/main/plugins/pluginManager.ts:581-590`; `apps/desktop-app/src/main/plugins/pluginSandbox.ts:457-465` |

#### Summary

File setting defaultValue strings from a plugin manifest are copied into plugin config and later become readableFiles. The sandbox then treats those paths as selected files for usp.readFile, even though the user may never have picked that path.

#### Validation

Reviewed manifest default validation, config seeding, getReadableFiles, and pluginSandbox file.read. The plugin-focused vitest group passed. Existing sandbox tests prove unreadable files are denied only when readableFiles is empty and allowed readableFiles are read.

#### Dataflow

Plugin manifest file field defaultValue -> validateSettingsDefaultValue accepts string -> ensurePluginConfig/defaultConfigFromSettings writes config -> getReadableFiles resolves config values for file fields -> pluginSandbox file.read checks readableFiles membership -> fs.readFile(targetPath).

#### Reachability

A malicious plugin must be installed with readSelectedFile and settingsSchema permissions and know or predict a target path. The issue crosses the intended user-selection boundary for local files. Counterevidence: the plugin permission is explicit, but the permission name and sandbox design indicate the file path should come from a user selection, not a manifest default.

#### Severity

Medium. Predictable local file disclosure from a plugin sandbox is materially security-relevant, but exploitation requires plugin installation and an existing predictable file path. A UI-backed selected-file token model would lower likelihood.

#### Remediation

Do not derive readableFiles from manifest defaults. Track file grants as explicit user selections with provenance, ignore file defaultValue for grants, and add tests where a file default path does not authorize usp.readFile until selected by the user.

### [5] Plugin config strings silently expand network host grants

| Field | Value |
|---|---|
| Severity | medium |
| Confidence | high |
| Confidence rationale | The source trace directly shows arbitrary URL-shaped config strings are collected into allowedNetworkHosts before sandbox fetch checks run. |
| Category | Plugin sandbox authorization bypass / SSRF |
| CWE | CWE-918 Server-Side Request Forgery; CWE-284 Improper Access Control |
| Affected lines | `apps/desktop-app/src/main/plugins/pluginManifest.ts:235-249`; `apps/desktop-app/src/main/plugins/pluginManifest.ts:257-261`; `apps/desktop-app/src/main/settings/appSettingsSanitizer.ts:120-127`; `apps/desktop-app/src/main/plugins/pluginManager.ts:541-579`; `apps/desktop-app/src/main/plugins/pluginSandbox.ts:466-475` |

#### Summary

PluginManager derives allowedNetworkHosts from every URL-shaped string found recursively in plugin config, in addition to manifest.network.allowedHosts. Manifest defaults or later config updates can therefore grant network hosts that were never declared in the manifest network block.

#### Validation

Reviewed pluginManifest.ts, appSettingsSanitizer.ts, pluginManager.ts, and pluginSandbox.ts. The plugin-focused vitest group passed. Tests cover derived access grants being pushed to enabled runtimes, and the source shows collectNetworkHostFromString adds any URL.canParse host.

#### Dataflow

Manifest defaults or settings plugins object -> validatePluginSettingsRecordForUpdate accepts current plugin config object -> getAllowedNetworkHosts adds manifest hosts and collectNetworkHosts(config) -> collectNetworkHostFromString adds parsed host -> pluginSandbox fetch permits requests whose initial host is in the derived set.

#### Reachability

The attacker needs a plugin with network permission and control of its manifest defaults or plugin config. Dynamic user-entered server URLs are an intended product workflow, which is counterevidence against suppressing all config-derived hosts. The reportable gap is that the collector is field-agnostic and default-aware, so unrelated strings or manifest-supplied defaults can become grants silently.

#### Severity

Medium. This weakens the sandbox host allowlist and can expose localhost/LAN destinations to network-capable plugins, but it still requires plugin installation and network permission. Restricting derivation to explicit user-edited serverList fields would lower likelihood.

#### Remediation

Only grant hosts from manifest.network.allowedHosts and explicit user-approved serverList fields. Mark manifest-default server URLs as untrusted until confirmed by the user, validate plugin config keys against the manifest schema, and add tests for URL-shaped string/file/textarea defaults that must not become network grants.

### [6] Page-controlled media URLs can drive desktop yt-dlp requests

| Field | Value |
|---|---|
| Severity | medium |
| Confidence | medium |
| Confidence rationale | Static source and tests show arbitrary HTTP(S) media URLs are accepted; a live private-network SSRF harness was not run. |
| Category | SSRF / page-to-desktop confused deputy |
| CWE | CWE-918 Server-Side Request Forgery; CWE-441 Unintended Proxy or Intermediary |
| Affected lines | `apps/extension/src/manifest.ts:57-64`; `apps/extension/src/video/VideoStateGatherer.ts:18-21`; `apps/extension/src/background/messaging/ContentMessageRouter.ts:140-149`; `apps/desktop-app/src/main/connectionManager.ts:669-685`; `apps/desktop-app/src/main/connectionManager.ts:467-469`; `apps/desktop-app/src/main/subtitleService.ts:138-143`; `apps/desktop-app/src/common/ytdlpDefaults.ts:1-2` |

#### Summary

The all-URLs extension reports pageUrl and videoSrc from page DOM to the desktop app. The desktop resolveVideoUrl fallback accepts any HTTP(S) videoSrc or pageUrl and passes it to SubtitleService, which invokes yt-dlp with browser-cookie extraction enabled by default.

#### Validation

Reviewed extension manifest, video state gathering, background routing, connectionManager URL resolution, subtitleService args, and default yt-dlp args. The transport tests passed. Existing connectionManager and subtitleService tests demonstrate unknown-site videoSrc fallback and accepting http://video.local/watch, though subtitleService.test.ts currently fails to load in this workspace because the Electron test mock is not applied before subtitleCacheManager imports app.getPath.

#### Dataflow

Page video element currentSrc/src and location.href -> VideoStateGatherer snapshot -> ContentMessageRouter broadcast -> connectionManager resolveVideoUrl returns arbitrary HTTP(S) videoSrc/pageUrl -> subtitleService buildArgs appends URL -> yt-dlp runs with --cookies-from-browser firefox.

#### Reachability

A malicious page or subframe with a qualifying video can trigger the flow when the desktop app is connected. The path crosses from untrusted page content into desktop network/process behavior. Counterevidence: the result is primarily a blind request/subtitle workflow and command injection is suppressed because runCommand uses spawn with an argv array.

#### Severity

Medium. Page-controlled desktop network fetches plus browser-cookie extraction are meaningful privacy and SSRF risks, but response exfiltration and private-service impact were not proven in the scan. Demonstrating response disclosure from a private endpoint would raise severity; adding private-network and redirect blocking would lower it.

#### Remediation

Before invoking yt-dlp, reject loopback, private, link-local, and metadata hosts unless explicitly allowed by user settings. Bind subtitle downloads to a user-visible top-frame media source, disable browser-cookie extraction for untrusted origins, and add tests for private IPs, localhost, redirects, and iframe sources.

### [7] All-frames subframes can replace tab-level media state and control routing

| Field | Value |
|---|---|
| Severity | medium |
| Confidence | medium |
| Confidence rationale | Static source and focused tests support the frame-confusion path, but no browser harness with competing top-frame and iframe videos was run. |
| Category | Frame confusion / confused deputy |
| CWE | CWE-441 Unintended Proxy or Intermediary |
| Affected lines | `apps/extension/src/manifest.ts:59-64`; `apps/extension/src/background/messaging/ContentMessageRouter.ts:135-149`; `apps/extension/src/background/tabs/TabRegistry.ts:24-31`; `apps/extension/src/background/tabs/MediaStateStore.ts:42-58`; `apps/extension/src/background/desktop/DesktopMessageHandler.ts:21-46` |

#### Summary

The extension injects content scripts into all frames and tracks media state by tabId. Any frame that sends video-context can become the preferred frame for that tab, and later desktop play/pause/seek/loop controls are routed to that preferred frame.

#### Validation

Reviewed manifest.ts, ContentMessageRouter.ts, TabRegistry.ts, MediaStateStore.ts, DesktopMessageHandler.ts, and supporting tests. The transport test command passed with 4 files and 16 tests. Static counterevidence shows tabId comes from Chrome port metadata, so cross-tab spoofing is suppressed; the remaining gap is within the same tab across frames.

#### Dataflow

Subframe content script port -> handlePort captures tabId and frameId -> video-context calls rememberActiveFrame(tabId, frameId) and setState(tabId, patch) -> desktop command receives tabId -> getPreferredFrameId returns the last media frame -> postMessage sends the control command to that frame.

#### Reachability

A third-party iframe or nested same-tab frame with a qualifying video can compete with the top frame when all_frames is enabled. The result is wrong media state, possible subtitle downloads for the frame URL, and controls delivered to the wrong frame. Counterevidence: the attacker cannot choose another tabId from content messages.

#### Severity

Medium. The issue crosses an extension frame boundary and can affect desktop control of media, but impact is same-tab and no cross-tab takeover was found. A browser harness proving hidden third-party iframes can win preferred-frame state would raise confidence.

#### Remediation

Track media by tabId and frameId, prefer top-frame or user-active media, include frameId in desktop messages, and require desktop controls to target the same verified frame that produced the active media snapshot.

### [8] yt-dlp updater executes downloaded assets without content verification

| Field | Value |
|---|---|
| Severity | medium |
| Confidence | high |
| Confidence rationale | The updater source directly downloads release asset bytes, writes them executable, and later uses the path as the yt-dlp binary; checksum/signature verification is absent. |
| Category | Unverified executable download / supply-chain risk |
| CWE | CWE-494 Download of Code Without Integrity Check |
| Affected lines | `apps/desktop-app/src/main/ytDlpManager.ts:69-82`; `apps/desktop-app/src/main/ytDlpManager.ts:124-139`; `apps/desktop-app/src/main/subtitleService.ts:172-180` |

#### Summary

YtDlpManager trusts the latest GitHub release JSON and downloads the selected platform asset without verifying a checksum, signature, or attestation. The downloaded file is chmodded executable and later spawned for subtitle and transcription jobs.

#### Validation

Reviewed ytDlpManager.ts and subtitleService.ts. The ytDlpManager focused test currently fails before the release-fetch assertion because Electron app.isReady is undefined in the isolated test environment, but the static path is direct: fetch release JSON, download browser_download_url, write bytes, chmod 0755, spawn later.

#### Dataflow

GitHub releases/latest JSON -> asset browser_download_url -> downloadBinary fetches bytes -> fs.writeFile and fs.rename to userData/yt-dlp -> ensurePermissions chmod 0755 -> SubtitleService runCommand spawns the binary.

#### Reachability

The path executes during runtime binary refresh. Attackers need compromise of the upstream release, release API/asset delivery, local trust store/TLS, or a comparable supply-chain position. Counterevidence: HTTPS and GitHub asset name selection reduce accidental tampering, but they do not provide executable content integrity.

#### Severity

Medium. The impact is arbitrary user-level code execution if the update channel is compromised, but likelihood depends on a supply-chain compromise rather than a direct app input. Verifying detached signatures or pinned checksums would lower risk.

#### Remediation

Verify yt-dlp releases against a signed checksum or trusted attestation before chmod/execution. Store the verified digest with metadata, reject unexpected asset names and redirects, and add tests that modified bytes or missing signatures are refused.

### [9] Blacklist URL changes are broadcast before blacklist re-evaluation

| Field | Value |
|---|---|
| Severity | low |
| Confidence | medium |
| Confidence rationale | The line-order leak is clear statically; no browser SPA navigation harness was run. |
| Category | Information exposure / privacy leak |
| CWE | CWE-200 Exposure of Sensitive Information |
| Affected lines | `apps/extension/src/monitoring/URLWatcher.ts:18-20`; `apps/extension/src/content/index.ts:72-76`; `apps/extension/src/background/messaging/ContentMessageRouter.ts:92-97`; `apps/desktop-app/src/main/connectionManager.ts:591-598` |

#### Summary

During SPA URL changes, the content script sends page-url-changed to the background before it re-evaluates blacklist rules. A transition into a blacklisted path or hash can therefore leak one URL/title update to desktop state.

#### Validation

Reviewed URLWatcher.ts, content/index.ts, ContentMessageRouter.ts, and connectionManager.ts. The ordering is send first, evaluate blacklist second. Initial blacklisted loads are suppressed, so the leak is limited to active navigation transitions.

#### Dataflow

history/hash/popstate change -> URLWatcher notifyUrlChange -> content handleUrlChanged sends page-url-changed -> background broadcasts -> desktop connectionManager updates pageUrl/title -> evaluateCurrentUrl then stops monitoring if the new URL is blacklisted.

#### Reachability

A page already being monitored can navigate to a newly blacklisted same-origin/path/hash URL. The leak crosses the blacklist privacy boundary but appears limited to one URL/title event. Counterevidence: fully blacklisted initial pages are skipped before monitoring starts.

#### Severity

Low. The impact is narrow privacy exposure of one URL/title update, not code execution or broad data access. A browser harness quantifying repeated redirects or title leakage would refine severity.

#### Remediation

Evaluate blacklist status before sending page-url-changed. If the destination is blocked, stop monitoring and send a redacted stop/end event instead of the URL and title. Add tests for pushState, replaceState, and hashchange into blacklisted URLs.


## Reviewed Surfaces

| Surface | Risk Area | Outcome | Notes |
|---|---|---|---|
| Desktop WebSocket auth and connection manager | Extension-to-desktop auth, token handling, message side effects | Reported | `USP-CAND-002` |
| Extension content/background all-frames routing | Page/frame to desktop media state and control | Reported | `USP-CAND-006`, `USP-CAND-007`, `USP-CAND-009` |
| Plugin sandbox network bridge | Plugin network host allowlist and redirects | Reported | `USP-CAND-003`, `USP-CAND-005` |
| Plugin selected-file bridge | Plugin file grants and readSelectedFile enforcement | Reported | `USP-CAND-004` |
| Plugin transcription runtime bridge | Plugin-to-host transcription and subprocess/network config | Reported | `USP-CAND-001` |
| yt-dlp updater | External executable download/update path | Reported | `USP-CAND-008` |
| Electron preload and settings IPC shell helpers | Renderer to shell.openExternal/openPath | Rejected | No current untrusted renderer call site; word lookup anchors are http/https-filtered; renderer compromise-only path left as hardening note. |
| Plugin package installer | Manifest/package swap, hash, ZIP traversal, path traversal, local file URLs | Rejected | Installer validation and tests cover these paths; no bypass survived. |
| Subtitle process invocation | Shell injection via media URL | Rejected | `spawn(cmd, args)` uses argv without a shell; remaining issue is SSRF/confused-deputy, not shell injection. |
| Docs/tests/generated rows | Runtime exploitability | Not applicable | Closed in row closure ledger unless used as validation evidence. |

## Open Questions And Follow Up

- Build a browser harness for `apps/extension/src/background/messaging/ContentMessageRouter.ts` to reproduce top-frame versus iframe media competition and validate `USP-CAND-006` and `USP-CAND-007` under real extension timing.
- Add a malicious plugin fixture for `apps/desktop-app/src/main/plugins/pluginRuntimeHost.ts` that attempts `transcriptionRuntime.transcribe` with `ytDlpArgs` containing an execution primitive, off-allowlist `baseUrl`, and custom `fasterWhisperBinary`.
- Repair the Electron mock setup for `apps/desktop-app/src/main/subtitleService.test.ts` and `apps/desktop-app/src/main/ytDlpManager.test.ts`, then rerun the subtitle and updater focused groups.
