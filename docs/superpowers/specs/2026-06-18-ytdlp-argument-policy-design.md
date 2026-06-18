# yt-dlp Argument Policy Design

## Goal

Make the desktop app's user-configurable yt-dlp argument policy a real blacklist policy.

The final behavior is:

- User-configured yt-dlp arguments are accepted unless they match a denied option or a forbidden positional argument shape.
- `--cookies` and `--cookies-from-browser` are allowed for sites that need authenticated browser or cookie-file access.
- The app still owns the output template and target media URL.
- No compatibility layer, migration path, or legacy setting behavior is preserved. The product has not launched, so only the final current shape is supported.

## Scope

This design covers the desktop app's yt-dlp argument validation for:

- Subtitle extraction profile settings.
- Transcription yt-dlp settings.
- Settings sanitization before persistence.
- Runtime validation before invoking yt-dlp.

Out of scope:

- Changing subtitle cache storage.
- Changing the per-run temporary yt-dlp working directory.
- Changing yt-dlp binary download or update behavior.
- Adding compatibility or migration handling for previously saved invalid argument strings.

## Final Policy

`apps/desktop-app/src/main/ytDlpArgPolicy.ts` owns a single policy for user-configured yt-dlp arguments. The policy no longer has separate subtitle and transcription allowlists.

The parser remains responsible for shell-like splitting, including quotes and escaped characters. Validation then applies these final rules:

- Empty argument lines are rejected by the existing callers before policy validation.
- Any denied option is rejected.
- Any raw positional token is rejected.
- Long options with values must use inline assignment form: `--option=value`.
- Long options without inline values are accepted as flags.
- Values containing spaces must quote the whole inline assignment, for example `--option="value with spaces"`.
- Short options are accepted unless they match a denied short option. Denied short options reject both separated and attached forms, including `-o`, `-o=...`, `-o...`, `-P`, `-P=...`, and `-P...`.
- Unknown yt-dlp options are accepted when they are not denied.

This keeps the project out of the business of tracking yt-dlp's full option surface. Users can pass normal yt-dlp options without waiting for the app to add them to an allowlist.

## Denied Options

The final blacklist contains options that would break app-owned file boundaries, app-owned target URL handling, or command execution boundaries:

- `-o`
- `--output`
- `-P`
- `--paths`
- `--exec`
- `--exec-before-download`
- `--config-location`
- `--ignore-config`
- `--external-downloader`
- `--external-downloader-args`
- `--use-postprocessor`
- `--download-archive`
- `--write-info-json`
- `--write-description`
- `--write-thumbnail`

`--cookies` and `--cookies-from-browser` are not denied.

Allowed examples:

```text
--cookies=/Users/me/cookies.txt
--cookies-from-browser=chrome
--extractor-args=youtube:player_client=default
--sub-lang=en.*,zh-Hans.*
--sub-format=srt/best
--audio-format=wav
--audio-quality=32K
--postprocessor-args="-ac 1 -ar 16000"
```

Rejected examples:

```text
-o /tmp/out.%(ext)s
--output=/tmp/out.%(ext)s
--paths=/tmp
--exec=sh
https://attacker.example/watch
--skip-download https://attacker.example/watch
```

## App-Owned Invocation Boundary

User settings supply only the configurable yt-dlp arguments.

Subtitle and transcription services continue to append the app-owned output template and target URL:

```ts
[
  ...ytDlpArgs,
  "-o",
  baseOutput,
  videoUrl
]
```

The user-configured argument string cannot set the output path or provide another target URL. The app remains responsible for:

- Creating the per-run working directory.
- Choosing the output basename.
- Passing the current media URL.
- Reading produced subtitle or audio files from that run's working directory.
- Cleaning up the working directory after the run.

## Runtime And Cache Shape

The subtitle cache remains a final-result cache. It stores parsed `SubtitleLoadResult` data keyed by URL, source, and normalized yt-dlp argument variant.

The per-run temporary directory remains a yt-dlp execution workspace. It is used only when the final-result cache misses. After yt-dlp completes, the app parses files from that isolated directory, writes the parsed result to the cache when applicable, and removes the temporary directory.

The final cache/workspace behavior is:

```text
cache hit:
  return parsed cached result

cache miss:
  create isolated run directory
  invoke yt-dlp with app-owned output template and URL
  parse produced files
  write parsed result cache
  remove isolated run directory
```

## Defaults

Product-owned default yt-dlp argument strings use inline values where a value is needed.

Final default examples:

```text
--skip-download --write-subs --write-auto-subs --all-subs --no-playlist
--skip-download --write-subs --write-auto-subs --sub-lang=en.*,zh-Hans.* --sub-format=srt/best
--extract-audio --audio-format=wav --audio-quality=32K --postprocessor-args="-ac 1 -ar 16000"
```

Because the product has not launched, saved old settings that use separated option values do not need migration support.

## Error Handling

Policy errors remain explicit and early:

- Denied options report `cannot use yt-dlp option <option>`.
- Raw positional tokens report `cannot include positional yt-dlp argument`.
- Empty settings continue to report the existing non-empty setting errors from callers.

Validation still runs both before settings are persisted and before yt-dlp is invoked.

## Tests And Acceptance Criteria

Required final tests:

- Default subtitle arguments pass policy validation.
- Default transcription arguments pass policy validation.
- Preset profile subtitle arguments pass settings validation.
- Blacklisted output, path, exec, config, external downloader, postprocessor, archive, and extra-write options are rejected.
- `--cookies=/path/to/cookies.txt` is accepted.
- `--cookies-from-browser=chrome` is accepted.
- Unknown non-denied options are accepted.
- Raw URL and raw positional tokens are rejected.
- Runtime subtitle and transcription services reject unsafe args before resolving or invoking yt-dlp.
- Settings sanitization rejects unsafe args before persistence.

Acceptance criteria:

- `ytDlpArgPolicy` contains no subtitle/transcription allowlist.
- `--cookies` and `--cookies-from-browser` are not blacklisted.
- App-owned `-o <baseOutput>` and `videoUrl` appending remains unchanged.
- Subtitle cache behavior remains a final-result cache.
- Per-run temporary directory behavior remains unchanged.
- Focused desktop app tests pass.
- Desktop app typecheck passes.
