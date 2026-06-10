# Attack Path Analysis: USP-CAND-009

## Title

Blacklist URL changes are broadcast before blacklist re-evaluation

## Attack Path Steps

1. Attacker reaches the source boundary described by the finding.
2. The repository control listed in affected lines accepts or derives the attacker-controlled value.
3. The value crosses into the desktop, plugin sandbox, extension frame, filesystem, network, or update sink.
4. The attacker obtains the stated effect unless the documented preconditions or proof gaps block the path.

## Attack Path Facts

- In-scope status: in scope under the generated repository threat model.
- Vector: remote page.
- Cross-boundary behavior: During SPA URL changes, the content script sends page-url-changed to the background before it re-evaluates blacklist rules. A transition into a blacklisted path or hash can therefore leak one URL/title update to desktop state.
- Preconditions and counterevidence: A page already being monitored can navigate to a newly blacklisted same-origin/path/hash URL. The leak crosses the blacklist privacy boundary but appears limited to one URL/title event. Counterevidence: fully blacklisted initial pages are skipped before monitoring starts.
- Controls already present: explicit permissions, auth/token checks, manifest validation, or safe argv process spawning where noted.
- Confidence: medium.

## Severity Calibration

Low. The impact is narrow privacy exposure of one URL/title update, not code execution or broad data access. A browser harness quantifying repeated redirects or title leakage would refine severity.

## Final Policy Decision

Report as `low` severity.
