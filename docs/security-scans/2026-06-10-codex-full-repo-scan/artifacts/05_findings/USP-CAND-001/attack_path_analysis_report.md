# Attack Path Analysis: USP-CAND-001

## Title

Plugin-controlled transcription config reaches host network and process execution

## Attack Path Steps

1. Attacker reaches the source boundary described by the finding.
2. The repository control listed in affected lines accepts or derives the attacker-controlled value.
3. The value crosses into the desktop, plugin sandbox, extension frame, filesystem, network, or update sink.
4. The attacker obtains the stated effect unless the documented preconditions or proof gaps block the path.

## Attack Path Facts

- In-scope status: in scope under the generated repository threat model.
- Vector: remote/plugin.
- Cross-boundary behavior: A plugin with transcriptionRuntime permission can supply the complete TranscriptionConfig object to the host. The host forwards that object into TranscriptionService, where config.ytDlpArgs becomes yt-dlp argv, config.baseUrl receives the uploaded audio and bearer token, and config.fasterWhisperBinary is used as the executable for runCommand.
- Preconditions and counterevidence: The attacker must get a malicious or compromised plugin installed and enabled with transcriptionRuntime permission. That is an in-scope plugin boundary per the threat model. The abuse crosses from sandboxed plugin code into host network and subprocess primitives with the desktop user privileges. Counterevidence: the permission is explicit and plugin installation is user-approved, so this is not unauthenticated remote code execution. It remains reportable because a single host runtime permission grants more authority than the plugin network and process sandbox imply.
- Controls already present: explicit permissions, auth/token checks, manifest validation, or safe argv process spawning where noted.
- Confidence: medium.

## Severity Calibration

High. The impact is host command/process execution or sensitive audio/API token exfiltration from a plugin sandbox boundary. Likelihood is reduced by the need for plugin installation and a declared transcriptionRuntime permission, but the security consequence is stronger than ordinary plugin networking. A live demonstration of yt-dlp command execution would raise confidence; proving yt-dlp cannot execute attacker-controlled commands from the supplied argv would lower severity.

## Final Policy Decision

Report as `high` severity.
