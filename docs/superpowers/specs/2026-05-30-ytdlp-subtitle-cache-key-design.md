# Ytdlp Subtitle Cache Key Design

## Goal

Ytdlp subtitle cache identity includes the effective yt-dlp subtitle download arguments. The same video URL downloaded with different active profile `ytDlpArgs` must not hit the same ytdlp subtitle cache entry or share the same in-flight download job.

This project has not shipped. The final implementation must not include compatibility, migration, legacy cache reads, legacy cache rejection layers, transition layers, or cleanup logic for old cache keys.

## Cache Identity

`SubtitleService` owns the ytdlp-specific cache variant because it already owns the active profile lookup and yt-dlp argument construction.

The ytdlp cache variant is derived from the effective argument line:

- Use the active profile `ytDlpArgs` when its trimmed value is non-empty.
- Use `DEFAULT_YTDLP_ARGS` when the active profile argument line is empty.
- Normalize with the existing `splitArgs()` parser.
- Hash `JSON.stringify(normalizedArgs)` with sha256 and use the hash as the cache variant.

Whitespace and quote-only differences that produce the same parsed argument array share a cache variant. Different argument order remains a different variant because yt-dlp command-line order can affect behavior.

Profile id is not part of the ytdlp cache identity. Two profiles with the same effective `ytDlpArgs` can share the same cached subtitle download.

Subtitle display settings, subtitle priority settings, cookies file contents, and yt-dlp binary version are not part of this cache identity. The cache identity is limited to the video URL, cache source, and effective yt-dlp argument signature.

## Cache Manager Shape

`SubtitleCacheManager.get()` and `SubtitleCacheManager.set()` accept an optional cache variant string.

Without a variant, cache behavior is unchanged for media server subtitles, transcription subtitles, and any call site that does not need an extra identity dimension.

With a variant, the internal cache key is computed from structured identity data containing:

- `source`
- `url`
- `variant`

The cache manager does not parse or understand ytdlp arguments. It treats `variant` as an opaque identity component.

Cache entries continue to store the redacted source URL and subtitle data. They do not need to persist the variant as a separate data field because the variant is already represented by the cache file key.

## Subtitle Service Behavior

`SubtitleService.getSubtitles(videoUrl)` computes the ytdlp cache variant before checking cache or in-flight work.

Cache reads and writes use:

- `cacheManager.get(videoUrl, "ytdlp", variant)`
- `cacheManager.set(videoUrl, "ytdlp", result, variant)`

The in-flight download map uses both `videoUrl` and the same ytdlp variant. Two requests for the same URL with the same effective arguments share one in-flight job. Two requests for the same URL with different effective arguments run as separate jobs and produce separate cache entries.

`downloadSubtitles()` continues to build the actual yt-dlp command from the same effective argument line used for the cache variant.

## Out Of Scope

This change does not alter the current same-URL reload behavior in `ConnectionManager`. If the same normalized URL is already loaded and the connection layer skips subtitle reload, that remains a separate behavior decision.

This change does not inspect individual yt-dlp flags such as `--sub-lang`, `--all-subs`, `--write-subs`, `--write-auto-subs`, `--sub-format`, or cookies-related flags. The complete effective argument array is the identity.

This change does not migrate old cache files, read old cache keys, delete old cache files, or add fallback reads from previous key formats.

## Tests

Tests verify final behavior directly:

- `SubtitleCacheManager` stores distinct entries for the same URL and source when variants differ.
- `SubtitleCacheManager` preserves existing behavior when no variant is supplied.
- `SubtitleService` uses different ytdlp cache variants for the same URL when active profile `ytDlpArgs` differ.
- `SubtitleService` uses the same ytdlp cache variant for argument lines that parse to the same array.
- `SubtitleService` uses `DEFAULT_YTDLP_ARGS` for an empty active profile argument line.
- `SubtitleService` does not share an in-flight job for the same URL when ytdlp variants differ.

Verification commands:

```bash
pnpm --filter @immersive-subs/desktop-app test:renderer -- subtitleCacheManager
pnpm --filter @immersive-subs/desktop-app test:renderer
pnpm --filter @immersive-subs/desktop-app typecheck
```
