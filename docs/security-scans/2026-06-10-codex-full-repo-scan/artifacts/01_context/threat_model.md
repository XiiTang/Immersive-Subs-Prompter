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
