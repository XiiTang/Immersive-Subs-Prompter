# Remediation - 2026-06-11

This note records the in-repository fixes applied after the 2026-06-10 Codex
Security scan.

## Findings Addressed

| Candidate | Status | Remediation |
|---|---|---|
| `USP-CAND-001` | fixed | `transcriptionRuntime` now accepts only `videoUrl`; host code derives transcription config from saved plugin settings, ignores plugin-supplied `ytDlpArgs` and `fasterWhisperBinary`, validates transcription URLs, and the transcription plugin no longer passes config through the bridge. |
| `USP-CAND-002` | fixed | Desktop WebSocket auth now requires the shared token for loopback and non-loopback endpoints. Extension endpoint normalization rejects tokenless endpoints. |
| `USP-CAND-003` | fixed | Plugin sandbox fetches use `redirect: "manual"` and reject 3xx responses or final-host changes. |
| `USP-CAND-004` | fixed | Manifest validation rejects non-empty `file` defaults, preventing manifest defaults from becoming `readSelectedFile` grants. |
| `USP-CAND-005` | fixed | Plugin network grants now come only from manifest `network.allowedHosts` and schema `serverList` `serverUrl` values; arbitrary URL-shaped strings no longer expand grants. |
| `USP-CAND-006` | fixed | Extension-driven subtitle and transcription URLs are rejected before `yt-dlp` when they target loopback, private, link-local, multicast/reserved, `.local`, or metadata hosts; default `yt-dlp` args no longer read browser cookies. |
| `USP-CAND-007` | fixed | Extension background ignores non-top-frame media/control-state messages, and control routing no longer falls back to arbitrary subframe ports. |
| `USP-CAND-008` | fixed | `yt-dlp` updater requires the release `SHA2-256SUMS` asset, verifies the selected binary SHA-256 before writing it executable, and rejects unsupported release redirect hosts. |
| `USP-CAND-009` | fixed | Content script URL changes now re-evaluate blacklist status before broadcasting `page-url-changed`. |

## Validation

- `pnpm build:plugins`: passed; regenerated `plugin-repository/transcription/*`.
- `pnpm --filter @immersive-subs/contracts test`: passed, 3 files and 12 tests.
- Desktop focused security regression command: passed, 12 files and 79 tests.
- Extension focused regression command: passed, 4 files and 9 tests.
- `pnpm typecheck`: passed.
- `pnpm test`: passed, including release script tests, silent-catch scan, contracts, desktop app tests, and extension tests.

## Notes

The original `report.md` and `report.html` remain the scan results as generated.
This file is the follow-up remediation record for the current worktree state.
