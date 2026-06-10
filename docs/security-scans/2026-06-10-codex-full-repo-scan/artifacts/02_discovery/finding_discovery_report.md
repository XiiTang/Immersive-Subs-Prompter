# Finding Discovery Report

## Scope

- Repository-wide scan of `/Users/cq-laptop/Projects/Immersive-Subs-Prompter`.
- Rank/deep-review input: 529 file rows in `rank_input.csv` and `deep_review_input.csv`.
- High-risk surfaces reviewed in depth: Electron WebSocket auth/message handling, extension all-frames content/background routing, plugin manifest/install/runtime sandbox, settings-derived plugin grants, transcription/yt-dlp process boundaries, IPC/preload shell helpers, and update/download paths.

## Raw Candidate Handling

- `raw_candidates.jsonl` contains 7 raw rows from parent and subagent discovery.
- Subagent notifications and candidate ledgers supplied additional reportable rows for transcription runtime config and renderer IPC review.
- Raw id collisions were reconciled in `../04_reconciliation/dedupe_report.md`.

## Surviving Candidates

| Candidate | Severity | Title |
|---|---|---|
| `USP-CAND-001` | high | Plugin-controlled transcription config reaches host network and process execution |
| `USP-CAND-002` | medium | Loopback desktop WebSocket trusts any extension origin without the auth token |
| `USP-CAND-003` | medium | Plugin network allowlist is bypassed by fetch redirects |
| `USP-CAND-004` | medium | Manifest file defaults are treated as user-selected readable files |
| `USP-CAND-005` | medium | Plugin config strings silently expand network host grants |
| `USP-CAND-006` | medium | Page-controlled media URLs can drive desktop yt-dlp requests |
| `USP-CAND-007` | medium | All-frames subframes can replace tab-level media state and control routing |
| `USP-CAND-008` | medium | yt-dlp updater executes downloaded assets without content verification |
| `USP-CAND-009` | low | Blacklist URL changes are broadcast before blacklist re-evaluation |

## Discovery Suppressions

- ZIP path traversal, package hash mismatch, plugin identity confusion, local file install URLs, and stale runtime rollback were suppressed by manifest/package installer controls and tests.
- Direct web page access to the extension dashboard port was suppressed because no externally_connectable manifest entry or window.postMessage bridge was found.
- Subtitle URL shell injection was suppressed because `subtitleService.runCommand` uses `spawn(cmd, args)` without a shell.
- Word lookup external link scheme injection was suppressed because rendered word lookup anchors are constrained to http/https before `window.usp.openExternal` is called.
