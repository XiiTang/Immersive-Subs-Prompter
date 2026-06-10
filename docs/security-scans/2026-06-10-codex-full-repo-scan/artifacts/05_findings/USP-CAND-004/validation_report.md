# Validation Report: USP-CAND-004

## Finding

Manifest file defaults are treated as user-selected readable files

## Decision

- Status: reportable
- Severity hypothesis: medium
- Confidence: high

## Affected Lines

- `apps/desktop-app/src/main/plugins/pluginManifest.ts:257-261`
- `apps/desktop-app/src/main/plugins/pluginManager.ts:477-489`
- `apps/desktop-app/src/main/plugins/pluginManager.ts:508-520`
- `apps/desktop-app/src/main/plugins/pluginManager.ts:581-590`
- `apps/desktop-app/src/main/plugins/pluginSandbox.ts:457-465`

## Method And Evidence

Reviewed manifest default validation, config seeding, getReadableFiles, and pluginSandbox file.read. The plugin-focused vitest group passed. Existing sandbox tests prove unreadable files are denied only when readableFiles is empty and allowed readableFiles are read.

## Dataflow

Plugin manifest file field defaultValue -> validateSettingsDefaultValue accepts string -> ensurePluginConfig/defaultConfigFromSettings writes config -> getReadableFiles resolves config values for file fields -> pluginSandbox file.read checks readableFiles membership -> fs.readFile(targetPath).

## Counterevidence And Proof Gaps

A malicious plugin must be installed with readSelectedFile and settingsSchema permissions and know or predict a target path. The issue crosses the intended user-selection boundary for local files. Counterevidence: the plugin permission is explicit, but the permission name and sandbox design indicate the file path should come from a user selection, not a manifest default.
