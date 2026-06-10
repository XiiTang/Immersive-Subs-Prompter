# Attack Path Analysis: USP-CAND-007

## Title

All-frames subframes can replace tab-level media state and control routing

## Attack Path Steps

1. Attacker reaches the source boundary described by the finding.
2. The repository control listed in affected lines accepts or derives the attacker-controlled value.
3. The value crosses into the desktop, plugin sandbox, extension frame, filesystem, network, or update sink.
4. The attacker obtains the stated effect unless the documented preconditions or proof gaps block the path.

## Attack Path Facts

- In-scope status: in scope under the generated repository threat model.
- Vector: remote page.
- Cross-boundary behavior: The extension injects content scripts into all frames and tracks media state by tabId. Any frame that sends video-context can become the preferred frame for that tab, and later desktop play/pause/seek/loop controls are routed to that preferred frame.
- Preconditions and counterevidence: A third-party iframe or nested same-tab frame with a qualifying video can compete with the top frame when all_frames is enabled. The result is wrong media state, possible subtitle downloads for the frame URL, and controls delivered to the wrong frame. Counterevidence: the attacker cannot choose another tabId from content messages.
- Controls already present: explicit permissions, auth/token checks, manifest validation, or safe argv process spawning where noted.
- Confidence: medium.

## Severity Calibration

Medium. The issue crosses an extension frame boundary and can affect desktop control of media, but impact is same-tab and no cross-tab takeover was found. A browser harness proving hidden third-party iframes can win preferred-frame state would raise confidence.

## Final Policy Decision

Report as `medium` severity.
