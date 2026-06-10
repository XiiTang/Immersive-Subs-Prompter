# Validation Report: USP-CAND-006

## Finding

Page-controlled media URLs can drive desktop yt-dlp requests

## Decision

- Status: reportable
- Severity hypothesis: medium
- Confidence: medium

## Affected Lines

- `apps/extension/src/manifest.ts:57-64`
- `apps/extension/src/video/VideoStateGatherer.ts:18-21`
- `apps/extension/src/background/messaging/ContentMessageRouter.ts:140-149`
- `apps/desktop-app/src/main/connectionManager.ts:669-685`
- `apps/desktop-app/src/main/connectionManager.ts:467-469`
- `apps/desktop-app/src/main/subtitleService.ts:138-143`
- `apps/desktop-app/src/common/ytdlpDefaults.ts:1-2`

## Method And Evidence

Reviewed extension manifest, video state gathering, background routing, connectionManager URL resolution, subtitleService args, and default yt-dlp args. The transport tests passed. Existing connectionManager and subtitleService tests demonstrate unknown-site videoSrc fallback and accepting http://video.local/watch, though subtitleService.test.ts currently fails to load in this workspace because the Electron test mock is not applied before subtitleCacheManager imports app.getPath.

## Dataflow

Page video element currentSrc/src and location.href -> VideoStateGatherer snapshot -> ContentMessageRouter broadcast -> connectionManager resolveVideoUrl returns arbitrary HTTP(S) videoSrc/pageUrl -> subtitleService buildArgs appends URL -> yt-dlp runs with --cookies-from-browser firefox.

## Counterevidence And Proof Gaps

A malicious page or subframe with a qualifying video can trigger the flow when the desktop app is connected. The path crosses from untrusted page content into desktop network/process behavior. Counterevidence: the result is primarily a blind request/subtitle workflow and command injection is suppressed because runCommand uses spawn with an argv array.
