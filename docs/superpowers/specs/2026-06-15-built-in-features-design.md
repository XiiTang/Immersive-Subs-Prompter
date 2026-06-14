# Built-In Features Design

## Goal

Replace the desktop app's downloadable plugin model with built-in Features.

The final desktop app ships `Word Lookup`, `Speech Transcription`, and `Jellyfin / Emby` as first-party capabilities that are released with the desktop app. Users can enable, disable, and configure these capabilities. Users do not install, update, delete, download, approve permissions for, or independently version these capabilities.

The project has not launched. The final state does not preserve old plugin data, old plugin registry records, old plugin package files, old plugin IPC contracts, old plugin settings keys, old plugin runtime abstractions, compatibility shims, migration layers, or transitional aliases.

## Product Model

The final product term is `Features`.

User-facing settings use:

- English: `Features`
- Chinese: `功能`

The renderer does not use `Plugins`, `Extensions`, `Add-ons`, marketplace, package, permission, install, update, or delete language for these capabilities.

The built-in features are:

- `Word Lookup`: looks up subtitle words from a configured JSONL word list.
- `Speech Transcription`: transcribes the active browser video through the desktop transcription runtime.
- `Jellyfin / Emby`: connects configured Jellyfin or Emby servers as media sources.

All three are first-party desktop features. `Jellyfin / Emby` is an external-service integration by behavior, but it still appears under the single `Features` settings entry.

## Settings UI

The final settings window has one top-level `Features` navigation item.

The `Features` page shows a stable first-party list:

- `Word Lookup`
- `Speech Transcription`
- `Jellyfin / Emby`

Each row shows:

- display name
- short description
- enabled switch
- configuration content for that feature
- local validation or runtime error text when applicable

The page does not show:

- install URL inputs
- recommended plugin rows
- package versions
- publisher metadata
- permissions
- update actions
- delete actions
- plugin keys
- package hashes
- remote source URLs

Each feature owns an explicit renderer settings component. The final renderer does not keep a generic plugin settings schema renderer.

Final settings components:

- `SettingsFeatures`
- `WordLookupFeatureSettings`
- `TranscriptionFeatureSettings`
- `JellyfinEmbyFeatureSettings`

The feature settings components use the existing renderer UI foundation for switches, inputs, textareas, selects, lists, icon buttons, status messages, and empty states.

## Settings Data

Feature settings are fixed first-party settings under `settings.features`.

Final shape:

```ts
interface AppSettings {
  global: GlobalSettings;
  network: NetworkSettings;
  profiles: ProfileDefinition[];
  defaultProfileId: string;
  rules: ProfileRule[];
  features: FeatureSettings;
  cache: SubtitleCacheSettings;
}

interface FeatureSettings {
  wordLookup: WordLookupFeatureSettingsRecord;
  transcription: TranscriptionFeatureSettingsRecord;
  jellyfinEmby: JellyfinEmbyFeatureSettingsRecord;
}

interface WordLookupFeatureSettingsRecord {
  enabled: boolean;
  config: {
    wordListPath: string;
    modifierKey: "alt" | "ctrl" | "shift";
    panelWidth: number;
    panelHeight: number;
  };
}

interface TranscriptionFeatureSettingsRecord {
  enabled: boolean;
  config: {
    provider: "whisper-api" | "faster-whisper";
    baseUrl: string;
    apiKey: string;
    model: string;
    language: string;
    prompt: string;
    enableWordTimestamps: boolean;
    extraParamsJson: string;
    fasterWhisperModel: string;
    fasterWhisperModelDir: string;
    fasterWhisperDevice: "cpu" | "cuda";
    fasterWhisperVadFilter: boolean;
    fasterWhisperVadThreshold: number;
    fasterWhisperVadMethod: string;
    fasterWhisperUseKim2: boolean;
  };
}

interface JellyfinEmbyFeatureSettingsRecord {
  enabled: boolean;
  config: {
    servers: Array<{
      id: string;
      name: string;
      serverUrl: string;
      apiKey: string;
      enabled: boolean;
    }>;
  };
}
```

Default settings include all three feature records. A fresh desktop settings object always has a complete `settings.features` object.

The final settings sanitizer validates the fixed feature settings shape. It does not accept arbitrary feature IDs or dynamic plugin config records.

## Main Process Architecture

The final main process has concrete built-in feature services, not a dynamic plugin platform.

Final feature services:

- `WordLookupService`
- `TranscriptionFeatureService`
- `JellyfinEmbyMediaSource`

`WindowController` wires these services directly into IPC, settings refresh, media-source handling, transcription actions, and word-lookup windows.

There is no main-process `PluginManager`, plugin registry store, plugin installer, plugin manifest validator, plugin package installer, plugin runtime host, plugin sandbox, plugin worker entry, plugin permission gate, plugin contribution registry, or plugin source manifest model in the final source tree.

There is no runtime loading of first-party feature code from user data directories. Feature code is normal desktop source code and is bundled into the desktop app.

### Word Lookup

`WordLookupService` owns:

- JSONL word-list reading
- row validation
- token normalization
- alias indexing
- lookup ranking
- cache refresh when the configured word-list path changes

The word lookup IPC handler calls the service directly. If the feature is disabled, lookup requests return a disabled-feature error. If the word list is missing or invalid, the feature reports a word-list error without affecting other desktop features.

The word lookup window reads its panel size and trigger key from `settings.features.wordLookup.config`.

### Speech Transcription

`TranscriptionFeatureService` owns feature-level enablement and config conversion for the existing desktop `TranscriptionService`.

The start-transcription IPC handler checks `settings.features.transcription.enabled`. If disabled, the handler returns a disabled-feature error. If enabled, it builds a typed `TranscriptionConfig` from `settings.features.transcription.config` and runs the desktop transcription pipeline.

Transcription cache variants are derived from the built-in feature ID and typed transcription config. They are not derived from plugin keys.

### Jellyfin / Emby

`JellyfinEmbyMediaSource` owns:

- server config validation
- page and video URL matching
- session fetching
- subtitle stream detection
- subtitle track loading
- playback snapshot handling
- source disconnect handling

The media-source controller calls the built-in Jellyfin / Emby source directly when `settings.features.jellyfinEmby.enabled` is true.

The final media-source code does not enumerate dynamic plugin adapters. Internal first-party interfaces may exist where they clarify media-source behavior, but they are not public extension points and are not manifest-driven contribution APIs.

## Renderer Data Flow

The renderer store receives settings through the existing settings IPC path and derives feature state from `settings.features`.

The renderer does not need a plugin catalog. Subtitle and control components use fixed feature settings:

- transcription controls are available when `settings.features.transcription.enabled` is true
- word lookup interaction is available when `settings.features.wordLookup.enabled` is true
- Jellyfin / Emby media-source behavior is represented through existing desktop state and media-server state

Feature settings are updated through normal settings updates. There are no install, preview, update, delete, enable-plugin, disable-plugin, or plugin-catalog IPC routes.

The preload bridge exposes only first-party feature operations that the renderer needs, such as word lookup and start transcription. It does not expose generic plugin lifecycle methods.

## Build And Release Shape

The final repository has no plugin distribution channel.

The final build does not generate plugin artifacts. The final release check does not validate plugin repositories, plugin package hashes, plugin manifests, or plugin package versions.

The final desktop release is the only update channel for built-in feature code.

Final repository shape does not include active plugin distribution directories or scripts:

- no `plugins/` source tree for downloadable packages
- no `plugin-repository/` generated artifacts
- no `build:plugins` script
- no plugin artifact freshness check in release validation

## Error Handling

Feature errors are first-party desktop errors, not plugin lifecycle states.

Final behavior:

- disabled `Word Lookup` rejects lookup requests with a clear disabled-feature message
- missing or invalid word-list files produce word-list errors
- disabled `Speech Transcription` rejects transcription requests with a clear disabled-feature message
- invalid transcription config produces transcription config errors
- transcription runtime failures continue to use the existing transcription state
- disabled `Jellyfin / Emby` does not claim media-source messages
- invalid Jellyfin / Emby server rows are reported in the feature settings UI and are not used by media-source runtime code
- Jellyfin / Emby request failures update media-source error state without affecting browser-extension connectivity

There are no plugin statuses such as `installed`, `updating`, `broken`, or `deleted`.

## Security Boundary

The final security boundary is simpler because the desktop app no longer runs downloaded feature code.

Final behavior:

- no downloaded JavaScript executes in the desktop app
- no feature code is loaded from `userData`
- no feature package is downloaded or extracted
- no plugin permission manifest grants network, file, transcription, or media-source access
- no feature receives arbitrary Electron, Node, shell, filesystem, renderer DOM, or IPC access through a plugin bridge

File access and network access are ordinary first-party desktop behavior:

- word lookup reads only the configured word-list path through desktop-owned code
- Jellyfin / Emby requests are made only to configured server URLs
- transcription uses the existing desktop transcription runtime and configured transcription endpoint

## Testing

Final verification covers fixed first-party feature behavior, settings validation, IPC routing, and removal of plugin-platform surfaces.

Required focused tests:

- settings sanitizer tests for fixed `settings.features`
- renderer settings tests for `SettingsFeatures`
- renderer feature settings tests for Word Lookup, Speech Transcription, and Jellyfin / Emby
- subtitle renderer tests for transcription and word lookup availability from `settings.features`
- word lookup service tests for JSONL parsing, normalization, aliases, ranking, disabled state, and invalid file errors
- transcription feature tests for enablement, config conversion, cache variant identity, disabled state, and error state
- Jellyfin / Emby media-source tests for server parsing, URL matching, sessions, subtitle loading, playback snapshots, disabled state, and request failures
- IPC/preload tests proving plugin lifecycle routes are absent and first-party feature routes work
- build/release script tests proving plugin artifact generation and validation are absent

Required repository checks:

- desktop main typecheck
- desktop renderer typecheck
- desktop app tests
- extension tests where shared contracts are affected
- repository-wide test command
- build command

Required source-boundary checks:

- no source imports from `main/plugins`
- no renderer plugin lifecycle actions
- no plugin catalog state
- no plugin install, preview, update, delete, enable-plugin, or disable-plugin IPC routes
- no active `plugin-repository` or plugin packaging build path
- no user-facing `Plugins` settings page

## Out Of Scope

The final design does not include third-party plugins, downloadable first-party packages, independent feature updates, a plugin marketplace, extension-host APIs, manifest-driven settings, dynamic renderer component injection, arbitrary media-source adapters, plugin package signing, plugin package compatibility ranges, or compatibility with old unpublished plugin data.

The final design does not preserve plugin-platform abstractions for possible future reuse. Future extensibility can be designed from the final first-party feature architecture if a real need appears.
