# Playback Time Baseline Final State

## Outcome

Playback time now has one source of truth: extension snapshots sampled from `HTMLVideoElement`.

The shared projection helper in `@immersive-subs/contracts` remains the only timestamp math implementation. Extension background records, reconnect replay, popup/dashboard snapshots, and desktop main playback updates all project source snapshots from `updatedAt` to local handling time before exposing them further.

Malformed playback snapshots are contract errors. The extension background rejects playback samples without a valid `updatedAt`, and the projection helper rejects malformed projection inputs instead of substituting local timestamps, zero positions, or default playback rates.

## Desktop Behavior

`ConnectionManager` applies extension playback for `video-context`, `time-update`, and `playback-rate` messages once at socket ingress.

When Jellyfin / Emby matches a media page, `MediaSourceController` handles media-server state, session selection, subtitle loading, and media-source errors. It may mark the message handled so generic/YT-DLP subtitle loading does not run. The extension playback projection has already run before that media-source handling starts.

This keeps Jellyfin / Emby playback time on the same path as generic/YT-DLP playback.

## Jellyfin / Emby Behavior

The Jellyfin / Emby media source no longer emits or owns playback timeline events.

It uses server sessions for:

- Selecting the active session.
- Finding the media source ID needed for subtitle URLs.
- Discovering text subtitle streams.
- Updating media-server session state.

It does not use `/Sessions` playback fields as a desktop playback clock. Session cache timestamps are cache-expiry data only.

## Final Code Shape

The final code contains:

- Extension-owned desktop playback timeline updates.
- Jellyfin / Emby session state for matching and subtitle loading.
- Strict playback sample validation that rejects malformed timestamps instead of fabricating local baselines.
- Desktop duration baselines from the current extension sample, including `null` for unknown duration.
- A regression test proving Jellyfin / Emby media-source handling does not replace extension playback time.

## Verification

Required verification for this area:

```bash
pnpm --filter @immersive-subs/contracts test
pnpm --filter @immersive-subs/extension exec vitest run src/background/tabs/MediaStateStore.test.ts src/background/messaging/ContentMessageRouter.test.ts src/background/desktop/reconnectMediaSync.test.ts
pnpm --filter @immersive-subs/desktop-app exec vitest run --project main src/main/connectionManager.test.ts src/main/features/jellyfinEmbyMediaSource.test.ts src/main/mediaSources/mediaSourceController.test.ts src/main/stateManager.test.ts
pnpm typecheck
pnpm lint:silent-catches
pnpm lint:ui-boundaries
pnpm test
git diff --check
```
