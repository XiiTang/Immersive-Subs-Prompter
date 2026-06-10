# Attack Path Analysis: USP-CAND-002

## Title

Loopback desktop WebSocket trusts any extension origin without the auth token

## Attack Path Steps

1. Attacker reaches the source boundary described by the finding.
2. The repository control listed in affected lines accepts or derives the attacker-controlled value.
3. The value crosses into the desktop, plugin sandbox, extension frame, filesystem, network, or update sink.
4. The attacker obtains the stated effect unless the documented preconditions or proof gaps block the path.

## Attack Path Facts

- In-scope status: in scope under the generated repository threat model.
- Vector: localhost/extension.
- Cross-boundary behavior: The loopback WebSocket auth path checks only that Origin matches a generic browser-extension URL and then returns true for loopback endpoints. The default endpoint URL also omits the token for loopback, so any local extension-origin client can impersonate the real extension.
- Preconditions and counterevidence: A malicious installed extension or a local client that can forge an extension-looking Origin can connect to ws://127.0.0.1 without the secret token. Ordinary web origins are rejected and non-loopback endpoints still require a token, so exposure is local/extension rather than internet-wide.
- Controls already present: explicit permissions, auth/token checks, manifest validation, or safe argv process spawning where noted.
- Confidence: high.

## Severity Calibration

Medium. The issue crosses the browser-extension to Electron desktop boundary and can drive desktop state and network/subtitle side effects, but it is loopback-scoped and requires a malicious local extension or equivalent local client. Pinning the extension id and requiring the token on loopback would lower likelihood significantly.

## Final Policy Decision

Report as `medium` severity.
