# Candidate Reconciliation

Parallel discovery produced raw candidate id collisions under `USP-RAW-*`. The final scan uses canonical `USP-CAND-*` ids and preserves raw ids as provenance.

| Canonical id | Raw provenance | Final disposition | Notes |
|---|---|---|---|
| `USP-CAND-001` | `USP-RAW-transcription-runtime` | reportable | Plugin-controlled transcription config reaches host network and process execution |
| `USP-CAND-002` | `USP-RAW-005`, `USP-RAW-001-collision` | reportable | Loopback desktop WebSocket trusts any extension origin without the auth token |
| `USP-CAND-003` | `USP-RAW-004` | reportable | Plugin network allowlist is bypassed by fetch redirects |
| `USP-CAND-004` | `USP-RAW-007` | reportable | Manifest file defaults are treated as user-selected readable files |
| `USP-CAND-005` | `USP-RAW-008` | reportable | Plugin config strings silently expand network host grants |
| `USP-CAND-006` | `USP-RAW-007-harvey` | reportable | Page-controlled media URLs can drive desktop yt-dlp requests |
| `USP-CAND-007` | `USP-RAW-001` | reportable | All-frames subframes can replace tab-level media state and control routing |
| `USP-CAND-008` | `USP-RAW-006` | reportable | yt-dlp updater executes downloaded assets without content verification |
| `USP-CAND-009` | `USP-RAW-002` | reportable | Blacklist URL changes are broadcast before blacklist re-evaluation |

Suppressed during reconciliation: renderer `openExternal`/`openPath` abuse requires renderer compromise and current call sites are fixed trusted UI or http/https-filtered word lookup links; shell injection through subtitle URL is suppressed because `spawn(cmd, args)` uses argv rather than a shell.
