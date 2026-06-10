# Attack Path Analysis: USP-CAND-006

## Title

Page-controlled media URLs can drive desktop yt-dlp requests

## Attack Path Steps

1. Attacker reaches the source boundary described by the finding.
2. The repository control listed in affected lines accepts or derives the attacker-controlled value.
3. The value crosses into the desktop, plugin sandbox, extension frame, filesystem, network, or update sink.
4. The attacker obtains the stated effect unless the documented preconditions or proof gaps block the path.

## Attack Path Facts

- In-scope status: in scope under the generated repository threat model.
- Vector: remote page.
- Cross-boundary behavior: The all-URLs extension reports pageUrl and videoSrc from page DOM to the desktop app. The desktop resolveVideoUrl fallback accepts any HTTP(S) videoSrc or pageUrl and passes it to SubtitleService, which invokes yt-dlp with browser-cookie extraction enabled by default.
- Preconditions and counterevidence: A malicious page or subframe with a qualifying video can trigger the flow when the desktop app is connected. The path crosses from untrusted page content into desktop network/process behavior. Counterevidence: the result is primarily a blind request/subtitle workflow and command injection is suppressed because runCommand uses spawn with an argv array.
- Controls already present: explicit permissions, auth/token checks, manifest validation, or safe argv process spawning where noted.
- Confidence: medium.

## Severity Calibration

Medium. Page-controlled desktop network fetches plus browser-cookie extraction are meaningful privacy and SSRF risks, but response exfiltration and private-service impact were not proven in the scan. Demonstrating response disclosure from a private endpoint would raise severity; adding private-network and redirect blocking would lower it.

## Final Policy Decision

Report as `medium` severity.
