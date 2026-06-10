# Repository Coverage Ledger

Scan id: `529b57e2ed1b_20260610T155830Z`

Every row from `../02_discovery/deep_review_input.csv` has an explicit closure record in `worklist_row_closures.jsonl`. High-risk runtime surfaces were read directly; lower-risk renderer, config, docs, and test rows were closed by sink inventory, runtime relevance, or not-applicable disposition.

| Surface | Disposition | Row count |
|---|---:|---:|
| desktop IPC/preload | completed | 8 |
| desktop main runtime | completed | 59 |
| desktop plugin host/runtime | completed | 22 |
| desktop renderer UI | completed_by_sink_inventory | 125 |
| extension background transport | completed | 17 |
| extension content/page runtime | completed | 33 |
| repo plugin packages | completed | 6 |
| shared contracts | completed | 14 |
| workspace/config/scripts | completed_by_sink_inventory | 245 |

## Verification Status

- Passed: transport/auth focused vitest group, 4 files and 16 tests.
- Passed: plugin sandbox/runtime/manifest/install focused vitest group, 7 files and 60 tests.
- Passed: `transcriptionService.test.ts`, 1 file and 3 tests.
- Failed due existing Electron mock setup issue: `subtitleService.test.ts` failed before tests because `app.getPath` was undefined in `subtitleCacheManager.ts` import.
- Failed due same mock setup issue: `ytDlpManager.test.ts` expected `release unavailable` but got `app.isReady` undefined before release fetch.

## Notes

The failing tests are recorded as validation limitations, not repository source changes made by this scan. No repository files were modified.
