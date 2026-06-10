# Attack Path Analysis: USP-CAND-004

## Title

Manifest file defaults are treated as user-selected readable files

## Attack Path Steps

1. Attacker reaches the source boundary described by the finding.
2. The repository control listed in affected lines accepts or derives the attacker-controlled value.
3. The value crosses into the desktop, plugin sandbox, extension frame, filesystem, network, or update sink.
4. The attacker obtains the stated effect unless the documented preconditions or proof gaps block the path.

## Attack Path Facts

- In-scope status: in scope under the generated repository threat model.
- Vector: remote/plugin.
- Cross-boundary behavior: File setting defaultValue strings from a plugin manifest are copied into plugin config and later become readableFiles. The sandbox then treats those paths as selected files for usp.readFile, even though the user may never have picked that path.
- Preconditions and counterevidence: A malicious plugin must be installed with readSelectedFile and settingsSchema permissions and know or predict a target path. The issue crosses the intended user-selection boundary for local files. Counterevidence: the plugin permission is explicit, but the permission name and sandbox design indicate the file path should come from a user selection, not a manifest default.
- Controls already present: explicit permissions, auth/token checks, manifest validation, or safe argv process spawning where noted.
- Confidence: high.

## Severity Calibration

Medium. Predictable local file disclosure from a plugin sandbox is materially security-relevant, but exploitation requires plugin installation and an existing predictable file path. A UI-backed selected-file token model would lower likelihood.

## Final Policy Decision

Report as `medium` severity.
