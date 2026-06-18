# Playback Time Baseline Design

## Goal

Playback time has one authoritative sample source: the browser extension's `HTMLVideoElement` snapshot. Every runtime that stores, forwards, replays, or applies playback state projects that snapshot from its `updatedAt` sample timestamp to the local handling time.

The desktop renderer keeps its existing prediction loop. It receives a desktop-side baseline containing projected `currentTime`, `playbackRate`, `duration`, `loop`, and `lastUpdate`.

## Final Architecture

`packages/contracts/src/core/playback.ts` owns the shared projection rule through `projectPlaybackSnapshot()`.
The helper accepts only complete, finite playback samples and rejects malformed input instead of fabricating timestamps or playback defaults.

The projection contract treats these values as distinct:

- `updatedAt`: when `currentTime` was sampled from the media element.
- `currentTime`: media position in milliseconds at `updatedAt`.
- `playbackRate`: source playback speed.
- `paused`: whether the source was paused at `updatedAt`.
- `lastUpdate`: desktop renderer baseline time after projection in the main process.

`sentAt` remains a transport timestamp. It is not a playback sample timestamp.

## Data Flow

```mermaid
flowchart LR
  Video["HTMLVideoElement"] --> Content["Content snapshot\ncurrentTime + updatedAt"]
  Content --> Background["Extension background\ncache/project/forward"]
  Background --> DesktopMain["Desktop main\nproject/apply playback"]
  Jellyfin["Jellyfin / Emby\nsource/session/subtitle matching"] --> DesktopMain
  DesktopMain --> Renderer["Renderer\nexisting prediction loop"]
```

## Extension

The content script reads playback directly from `HTMLVideoElement` and emits:

- `currentTime` in milliseconds.
- `duration` in milliseconds or `null`.
- `playbackRate`.
- `paused`.
- `updatedAt: Date.now()`.
- loop metadata.

The background runtime keeps cached media records on a current background baseline. Popup snapshots and reconnect replay use `projectPlaybackSnapshot()` before exposing cached records.

## Desktop Main

`ConnectionManager` projects all extension playback-bearing messages:

- `video-context`.
- `time-update`.
- `playback-rate`.

For generic/YT-DLP videos, that projection happens inside the normal extension message path before subtitle loading.

For Jellyfin / Emby videos, `MediaSourceController` may mark the message handled to prevent generic subtitle loading, but `ConnectionManager` still applies the same extension playback projection before returning. This keeps Jellyfin / Emby playback time on the exact same timestamp path as generic/YT-DLP playback.

## Jellyfin / Emby

The built-in Jellyfin / Emby media source is not a playback-time source.

It owns only:

- Matching configured server URLs.
- Fetching and caching server sessions for session selection.
- Loading subtitle tracks from the selected session.
- Keeping first-match failures on the media-source path.

It does not emit playback timeline events. Server playback fields are not used to drive the desktop playback clock. The session cache timestamp is only a cache-expiry timestamp.

## Acceptance Criteria

- All playback projection goes through `projectPlaybackSnapshot()`.
- Extension playback snapshots are the only playback timestamp source.
- Malformed playback samples fail at the shared projection boundary instead of falling back to local timestamps or default playback values.
- Jellyfin / Emby media-source handling cannot fall through into generic subtitle loading, but it also cannot replace extension playback time.
- Media-source adapters do not own desktop playback timeline events.
- The renderer prediction loop remains structurally unchanged.
- Focused contracts, extension background, desktop main, typecheck, and repository tests pass.
