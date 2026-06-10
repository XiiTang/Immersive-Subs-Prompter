# Validation Summary

| Candidate | Decision | Severity | Confidence | Notes |
|---|---|---|---|---|
| `USP-CAND-001` | reportable | high | medium | Static source evidence shows plugin-controlled config reaches host fetch and subprocess arguments; a live yt-dlp command-execution harness was not run in this read-only scan. |
| `USP-CAND-002` | reportable | medium | high | The auth predicate and existing tests directly assert tokenless loopback acceptance for arbitrary chrome-extension and moz-extension origins. |
| `USP-CAND-003` | reportable | medium | high | Static source evidence and a local Node fetch probe show default fetch follows redirects and returns the final unallowed response. |
| `USP-CAND-004` | reportable | medium | high | The source trace is direct and existing plugin tests show readableFiles grants are consumed by the sandbox readFile sink. |
| `USP-CAND-005` | reportable | medium | high | The source trace directly shows arbitrary URL-shaped config strings are collected into allowedNetworkHosts before sandbox fetch checks run. |
| `USP-CAND-006` | reportable | medium | medium | Static source and tests show arbitrary HTTP(S) media URLs are accepted; a live private-network SSRF harness was not run. |
| `USP-CAND-007` | reportable | medium | medium | Static source and focused tests support the frame-confusion path, but no browser harness with competing top-frame and iframe videos was run. |
| `USP-CAND-008` | reportable | medium | high | The updater source directly downloads release asset bytes, writes them executable, and later uses the path as the yt-dlp binary; checksum/signature verification is absent. |
| `USP-CAND-009` | reportable | low | medium | The line-order leak is clear statically; no browser SPA navigation harness was run. |

## Test Evidence

- Transport/auth tests: passed, 4 files and 16 tests.
- Plugin sandbox/runtime/manifest/install tests: passed, 7 files and 60 tests.
- TranscriptionService tests: passed, 1 file and 3 tests.
- SubtitleService and YtDlpManager isolated tests failed due Electron app mock setup (`app.getPath`/`app.isReady` undefined) before the security assertions could complete.
