# Attack Path Analysis: USP-CAND-008

## Title

yt-dlp updater executes downloaded assets without content verification

## Attack Path Steps

1. Attacker reaches the source boundary described by the finding.
2. The repository control listed in affected lines accepts or derives the attacker-controlled value.
3. The value crosses into the desktop, plugin sandbox, extension frame, filesystem, network, or update sink.
4. The attacker obtains the stated effect unless the documented preconditions or proof gaps block the path.

## Attack Path Facts

- In-scope status: in scope under the generated repository threat model.
- Vector: supply chain.
- Cross-boundary behavior: YtDlpManager trusts the latest GitHub release JSON and downloads the selected platform asset without verifying a checksum, signature, or attestation. The downloaded file is chmodded executable and later spawned for subtitle and transcription jobs.
- Preconditions and counterevidence: The path executes during runtime binary refresh. Attackers need compromise of the upstream release, release API/asset delivery, local trust store/TLS, or a comparable supply-chain position. Counterevidence: HTTPS and GitHub asset name selection reduce accidental tampering, but they do not provide executable content integrity.
- Controls already present: explicit permissions, auth/token checks, manifest validation, or safe argv process spawning where noted.
- Confidence: high.

## Severity Calibration

Medium. The impact is arbitrary user-level code execution if the update channel is compromised, but likelihood depends on a supply-chain compromise rather than a direct app input. Verifying detached signatures or pinned checksums would lower risk.

## Final Policy Decision

Report as `medium` severity.
