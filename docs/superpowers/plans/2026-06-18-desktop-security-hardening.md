# Desktop Security Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the selected desktop security hardening from `docs/superpowers/specs/2026-06-18-desktop-security-hardening-design.md` without legacy compatibility or migration paths.

**Architecture:** Keep trusted user configuration separate from untrusted renderer/media input. Main-process modules own URL normalization, binary integrity checks, path opening, process output caps, subtitle parser caps, and cache ownership boundaries. Production Faster-Whisper app-managed binary download is disabled until stable versioned metadata with a trusted hash is available; integrity behavior remains testable through injected asset metadata.

**Tech Stack:** Electron main/preload IPC, Vue renderer settings components, Node fs/crypto/child_process, TypeScript, Vitest projects `main`, `jsdom`, and `browser`.

---

## File Structure

- Modify `apps/desktop-app/src/main/networkUrlSafety.ts`: add HTTP(S)-only user-configured endpoint normalization while preserving the existing public-only media guard.
- Modify `apps/desktop-app/src/main/networkUrlSafety.test.ts`: cover local/LAN acceptance for user-configured endpoints and keep public media URL rejections.
- Create `apps/desktop-app/src/main/resourceLimits.ts`: centralize subtitle text/parser and process stdout/stderr limits.
- Modify `apps/desktop-app/src/main/subtitleParser.ts`: enforce input byte, line, and cue caps.
- Modify `apps/desktop-app/src/main/subtitleParser.test.ts`: cover parser limits using small per-test limit overrides plus final exported constant values.
- Modify `apps/desktop-app/src/main/subtitleService.ts`: enforce subtitle file size before reading and cap process stdout/stderr in `runCommand`.
- Modify `apps/desktop-app/src/main/subtitleService.test.ts`: cover oversized subtitle files and stdout/stderr caps.
- Modify `apps/desktop-app/src/main/transcriptionService.ts`: use HTTP(S)-only Whisper API base URL validation and enforce Faster-Whisper subtitle output file size.
- Modify `apps/desktop-app/src/main/transcriptionService.test.ts`: cover local/LAN Whisper API base URLs and rejected non-HTTP(S) schemes.
- Modify `apps/desktop-app/src/main/features/transcriptionFeatureConfig.ts`: use the same HTTP(S)-only validator for active Whisper API configs.
- Modify `apps/desktop-app/src/main/features/transcriptionFeatureService.test.ts`: cover accepted localhost/private Whisper API config.
- Modify `apps/desktop-app/src/main/settings/appSettingsSanitizer.ts`: validate Whisper API config `baseUrl` with HTTP(S)-only semantics.
- Modify `apps/desktop-app/src/main/settings/appSettingsSanitizer.test.ts`: cover accepted localhost/private Whisper API saved settings and rejected non-HTTP(S) schemes.
- Modify `apps/desktop-app/src/main/fasterWhisperManager.ts`: add asset metadata, SHA-256 verification, final host checks, temp-file cleanup, and verified status.
- Modify `apps/desktop-app/src/main/fasterWhisperManager.test.ts`: cover host rejection, hash mismatch, temp cleanup, successful verified rename, and unavailable production asset behavior.
- Create `apps/desktop-app/src/main/ipc/openFolder.ts`: shared main-owned folder creation, canonicalization, and `shell.openPath` wrapper.
- Modify `apps/desktop-app/src/main/ipc/handlers/settingsHandlers.ts`: remove the generic `usp:open-path` handler.
- Modify `apps/desktop-app/src/main/ipc/handlers/cacheHandlers.ts`: use `openFolder` for cache folder opening and return structured results.
- Modify `apps/desktop-app/src/main/ipc/handlers/fasterWhisperHandlers.ts`: add narrow Faster-Whisper folder-open handlers that resolve paths in main.
- Modify `apps/desktop-app/src/main/ipc/handlers/fasterWhisperHandlers.test.ts`: cover narrow open-folder IPC behavior.
- Modify `apps/desktop-app/src/main/ipc/securitySurface.test.ts`: assert preload and handlers no longer expose generic path opening.
- Modify `apps/desktop-app/src/preload.cts`: remove `openPath`; add `openFasterWhisperBinaryFolder` and `openFasterWhisperModelsFolder`.
- Modify `apps/desktop-app/src/renderer/components/settings/transcription/composables/useFasterWhisper.ts`: call narrow folder APIs without sending raw paths.
- Modify `apps/desktop-app/src/renderer/components/settings/transcription/FasterWhisperBinariesCard.vue`: emit a pathless binary-folder open command.
- Modify `apps/desktop-app/src/renderer/components/settings/transcription/FasterWhisperModelsCard.vue`: emit a pathless models-folder open command.
- Modify `apps/desktop-app/src/renderer/components/settings/TranscriptionFeatureSettings.vue`: wire the pathless open-folder commands.
- Modify `apps/desktop-app/src/renderer/components/settings/SettingsFeatures.test.ts`: update `window.usp` mocks and cover pathless folder opening.
- Modify `apps/desktop-app/src/main/subtitleCacheManager.ts`: canonicalize cache path, use `usp-cache-<sha256>.json`, and limit cleanup/stats to app-owned cache entries.
- Modify `apps/desktop-app/src/main/subtitleCacheManager.test.ts`: cover prefixed filenames, custom path normalization, stats filtering, and cleanup skipping unrelated/invalid files.

---

### Task 1: Shared URL And Resource Boundaries

**Files:**
- Modify: `apps/desktop-app/src/main/networkUrlSafety.ts`
- Modify: `apps/desktop-app/src/main/networkUrlSafety.test.ts`
- Create: `apps/desktop-app/src/main/resourceLimits.ts`

- [ ] **Step 1: Write failing tests for trusted HTTP(S) endpoint validation**

Add these tests to `apps/desktop-app/src/main/networkUrlSafety.test.ts` and update the import:

```ts
import { assertHttpUrl, assertPublicHttpUrl, isPublicHttpUrl } from "./networkUrlSafety.js";
```

```ts
it("accepts local and private HTTP(S) URLs for user-configured endpoints", () => {
  expect(assertHttpUrl("https://api.openai.com/v1", "Whisper API base URL")).toBe("https://api.openai.com/v1");
  expect(assertHttpUrl("http://127.0.0.1:8080/v1", "Whisper API base URL")).toBe(
    "http://127.0.0.1:8080/v1"
  );
  expect(assertHttpUrl("http://localhost:8080/v1", "Whisper API base URL")).toBe(
    "http://localhost:8080/v1"
  );
  expect(assertHttpUrl("http://192.168.1.20:8080/v1", "Whisper API base URL")).toBe(
    "http://192.168.1.20:8080/v1"
  );
});

it("rejects non HTTP(S) schemes for user-configured endpoints", () => {
  expect(() => assertHttpUrl("file:///tmp/socket", "Whisper API base URL")).toThrow(
    "Whisper API base URL must use http or https."
  );
  expect(() => assertHttpUrl("not a url", "Whisper API base URL")).toThrow(
    "Whisper API base URL must be a valid URL."
  );
});
```

- [ ] **Step 2: Run the URL tests and verify they fail**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app exec vitest run --project main src/main/networkUrlSafety.test.ts
```

Expected: FAIL because `assertHttpUrl` is not exported.

- [ ] **Step 3: Implement HTTP(S)-only endpoint validation**

Add this function to `apps/desktop-app/src/main/networkUrlSafety.ts` above `assertPublicHttpUrl`:

```ts
export function assertHttpUrl(input: string, label = "URL"): string {
  let parsed: URL;
  try {
    parsed = new URL(input);
  } catch {
    throw new Error(`${label} must be a valid URL.`);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`${label} must use http or https.`);
  }
  return parsed.toString();
}
```

Refactor `assertPublicHttpUrl` to call this helper before applying private-host blocking:

```ts
export function assertPublicHttpUrl(input: string, label = "URL"): string {
  const normalized = assertHttpUrl(input, label);
  const parsed = new URL(normalized);
  if (isBlockedLocalHost(parsed.hostname)) {
    throw new Error(`${label} cannot target local or private network hosts.`);
  }
  return normalized;
}
```

- [ ] **Step 4: Create centralized resource limit constants**

Create `apps/desktop-app/src/main/resourceLimits.ts`:

```ts
export const MAX_SUBTITLE_TEXT_BYTES = 100 * 1024 * 1024;
export const MAX_SUBTITLE_LINE_COUNT = 1_000_000;
export const MAX_SUBTITLE_CUE_COUNT = 1_000_000;
export const MAX_PROCESS_STDOUT_BYTES = 8 * 1024 * 1024;
export const MAX_PROCESS_STDERR_BYTES = 8 * 1024 * 1024;

export interface SubtitleParserLimits {
  maxInputBytes: number;
  maxLineCount: number;
  maxCueCount: number;
}

export const DEFAULT_SUBTITLE_PARSER_LIMITS: SubtitleParserLimits = {
  maxInputBytes: MAX_SUBTITLE_TEXT_BYTES,
  maxLineCount: MAX_SUBTITLE_LINE_COUNT,
  maxCueCount: MAX_SUBTITLE_CUE_COUNT
};

export function utf8ByteLength(value: string): number {
  return Buffer.byteLength(value, "utf8");
}

export function assertSubtitleTextWithinLimit(content: string, label: string): void {
  const byteLength = utf8ByteLength(content);
  if (byteLength > MAX_SUBTITLE_TEXT_BYTES) {
    throw new Error(`${label} exceeds ${MAX_SUBTITLE_TEXT_BYTES} bytes.`);
  }
}
```

- [ ] **Step 5: Run tests**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app exec vitest run --project main src/main/networkUrlSafety.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/desktop-app/src/main/networkUrlSafety.ts apps/desktop-app/src/main/networkUrlSafety.test.ts apps/desktop-app/src/main/resourceLimits.ts
git commit -m "fix: split trusted endpoint URL validation"
```

---

### Task 2: Whisper API Base URL Semantics

**Files:**
- Modify: `apps/desktop-app/src/main/transcriptionService.ts`
- Modify: `apps/desktop-app/src/main/transcriptionService.test.ts`
- Modify: `apps/desktop-app/src/main/features/transcriptionFeatureConfig.ts`
- Modify: `apps/desktop-app/src/main/features/transcriptionFeatureService.test.ts`
- Modify: `apps/desktop-app/src/main/settings/appSettingsSanitizer.ts`
- Modify: `apps/desktop-app/src/main/settings/appSettingsSanitizer.test.ts`

- [ ] **Step 1: Write failing runtime service tests**

Add `afterEach` to the imports in `apps/desktop-app/src/main/transcriptionService.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
```

Add cleanup after `createConfig`:

```ts
afterEach(() => {
  vi.unstubAllGlobals();
});
```

Add these tests inside the existing `describe("TranscriptionService", () => {` block:

```ts
it("builds Whisper API requests from local HTTP base URLs", async () => {
  const tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), "usp-whisper-api-"));
  const audioPath = path.join(tempDir, "audio.wav");
  await fsp.writeFile(audioPath, "fake-audio", "utf-8");
  const fetchMock = vi.fn().mockResolvedValue(
    Response.json({
      segments: [{ start: 0, end: 1, text: "hello" }]
    })
  );
  vi.stubGlobal("fetch", fetchMock);
  const service = new TranscriptionService(async () => "yt-dlp");
  const submitToWhisperApi = (service as unknown as {
    submitToWhisperApi(audioPath: string, config: TranscriptionConfig): Promise<SubtitleTrack>;
  }).submitToWhisperApi.bind(service);

  try {
    const track = await submitToWhisperApi(audioPath, createConfig({ baseUrl: "http://127.0.0.1:8080/v1" }));

    expect(track.cues[0]).toMatchObject({ start: 0, end: 1000, text: "hello" });
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:8080/v1/audio/transcriptions",
      expect.objectContaining({ method: "POST" })
    );
  } finally {
    await fsp.rm(tempDir, { recursive: true, force: true });
  }
});

it("rejects non HTTP(S) Whisper API base URLs before fetch", async () => {
  const tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), "usp-whisper-api-"));
  const audioPath = path.join(tempDir, "audio.wav");
  await fsp.writeFile(audioPath, "fake-audio", "utf-8");
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  const service = new TranscriptionService(async () => "yt-dlp");
  const submitToWhisperApi = (service as unknown as {
    submitToWhisperApi(audioPath: string, config: TranscriptionConfig): Promise<SubtitleTrack>;
  }).submitToWhisperApi.bind(service);

  try {
    await expect(submitToWhisperApi(audioPath, createConfig({ baseUrl: "file:///tmp/api" }))).rejects.toThrow(
      "Whisper API base URL must use http or https"
    );
    expect(fetchMock).not.toHaveBeenCalled();
  } finally {
    await fsp.rm(tempDir, { recursive: true, force: true });
  }
});
```

- [ ] **Step 2: Write failing feature config and settings tests**

Add these assertions to `apps/desktop-app/src/main/features/transcriptionFeatureService.test.ts` in the provider-specific validation test:

```ts
expect(buildFeatureTranscriptionConfig(createFeatureSettings({
  configs: [createRuntimeConfig({ baseUrl: "http://localhost:8080/v1" })]
}))).toMatchObject({
  baseUrl: "http://localhost:8080/v1"
});

expect(buildFeatureTranscriptionConfig(createFeatureSettings({
  configs: [createRuntimeConfig({ baseUrl: "http://192.168.1.20:8080/v1" })]
}))).toMatchObject({
  baseUrl: "http://192.168.1.20:8080/v1"
});
```

Add this test to `apps/desktop-app/src/main/settings/appSettingsSanitizer.test.ts` near the existing transcription config validation tests:

```ts
it("accepts local and private Whisper API base URLs in explicit transcription settings", () => {
  const settings = DEFAULT_SETTINGS_FACTORY();
  const config = settings.features.transcription.configs[0]!;

  for (const baseUrl of [
    "http://localhost:8080/v1",
    "http://127.0.0.1:8080/v1",
    "http://192.168.1.20:8080/v1"
  ]) {
    expect(() =>
      validateSettingsForUpdate(
        {
          features: {
            transcription: {
              enabled: true,
              activeConfigId: config.id,
              configs: [{ ...config, baseUrl }]
            }
          }
        },
        settings
      )
    ).not.toThrow();
  }
});
```

Add this assertion to the same test file's invalid transcription config fields test:

```ts
expect(() =>
  validateSettingsForUpdate(
    {
      features: {
        transcription: {
          enabled: true,
          activeConfigId: config.id,
          configs: [
            {
              ...config,
              baseUrl: "file:///tmp/api"
            }
          ]
        }
      }
    } as never,
    settings
  )
).toThrow("features.transcription.configs.0.baseUrl must use http or https");
```

- [ ] **Step 3: Run tests and verify they fail**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app exec vitest run --project main src/main/transcriptionService.test.ts src/main/features/transcriptionFeatureService.test.ts src/main/settings/appSettingsSanitizer.test.ts
```

Expected: FAIL because runtime still uses `assertPublicHttpUrl`, and settings validation does not yet share the new helper.

- [ ] **Step 4: Update runtime Whisper API URL validation**

In `apps/desktop-app/src/main/transcriptionService.ts`, change the import:

```ts
import { assertHttpUrl, assertPublicHttpUrl } from "./networkUrlSafety.js";
```

Change the endpoint construction in `submitToWhisperApi`:

```ts
const endpoint = buildTranscriptionUrl(assertHttpUrl(config.baseUrl, "Whisper API base URL"));
```

Leave this existing media-entry validation unchanged:

```ts
const safeVideoUrl = assertPublicHttpUrl(videoUrl, "Transcription video URL");
```

- [ ] **Step 5: Update active transcription config validation**

In `apps/desktop-app/src/main/features/transcriptionFeatureConfig.ts`, import `assertHttpUrl`:

```ts
import { assertHttpUrl } from "../networkUrlSafety.js";
```

Replace `requireHttpUrl` with:

```ts
function requireHttpUrl(value: string, fieldName: string): string {
  try {
    return assertHttpUrl(value, `Transcription ${fieldName}`);
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`Transcription ${fieldName} must be a valid HTTP(S) URL.`);
  }
}
```

Normalize `baseUrl` in the Whisper API branch:

```ts
if (config.provider === "whisper-api") {
  config.baseUrl = requireTrimmed(record, "baseUrl", "API base URL");
  config.baseUrl = requireHttpUrl(config.baseUrl, "API base URL");
  config.model = requireTrimmed(record, "model", "model");
}
```

- [ ] **Step 6: Update settings sanitizer validation**

In `apps/desktop-app/src/main/settings/appSettingsSanitizer.ts`, import `assertHttpUrl`:

```ts
import { assertHttpUrl } from "../networkUrlSafety.js";
```

After the provider check in `validateTranscriptionConfigRecord`, add:

```ts
if (config.provider === "whisper-api") {
  const baseUrl = (config.baseUrl as string).trim();
  if (!baseUrl) {
    throw new Error(`${context}.baseUrl must be a non-empty string for whisper-api`);
  }
  try {
    assertHttpUrl(baseUrl, `${context}.baseUrl`);
  } catch (error) {
    throw error instanceof Error ? error : new Error(`${context}.baseUrl must use http or https`);
  }
}
```

- [ ] **Step 7: Run tests**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app exec vitest run --project main src/main/networkUrlSafety.test.ts src/main/transcriptionService.test.ts src/main/features/transcriptionFeatureService.test.ts src/main/settings/appSettingsSanitizer.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/desktop-app/src/main/transcriptionService.ts apps/desktop-app/src/main/transcriptionService.test.ts apps/desktop-app/src/main/features/transcriptionFeatureConfig.ts apps/desktop-app/src/main/features/transcriptionFeatureService.test.ts apps/desktop-app/src/main/settings/appSettingsSanitizer.ts apps/desktop-app/src/main/settings/appSettingsSanitizer.test.ts
git commit -m "fix: allow trusted local whisper endpoints"
```

---

### Task 3: Faster-Whisper Binary Integrity

**Files:**
- Modify: `apps/desktop-app/src/main/fasterWhisperManager.ts`
- Modify: `apps/desktop-app/src/main/fasterWhisperManager.test.ts`

- [ ] **Step 1: Write failing integrity tests**

Update imports in `apps/desktop-app/src/main/fasterWhisperManager.test.ts`:

```ts
import { mkdtemp, mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
```

Add this helper near the top of the file:

```ts
function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function responseWithUrl(body: string, url: string): Response {
  const response = new Response(body, { status: 200 });
  Object.defineProperty(response, "url", { value: url });
  return response;
}
```

Add these tests:

```ts
it("disables production app-managed CPU binary download until trusted metadata exists", async () => {
  const baseDir = await mkdtemp(path.join(tmpdir(), "usp-fw-"));
  const manager = new FasterWhisperManager({ baseDir, platform: "win32" });

  const status = await manager.getStatus();

  expect(status.binaries.cpu.exists).toBe(false);
  expect(status.binaries.cpu.downloadSupported).toBe(false);
  expect(status.binaries.cpu.downloadUnavailableReason).toContain("trusted binary metadata");
  await expect(manager.downloadBinary("cpu")).rejects.toThrow("trusted binary metadata");
});

it("rejects app-managed binary downloads from unexpected final hosts", async () => {
  const baseDir = await mkdtemp(path.join(tmpdir(), "usp-fw-"));
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(responseWithUrl("binary", "https://evil.example/fw.exe")));
  const manager = new FasterWhisperManager({
    baseDir,
    platform: "win32",
    binaryAssets: {
      cpu: {
        url: "https://downloads.example.test/fw.exe",
        fileName: "faster-whisper.exe",
        expectedSha256: sha256("binary"),
        allowedFinalHosts: ["downloads.example.test"]
      }
    }
  });

  await expect(manager.downloadBinary("cpu")).rejects.toThrow("unexpected download host");
});

it("rejects app-managed binary downloads when SHA-256 does not match and removes the temp file", async () => {
  const baseDir = await mkdtemp(path.join(tmpdir(), "usp-fw-"));
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(responseWithUrl("tampered", "https://downloads.example.test/fw.exe"))
  );
  const manager = new FasterWhisperManager({
    baseDir,
    platform: "win32",
    binaryAssets: {
      cpu: {
        url: "https://downloads.example.test/fw.exe",
        fileName: "faster-whisper.exe",
        expectedSha256: sha256("expected"),
        allowedFinalHosts: ["downloads.example.test"]
      }
    }
  });

  await expect(manager.downloadBinary("cpu")).rejects.toThrow("could not be verified");

  const entries = await readdir(path.join(baseDir, "bin"));
  expect(entries).toEqual([]);
});

it("renames verified app-managed binary bytes into place only after verification succeeds", async () => {
  const baseDir = await mkdtemp(path.join(tmpdir(), "usp-fw-"));
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(responseWithUrl("verified", "https://downloads.example.test/fw.exe"))
  );
  const manager = new FasterWhisperManager({
    baseDir,
    platform: "win32",
    binaryAssets: {
      cpu: {
        url: "https://downloads.example.test/fw.exe",
        fileName: "faster-whisper.exe",
        expectedSha256: sha256("verified"),
        allowedFinalHosts: ["downloads.example.test"]
      }
    }
  });

  const targetPath = await manager.downloadBinary("cpu");
  const status = await manager.getStatus();

  expect(targetPath).toBe(path.join(baseDir, "bin", "faster-whisper.exe"));
  expect(await readFile(targetPath, "utf-8")).toBe("verified");
  expect(status.binaries.cpu.exists).toBe(true);
  expect(status.binaries.cpu.downloadSupported).toBe(true);
});

it("does not trust an existing app-managed binary whose hash does not match metadata", async () => {
  const baseDir = await mkdtemp(path.join(tmpdir(), "usp-fw-"));
  const targetPath = path.join(baseDir, "bin", "faster-whisper.exe");
  await mkdir(path.dirname(targetPath), { recursive: true });
  await writeFile(targetPath, "old-bytes", "utf-8");
  const manager = new FasterWhisperManager({
    baseDir,
    platform: "win32",
    binaryAssets: {
      cpu: {
        url: "https://downloads.example.test/fw.exe",
        fileName: "faster-whisper.exe",
        expectedSha256: sha256("new-bytes"),
        allowedFinalHosts: ["downloads.example.test"]
      }
    }
  });

  const status = await manager.getStatus();

  expect(status.binaries.cpu.exists).toBe(false);
});
```

- [ ] **Step 2: Run tests and verify they fail**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app exec vitest run --project main src/main/fasterWhisperManager.test.ts
```

Expected: FAIL because `binaryAssets`, hash checks, host checks, and disabled production metadata are not implemented.

- [ ] **Step 3: Add binary asset metadata types and constructor injection**

In `apps/desktop-app/src/main/fasterWhisperManager.ts`, change imports:

```ts
import { createHash, randomUUID } from "node:crypto";
```

Replace `WINDOWS_BINARY_ASSETS` with:

```ts
export interface FasterWhisperBinaryAsset {
  url: string;
  fileName: string;
  expectedSha256: string;
  allowedFinalHosts: string[];
}

type BinaryAssetMap = Partial<Record<FasterWhisperBinaryVariant, FasterWhisperBinaryAsset>>;

const WINDOWS_BINARY_ASSETS: BinaryAssetMap = {};
```

Update class fields and constructor:

```ts
  private readonly binaryAssets: BinaryAssetMap;

  constructor(options: { baseDir?: string; platform?: NodeJS.Platform; binaryAssets?: BinaryAssetMap } = {}) {
    this.baseDir = options.baseDir ?? path.join(app.getPath("userData"), "faster-whisper");
    this.binDir = path.join(this.baseDir, "bin");
    this.modelsDir = path.join(this.baseDir, "models");
    this.platform = options.platform ?? process.platform;
    this.binaryAssets = options.binaryAssets ?? WINDOWS_BINARY_ASSETS;
  }
```

- [ ] **Step 4: Make binary status depend on verified metadata**

Replace the binary part of `getStatus`:

```ts
    const [cpuStatus, gpuStatus, modelList] = await Promise.all([
      this.buildBinaryStatus("cpu", paths.cpuBinaryPath),
      this.buildBinaryStatus("gpu", paths.gpuBinaryPath),
      this.listDownloadedModels(targetModelDir)
    ]);
    return {
      paths,
      binaries: {
        cpu: cpuStatus,
        gpu: gpuStatus
      },
      models: modelList.models,
      modelsBaseDir: modelList.baseDir
    };
```

Replace `buildBinaryStatus`:

```ts
  private async buildBinaryStatus(variant: FasterWhisperBinaryVariant, targetPath: string) {
    const unavailableReason = this.getDownloadUnavailableReason(variant);
    const exists = unavailableReason === null
      ? await this.isVerifiedBinary(variant, targetPath)
      : await this.fileExists(targetPath);
    return {
      exists,
      path: targetPath,
      downloadSupported: unavailableReason === null,
      downloadUnavailableReason: unavailableReason
    };
  }
```

Add this helper:

```ts
  private async isVerifiedBinary(variant: FasterWhisperBinaryVariant, targetPath: string): Promise<boolean> {
    const asset = this.binaryAssets[variant];
    if (!asset || !(await this.fileExists(targetPath))) {
      return false;
    }
    return (await this.sha256File(targetPath)) === asset.expectedSha256;
  }
```

- [ ] **Step 5: Enforce metadata availability before download**

Update `getDownloadUnavailableReason`:

```ts
  private getDownloadUnavailableReason(variant: FasterWhisperBinaryVariant): string | null {
    if (variant === "gpu") {
      return "GPU binary installation is manual. Set the Faster-Whisper executable path in settings.";
    }
    if (this.platform !== "win32") {
      return "App-managed Faster-Whisper binary download is only available on Windows.";
    }
    if (!this.binaryAssets[variant]) {
      return "App-managed Faster-Whisper binary download requires trusted binary metadata.";
    }
    return null;
  }
```

- [ ] **Step 6: Verify download final host and SHA-256 before rename**

Replace `downloadBinary` body after `const targetPath = this.getTargetPath(variant);`:

```ts
    if (await this.isVerifiedBinary(variant, targetPath)) {
      return targetPath;
    }

    const unavailableReason = this.getDownloadUnavailableReason(variant);
    if (unavailableReason) {
      throw new Error(unavailableReason);
    }

    const asset = this.binaryAssets[variant];
    if (!asset) {
      throw new Error("App-managed Faster-Whisper binary download requires trusted binary metadata.");
    }
    progress?.(1, `Downloading ${variant.toUpperCase()} binary...`);
    await this.downloadVerifiedBinaryAsset(asset, targetPath, (percent) =>
      progress?.(Math.max(1, Math.min(99, percent)), `Downloading ${variant.toUpperCase()} binary...`)
    );

    progress?.(100, "Binary ready");
    return targetPath;
```

Add these helpers near `downloadFile`:

```ts
  private async downloadVerifiedBinaryAsset(
    asset: FasterWhisperBinaryAsset,
    targetPath: string,
    progress?: (percent: number) => void
  ): Promise<void> {
    const tempPath = path.join(this.binDir, `${asset.fileName}.${randomUUID()}.tmp`);
    try {
      const response = await fetch(asset.url);
      if (!response.ok || !response.body) {
        throw new Error(`Download failed: ${response.status} ${response.statusText}`);
      }
      this.assertAllowedFinalDownloadUrl(response.url || asset.url, asset);
      await this.writeResponseBody(response, tempPath, progress);
      const actualSha256 = await this.sha256File(tempPath);
      if (actualSha256 !== asset.expectedSha256) {
        throw new Error("Faster-Whisper binary could not be verified.");
      }
      await fs.mkdir(path.dirname(targetPath), { recursive: true });
      await fs.rename(tempPath, targetPath);
      await this.ensurePermissions(targetPath);
    } catch (error) {
      await fs.rm(tempPath, { force: true }).catch(() => undefined);
      throw error;
    }
  }

  private assertAllowedFinalDownloadUrl(finalUrl: string, asset: FasterWhisperBinaryAsset): void {
    let parsed: URL;
    try {
      parsed = new URL(finalUrl);
    } catch {
      throw new Error("Faster-Whisper binary download returned an invalid final URL.");
    }
    if (parsed.protocol !== "https:") {
      throw new Error("Faster-Whisper binary download must use HTTPS.");
    }
    if (!asset.allowedFinalHosts.includes(parsed.hostname)) {
      throw new Error("Faster-Whisper binary download reached an unexpected download host.");
    }
  }

  private async writeResponseBody(
    response: Response,
    targetPath: string,
    progress?: (percent: number) => void
  ): Promise<void> {
    const total = Number(response.headers.get("content-length") ?? 0);
    const readable = Readable.fromWeb(response.body as never);
    let downloaded = 0;
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await new Promise<void>((resolve, reject) => {
      const fileStream = createWriteStream(targetPath);
      fileStream.on("error", reject);
      fileStream.on("finish", resolve);
      readable.on("data", (chunk: Buffer) => {
        downloaded += chunk.length;
        if (progress && total > 0) {
          progress(Math.min(99, Math.round((downloaded / total) * 100)));
        }
      });
      readable.on("error", reject);
      readable.pipe(fileStream);
    });
    progress?.(100);
  }

  private async sha256File(targetPath: string): Promise<string> {
    const hash = createHash("sha256");
    const content = await fs.readFile(targetPath);
    hash.update(content);
    return hash.digest("hex");
  }
```

Leave `downloadFile` in place for model downloads.

- [ ] **Step 7: Run tests**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app exec vitest run --project main src/main/fasterWhisperManager.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/desktop-app/src/main/fasterWhisperManager.ts apps/desktop-app/src/main/fasterWhisperManager.test.ts
git commit -m "fix: verify app-managed faster-whisper binaries"
```

---

### Task 4: Subtitle And Process Resource Limits

**Files:**
- Modify: `apps/desktop-app/src/main/subtitleParser.ts`
- Modify: `apps/desktop-app/src/main/subtitleParser.test.ts`
- Modify: `apps/desktop-app/src/main/subtitleService.ts`
- Modify: `apps/desktop-app/src/main/subtitleService.test.ts`
- Modify: `apps/desktop-app/src/main/transcriptionService.ts`
- Modify: `apps/desktop-app/src/main/transcriptionService.test.ts`
- Modify: `apps/desktop-app/src/main/resourceLimits.ts`

- [ ] **Step 1: Write failing parser limit tests**

Update imports in `apps/desktop-app/src/main/subtitleParser.test.ts`:

```ts
import {
  DEFAULT_SUBTITLE_PARSER_LIMITS,
  MAX_SUBTITLE_CUE_COUNT,
  MAX_SUBTITLE_LINE_COUNT,
  MAX_SUBTITLE_TEXT_BYTES
} from "./resourceLimits.js";
```

Add these tests:

```ts
it("exports broad final parser limits", () => {
  expect(MAX_SUBTITLE_TEXT_BYTES).toBe(100 * 1024 * 1024);
  expect(MAX_SUBTITLE_LINE_COUNT).toBe(1_000_000);
  expect(MAX_SUBTITLE_CUE_COUNT).toBe(1_000_000);
  expect(DEFAULT_SUBTITLE_PARSER_LIMITS).toEqual({
    maxInputBytes: MAX_SUBTITLE_TEXT_BYTES,
    maxLineCount: MAX_SUBTITLE_LINE_COUNT,
    maxCueCount: MAX_SUBTITLE_CUE_COUNT
  });
});

it("rejects direct subtitle input above the configured byte limit", () => {
  expect(() =>
    parseSubtitle("123456", "srt", {
      maxInputBytes: 5,
      maxLineCount: MAX_SUBTITLE_LINE_COUNT,
      maxCueCount: MAX_SUBTITLE_CUE_COUNT
    })
  ).toThrow("Subtitle parser input exceeds 5 bytes.");
});

it("rejects direct subtitle input above the configured line cap", () => {
  expect(() =>
    parseSubtitle("a\nb\nc", "srt", {
      maxInputBytes: MAX_SUBTITLE_TEXT_BYTES,
      maxLineCount: 2,
      maxCueCount: MAX_SUBTITLE_CUE_COUNT
    })
  ).toThrow("Subtitle parser input exceeds 2 lines.");
});

it("rejects direct subtitle input above the configured cue cap", () => {
  const srt = [
    "1",
    "00:00:00,000 --> 00:00:01,000",
    "One",
    "",
    "2",
    "00:00:01,000 --> 00:00:02,000",
    "Two",
    ""
  ].join("\n");

  expect(() =>
    parseSubtitle(srt, "srt", {
      maxInputBytes: MAX_SUBTITLE_TEXT_BYTES,
      maxLineCount: MAX_SUBTITLE_LINE_COUNT,
      maxCueCount: 1
    })
  ).toThrow("Subtitle parser cue count exceeds 1.");
});
```

- [ ] **Step 2: Write failing process and file limit tests**

Update imports in `apps/desktop-app/src/main/subtitleService.test.ts`:

```ts
import {
  MAX_PROCESS_STDERR_BYTES,
  MAX_PROCESS_STDOUT_BYTES,
  MAX_SUBTITLE_TEXT_BYTES
} from "./resourceLimits.js";
import { runCommand, SubtitleService } from "./subtitleService.js";
```

Add this fake yt-dlp helper after `createFakeYtDlpScript`:

```ts
async function createOversizedSubtitleYtDlpScript(): Promise<string> {
  const scriptPath = path.join(tempDir, "fake-ytdlp-oversized.cjs");
  await fsp.writeFile(
    scriptPath,
    `#!/usr/bin/env node
const fs = require("node:fs");
function argValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}
const output = argValue("-o");
const subtitlePath = output + ".en.srt";
fs.writeFileSync(subtitlePath, "1\\n00:00:00,000 --> 00:00:01,000\\nhello\\n", "utf-8");
fs.truncateSync(subtitlePath, ${MAX_SUBTITLE_TEXT_BYTES + 1});
`,
    "utf-8"
  );
  await fsp.chmod(scriptPath, 0o755);
  return scriptPath;
}
```

Add these tests:

```ts
it("rejects subtitle files larger than 100 MiB before reading them", async () => {
  const scriptPath = await createOversizedSubtitleYtDlpScript();
  const service = new SubtitleService(
    async () => scriptPath,
    () => ({ ytDlpArgs: "--sub-lang en" })
  );

  await expect(service.getSubtitles("https://video.example.test/watch")).rejects.toThrow(
    `Subtitle file exceeds ${MAX_SUBTITLE_TEXT_BYTES} bytes`
  );
});

it("terminates commands when stdout exceeds the process output cap", async () => {
  await expect(
    runCommand(
      process.execPath,
      ["-e", `process.stdout.write("x".repeat(${MAX_PROCESS_STDOUT_BYTES + 1}))`],
      tempDir,
      "node"
    )
  ).rejects.toThrow(`stdout exceeded ${MAX_PROCESS_STDOUT_BYTES} bytes`);
});

it("terminates commands when stderr exceeds the process output cap", async () => {
  await expect(
    runCommand(
      process.execPath,
      ["-e", `process.stderr.write("x".repeat(${MAX_PROCESS_STDERR_BYTES + 1}))`],
      tempDir,
      "node"
    )
  ).rejects.toThrow(`stderr exceeded ${MAX_PROCESS_STDERR_BYTES} bytes`);
});
```

Add this test to `apps/desktop-app/src/main/transcriptionService.test.ts`:

```ts
it("rejects oversized Faster-Whisper subtitle output before reading it", async () => {
  const tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), "usp-fw-output-"));
  const audioPath = path.join(tempDir, "audio.wav");
  const subtitlePath = path.join(tempDir, "audio.srt");
  await fsp.writeFile(audioPath, "fake-audio", "utf-8");
  await fsp.writeFile(subtitlePath, "1\n00:00:00,000 --> 00:00:01,000\nhello\n", "utf-8");
  await fsp.truncate(subtitlePath, 100 * 1024 * 1024 + 1);
  const service = new TranscriptionService(async () => "yt-dlp");
  const readFasterWhisperOutput = (service as unknown as {
    readFasterWhisperOutput(audioPath: string): Promise<{ path: string; content: string }>;
  }).readFasterWhisperOutput.bind(service);

  try {
    await expect(readFasterWhisperOutput(audioPath)).rejects.toThrow("Subtitle file exceeds 104857600 bytes");
  } finally {
    await fsp.rm(tempDir, { recursive: true, force: true });
  }
});
```

- [ ] **Step 3: Run tests and verify they fail**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app exec vitest run --project main src/main/subtitleParser.test.ts src/main/subtitleService.test.ts src/main/transcriptionService.test.ts
```

Expected: FAIL because parser options, file-size checks, and process output caps are not implemented.

- [ ] **Step 4: Enforce parser limits**

In `apps/desktop-app/src/main/subtitleParser.ts`, add imports:

```ts
import {
  DEFAULT_SUBTITLE_PARSER_LIMITS,
  type SubtitleParserLimits,
  utf8ByteLength
} from "./resourceLimits.js";
```

Change the parse signature:

```ts
export function parseSubtitle(
  content: string,
  extension: string,
  limits: SubtitleParserLimits = DEFAULT_SUBTITLE_PARSER_LIMITS
): SubtitleCue[] {
  assertParserInputWithinLimits(content, limits);
  const normalized = content.replace(/\ufeff/g, '');
  const normalizedExtension = extension.toLowerCase();

  if (normalizedExtension === "srt") {
    return parseSrt(normalized, limits);
  }
  if (normalizedExtension === "vtt") {
    return parseVtt(normalized, limits);
  }
  throw new Error(`Unsupported subtitle extension: ${extension}`);
}
```

Add helpers:

```ts
function assertParserInputWithinLimits(content: string, limits: SubtitleParserLimits): void {
  const byteLength = utf8ByteLength(content);
  if (byteLength > limits.maxInputBytes) {
    throw new Error(`Subtitle parser input exceeds ${limits.maxInputBytes} bytes.`);
  }
  const lineCount = countLines(content);
  if (lineCount > limits.maxLineCount) {
    throw new Error(`Subtitle parser input exceeds ${limits.maxLineCount} lines.`);
  }
}

function countLines(content: string): number {
  if (!content.length) {
    return 0;
  }
  let count = 1;
  for (let index = 0; index < content.length; index += 1) {
    if (content.charCodeAt(index) === 10) {
      count += 1;
    }
  }
  return count;
}

function pushCue(cues: SubtitleCue[], cue: SubtitleCue, limits: SubtitleParserLimits): void {
  if (cues.length >= limits.maxCueCount) {
    throw new Error(`Subtitle parser cue count exceeds ${limits.maxCueCount}.`);
  }
  cues.push(cue);
}
```

Update parser helpers to accept limits:

```ts
function parseVtt(content: string, limits: SubtitleParserLimits): SubtitleCue[] {
  const rawCues = readRawVttCues(content);
  if (!rawCues.length) {
    return [];
  }

  if (isYoutubeWordLevelVtt(rawCues)) {
    return collapseYoutubeWordLevelCues(rawCues, limits);
  }

  const cues: SubtitleCue[] = [];
  for (const cue of rawCues) {
    const text = formatCueText(cue.lines);
    if (!text) continue;
    pushCue(cues, { start: cue.start, end: cue.end, text }, limits);
  }
  return cues;
}

function collapseYoutubeWordLevelCues(rawCues: RawVttCue[], limits: SubtitleParserLimits): SubtitleCue[] {
  const cues: SubtitleCue[] = [];
  for (let i = 0; i < rawCues.length; i += 1) {
    const current = rawCues[i];
    if (cueDuration(current) <= YOUTUBE_SHORT_CUE_THRESHOLD) {
      continue;
    }

    const next = rawCues[i + 1];
    const hasShortPartner = Boolean(next && cueDuration(next) <= YOUTUBE_SHORT_CUE_THRESHOLD);
    let text = formatCueText(hasShortPartner ? next!.lines : current.lines);
    if (!text && hasShortPartner) {
      text = formatCueText(current.lines);
    }
    if (text) {
      pushCue(cues, { start: current.start, end: current.end, text }, limits);
    }
    if (hasShortPartner) {
      i += 1;
    }
  }
  return cues;
}

function parseSrt(content: string, limits: SubtitleParserLimits): SubtitleCue[] {
  const blocks = content.replace(/\r/g, "").split(/\n\s*\n/);
  const cues: SubtitleCue[] = [];

  for (const block of blocks) {
    const lines = block
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    if (!lines.length) continue;

    let cursor = 0;
    if (/^\d+$/.test(lines[cursor])) {
      cursor += 1;
    }
    if (cursor >= lines.length) continue;

    const timingLine = lines[cursor];
    const match = timingLine.match(/(.+?)\s+-->\s+(.+)/);
    if (!match) continue;

    const start = parseTimestamp(match[1].trim());
    const end = parseTimestamp(match[2].trim());
    const text = sanitizeCueText(lines.slice(cursor + 1).map(stripTags).join("\n"));
    if (!Number.isNaN(start) && !Number.isNaN(end) && text) {
      pushCue(cues, { start, end, text }, limits);
    }
  }

  return cues;
}
```

When editing `parseSrt`, keep its existing block parsing and replace only the direct `cues.push` call with `pushCue`.

- [ ] **Step 5: Add subtitle file-size checks before reads**

In `apps/desktop-app/src/main/subtitleService.ts`, import:

```ts
import {
  MAX_PROCESS_STDERR_BYTES,
  MAX_PROCESS_STDOUT_BYTES,
  MAX_SUBTITLE_TEXT_BYTES
} from "./resourceLimits.js";
```

Add helper near `createYtDlpArgsVariant`:

```ts
async function readSubtitleTextFile(filePath: string): Promise<string> {
  const fileStat = await fs.stat(filePath);
  if (fileStat.size > MAX_SUBTITLE_TEXT_BYTES) {
    throw new Error(`Subtitle file exceeds ${MAX_SUBTITLE_TEXT_BYTES} bytes.`);
  }
  return fs.readFile(filePath, "utf-8");
}
```

Replace subtitle file reads:

```ts
const content = await readSubtitleTextFile(filePath);
```

In `apps/desktop-app/src/main/transcriptionService.ts`, import:

```ts
import { MAX_SUBTITLE_TEXT_BYTES } from "./resourceLimits.js";
```

In `readFasterWhisperOutput`, replace the read with:

```ts
        const fileStat = await fs.stat(candidate);
        if (fileStat.size > MAX_SUBTITLE_TEXT_BYTES) {
          throw new Error(`Subtitle file exceeds ${MAX_SUBTITLE_TEXT_BYTES} bytes.`);
        }
        const content = await fs.readFile(candidate, "utf-8");
        return { path: candidate, content };
```

- [ ] **Step 6: Cap stdout and stderr in runCommand**

In `apps/desktop-app/src/main/subtitleService.ts`, replace the `child.stdout` and `child.stderr` handlers inside `runCommand` with bounded collection:

```ts
    let stdoutBytes = 0;
    let stderrBytes = 0;
    let limitError: CommandExecutionError | null = null;

    const failForOutputLimit = (streamName: "stdout" | "stderr", limit: number): void => {
      if (limitError) {
        return;
      }
      limitError = new CommandExecutionError(`${name} ${streamName} exceeded ${limit} bytes.`, info);
      child.kill();
    };

    child.stdout?.on("data", (chunk: Buffer) => {
      stdoutBytes += chunk.length;
      if (stdoutBytes > MAX_PROCESS_STDOUT_BYTES) {
        failForOutputLimit("stdout", MAX_PROCESS_STDOUT_BYTES);
        return;
      }
      info.stdout += decodeBuffer(chunk);
    });

    child.stderr?.on("data", (chunk: Buffer) => {
      stderrBytes += chunk.length;
      if (stderrBytes > MAX_PROCESS_STDERR_BYTES) {
        failForOutputLimit("stderr", MAX_PROCESS_STDERR_BYTES);
        return;
      }
      info.stderr += decodeBuffer(chunk);
    });
```

Update the close handler to reject the limit error first:

```ts
    child.on("close", (code) => {
      if (limitError) {
        reject(limitError);
        return;
      }
      if (code === 0) {
        resolve({ stdout: info.stdout, stderr: info.stderr });
      } else {
        info.exitCode = code ?? null;
        reject(
          new CommandExecutionError(
            info.stderr || `${name} exited with code ${code}`,
            info
          )
        );
      }
    });
```

- [ ] **Step 7: Run tests**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app exec vitest run --project main src/main/subtitleParser.test.ts src/main/subtitleService.test.ts src/main/transcriptionService.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/desktop-app/src/main/resourceLimits.ts apps/desktop-app/src/main/subtitleParser.ts apps/desktop-app/src/main/subtitleParser.test.ts apps/desktop-app/src/main/subtitleService.ts apps/desktop-app/src/main/subtitleService.test.ts apps/desktop-app/src/main/transcriptionService.ts apps/desktop-app/src/main/transcriptionService.test.ts
git commit -m "fix: bound subtitle parsing and process output"
```

---

### Task 5: Narrow Folder-Open IPC Surface

**Files:**
- Create: `apps/desktop-app/src/main/ipc/openFolder.ts`
- Modify: `apps/desktop-app/src/main/ipc/handlers/settingsHandlers.ts`
- Modify: `apps/desktop-app/src/main/ipc/handlers/cacheHandlers.ts`
- Modify: `apps/desktop-app/src/main/ipc/handlers/fasterWhisperHandlers.ts`
- Modify: `apps/desktop-app/src/main/ipc/handlers/fasterWhisperHandlers.test.ts`
- Modify: `apps/desktop-app/src/main/ipc/securitySurface.test.ts`
- Modify: `apps/desktop-app/src/preload.cts`
- Modify: `apps/desktop-app/src/renderer/components/settings/transcription/composables/useFasterWhisper.ts`
- Modify: `apps/desktop-app/src/renderer/components/settings/transcription/FasterWhisperBinariesCard.vue`
- Modify: `apps/desktop-app/src/renderer/components/settings/transcription/FasterWhisperModelsCard.vue`
- Modify: `apps/desktop-app/src/renderer/components/settings/TranscriptionFeatureSettings.vue`
- Modify: `apps/desktop-app/src/renderer/components/settings/SettingsFeatures.test.ts`

- [ ] **Step 1: Write failing security surface test**

Add to `apps/desktop-app/src/main/ipc/securitySurface.test.ts`:

```ts
  it("does not expose generic renderer-controlled path opening", () => {
    const preload = readSource("src/preload.cts");
    const settingsHandlers = readSource("src/main/ipc/handlers/settingsHandlers.ts");
    const transcriptionSettings = readSource("src/renderer/components/settings/TranscriptionFeatureSettings.vue");
    const fasterWhisperComposable = readSource(
      "src/renderer/components/settings/transcription/composables/useFasterWhisper.ts"
    );

    expect(preload).not.toContain("openPath:");
    expect(preload).not.toContain("usp:open-path");
    expect(settingsHandlers).not.toContain("usp:open-path");
    expect(transcriptionSettings).not.toContain("@open-path");
    expect(fasterWhisperComposable).not.toContain("window.usp.openPath");
    expect(preload).toContain("openFasterWhisperBinaryFolder");
    expect(preload).toContain("openFasterWhisperModelsFolder");
  });
```

- [ ] **Step 2: Write failing Faster-Whisper handler tests**

Update the Electron mock in `apps/desktop-app/src/main/ipc/handlers/fasterWhisperHandlers.test.ts`:

```ts
const { handle, openPath } = vi.hoisted(() => ({
  handle: vi.fn(),
  openPath: vi.fn()
}));

vi.mock("electron", () => ({
  ipcMain: {
    handle
  },
  shell: {
    openPath
  }
}));
```

Add `beforeEach` reset:

```ts
openPath.mockReset();
openPath.mockResolvedValue("");
```

Add tests:

```ts
it("opens the app-managed Faster-Whisper binary folder without renderer paths", async () => {
  registerFasterWhisperHandlers({
    fasterWhisperManager: {
      getStatus: vi.fn(),
      getPaths: vi.fn().mockResolvedValue({
        binaryDir: "/tmp/fw/bin",
        modelsDir: "/tmp/fw/models",
        cpuBinaryPath: "/tmp/fw/bin/faster-whisper",
        gpuBinaryPath: "/tmp/fw/bin/faster-whisper-xxl"
      }),
      listDownloadedModels: vi.fn(),
      downloadBinary: vi.fn(),
      downloadModel: vi.fn()
    },
    getSettings: vi.fn(),
    logger: { error: vi.fn() }
  } as never);

  await expect(registeredHandler("usp:faster-whisper-open-binary-folder")({})).resolves.toEqual({ ok: true });
  expect(openPath).toHaveBeenCalledWith(expect.stringContaining("/tmp/fw/bin"));
});

it("opens a selected config model folder by config id instead of renderer path", async () => {
  registerFasterWhisperHandlers({
    fasterWhisperManager: {
      getStatus: vi.fn(),
      getPaths: vi.fn().mockResolvedValue({
        binaryDir: "/tmp/fw/bin",
        modelsDir: "/tmp/fw/models",
        cpuBinaryPath: "/tmp/fw/bin/faster-whisper",
        gpuBinaryPath: "/tmp/fw/bin/faster-whisper-xxl"
      }),
      listDownloadedModels: vi.fn(),
      downloadBinary: vi.fn(),
      downloadModel: vi.fn()
    },
    getSettings: vi.fn(() => ({
      features: {
        transcription: {
          configs: [{ id: "config-a", fasterWhisperModelDir: "/tmp/custom-models" }]
        }
      }
    })),
    logger: { error: vi.fn() }
  } as never);

  await expect(
    registeredHandler("usp:faster-whisper-open-models-folder")({}, { configId: "config-a" })
  ).resolves.toEqual({ ok: true });
  expect(openPath).toHaveBeenCalledWith(expect.stringContaining("/tmp/custom-models"));
});
```

- [ ] **Step 3: Write failing renderer test**

In `apps/desktop-app/src/renderer/components/settings/SettingsFeatures.test.ts`, replace default `window.usp.openPath` mock with:

```ts
openFasterWhisperBinaryFolder: vi.fn().mockResolvedValue({ ok: true }),
openFasterWhisperModelsFolder: vi.fn().mockResolvedValue({ ok: true })
```

Add this test:

```ts
it("opens Faster-Whisper folders through narrow pathless APIs", async () => {
  const store = seedStore();
  store.settings!.features.transcription.activeConfigId = "config-a";
  store.settings!.features.transcription.configs = [
    createTranscriptionConfig({ id: "config-a", provider: "faster-whisper", fasterWhisperModelDir: "/custom/models" })
  ];
  const openFasterWhisperBinaryFolder = vi.fn().mockResolvedValue({ ok: true });
  const openFasterWhisperModelsFolder = vi.fn().mockResolvedValue({ ok: true });
  Object.defineProperty(window, "usp", {
    configurable: true,
    value: {
      ...window.usp,
      openFasterWhisperBinaryFolder,
      openFasterWhisperModelsFolder
    }
  });
  const wrapper = mount(TranscriptionFeatureSettings);
  await flushPromises();

  await wrapper.getComponent(FasterWhisperBinariesCard).findAll('[data-slot="button"]')[0]!.trigger("click");
  await wrapper.getComponent(FasterWhisperModelsCard).findAll('[data-slot="button"]')[0]!.trigger("click");

  expect(openFasterWhisperBinaryFolder).toHaveBeenCalledWith();
  expect(openFasterWhisperModelsFolder).toHaveBeenCalledWith({ configId: "config-a" });
});
```

- [ ] **Step 4: Run tests and verify they fail**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app exec vitest run --project main src/main/ipc/securitySurface.test.ts src/main/ipc/handlers/fasterWhisperHandlers.test.ts
pnpm --filter @immersive-subs/desktop-app exec vitest run --project jsdom src/renderer/components/settings/SettingsFeatures.test.ts
```

Expected: FAIL because generic `openPath` still exists and narrow handlers are missing.

- [ ] **Step 5: Add shared folder opener**

Create `apps/desktop-app/src/main/ipc/openFolder.ts`:

```ts
import { shell } from "electron";
import { promises as fs } from "node:fs";
import path from "node:path";

export type OpenFolderResult = { ok: true } | { ok: false; error: string };

export async function openFolder(targetPath: string, operation: string): Promise<OpenFolderResult> {
  try {
    const trimmed = targetPath.trim();
    if (!trimmed) {
      throw new Error(`${operation} path is empty.`);
    }
    const resolved = path.resolve(trimmed);
    await fs.mkdir(resolved, { recursive: true });
    const canonical = await fs.realpath(resolved);
    const shellError = await shell.openPath(canonical);
    if (shellError) {
      throw new Error(shellError);
    }
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: message };
  }
}
```

- [ ] **Step 6: Remove generic open path handler**

In `apps/desktop-app/src/main/ipc/handlers/settingsHandlers.ts`, remove `shell` and `fs` imports:

```ts
import { dialog, ipcMain } from "electron";
```

Delete the entire `usp:open-path` handler. After deletion, `apps/desktop-app/src/main/ipc/handlers/settingsHandlers.ts` keeps only settings retrieval, settings updates, and word-list file selection:

```ts
export function registerSettingsHandlers(context: IpcContext) {
  ipcMain.handle("usp:get-settings", () => context.getSettings());

  ipcMain.handle("usp:update-settings", (_event, payload: Partial<AppSettings>) => {
    return context.updateAppSettings(payload);
  });

  ipcMain.handle("usp:select-word-list-file", async () => {
    const result = await dialog.showOpenDialog({
      title: "Select Word List",
      properties: ["openFile"],
      filters: [
        { name: "JSONL", extensions: ["jsonl"] },
        { name: "JSON", extensions: ["json"] },
        { name: "All Files", extensions: ["*"] }
      ]
    });
    return {
      canceled: result.canceled,
      path: result.canceled ? null : result.filePaths[0] ?? null
    };
  });
}
```

- [ ] **Step 7: Update cache folder handler**

In `apps/desktop-app/src/main/ipc/handlers/cacheHandlers.ts`, replace imports with:

```ts
import { ipcMain } from "electron";
import { IpcContext } from "../ipcRouter.js";
import { openFolder } from "../openFolder.js";
```

Replace the open handler:

```ts
  ipcMain.handle("usp:cache-open-folder", async () => {
    const result = await openFolder(context.cacheManager.getCachePath(), "Cache folder");
    if (!result.ok) {
      context.logger.error("Failed to open cache folder", result.error);
    }
    return result;
  });
```

- [ ] **Step 8: Add narrow Faster-Whisper folder handlers**

In `apps/desktop-app/src/main/ipc/handlers/fasterWhisperHandlers.ts`, import `openFolder`:

```ts
import { openFolder } from "../openFolder.js";
```

Add payload type:

```ts
type OpenModelsFolderPayload = { configId?: string };
```

Add handlers after `usp:faster-whisper-paths`:

```ts
  ipcMain.handle("usp:faster-whisper-open-binary-folder", async () => {
    const paths = await context.fasterWhisperManager.getPaths();
    const result = await openFolder(paths.binaryDir, "Faster-Whisper binary folder");
    if (!result.ok) {
      context.logger.error("Failed to open Faster-Whisper binary folder", result.error);
    }
    return result;
  });

  ipcMain.handle("usp:faster-whisper-open-models-folder", async (_event, payload?: OpenModelsFolderPayload) => {
    const paths = await context.fasterWhisperManager.getPaths();
    const configId = payload?.configId;
    const config = configId
      ? context.getSettings().features.transcription.configs.find((item) => item.id === configId)
      : null;
    const targetPath = config?.fasterWhisperModelDir.trim() || paths.modelsDir;
    const result = await openFolder(targetPath, "Faster-Whisper models folder");
    if (!result.ok) {
      context.logger.error("Failed to open Faster-Whisper models folder", result.error);
    }
    return result;
  });
```

- [ ] **Step 9: Update preload API**

In `apps/desktop-app/src/preload.cts`, remove:

```ts
  openPath: (targetPath: string): Promise<{ ok: boolean; error?: string }> =>
    ipcRenderer.invoke("usp:open-path", targetPath),
```

Add:

```ts
  openFasterWhisperBinaryFolder: (): Promise<{ ok: boolean; error?: string }> =>
    ipcRenderer.invoke("usp:faster-whisper-open-binary-folder"),
  openFasterWhisperModelsFolder: (payload?: { configId?: string }): Promise<{ ok: boolean; error?: string }> =>
    ipcRenderer.invoke("usp:faster-whisper-open-models-folder", payload),
```

Change `openCacheFolder` return type:

```ts
  openCacheFolder: (): Promise<{ ok: boolean; error?: string }> => ipcRenderer.invoke("usp:cache-open-folder"),
```

- [ ] **Step 10: Update Faster-Whisper renderer calls**

In `apps/desktop-app/src/renderer/components/settings/transcription/composables/useFasterWhisper.ts`, replace `openPath`:

```ts
  async function openBinaryFolder() {
    await window.usp.openFasterWhisperBinaryFolder();
  }

  async function openModelsFolder() {
    await window.usp.openFasterWhisperModelsFolder(
      activeConfig.value?.id ? { configId: activeConfig.value.id } : undefined
    );
  }
```

Return the new functions:

```ts
    openBinaryFolder,
    openModelsFolder
```

In `FasterWhisperBinariesCard.vue`, change the button:

```vue
<UiButton v-if="paths" size="sm" variant="ghost" @click="$emit('openBinaryFolder')">
```

Change emits:

```ts
defineEmits<{
  downloadBinary: [variant: "cpu" | "gpu"];
  openBinaryFolder: [];
}>();
```

In `FasterWhisperModelsCard.vue`, change the button:

```vue
<UiButton v-if="paths" size="sm" variant="ghost" @click="$emit('openModelsFolder')">
```

Change emits:

```ts
defineEmits<{
  downloadModel: [];
  openModelsFolder: [];
}>();
```

In `TranscriptionFeatureSettings.vue`, change bindings:

```vue
        <FasterWhisperBinariesCard
          v-bind="fasterWhisperBindings"
          @download-binary="handleDownloadBinary"
          @open-binary-folder="openBinaryFolder"
        />
        <FasterWhisperModelsCard
          v-bind="fasterWhisperBindings"
          @download-model="handleDownloadModel"
          @open-models-folder="openModelsFolder"
        />
```

Change composable destructuring:

```ts
  openBinaryFolder,
  openModelsFolder
```

- [ ] **Step 11: Run tests**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app exec vitest run --project main src/main/ipc/securitySurface.test.ts src/main/ipc/handlers/fasterWhisperHandlers.test.ts
pnpm --filter @immersive-subs/desktop-app exec vitest run --project jsdom src/renderer/components/settings/SettingsFeatures.test.ts
pnpm --filter @immersive-subs/desktop-app typecheck:preload
pnpm --filter @immersive-subs/desktop-app typecheck:renderer
```

Expected: PASS.

- [ ] **Step 12: Commit**

```bash
git add apps/desktop-app/src/main/ipc/openFolder.ts apps/desktop-app/src/main/ipc/handlers/settingsHandlers.ts apps/desktop-app/src/main/ipc/handlers/cacheHandlers.ts apps/desktop-app/src/main/ipc/handlers/fasterWhisperHandlers.ts apps/desktop-app/src/main/ipc/handlers/fasterWhisperHandlers.test.ts apps/desktop-app/src/main/ipc/securitySurface.test.ts apps/desktop-app/src/preload.cts apps/desktop-app/src/renderer/components/settings/transcription/composables/useFasterWhisper.ts apps/desktop-app/src/renderer/components/settings/transcription/FasterWhisperBinariesCard.vue apps/desktop-app/src/renderer/components/settings/transcription/FasterWhisperModelsCard.vue apps/desktop-app/src/renderer/components/settings/TranscriptionFeatureSettings.vue apps/desktop-app/src/renderer/components/settings/SettingsFeatures.test.ts
git commit -m "fix: replace generic path opening with folder APIs"
```

---

### Task 6: Cache Path Ownership Boundaries

**Files:**
- Modify: `apps/desktop-app/src/main/subtitleCacheManager.ts`
- Modify: `apps/desktop-app/src/main/subtitleCacheManager.test.ts`

- [ ] **Step 1: Write failing cache ownership tests**

Add these tests to `apps/desktop-app/src/main/subtitleCacheManager.test.ts`:

```ts
it("writes cache files with the app-owned prefix", async () => {
  manager = new SubtitleCacheManager(() => makeSettings());

  await manager.set("http://x", "ytdlp", makeData("prefixed"));

  const files = await fsp.readdir(cacheDir);
  expect(files).toHaveLength(1);
  expect(files[0]).toMatch(/^usp-cache-[a-f0-9]{64}\.json$/);
});

it("normalizes custom cache paths before use", async () => {
  manager = new SubtitleCacheManager(() => makeSettings({ path: path.join(cacheDir, "nested", "..", "custom") }));

  expect(manager.getCachePath()).toBe(path.join(cacheDir, "custom"));
});

it("reports stats only for matching cache-owned files with valid cache shape", async () => {
  manager = new SubtitleCacheManager(() => makeSettings());
  await manager.set("http://a", "ytdlp", makeData("a"));
  await fsp.writeFile(path.join(cacheDir, "notes.json"), JSON.stringify({ timestamp: 1 }), "utf-8");
  await fsp.writeFile(path.join(cacheDir, "usp-cache-invalid.json"), JSON.stringify({ timestamp: 1 }), "utf-8");
  await fsp.writeFile(
    path.join(cacheDir, `usp-cache-${"a".repeat(64)}.json`),
    JSON.stringify({ timestamp: 1, data: null }),
    "utf-8"
  );

  const stats = await manager.getStats();

  expect(stats.totalEntries).toBe(1);
});

it("cleanup skips unrelated json and invalid cache-shaped filenames", async () => {
  manager = new SubtitleCacheManager(() => makeSettings({ retentionDays: 1 }));
  await manager.set("http://x", "ytdlp", makeData("stale"));
  await ageOnlyCacheFile(2 * 24 * 60 * 60 * 1000);
  await fsp.writeFile(path.join(cacheDir, "notes.json"), "not cache", "utf-8");
  await fsp.writeFile(path.join(cacheDir, `usp-cache-${"b".repeat(64)}.json`), "not json", "utf-8");

  const removed = await manager.cleanup();
  const files = await fsp.readdir(cacheDir);

  expect(removed).toBe(1);
  expect(files).toContain("notes.json");
  expect(files).toContain(`usp-cache-${"b".repeat(64)}.json`);
});
```

- [ ] **Step 2: Run tests and verify they fail**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app exec vitest run --project main src/main/subtitleCacheManager.test.ts
```

Expected: FAIL because files are currently named `<sha256>.json`, stats count unrelated `.json`, and cleanup deletes unreadable `.json`.

- [ ] **Step 3: Add cache filename and shape guards**

In `apps/desktop-app/src/main/subtitleCacheManager.ts`, add:

```ts
const CACHE_FILE_PREFIX = "usp-cache-";
const CACHE_FILE_PATTERN = /^usp-cache-[a-f0-9]{64}\.json$/;
const CACHE_SOURCES = new Set<CacheSource>(["ytdlp", "mediaserver", "transcription"]);
```

Add helpers near `getCacheKey`:

```ts
  private getCacheFilePath(key: string): string {
    return path.join(this.getCachePath(), `${CACHE_FILE_PREFIX}${key}.json`);
  }

  private isCacheFileName(fileName: string): boolean {
    return CACHE_FILE_PATTERN.test(fileName);
  }

  private isCacheEntry(value: unknown): value is CacheEntry {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return false;
    }
    const entry = value as Partial<CacheEntry>;
    return (
      typeof entry.url === "string" &&
      typeof entry.timestamp === "number" &&
      Number.isFinite(entry.timestamp) &&
      typeof entry.source === "string" &&
      CACHE_SOURCES.has(entry.source as CacheSource) &&
      Boolean(entry.data) &&
      typeof entry.data === "object" &&
      Array.isArray((entry.data as SubtitleLoadResult).tracks)
    );
  }

  private async readCacheEntry(filePath: string): Promise<CacheEntry | null> {
    try {
      const content = await fs.readFile(filePath, "utf-8");
      const parsed = JSON.parse(content) as unknown;
      return this.isCacheEntry(parsed) ? parsed : null;
    } catch (error) {
      swallow(error, "cache.read", "skipping unreadable cache entry");
      return null;
    }
  }
```

- [ ] **Step 4: Use prefixed filenames for get and set**

Replace cache file path construction in `get`:

```ts
const cacheFile = this.getCacheFilePath(key);
```

When reading from disk, replace direct JSON parsing:

```ts
      const entry = await this.readCacheEntry(cacheFile);
      if (!entry) {
        this.log.debug(`Cache miss for ${source}: ${redactedUrl}`);
        return null;
      }
```

Replace cache file path construction in `set`:

```ts
const cacheFile = this.getCacheFilePath(key);
```

- [ ] **Step 5: Filter stats and cleanup by filename plus cache entry shape**

In `cleanup`, replace the disk loop condition and read block:

```ts
      for (const file of files) {
        if (!this.isCacheFileName(file)) {
          continue;
        }

        const filePath = path.join(cacheDir, file);
        const entry = await this.readCacheEntry(filePath);
        if (!entry) {
          continue;
        }

        if (this.isExpired(entry.timestamp, settings.retentionDays)) {
          await fs.unlink(filePath);
          removedCount++;
        }
      }
```

In `getStats`, replace the disk loop condition and read block:

```ts
      for (const file of files) {
        if (!this.isCacheFileName(file)) {
          continue;
        }

        const filePath = path.join(cacheDir, file);
        const entry = await this.readCacheEntry(filePath);
        if (!entry) {
          continue;
        }
        const fileStat = await fs.stat(filePath);

        stats.totalEntries++;
        stats.totalSize += fileStat.size;
```

Keep the existing oldest/newest timestamp update block after this replacement.

- [ ] **Step 6: Canonicalize cache paths**

Replace `getCachePath`:

```ts
  getCachePath(): string {
    const settings = this.settingsProvider();
    const configuredPath = settings.path.trim();
    return path.resolve(configuredPath || DEFAULT_CACHE_DIR);
  }
```

- [ ] **Step 7: Run tests**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app exec vitest run --project main src/main/subtitleCacheManager.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/desktop-app/src/main/subtitleCacheManager.ts apps/desktop-app/src/main/subtitleCacheManager.test.ts
git commit -m "fix: scope subtitle cache file ownership"
```

---

### Task 7: Final Verification And Residue Checks

**Files:**
- Read: `docs/superpowers/specs/2026-06-18-desktop-security-hardening-design.md`
- Read: `apps/desktop-app/src/main/fasterWhisperManager.ts`
- Read: `apps/desktop-app/src/main/transcriptionService.ts`
- Read: `apps/desktop-app/src/main/subtitleService.ts`
- Read: `apps/desktop-app/src/main/subtitleParser.ts`
- Read: `apps/desktop-app/src/main/subtitleCacheManager.ts`
- Read: `apps/desktop-app/src/preload.cts`

- [ ] **Step 1: Run focused main-process tests**

```bash
pnpm --filter @immersive-subs/desktop-app exec vitest run --project main src/main/networkUrlSafety.test.ts src/main/fasterWhisperManager.test.ts src/main/transcriptionService.test.ts src/main/features/transcriptionFeatureService.test.ts src/main/settings/appSettingsSanitizer.test.ts src/main/subtitleService.test.ts src/main/subtitleParser.test.ts src/main/subtitleCacheManager.test.ts src/main/ytDlpManager.test.ts src/main/ytDlpArgPolicy.test.ts src/main/ipc/securitySurface.test.ts src/main/ipc/handlers/fasterWhisperHandlers.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run focused renderer tests**

```bash
pnpm --filter @immersive-subs/desktop-app exec vitest run --project jsdom src/renderer/components/settings/SettingsFeatures.test.ts src/renderer/stores/desktop.test.ts
pnpm --filter @immersive-subs/desktop-app exec vitest run --project browser src/renderer/components/settings/SettingsFeatures.browser.test.ts
```

Expected: PASS.

- [ ] **Step 3: Run desktop package gates**

```bash
pnpm --filter @immersive-subs/desktop-app typecheck:app
pnpm --filter @immersive-subs/desktop-app test:app
git diff --check
```

Expected: all commands PASS.

- [ ] **Step 4: Run residue searches**

```bash
rg -n "openPath|usp:open-path|window\\.usp\\.openPath|modelsBaseDir \\|\\| paths\\.modelsDir|\\.endsWith\\(\"\\.json\"\\)|resolve/master/whisper-faster|assertPublicHttpUrl\\(config\\.baseUrl|Whisper API base URL cannot target local" apps/desktop-app/src
```

Expected remaining matches:

```text
apps/desktop-app/src/main/test/setup.ts: shell.openPath test mock
apps/desktop-app/src/main/ipc/openFolder.ts: shell.openPath wrapper
apps/desktop-app/src/main/ipc/handlers/cacheHandlers.ts: cache folder channel
apps/desktop-app/src/main/ipc/handlers/fasterWhisperHandlers.ts: narrow Faster-Whisper folder channels
apps/desktop-app/src/main/networkUrlSafety.ts and tests: public media URL guard
```

No remaining matches should show renderer-controlled `openPath`, `usp:open-path`, mutable Faster-Whisper binary asset URLs, cache cleanup over all `.json`, or Whisper API `baseUrl` using `assertPublicHttpUrl`.

- [ ] **Step 5: Inspect git diff for final-state constraints**

```bash
git diff -- docs/superpowers/specs/2026-06-18-desktop-security-hardening-design.md apps/desktop-app/src/main apps/desktop-app/src/preload.cts apps/desktop-app/src/renderer/components/settings apps/desktop-app/src/renderer/stores
```

Expected:
- No migration code for old cache files or old binary downloads.
- No compatibility alias for removed `openPath`.
- No `yt-dlp` final-destination allowlist or proxy claim.
- Whisper API accepts explicit local/LAN HTTP(S) endpoints.
- Subtitle and process limits match the spec constants.

- [ ] **Step 6: Commit final verification notes if code changed after previous commits**

If Step 1-5 required source or test changes, commit them:

```bash
git add apps/desktop-app/src docs/superpowers/plans/2026-06-18-desktop-security-hardening.md
git commit -m "test: verify desktop security hardening"
```

If Step 1-5 did not require changes, do not create an empty commit.

---

## Self-Review

Spec coverage:
- Faster-Whisper executable integrity is covered by Task 3.
- Whisper API `baseUrl` semantics are covered by Tasks 1 and 2.
- `yt-dlp` boundary positioning is preserved by Tasks 2 and 7: media URL guards and arg policy remain, with no final-destination allowlist or proxy.
- Resource limits are covered by Task 4.
- `openPath` hardening is covered by Task 5.
- Custom cache path hardening is covered by Task 6.
- Focused tests and package verification are covered by Task 7.

Placeholder scan:
- This plan contains concrete file paths, snippets, commands, and expected results.
- Production Faster-Whisper binary metadata is intentionally empty, which is a concrete final state from the spec when trusted stable metadata is unavailable.

Type consistency:
- `assertHttpUrl` returns a normalized string and is used by runtime config, persisted settings validation, and Whisper API request construction.
- `SubtitleParserLimits` is defined once in `resourceLimits.ts` and used by parser tests without changing production caller behavior.
- Narrow folder APIs use `openFasterWhisperBinaryFolder()` and `openFasterWhisperModelsFolder({ configId })` consistently across handler, preload, composable, and renderer tests.
