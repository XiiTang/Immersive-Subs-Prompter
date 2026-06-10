# Attack Path Analysis: USP-CAND-003

## Title

Plugin network allowlist is bypassed by fetch redirects

## Attack Path Steps

1. Attacker reaches the source boundary described by the finding.
2. The repository control listed in affected lines accepts or derives the attacker-controlled value.
3. The value crosses into the desktop, plugin sandbox, extension frame, filesystem, network, or update sink.
4. The attacker obtains the stated effect unless the documented preconditions or proof gaps block the path.

## Attack Path Facts

- In-scope status: in scope under the generated repository threat model.
- Vector: remote/plugin.
- Cross-boundary behavior: The plugin sandbox checks the original request host against allowedNetworkHosts, then calls fetch with the default redirect-following behavior. If an allowed host redirects to a disallowed host, the plugin receives the final response body, URL, and headers anyway.
- Preconditions and counterevidence: The attacker needs an installed plugin with network permission and at least one allowed host that the plugin controls or can cause to redirect. That is a realistic plugin boundary. Counterevidence: plugins with network permission are user-approved, but host allowlists are explicitly intended to confine that permission.
- Controls already present: explicit permissions, auth/token checks, manifest validation, or safe argv process spawning where noted.
- Confidence: high.

## Severity Calibration

Medium. The bug bypasses a declared sandbox network host control and can reach localhost, LAN, or metadata-style endpoints if an allowed host redirects there. The need for an installed network-capable plugin keeps likelihood below high. A browser/Node fetch mode that prevents redirects or validates final response hosts would lower severity.

## Final Policy Decision

Report as `medium` severity.
