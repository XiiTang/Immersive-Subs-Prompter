# Codex Security Scan - 2026-06-10

This directory persists the full Codex Security repository-wide scan bundle for
Immersive Subs Prompter.

## Entry Points

- `report.html`: rendered readable report.
- `report.md`: markdown source for the rendered report.
- `artifacts/01_context/threat_model.md`: generated repository threat model.
- `artifacts/03_coverage/repository_coverage_ledger.md`: coverage and test-status summary.
- `artifacts/04_reconciliation/dedupe_report.md`: canonical candidate-id reconciliation.
- `artifacts/05_findings/validation_summary.md`: validation summary for reportable findings.
- `artifacts/05_findings/attack_path_analysis_report.md`: scan-level attack-path summary.
- `remediation-2026-06-11.md`: follow-up fixes and validation evidence for the reportable findings.

## Summary

- Scan mode: repository-wide.
- Reportable findings: 9.
- Severity mix: 1 high, 7 medium, 1 low.
- Coverage: 529 ranked rows closed in `artifacts/03_coverage/worklist_row_closures.jsonl`.
- Original transient scan path: `/tmp/codex-security-scans/Immersive-Subs-Prompter/529b57e2ed1b_20260610T155830Z`.

## Verification Notes

- Passed: transport/auth focused vitest group, 4 files and 16 tests.
- Passed: plugin sandbox/runtime/manifest/install focused vitest group, 7 files and 60 tests.
- Passed: `transcriptionService.test.ts`, 1 file and 3 tests.
- Known validation limitation: `subtitleService.test.ts` and `ytDlpManager.test.ts` failed in the scan environment because the Electron `app` mock was not active before `app.getPath` / `app.isReady` usage.
