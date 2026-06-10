# Attack Path Analysis: USP-CAND-005

## Title

Plugin config strings silently expand network host grants

## Attack Path Steps

1. Attacker reaches the source boundary described by the finding.
2. The repository control listed in affected lines accepts or derives the attacker-controlled value.
3. The value crosses into the desktop, plugin sandbox, extension frame, filesystem, network, or update sink.
4. The attacker obtains the stated effect unless the documented preconditions or proof gaps block the path.

## Attack Path Facts

- In-scope status: in scope under the generated repository threat model.
- Vector: remote/plugin.
- Cross-boundary behavior: PluginManager derives allowedNetworkHosts from every URL-shaped string found recursively in plugin config, in addition to manifest.network.allowedHosts. Manifest defaults or later config updates can therefore grant network hosts that were never declared in the manifest network block.
- Preconditions and counterevidence: The attacker needs a plugin with network permission and control of its manifest defaults or plugin config. Dynamic user-entered server URLs are an intended product workflow, which is counterevidence against suppressing all config-derived hosts. The reportable gap is that the collector is field-agnostic and default-aware, so unrelated strings or manifest-supplied defaults can become grants silently.
- Controls already present: explicit permissions, auth/token checks, manifest validation, or safe argv process spawning where noted.
- Confidence: high.

## Severity Calibration

Medium. This weakens the sandbox host allowlist and can expose localhost/LAN destinations to network-capable plugins, but it still requires plugin installation and network permission. Restricting derivation to explicit user-edited serverList fields would lower likelihood.

## Final Policy Decision

Report as `medium` severity.
