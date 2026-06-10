# Validation Report: USP-CAND-009

## Finding

Blacklist URL changes are broadcast before blacklist re-evaluation

## Decision

- Status: reportable
- Severity hypothesis: low
- Confidence: medium

## Affected Lines

- `apps/extension/src/monitoring/URLWatcher.ts:18-20`
- `apps/extension/src/content/index.ts:72-76`
- `apps/extension/src/background/messaging/ContentMessageRouter.ts:92-97`
- `apps/desktop-app/src/main/connectionManager.ts:591-598`

## Method And Evidence

Reviewed URLWatcher.ts, content/index.ts, ContentMessageRouter.ts, and connectionManager.ts. The ordering is send first, evaluate blacklist second. Initial blacklisted loads are suppressed, so the leak is limited to active navigation transitions.

## Dataflow

history/hash/popstate change -> URLWatcher notifyUrlChange -> content handleUrlChanged sends page-url-changed -> background broadcasts -> desktop connectionManager updates pageUrl/title -> evaluateCurrentUrl then stops monitoring if the new URL is blacklisted.

## Counterevidence And Proof Gaps

A page already being monitored can navigate to a newly blacklisted same-origin/path/hash URL. The leak crosses the blacklist privacy boundary but appears limited to one URL/title event. Counterevidence: fully blacklisted initial pages are skipped before monitoring starts.
