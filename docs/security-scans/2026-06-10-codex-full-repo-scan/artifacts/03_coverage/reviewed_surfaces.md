# Reviewed Surfaces

| Surface | Risk Area | Outcome | Notes |
|---|---|---|---|
| Desktop WebSocket auth and connection manager | Extension-to-desktop auth, token handling, message side effects | Reported | `USP-CAND-002` |
| Extension content/background all-frames routing | Page/frame to desktop media state and control | Reported | `USP-CAND-006`, `USP-CAND-007`, `USP-CAND-009` |
| Plugin sandbox network bridge | Plugin network host allowlist and redirects | Reported | `USP-CAND-003`, `USP-CAND-005` |
| Plugin selected-file bridge | Plugin file grants and readSelectedFile enforcement | Reported | `USP-CAND-004` |
| Plugin transcription runtime bridge | Plugin-to-host transcription and subprocess/network config | Reported | `USP-CAND-001` |
| yt-dlp updater | External executable download/update path | Reported | `USP-CAND-008` |
| Electron preload and settings IPC shell helpers | Renderer to shell.openExternal/openPath | Rejected | No current untrusted renderer call site; word lookup anchors are http/https-filtered; renderer compromise-only path left as hardening note. |
| Plugin package installer | Manifest/package swap, hash, ZIP traversal, path traversal, local file URLs | Rejected | Installer validation and tests cover these paths; no bypass survived. |
| Subtitle process invocation | Shell injection via media URL | Rejected | `spawn(cmd, args)` uses argv without a shell; remaining issue is SSRF/confused-deputy, not shell injection. |
| Docs/tests/generated rows | Runtime exploitability | Not applicable | Closed in row closure ledger unless used as validation evidence. |
