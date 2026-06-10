# Validation Report: USP-CAND-003

## Finding

Plugin network allowlist is bypassed by fetch redirects

## Decision

- Status: reportable
- Severity hypothesis: medium
- Confidence: high

## Affected Lines

- `apps/desktop-app/src/main/plugins/pluginSandbox.ts:466-475`
- `apps/desktop-app/src/main/plugins/pluginManager.ts:541-550`
- `apps/desktop-app/src/main/plugins/pluginManifest.ts:324-335`

## Method And Evidence

Reviewed pluginSandbox.ts and pluginManager.ts. A local validation artifact at artifacts/05_findings/USP-CAND-003/validation_artifacts/node_fetch_redirect_probe.json shows Node fetch returned status 200, finalUrl /secret, and body internal-response after requesting /redirect. Existing sandbox tests prove direct off-allowlist fetches are blocked before fetch is called.

## Dataflow

Plugin usp.fetch(input) -> pluginSandbox network.fetch -> getFetchHost(input) checks only initial host -> fetch(input, init) follows redirect -> response.url/bodyText from final host are returned to plugin code.

## Counterevidence And Proof Gaps

The attacker needs an installed plugin with network permission and at least one allowed host that the plugin controls or can cause to redirect. That is a realistic plugin boundary. Counterevidence: plugins with network permission are user-approved, but host allowlists are explicitly intended to confine that permission.
