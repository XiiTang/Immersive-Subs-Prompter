# Media URL SSRF and Jellyfin / Emby URLs Final Plan

This document records the implemented final state. It is not an execution script.

## Final State

Generic subtitle loading treats extension media URLs as untrusted page input. The desktop main process resolves a media URL for `yt-dlp` only when the extension-reported site is one of the supported generic sites and the page URL host is that site's exact domain or subdomain:

- `youtube` -> `youtube.com`
- `bilibili` -> `bilibili.com`
- `douyin` -> `douyin.com`

The generic path does not use unknown-site `pageUrl` or `videoSrc` values to start desktop network requests. `SubtitleService` validates the resolved URL again before invoking `yt-dlp` and rejects local, private, link-local, multicast, reserved, and metadata-service targets.

Jellyfin / Emby uses the built-in feature settings at `settings.features.jellyfinEmby`. A server row has one final endpoint field:

```ts
serverUrls: string;
```

`serverUrls` is a comma-separated list of equivalent HTTP(S) origins for that same configured server. Localhost, loopback, and LAN URLs are allowed only in this explicit Jellyfin / Emby settings field.

At runtime, `JellyfinEmbyMediaSource` matches extension `pageUrl` or `videoSrc` candidates against the configured origins. The first matching configured URL is used as `apiBaseUrl` for Jellyfin / Emby session, item, and subtitle requests. Raw page-provided URLs are never used to construct Jellyfin / Emby API URLs.

After a Jellyfin / Emby URL matches, network and subtitle-stream failures remain on the media-source path. A first matched `video-context` failure emits media-source state plus the Jellyfin / Emby error, so the connection manager does not continue into generic URL parsing.

## Source Map

- `apps/desktop-app/src/common/jellyfinEmbyServerUrls.ts`: shared comma-separated URL parser and validator.
- `apps/desktop-app/src/main/settings/appSettingsSanitizer.ts`: final settings validation for `serverUrls`.
- `apps/desktop-app/src/main/features/jellyfinEmbyMediaSource.ts`: configured-origin matching and matched API-base requests.
- `apps/desktop-app/src/main/connectionManager.ts`: supported-site host binding for generic media URL resolution.
- `apps/desktop-app/src/main/networkUrlSafety.ts`: public HTTP(S) URL guard for generic `yt-dlp`.
- `apps/desktop-app/src/main/subtitleService.ts`: direct pre-`yt-dlp` URL safety check.
- `apps/extension/src/video/VideoStateGatherer.ts`: exact-or-subdomain site classification in the extension.
- `apps/desktop-app/src/renderer/components/settings/JellyfinEmbyFeatureSettings.vue`: final Jellyfin / Emby settings UI with local invalid URL-list drafts.

## Verification

Focused verification:

```bash
pnpm --filter @immersive-subs/desktop-app exec vitest run --project main src/main/settings/jellyfinEmbyServerUrls.test.ts src/main/settings/appSettingsSanitizer.test.ts src/main/features/jellyfinEmbyMediaSource.test.ts src/main/connectionManager.test.ts src/main/networkUrlSafety.test.ts src/main/subtitleService.test.ts src/main/mediaSources/mediaSourceController.test.ts
pnpm --filter @immersive-subs/extension exec vitest run src/video/VideoStateGatherer.test.ts
pnpm --filter @immersive-subs/desktop-app exec vitest run --project jsdom src/renderer/components/settings/SettingsFeatures.test.ts src/renderer/stores/desktop.test.ts src/renderer/i18nCoverage.test.ts
pnpm --filter @immersive-subs/desktop-app exec vitest run --project browser src/renderer/components/settings/SettingsFeatures.browser.test.ts
```

Package verification:

```bash
pnpm --filter @immersive-subs/desktop-app test:app
pnpm --filter @immersive-subs/desktop-app typecheck:app
pnpm --filter @immersive-subs/extension test:app
pnpm --filter @immersive-subs/extension typecheck:app
pnpm lint:ui-boundaries
git diff --check
```

Residue checks should confirm active source has no old Jellyfin / Emby endpoint field, no removed plugin-platform code path, and no execution-stage task markers in this final-state plan.
