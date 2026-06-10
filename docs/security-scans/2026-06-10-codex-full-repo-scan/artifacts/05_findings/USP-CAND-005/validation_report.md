# Validation Report: USP-CAND-005

## Finding

Plugin config strings silently expand network host grants

## Decision

- Status: reportable
- Severity hypothesis: medium
- Confidence: high

## Affected Lines

- `apps/desktop-app/src/main/plugins/pluginManifest.ts:235-249`
- `apps/desktop-app/src/main/plugins/pluginManifest.ts:257-261`
- `apps/desktop-app/src/main/settings/appSettingsSanitizer.ts:120-127`
- `apps/desktop-app/src/main/plugins/pluginManager.ts:541-579`
- `apps/desktop-app/src/main/plugins/pluginSandbox.ts:466-475`

## Method And Evidence

Reviewed pluginManifest.ts, appSettingsSanitizer.ts, pluginManager.ts, and pluginSandbox.ts. The plugin-focused vitest group passed. Tests cover derived access grants being pushed to enabled runtimes, and the source shows collectNetworkHostFromString adds any URL.canParse host.

## Dataflow

Manifest defaults or settings plugins object -> validatePluginSettingsRecordForUpdate accepts current plugin config object -> getAllowedNetworkHosts adds manifest hosts and collectNetworkHosts(config) -> collectNetworkHostFromString adds parsed host -> pluginSandbox fetch permits requests whose initial host is in the derived set.

## Counterevidence And Proof Gaps

The attacker needs a plugin with network permission and control of its manifest defaults or plugin config. Dynamic user-entered server URLs are an intended product workflow, which is counterevidence against suppressing all config-derived hosts. The reportable gap is that the collector is field-agnostic and default-aware, so unrelated strings or manifest-supplied defaults can become grants silently.
