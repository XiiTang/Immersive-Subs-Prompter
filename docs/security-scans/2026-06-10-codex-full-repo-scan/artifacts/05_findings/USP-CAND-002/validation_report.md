# Validation Report: USP-CAND-002

## Finding

Loopback desktop WebSocket trusts any extension origin without the auth token

## Decision

- Status: reportable
- Severity hypothesis: medium
- Confidence: high

## Affected Lines

- `apps/desktop-app/src/main/connectionAuth.ts:27-42`
- `packages/contracts/src/core/network-endpoints.ts:31-35`
- `apps/desktop-app/src/main/connectionManager.ts:252-265`
- `apps/desktop-app/src/main/connectionManager.ts:331-350`
- `apps/desktop-app/src/main/connectionManager.ts:467-469`

## Method And Evidence

Reviewed connectionAuth.ts, network-endpoints.ts, connectionManager.ts, and extension transport code. The focused transport command passed: 4 test files and 16 tests. Existing connectionAuth tests assert arbitrary chrome-extension and moz-extension origins are allowed on loopback without token, web origins are rejected, and non-loopback endpoints require the token.

## Dataflow

WebSocket handshake Origin -> connectionManager verifyClient -> isAuthorizedDesktopClient -> isTrustedExtensionOrigin generic regex -> isLoopbackHost returns true -> handleSocketMessage accepts source usp-extension messages -> rememberTabSocket and subtitleService.getSubtitles can be driven by the socket payload.

## Counterevidence And Proof Gaps

A malicious installed extension or a local client that can forge an extension-looking Origin can connect to ws://127.0.0.1 without the secret token. Ordinary web origins are rejected and non-loopback endpoints still require a token, so exposure is local/extension rather than internet-wide.
