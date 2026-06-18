# Faster-Whisper-XXL Binary Download Design

## Reference Project

This design explicitly references the local Subtitle Edit checkout:

`/Users/cq-laptop/Projects/referrence projects/subtitleedit`

Relevant reference files:

- `/Users/cq-laptop/Projects/referrence projects/subtitleedit/src/ui/Logic/Download/WhisperDownloadService.cs`
- `/Users/cq-laptop/Projects/referrence projects/subtitleedit/src/ui/Features/Video/SpeechToText/DownloadSpeechToTextEngineViewModel.cs`
- `/Users/cq-laptop/Projects/referrence projects/subtitleedit/src/ui/Features/Video/SpeechToText/Engines/WhisperEnginePurfviewFasterWhisperXxl.cs`
- `/Users/cq-laptop/Projects/referrence projects/subtitleedit/src/ui/Logic/SevenZipExtractor/Unpacker.cs`

The product behavior follows Subtitle Edit's Purfview Faster-Whisper-XXL path: fixed Windows/Linux x64 assets, `.7z` extraction of the `Faster-Whisper-XXL` directory, executable permission repair on Linux, and no macOS XXL binary download.

## Scope

The app manages exactly one Faster-Whisper binary family: Purfview Faster-Whisper-XXL.

Supported app-managed binary downloads:

| Platform | Architecture | Asset | Download |
| --- | --- | --- | --- |
| Windows | x64 | `Faster-Whisper-XXL_r245.4_windows.7z` | yes |
| Linux | x64 | `Faster-Whisper-XXL_r245.4_linux.7z` | yes |
| macOS | any | none | no |
| Windows | non-x64 | none | no |
| Linux | non-x64 | none | no |

The app does not provide built-in downloads for ordinary `faster-whisper`, deprecated Purfview ordinary releases, Python runtimes, wrapper scripts, macOS binaries, or Linux packages on macOS.

The project has not shipped. There is no compatibility, migration, legacy data handling, fallback release selection, old-code rejection layer, or transitional API. Existing internal surfaces should be changed directly to the final shape.

## Final Architecture

`FasterWhisperManager` owns binary state, model state, and binary downloads. Its app-managed binary paths expose XXL only:

- `binaryDir`
- `modelsDir`
- `xxlBinaryPath`

The final installed executable path is:

- Windows: `<userData>/faster-whisper/bin/Faster-Whisper-XXL/faster-whisper-xxl.exe`
- Linux: `<userData>/faster-whisper/bin/Faster-Whisper-XXL/faster-whisper-xxl`

The final status shape contains one binary status, not CPU/GPU rows:

```ts
{
  paths: {
    binaryDir: string;
    modelsDir: string;
    xxlBinaryPath: string;
  };
  binary: {
    variant: "xxl";
    exists: boolean;
    path: string;
    downloadable: boolean;
    reason?: string;
    asset?: {
      name: string;
      version: "r245.4";
      sizeBytes: number;
    };
  };
  models: DownloadedModel[];
  modelsBaseDir: string;
}
```

The fixed manifest is a local, typed constant in main-process code. It does not call GitHub's latest-release API at runtime.

Manifest entries:

- Windows x64
  - URL: `https://github.com/Purfview/whisper-standalone-win/releases/download/Faster-Whisper-XXL/Faster-Whisper-XXL_r245.4_windows.7z`
  - asset name: `Faster-Whisper-XXL_r245.4_windows.7z`
  - size: `1424256246`
  - executable: `Faster-Whisper-XXL/faster-whisper-xxl.exe`
- Linux x64
  - URL: `https://github.com/Purfview/whisper-standalone-win/releases/download/Faster-Whisper-XXL/Faster-Whisper-XXL_r245.4_linux.7z`
  - asset name: `Faster-Whisper-XXL_r245.4_linux.7z`
  - size: `1657690937`
  - executable: `Faster-Whisper-XXL/faster-whisper-xxl`

The manifest does not include a SHA-256 checksum. GitHub's release API currently exposes `digest: null` for these Purfview assets, so the app must not invent or trust an unverified checksum.

## Binary Download Behavior

The renderer can request only the fixed XXL binary download. It cannot provide a URL, file path, platform, archive name, or executable path.

Final IPC surface:

- `usp:faster-whisper-status`
- `usp:faster-whisper-download-binary`
- `usp:faster-whisper-download-model`
- `usp:faster-whisper-open-binary-folder`
- `usp:faster-whisper-open-models-folder`
- `usp:faster-whisper-download-progress`

`usp:faster-whisper-download-binary` accepts a strict payload:

```ts
{
  variant: "xxl";
  jobId?: string;
}
```

Download progress events use:

```ts
{
  id: string;
  type: "binary";
  variant: "xxl";
  percent: number;
  status: string;
}
```

The final binary installation contract:

- Only current-platform manifest entries can be downloaded.
- Downloads use HTTPS and allow redirects only to `github.com`, `objects.githubusercontent.com`, or `release-assets.githubusercontent.com`.
- The downloaded byte count must match the manifest size.
- Extraction uses `7zip-bin` as a direct project dependency, not the user's system `7z` and not an electron-builder transitive dependency.
- The archive is extracted into a staging directory first.
- Only the `Faster-Whisper-XXL` directory is installed into `bin/Faster-Whisper-XXL`.
- Installation is considered successful only after the expected executable exists.
- Linux executable permissions are set to `755`.
- Temporary archive and staging directories are removed after success or failure.
- A failed download or failed extraction does not update the active transcription config.
- Re-downloading the fixed XXL asset replaces the app-managed `bin/Faster-Whisper-XXL` directory with the newly extracted directory.

## Renderer Behavior

The Faster-Whisper binary card represents the XXL app-managed binary only.

Final UI states:

- Installed: show Ready and the XXL executable path.
- Supported and missing: show Download.
- Unsupported platform: show Unsupported or Missing with the reason. macOS has no download button.

The card does not show CPU and GPU rows. XXL is not presented as a GPU-only download.

After a successful binary download, the renderer writes the returned executable path into the selected transcription config:

```ts
{
  fasterWhisperBinary: result.path
}
```

The download does not automatically change `fasterWhisperDevice`. Device selection remains a runtime setting controlled by the user.

The model download UI and model directory behavior remain separate. Model downloads still use the selected config id so the main process resolves the model directory.

## Error Handling

Errors are direct and terminal for the current action:

- Unsupported platform: binary download is unavailable for this platform.
- Network failure: binary download fails.
- Redirect to unsupported host: binary download fails.
- Byte count mismatch: binary download fails.
- 7z extraction failure: binary installation fails.
- Expected executable missing after extraction: binary installation fails.

There is no fallback to older Purfview releases, ordinary Faster-Whisper assets, macOS ordinary zip assets, Python-based installs, cached binaries, alternative mirrors, or system-installed tools.

## Tests

The test suite should assert the final behavior:

- `FasterWhisperManager` returns a downloadable XXL status for Windows x64 and Linux x64.
- `FasterWhisperManager` returns a non-downloadable status for macOS and non-x64 platforms.
- Successful binary download installs `Faster-Whisper-XXL/faster-whisper-xxl(.exe)` and returns that path.
- Linux installs set executable permissions.
- Download failure, size mismatch, extraction failure, or missing executable leaves no installed binary from the failed attempt.
- IPC rejects binary payloads that include renderer-supplied URL or path fields.
- IPC emits binary progress events with `type: "binary"` and `variant: "xxl"`.
- Renderer shows a download action only on supported platforms.
- Renderer writes `fasterWhisperBinary` after successful download and does not modify `fasterWhisperDevice`.
- Existing model download tests continue to cover config-id based model directory resolution.

## Non-Goals

- No ordinary Faster-Whisper binary download.
- No macOS built-in Faster-Whisper binary download.
- No CPU/GPU binary split in app-managed downloads.
- No dynamic latest-release lookup.
- No migration of old binary metadata or old directory layouts.
- No compatibility with previous internal IPC/status shapes.
- No automatic device switching after binary download.
