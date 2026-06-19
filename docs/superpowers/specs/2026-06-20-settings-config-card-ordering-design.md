# Settings Configuration Card Ordering Design

## Goal

Settings pages use one consistent configuration-list contract for subtitle profiles, Speech Transcription configs, and Jellyfin / Emby servers:

- Configuration rows can be reordered by drag and drop.
- The row circle means enabled or disabled, not runtime selection.
- Newly created configuration rows start enabled.
- Runtime selection happens only in the surface that uses the config at runtime.

The project is not launched, so this is a final-state contract. Do not preserve old Speech Transcription row-circle active switching, old setting shapes, migration code, compatibility branches, or legacy fallbacks.

## Final State

| Area | Final Contract |
| --- | --- |
| Speech Transcription config shape | Every `TranscriptionConfig` includes `enabled: boolean`. |
| Speech Transcription settings list | The list uses the same profile-style row behavior as configuration profiles: drag to reorder, click row to edit, click the circle to enable or disable. |
| Speech Transcription runtime selection | `activeConfigId` is changed only by the control-panel transcription dropdown or by deterministic normalization when the active config is deleted or disabled. |
| Speech Transcription dropdown order | The control-panel dropdown shows only enabled configs, in the same order as the settings list. |
| Speech Transcription unavailable state | If the feature is enabled but no config row is enabled, the control panel shows no transcription choices and transcription cannot start. |
| Jellyfin / Emby settings list | Server rows use the same profile-style drag behavior and persist the reordered server array. |
| Jellyfin / Emby runtime meaning | Server order is persisted management order. It does not introduce a user-facing priority model. |
| New Speech Transcription config | A newly added config is enabled by default. |
| New Jellyfin / Emby server | A newly added server row appears enabled by default. Persisted enabled server rows still require valid server URLs and an API key. |

## Data Model

`TranscriptionConfig` has an explicit enablement field:

```ts
interface TranscriptionConfig {
  id: string;
  enabled: boolean;
  name: string;
  provider: TranscriptionProvider;
  baseUrl: string;
  apiKey: string;
  model: string;
  language: string;
  prompt: string;
  enableWordTimestamps: boolean;
  extraParams: Record<string, string>;
  ytDlpArgs: string;
  fasterWhisperBinary: string;
  fasterWhisperModel: string;
  fasterWhisperModelDir: string;
  fasterWhisperDevice: FasterWhisperDevice;
  fasterWhisperVadFilter: boolean;
  fasterWhisperVadThreshold: number;
  fasterWhisperVadMethod: string;
  fasterWhisperUseKim2: boolean;
}
```

The default transcription config and every newly added transcription config use `enabled: true`.

Speech Transcription settings keep at least one config row. If all rows are disabled, `activeConfigId` may still reference an existing config for structural consistency, but no runtime transcription config is available until a row is enabled.

When at least one transcription config is enabled, `activeConfigId` references an enabled config. If the active config is disabled, deleted, or absent, it is reassigned to the first enabled config in array order. This keeps the control-panel dropdown stable and deterministic.

## Speech Transcription Settings Behavior

The Speech Transcription list is an editor list, not a runtime picker.

| Interaction | Behavior |
| --- | --- |
| Click row | Selects that config for editing only. |
| Edit name | Updates the selected config name after the non-empty name is committed. |
| Click circle | Toggles `config.enabled`. It does not write `activeConfigId` directly. |
| Drag row | Reorders `features.transcription.configs`. |
| Add config | Appends a new enabled config, selects it for editing, and leaves runtime selection unchanged if the current active config remains enabled. If no enabled active config exists, the new config becomes active. |
| Duplicate config | Inserts the copy after the source, selects it for editing, and preserves the source config enablement. |
| Delete config | Deletes the selected row. If the deleted row was active, runtime selection moves to the first enabled remaining row. |

The old settings-page active action is removed. There is no `make active` action, no settings-list active circle, and no active checkmark state in the Speech Transcription settings list.

## Control Panel Behavior

The control-panel transcription dropdown is the only user-facing runtime config switcher.

The dropdown options are:

```ts
settings.features.transcription.configs
  .filter((config) => config.enabled)
  .map((config) => ({ value: config.id, label: config.name || config.id }))
```

Changing the dropdown writes `activeConfigId`. The chosen config remains selected across settings window reopen, desktop restart, and app restart because it is stored in settings.

The transcribe action is enabled only when all of these are true:

- The Speech Transcription feature is enabled.
- At least one transcription config is enabled.
- `activeConfigId` references an enabled config.
- The desktop state has an active browser video.
- The active source is not a media-server source.

Runtime transcription config construction rejects disabled configs. A disabled config cannot be used by runtime code even if stale local UI state tries to reference it.

## Jellyfin / Emby Behavior

The Jellyfin / Emby server list uses the same profile-style list interactions:

| Interaction | Behavior |
| --- | --- |
| Click row | Selects that server for editing. |
| Edit name | Updates the selected server name after the non-empty name is committed. |
| Click circle | Toggles `server.enabled`. |
| Drag row | Reorders `features.jellyfinEmby.config.servers`. |
| Add server | Creates a selected enabled server draft. |
| Duplicate server | Inserts the copy after the source and preserves the source server enablement. |
| Delete server | Deletes the selected server. |

Persisted Jellyfin / Emby settings remain strict:

- Enabled server rows require at least one valid HTTP(S) server URL.
- Enabled server rows require a non-empty API key.
- Disabled server rows may keep incomplete fields.

An enabled newly added server can exist as an editable settings-page draft while the required URL and API key are empty. It is persisted only once it satisfies the same validation rules as every other enabled server row.

## Error Handling

| Scenario | Final Behavior |
| --- | --- |
| Active transcription config is disabled | Select the first enabled config in list order. If none exists, runtime transcription is unavailable. |
| Active transcription config is deleted | Select the first enabled remaining config in list order. If none exists, runtime transcription is unavailable. |
| No Speech Transcription config is enabled | The control-panel dropdown has no options and the transcribe action is disabled. |
| Disabled Speech Transcription config is requested by runtime | Reject it instead of silently using it. |
| Speech Transcription reorder receives invalid indexes | Ignore the reorder and leave settings unchanged. |
| Jellyfin / Emby reorder receives invalid indexes | Ignore the reorder and leave settings unchanged. |
| Enabled Jellyfin / Emby draft is incomplete | Keep the draft editable in the settings page and do not persist it as an enabled server row. |

## Acceptance Criteria

| Requirement | Acceptance Criteria |
| --- | --- |
| Speech Transcription config enablement | `TranscriptionConfig` has `enabled: boolean`, defaults are enabled, and settings validation requires the field. |
| No settings-page active switch | Speech Transcription settings rows no longer emit or call a direct active-switch action from the row circle. |
| Control-panel runtime selection | The control-panel dropdown writes `activeConfigId` and only lists enabled configs in settings-list order. |
| Stable active config | The selected active config persists through app restart because it remains part of saved settings. |
| Disabled configs hidden from runtime picker | Disabled Speech Transcription configs do not appear in the control-panel dropdown. |
| Disabled configs unavailable to runtime | Runtime config construction rejects disabled configs and unavailable active selections. |
| Speech Transcription reorder | Dragging Speech Transcription rows persists the reordered config array and changes dropdown option order. |
| Jellyfin / Emby reorder | Dragging Jellyfin / Emby rows persists the reordered server array. |
| New rows default enabled | New Speech Transcription configs and new Jellyfin / Emby server rows appear enabled by default. |
| No compatibility layer | No old-shape compatibility, migration, or fallback code is added for previous Speech Transcription config behavior. |

## Required Test Coverage

| Test Area | Required Coverage |
| --- | --- |
| Settings sanitizer | Accepts final transcription configs with `enabled`, rejects configs without it, and enforces active enabled config rules when enabled configs exist. |
| Transcription defaults | Default and newly created transcription configs include `enabled: true`. |
| Transcription settings list | Row circle toggles `enabled`; row click selects for editing; row circle does not change `activeConfigId`; drag reorder emits and persists reordered configs. |
| Transcription add/delete | Adding creates an enabled config; deleting or disabling the active config chooses the first enabled remaining config. |
| Control panel dropdown | Lists only enabled transcription configs and preserves settings-list order. |
| Runtime transcription config | Rejects disabled active config and rejects unavailable active selection. |
| Jellyfin / Emby add | New server card appears enabled by default while strict persisted validation still prevents incomplete enabled rows from being saved. |
| Jellyfin / Emby reorder | Dragging server rows persists the reordered server list. |
| Store actions | Transcription and Jellyfin / Emby reorder actions ignore invalid indexes and do not mutate unrelated settings. |
