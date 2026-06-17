# yt-dlp and External URL Security Design

## Goal

Close the current P1/P2 security work selected for this pass:

- renderer-controlled `ytDlpArgs` must not be able to activate command execution, arbitrary output paths, config-file loading, external downloaders, or other side-effecting `yt-dlp` capabilities.
- the renderer must no longer have a generic `openExternal` bridge that can hand arbitrary URL schemes to the operating system.

This design describes the final state only. The project has not launched, so implementation does not preserve legacy unsafe settings, add compatibility aliases, migrate old persisted values, or keep transitional fallbacks.

## Scope

In scope:

- profile subtitle `ytDlpArgs`
- transcription `ytDlpArgs`
- `yt-dlp` argv construction in subtitle download and transcription audio download
- removal of the renderer-exposed generic `openExternal` IPC surface
- tests that prove blocked arguments and external URL capabilities cannot cross the renderer-to-main boundary

Out of scope:

- extension media URL SSRF filtering
- Jellyfin / Emby server URL matching or localhost behavior
- subtitle cache path containment
- release workflow command injection
- Faster-Whisper executable path, model directory, or binary integrity
- generic `openPath`
- adding word-lookup external link support

## yt-dlp Argument Policy

The final app keeps `ytDlpArgs` as a string setting, but the main process treats the string as untrusted input. Every `ytDlpArgs` value is parsed with the existing shell-like argv parser and then validated against a context-specific allowlist plus a shared denylist. Unknown options and positional arguments are rejected.

Validation happens in the main process before settings are accepted and again before a `yt-dlp` command is built. Runtime command construction never trusts renderer-side UI checks.

### Shared Rules

The validator accepts only option tokens and option values expected by the selected policy. It rejects:

- positional arguments; the app appends the media URL itself
- `-o`, `--output`, `-P`, `--paths`, and other output-location controls
- `--exec`, `--exec-before-download`, and command execution options
- `--config-location`, `--ignore-config`, and config-file controls
- `--external-downloader` and `--external-downloader-args`
- `--use-postprocessor` and arbitrary postprocessor selection
- `--download-archive`, `--write-info-json`, `--write-description`, `--write-thumbnail`, and other unmanaged file-writing options
- `--cookies`, `--cookies-from-browser`, and credential-reading options
- all unrecognized short or long options

The shared denylist remains explicit even though unknown options are already rejected. It documents the security boundary and prevents future allowlist changes from accidentally enabling dangerous option families.

### Subtitle Policy

Profile subtitle downloads allow the product's subtitle-focused options:

- `--skip-download`
- `--write-subs`
- `--write-auto-subs`
- `--all-subs`
- `--no-playlist`
- `--sub-lang <value>`
- `--sub-format <value>`
- `--convert-subs <srt|vtt>`

The default subtitle argument string remains valid. A blank string still means the product default. A non-blank invalid string is rejected instead of silently falling back.

### Transcription Policy

Transcription audio downloads allow only the product's audio extraction shape:

- `--extract-audio`
- `--audio-format <wav|mp3|m4a|aac|webm|flac|opus|ogg>`
- `--audio-quality <value>`
- `--no-playlist`
- `--postprocessor-args "-ac 1 -ar 16000"`

`--postprocessor-args` is not generally allowlisted. The only accepted value is the exact mono 16 kHz normalization used by the product default. Arbitrary ffmpeg or postprocessor arguments are rejected.

The default transcription argument string remains valid. A blank string still means the product default. A non-blank invalid string is rejected instead of silently falling back.

## Settings and Runtime Behavior

Profile updates and transcription config updates reject invalid `ytDlpArgs` with a clear validation error. Runtime services also validate immediately before command construction so direct internal callers and future code paths cannot bypass the policy.

`SubtitleService` and `TranscriptionService` receive already parsed, validated `yt-dlp` argv fragments. They append app-owned output paths and the media URL after validation. User-controlled settings cannot override the app-owned output path or insert an additional media URL.

The UI may continue to use textareas for `ytDlpArgs`. The renderer does not decide whether an argument is safe; it only displays the persisted value or the validation error returned by the main process.

## External URL Opening

The final renderer API does not expose `window.usp.openExternal`.

The main process does not register `usp:open-external`. Renderer code cannot invoke a generic external URL opener through IPC.

Release downloads continue to use the existing narrow `openReleaseDownload` API. That path is not a generic renderer bridge: the main process owns the release URL decision and requires HTTPS before handing a URL to the operating system.

Word Lookup result content does not open external links in this final state. Clicking anchors inside the Word Lookup window is inert. If external word-lookup links become a product requirement later, they must be added as a new narrow API with main-process scheme and host validation.

The subtitle priority regex documentation link affordance is removed from settings. The settings UI does not need a replacement external documentation action in this pass.

## Error Handling

Invalid `ytDlpArgs` errors identify the rejected option family without echoing sensitive command contents unnecessarily. Runtime failures caused by invalid arguments are treated as configuration errors, not as `yt-dlp` process failures.

Removing generic `openExternal` removes the corresponding `{ ok, error }` IPC result path. Existing release-download errors continue to surface through `openReleaseDownload`.

## Testing

Required tests:

- subtitle `ytDlpArgs` accepts the current default string.
- transcription `ytDlpArgs` accepts the current default string.
- subtitle and transcription settings reject `--exec`, `--exec-before-download`, `--config-location`, `--output`, `-o`, `--paths`, `--external-downloader`, `--cookies-from-browser`, and unknown options.
- subtitle and transcription services reject invalid `ytDlpArgs` before invoking `runCommand`.
- app-owned `-o <baseOutput>` and media URL remain appended by the service, not supplied by settings.
- preload no longer exposes `openExternal`.
- `settingsHandlers` no longer registers `usp:open-external`.
- Word Lookup link clicks do not call an external opener.
- release download tests continue to prove HTTPS-only release opening through `openReleaseDownload`.

Verification commands should include focused desktop-app tests for settings sanitization, subtitle service, transcription service, Word Lookup window behavior, release service behavior, and a full typecheck.
