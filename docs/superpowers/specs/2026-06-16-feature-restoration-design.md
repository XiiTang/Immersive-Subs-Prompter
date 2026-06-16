# Feature Restoration Design

## Goal

Restore the full product depth of the built-in `Word Lookup`, `Speech Transcription`, and `Jellyfin / Emby` features while keeping the current fixed feature architecture.

The final desktop app uses first-party feature settings under `settings.features`. It does not restore the old plugin platform, plugin catalog, plugin lifecycle controls, plugin runtime, `settings.plugins`, transitional aliases, compatibility shims, old data migration, or stale fallback paths. The project has not launched, so the final state can require the current settings shape directly.

## Product Model

The product term remains `Features`.

The final built-in features are:

- `Word Lookup`: loads a JSONL word list, exposes lookup status, supports manual refresh, and opens the word lookup panel from subtitle tokens.
- `Speech Transcription`: manages multiple named transcription configurations, uses one active configuration at runtime, and supports Whisper API and local Faster-Whisper workflows.
- `Jellyfin / Emby`: manages multiple configured Jellyfin or Emby servers and uses enabled complete server rows as media sources.

Feature enablement and feature configuration are separate. The `Features` page toggles feature availability. Enabled features expose their own settings detail pages through the settings navigation.

## Settings Data

`AppSettings` keeps a fixed `features` object:

```ts
interface FeatureSettings {
  wordLookup: WordLookupFeatureSettings;
  transcription: TranscriptionFeatureSettings;
  jellyfinEmby: JellyfinEmbyFeatureSettings;
}
```

### Word Lookup

The persisted Word Lookup settings stay small and user-owned:

```ts
interface WordLookupFeatureSettings {
  enabled: boolean;
  config: {
    wordListPath: string;
    modifierKey: "alt" | "ctrl" | "shift";
    panelWidth: number;
    panelHeight: number;
  };
}
```

Word-list load state is runtime state, not persisted settings:

```ts
interface WordLookupStatus {
  ok: boolean;
  wordListPath: string;
  entryCount: number;
  fileMtimeMs: number | null;
  loadedAt: number | null;
  error: string | null;
}
```

### Speech Transcription

Speech Transcription stores a complete configuration list and one active configuration:

```ts
interface TranscriptionFeatureSettings {
  enabled: boolean;
  activeConfigId: string | null;
  configs: TranscriptionConfig[];
}
```

Each `TranscriptionConfig` is a complete runtime config:

```ts
interface TranscriptionConfig {
  id: string;
  name: string;
  provider: "whisper-api" | "faster-whisper";
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
  fasterWhisperDevice: "cpu" | "cuda";
  fasterWhisperVadFilter: boolean;
  fasterWhisperVadThreshold: number;
  fasterWhisperVadMethod: string;
  fasterWhisperUseKim2: boolean;
}
```

Fresh settings include one complete default transcription config. Runtime code does not invent missing config fields.

### Jellyfin / Emby

Jellyfin / Emby keeps an explicit server list:

```ts
interface JellyfinEmbyFeatureSettings {
  enabled: boolean;
  config: {
    servers: JellyfinEmbyServerConfig[];
  };
}

interface JellyfinEmbyServerConfig {
  id: string;
  name: string;
  serverUrl: string;
  apiKey: string;
  enabled: boolean;
}
```

The final server record contains only fields consumed by the current media-source runtime. It does not include `webSocketPath` unless that field becomes real runtime behavior again.

## Main Process

The main process owns concrete first-party services:

- `WordLookupService`
- `TranscriptionFeatureService`
- `FasterWhisperManager`
- `JellyfinEmbyMediaSource`

These services are normal desktop source code. They are not dynamically installed or loaded from user data.

### Word Lookup Runtime

`WordLookupService` owns JSONL parsing, row validation, token normalization, alias indexing, lookup ranking, refresh, and status reporting.

The preload bridge exposes explicit first-party operations:

- select a word-list file
- refresh the configured word list
- get word-list status
- lookup a token
- open and resize the word lookup window

Changing `wordListPath` makes status reflect the current path. Refresh reads the configured file, rebuilds the index, and returns status. Lookup uses the loaded index or loads the configured path as needed, and errors surface through the existing subtitle status path.

### Speech Transcription Runtime

`TranscriptionFeatureService` resolves the active transcription config from `settings.features.transcription`.

Starting transcription fails before audio download when:

- the feature is disabled
- no active config exists
- the active config ID does not match a config
- the selected provider is invalid
- Whisper API is selected and base URL or model is invalid
- Faster-Whisper is selected and the model or executable is invalid
- a transcription job is already running
- no active browser video is available
- the current source is Jellyfin / Emby media-server mode

When config validation passes, `TranscriptionService` receives the active `TranscriptionConfig`. `ytDlpArgs` comes from that config, with the product default used only when the active config explicitly leaves it empty. `fasterWhisperBinary` is honored for local Faster-Whisper runs. Commands continue to use structured argv parsing and process spawning rather than shell string concatenation.

The subtitle control panel derives its transcription config selector from the enabled feature's `configs` list and writes active selection back to `activeConfigId`.

### Faster-Whisper Runtime

`FasterWhisperManager` owns:

- app-managed binary directory
- app-managed model directory
- CPU and GPU binary status
- downloaded model discovery
- binary download
- model download
- download progress events

The preload bridge exposes explicit Faster-Whisper operations for paths, status, model listing, downloads, and download progress. Settings UI actions use manager-owned paths or the active config's model directory.

### Jellyfin / Emby Runtime

`JellyfinEmbyMediaSource` reads enabled complete server rows from `settings.features.jellyfinEmby.config.servers`.

Runtime matching uses configured server URLs and browser media context. Disabled rows and incomplete rows are ignored by runtime matching. Enabled complete rows that fail network or subtitle-stream requests surface media-source errors rather than silently reporting no subtitles.

Changing Jellyfin / Emby settings clears cached media-source runtime state.

## Settings UI

All settings UI uses the current renderer UI foundation under `apps/desktop-app/src/renderer/components/ui`. Product components may own layout, but shared control chrome remains in the foundation.

### Features Page

`SettingsFeatures` shows the fixed feature list:

- Word Lookup
- Speech Transcription
- Jellyfin / Emby

Each row shows name, description, and enabled switch. The page does not show plugin lifecycle concepts such as install, update, package version, permissions, source URL, marketplace, or delete.

### Word Lookup Page

`WordLookupFeatureSettings` shows:

- word-list path input
- file selection action
- trigger modifier select
- panel width and height controls
- manual refresh action
- status, entry count, file modified time, loaded time, and error text

The page is useful even when the current word list is invalid. Errors stay local to Word Lookup status unless lookup is attempted from subtitles.

### Speech Transcription Page

`TranscriptionFeatureSettings` uses a split layout:

- left configuration list
- add and delete actions
- selected and active state
- right-side config editor

The editor shows fields for all configs:

- config name
- provider
- language
- prompt
- yt-dlp audio args

For Whisper API configs it shows:

- base URL
- API key
- model
- word timestamps
- extra params JSON

For Faster-Whisper configs it shows:

- binary status
- binary download actions
- model status
- model download action
- download progress
- downloaded model selector
- custom model input
- model directory
- device
- VAD filter
- VAD threshold
- VAD method
- Kim2 toggle

Deleting the last config creates one complete default config so the feature never persists an empty config list.

### Jellyfin / Emby Page

`JellyfinEmbyFeatureSettings` uses a split layout:

- left server list
- add and delete actions
- enabled/disabled badge per server
- right-side selected server editor

The editor shows:

- server name
- server URL
- API key
- enabled switch

Required-field and HTTP(S) URL validation appear inline. Empty server lists show an empty state. Deleting a selected server selects the next available row or returns to the empty state.

## Renderer Data Flow

The renderer store keeps feature actions as first-party settings updates:

- set feature enabled
- set Word Lookup config
- set active transcription config
- add/update/delete transcription configs
- add/update/delete Jellyfin / Emby servers

The renderer does not fetch plugin catalogs or call plugin lifecycle APIs.

Subtitle surfaces derive availability from `settings.features`:

- Word Lookup interactions require `settings.features.wordLookup.enabled`
- transcription controls require `settings.features.transcription.enabled`
- transcription config options come from `settings.features.transcription.configs`

## Validation

The settings sanitizer validates the complete final settings shape:

- no unknown app settings keys
- no unknown feature IDs
- no unknown feature config keys
- Word Lookup modifier and panel size bounds
- Transcription active config consistency
- Transcription provider, device, VAD threshold, extra params, required strings, and non-empty config list
- Jellyfin / Emby server record shape and optional HTTP(S) server URLs

Runtime validation remains provider-specific and fails before side effects where possible.

## Testing

Required verification covers:

- settings sanitizer tests for the final feature shape
- Word Lookup service tests for refresh, status, invalid paths, invalid rows, and lookup ranking
- transcription feature tests for active config resolution, provider-specific validation, cache variant construction, disabled state, and running-state protection
- transcription service tests for `ytDlpArgs` and `fasterWhisperBinary`
- Faster-Whisper manager and IPC tests for paths, status, model listing, progress, and error results
- Jellyfin / Emby media-source tests for multi-server matching, disabled/incomplete rows, settings reset, and subtitle request failures
- renderer jsdom tests for Word Lookup status controls, Speech multi-config editing, Faster-Whisper settings state, and Jellyfin / Emby split editor
- renderer browser tests for settings navigation and subtitle transcription config selection
- desktop typecheck and focused build/test checks

The final tests assert the product behavior directly. They do not preserve old plugin storage, old plugin commands, legacy settings snapshots, or migration behavior.
