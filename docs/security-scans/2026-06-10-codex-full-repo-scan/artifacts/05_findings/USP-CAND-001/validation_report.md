# Validation Report: USP-CAND-001

## Finding

Plugin-controlled transcription config reaches host network and process execution

## Decision

- Status: reportable
- Severity hypothesis: high
- Confidence: medium

## Affected Lines

- `apps/desktop-app/src/main/plugins/pluginSandbox.ts:318-321`
- `apps/desktop-app/src/main/plugins/pluginSandbox.ts:484-493`
- `apps/desktop-app/src/main/plugins/pluginRuntimeHost.ts:280-284`
- `apps/desktop-app/src/main/window/windowController.ts:105-108`
- `apps/desktop-app/src/main/transcriptionService.ts:66-69`
- `apps/desktop-app/src/main/transcriptionService.ts:94-139`
- `apps/desktop-app/src/main/transcriptionService.ts:161-179`

## Method And Evidence

Reviewed pluginSandbox.ts, pluginWorkerEntry.ts, pluginRuntimeHost.ts, windowController.ts, and transcriptionService.ts. The command `pnpm exec vitest run apps/desktop-app/src/main/plugins/pluginSandbox.test.ts apps/desktop-app/src/main/plugins/pluginRuntimeHost.test.ts apps/desktop-app/src/main/plugins/pluginWorkerEntry.test.ts apps/desktop-app/src/main/plugins/pluginManager.test.ts apps/desktop-app/src/main/plugins/pluginManifest.test.ts apps/desktop-app/src/main/plugins/pluginPackageInstaller.test.ts apps/desktop-app/src/main/plugins/pluginSourceManifests.test.ts` passed with 7 files and 60 tests. `transcriptionService.test.ts` also passed independently. No dedicated exploit harness was run for yt-dlp --exec.

## Dataflow

Plugin code calls usp.transcriptionRuntime.transcribe(videoUrl, config) -> pluginSandbox hostValueAsync -> pluginRuntimeHost.handleHostCall passes source.config -> windowController transcriptionRuntime calls TranscriptionService.transcribe -> buildArgs splits config.ytDlpArgs and appends videoUrl -> runCommand executes yt-dlp; for faster-whisper, config.fasterWhisperBinary is passed directly to runCommand; for Whisper API, buildTranscriptionUrl(config.baseUrl) receives the audio upload and optional Authorization bearer token.

## Counterevidence And Proof Gaps

The attacker must get a malicious or compromised plugin installed and enabled with transcriptionRuntime permission. That is an in-scope plugin boundary per the threat model. The abuse crosses from sandboxed plugin code into host network and subprocess primitives with the desktop user privileges. Counterevidence: the permission is explicit and plugin installation is user-approved, so this is not unauthenticated remote code execution. It remains reportable because a single host runtime permission grants more authority than the plugin network and process sandbox imply.
