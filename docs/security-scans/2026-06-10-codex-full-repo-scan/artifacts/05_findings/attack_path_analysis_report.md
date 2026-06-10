# Attack Path Analysis Report

All reportable candidates received per-finding attack-path reports and candidate-ledger receipts. Final severity was calibrated using the generated threat model and the Codex Security severity policy.

| Candidate | Final severity | Final policy | Primary boundary |
|---|---|---|---|
| `USP-CAND-001` | high | report | Plugin sandbox escape / host subprocess abuse |
| `USP-CAND-002` | medium | report | Authentication bypass / confused deputy |
| `USP-CAND-003` | medium | report | Server-side request forgery / allowlist bypass |
| `USP-CAND-004` | medium | report | Plugin file permission bypass |
| `USP-CAND-005` | medium | report | Plugin sandbox authorization bypass / SSRF |
| `USP-CAND-006` | medium | report | SSRF / page-to-desktop confused deputy |
| `USP-CAND-007` | medium | report | Frame confusion / confused deputy |
| `USP-CAND-008` | medium | report | Unverified executable download / supply-chain risk |
| `USP-CAND-009` | low | report | Information exposure / privacy leak |
