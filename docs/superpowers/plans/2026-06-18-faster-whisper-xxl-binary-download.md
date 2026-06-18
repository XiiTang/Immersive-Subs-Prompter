# Faster-Whisper-XXL Binary Download Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add app-managed Purfview Faster-Whisper-XXL binary download for Windows x64 and Linux x64 only.

**Architecture:** Keep the feature owned by the Electron main process. `FasterWhisperManager` exposes a single XXL binary status and installs the fixed Purfview release through a narrow IPC API; the renderer only requests `"xxl"` and writes the returned executable path into the selected transcription config.

**Tech Stack:** Electron main IPC, TypeScript, Vue 3, Vitest, `7zip-bin` as a direct desktop-app dependency.

---

## Execution Notes

- Use the active checkout. Do not create a git worktree.
- Follow the spec at `docs/superpowers/specs/2026-06-18-faster-whisper-xxl-binary-download-design.md`.
- Use the local reference project when checking behavior: `/Users/cq-laptop/Projects/referrence projects/subtitleedit`.
- Do not add migration, compatibility, dynamic release lookup, fallback mirrors, ordinary Faster-Whisper downloads, or macOS binary downloads.

## File Structure

- Modify `apps/desktop-app/package.json`
  - Add `7zip-bin` as a direct dependency.
- Modify `pnpm-lock.yaml`
  - Produced by `pnpm --filter @immersive-subs/desktop-app add 7zip-bin@5.2.0`.
- Create `apps/desktop-app/src/main/sevenZipExtractor.ts`
  - Single responsibility: run the bundled `7zip-bin` executable against one `.7z` archive.
- Create `apps/desktop-app/src/main/sevenZipExtractor.test.ts`
  - Unit-test command construction and non-zero exit handling without extracting real archives.
- Modify `apps/desktop-app/src/main/fasterWhisperManager.ts`
  - Replace CPU/GPU binary status with single XXL status.
  - Add fixed Windows/Linux x64 manifest.
  - Download, size-check, extract, install, chmod, and clean temporary files.
- Modify `apps/desktop-app/src/main/fasterWhisperManager.test.ts`
  - Cover final status shape and binary installation behavior.
- Modify `apps/desktop-app/src/main/ipc/handlers/fasterWhisperHandlers.ts`
  - Add strict `usp:faster-whisper-download-binary` handler.
  - Keep model download config-id behavior.
- Modify `apps/desktop-app/src/main/ipc/handlers/fasterWhisperHandlers.test.ts`
  - Cover binary payload validation and binary progress events.
- Modify `apps/desktop-app/src/preload.cts`
  - Expose `downloadFasterWhisperBinary`.
  - Replace path type fields with `xxlBinaryPath`.
- Modify `apps/desktop-app/src/renderer/components/settings/transcription/composables/useFasterWhisper.ts`
  - Use single `binary` status.
  - Add `handleDownloadBinary`.
  - Write `fasterWhisperBinary` after success and leave `fasterWhisperDevice` unchanged.
- Modify `apps/desktop-app/src/renderer/components/settings/transcription/FasterWhisperBinariesCard.vue`
  - Show one XXL row and a download action only when supported.
- Modify `apps/desktop-app/src/renderer/components/settings/TranscriptionFeatureSettings.vue`
  - Pass the new binary bindings and event.
- Modify `apps/desktop-app/src/renderer/components/settings/SettingsFeatures.test.ts`
  - Update component and settings tests for the final status shape.
- Modify `apps/desktop-app/src/renderer/components/settings/SettingsFeatures.browser.test.ts`
  - Update mocked Faster-Whisper status.
- Modify `apps/desktop-app/src/renderer/locales/en.json`
  - Add labels for XXL, download, and unsupported reason.
- Modify `apps/desktop-app/src/renderer/locales/zh.json`
  - Add matching Chinese labels.
- Modify `apps/desktop-app/src/main/ipc/securitySurface.test.ts`
  - Assert the renderer cannot pass binary URL or path through the public API.

---

### Task 1: Add Direct 7z Extraction Adapter

**Files:**
- Modify: `apps/desktop-app/package.json`
- Modify: `pnpm-lock.yaml`
- Create: `apps/desktop-app/src/main/sevenZipExtractor.ts`
- Test: `apps/desktop-app/src/main/sevenZipExtractor.test.ts`

- [ ] **Step 1: Add direct dependency**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app add 7zip-bin@5.2.0
```

Expected:

```text
dependencies:
+ 7zip-bin 5.2.0
```

- [ ] **Step 2: Write the failing adapter tests**

Create `apps/desktop-app/src/main/sevenZipExtractor.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { extractSevenZipArchive } from "./sevenZipExtractor.js";

describe("extractSevenZipArchive", () => {
  it("runs bundled 7za with x, archive, output directory, and overwrite arguments", async () => {
    const runProcess = vi.fn().mockResolvedValue(undefined);

    await extractSevenZipArchive({
      archivePath: "/tmp/Faster-Whisper-XXL.7z",
      destinationDir: "/tmp/staging",
      sevenZipPath: "/tools/7za",
      runProcess
    });

    expect(runProcess).toHaveBeenCalledWith("/tools/7za", [
      "x",
      "/tmp/Faster-Whisper-XXL.7z",
      "-o/tmp/staging",
      "-y"
    ]);
  });

  it("rejects when the 7za process exits with a non-zero code", async () => {
    const runProcess = vi.fn(async () => {
      throw new Error("7z extraction failed with exit code 2: archive corrupt");
    });

    await expect(
      extractSevenZipArchive({
        archivePath: "/tmp/bad.7z",
        destinationDir: "/tmp/staging",
        sevenZipPath: "/tools/7za",
        runProcess
      })
    ).rejects.toThrow("7z extraction failed with exit code 2: archive corrupt");
  });
});
```

- [ ] **Step 3: Run tests and verify they fail**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app exec vitest run src/main/sevenZipExtractor.test.ts --project main
```

Expected:

```text
FAIL  main  src/main/sevenZipExtractor.test.ts
Error: Cannot find module './sevenZipExtractor.js'
```

- [ ] **Step 4: Implement the adapter**

Create `apps/desktop-app/src/main/sevenZipExtractor.ts`:

```ts
import { spawn } from "node:child_process";
import { createRequire } from "node:module";

type SevenZipBin = {
  path7za?: string;
};

export type RunProcess = (file: string, args: string[]) => Promise<void>;

export type ExtractSevenZipOptions = {
  archivePath: string;
  destinationDir: string;
  sevenZipPath?: string;
  runProcess?: RunProcess;
};

const require = createRequire(import.meta.url);

export async function extractSevenZipArchive(options: ExtractSevenZipOptions): Promise<void> {
  const sevenZipPath = options.sevenZipPath ?? getBundledSevenZipPath();
  const runProcess = options.runProcess ?? runProcessDefault;
  await runProcess(sevenZipPath, [
    "x",
    options.archivePath,
    `-o${options.destinationDir}`,
    "-y"
  ]);
}

function getBundledSevenZipPath(): string {
  const sevenZip = require("7zip-bin") as SevenZipBin;
  if (!sevenZip.path7za) {
    throw new Error("Bundled 7za executable was not found.");
  }
  return sevenZip.path7za;
}

async function runProcessDefault(file: string, args: string[]): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(file, args, {
      stdio: ["ignore", "ignore", "pipe"]
    });
    const stderr: Buffer[] = [];
    child.stderr.on("data", (chunk: Buffer) => {
      stderr.push(chunk);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`7z extraction failed with exit code ${code}: ${Buffer.concat(stderr).toString("utf-8").trim()}`));
    });
  });
}
```

- [ ] **Step 5: Run tests and verify they pass**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app exec vitest run src/main/sevenZipExtractor.test.ts --project main
```

Expected:

```text
PASS  main  src/main/sevenZipExtractor.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add apps/desktop-app/package.json pnpm-lock.yaml apps/desktop-app/src/main/sevenZipExtractor.ts apps/desktop-app/src/main/sevenZipExtractor.test.ts
git commit -m "feat: add bundled 7z extractor"
```

---

### Task 2: Implement Final Faster-Whisper-XXL Manager Contract

**Files:**
- Modify: `apps/desktop-app/src/main/fasterWhisperManager.ts`
- Test: `apps/desktop-app/src/main/fasterWhisperManager.test.ts`

- [ ] **Step 1: Write failing manager status tests**

In `apps/desktop-app/src/main/fasterWhisperManager.test.ts`, replace the first two binary status tests with:

```ts
it("reports a downloadable XXL binary on Windows x64", async () => {
  const baseDir = await mkdtemp(path.join(tmpdir(), "usp-fw-"));
  const manager = new FasterWhisperManager({ baseDir, platform: "win32", arch: "x64" });

  const status = await manager.getStatus();

  expect(status.paths).toEqual({
    binaryDir: path.join(baseDir, "bin"),
    modelsDir: path.join(baseDir, "models"),
    xxlBinaryPath: path.join(baseDir, "bin", "Faster-Whisper-XXL", "faster-whisper-xxl.exe")
  });
  expect(status.binary).toEqual({
    variant: "xxl",
    exists: false,
    path: path.join(baseDir, "bin", "Faster-Whisper-XXL", "faster-whisper-xxl.exe"),
    downloadable: true,
    asset: {
      name: "Faster-Whisper-XXL_r245.4_windows.7z",
      version: "r245.4",
      sizeBytes: 1424256246
    }
  });
});

it("reports a downloadable XXL binary on Linux x64", async () => {
  const baseDir = await mkdtemp(path.join(tmpdir(), "usp-fw-"));
  const manager = new FasterWhisperManager({ baseDir, platform: "linux", arch: "x64" });

  const status = await manager.getStatus();

  expect(status.binary).toEqual({
    variant: "xxl",
    exists: false,
    path: path.join(baseDir, "bin", "Faster-Whisper-XXL", "faster-whisper-xxl"),
    downloadable: true,
    asset: {
      name: "Faster-Whisper-XXL_r245.4_linux.7z",
      version: "r245.4",
      sizeBytes: 1657690937
    }
  });
});

it("reports non-downloadable XXL status on macOS", async () => {
  const baseDir = await mkdtemp(path.join(tmpdir(), "usp-fw-"));
  const manager = new FasterWhisperManager({ baseDir, platform: "darwin", arch: "arm64" });

  const status = await manager.getStatus();

  expect(status.binary).toEqual({
    variant: "xxl",
    exists: false,
    path: path.join(baseDir, "bin", "Faster-Whisper-XXL", "faster-whisper-xxl"),
    downloadable: false,
    reason: "Faster-Whisper-XXL binary download is not available on this platform."
  });
});
```

- [ ] **Step 2: Write failing binary download tests**

Append these tests to `apps/desktop-app/src/main/fasterWhisperManager.test.ts`:

```ts
it("downloads and installs the Windows XXL binary through the fixed manifest", async () => {
  const baseDir = await mkdtemp(path.join(tmpdir(), "usp-fw-"));
  const archiveBytes = Buffer.from("archive");
  const binaryAssets = [{
    platform: "win32" as const,
    arch: "x64" as const,
    name: "test-windows.7z",
    version: "r245.4" as const,
    url: "https://github.com/Purfview/whisper-standalone-win/releases/download/Faster-Whisper-XXL/test-windows.7z",
    sizeBytes: archiveBytes.length,
    executableRelativePath: path.join("Faster-Whisper-XXL", "faster-whisper-xxl.exe")
  }];
  const extractArchive = vi.fn(async ({ destinationDir }: { archivePath: string; destinationDir: string }) => {
    const binary = path.join(destinationDir, "Faster-Whisper-XXL", "faster-whisper-xxl.exe");
    await mkdir(path.dirname(binary), { recursive: true });
    await writeFile(binary, "xxl", "utf-8");
  });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(archiveBytes, {
    status: 200,
    headers: { "content-length": String(archiveBytes.length) }
  })));
  const manager = new FasterWhisperManager({ baseDir, platform: "win32", arch: "x64", extractArchive, binaryAssets });

  const result = await manager.downloadBinary("xxl");

  expect(result).toEqual({
    path: path.join(baseDir, "bin", "Faster-Whisper-XXL", "faster-whisper-xxl.exe"),
    asset: "test-windows.7z",
    version: "r245.4"
  });
  expect(extractArchive).toHaveBeenCalledWith({
    archivePath: path.join(baseDir, "bin", ".downloads", "test-windows.7z.download"),
    destinationDir: expect.stringContaining(path.join(baseDir, "bin", ".downloads"))
  });
});

it("rejects binary downloads on unsupported platforms before fetching", async () => {
  const baseDir = await mkdtemp(path.join(tmpdir(), "usp-fw-"));
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  const manager = new FasterWhisperManager({ baseDir, platform: "darwin", arch: "arm64" });

  await expect(manager.downloadBinary("xxl")).rejects.toThrow(
    "Faster-Whisper-XXL binary download is not available on this platform."
  );
  expect(fetchMock).not.toHaveBeenCalled();
});

it("rejects binary downloads when the byte count does not match the manifest", async () => {
  const baseDir = await mkdtemp(path.join(tmpdir(), "usp-fw-"));
  const binaryAssets = [{
    platform: "win32" as const,
    arch: "x64" as const,
    name: "test-windows.7z",
    version: "r245.4" as const,
    url: "https://github.com/Purfview/whisper-standalone-win/releases/download/Faster-Whisper-XXL/test-windows.7z",
    sizeBytes: 100,
    executableRelativePath: path.join("Faster-Whisper-XXL", "faster-whisper-xxl.exe")
  }];
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(Buffer.from("short"), { status: 200 })));
  const extractArchive = vi.fn();
  const manager = new FasterWhisperManager({ baseDir, platform: "win32", arch: "x64", extractArchive, binaryAssets });

  await expect(manager.downloadBinary("xxl")).rejects.toThrow("Faster-Whisper-XXL download size mismatch.");
  expect(extractArchive).not.toHaveBeenCalled();
});

it("rejects binary downloads redirected to unsupported hosts", async () => {
  const baseDir = await mkdtemp(path.join(tmpdir(), "usp-fw-"));
  const archiveBytes = Buffer.from("archive");
  const binaryAssets = [{
    platform: "win32" as const,
    arch: "x64" as const,
    name: "test-windows.7z",
    version: "r245.4" as const,
    url: "https://github.com/Purfview/whisper-standalone-win/releases/download/Faster-Whisper-XXL/test-windows.7z",
    sizeBytes: archiveBytes.length,
    executableRelativePath: path.join("Faster-Whisper-XXL", "faster-whisper-xxl.exe")
  }];
  const response = new Response(archiveBytes, { status: 200 });
  Object.defineProperty(response, "url", { value: "https://example.test/Faster-Whisper-XXL.7z" });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));
  const manager = new FasterWhisperManager({ baseDir, platform: "win32", arch: "x64", extractArchive: vi.fn(), binaryAssets });

  await expect(manager.downloadBinary("xxl")).rejects.toThrow(
    "Faster-Whisper-XXL release asset redirected to unsupported host: example.test"
  );
});

it("rejects installation when extraction does not produce the expected executable", async () => {
  const baseDir = await mkdtemp(path.join(tmpdir(), "usp-fw-"));
  const archiveBytes = Buffer.from("archive");
  const binaryAssets = [{
    platform: "win32" as const,
    arch: "x64" as const,
    name: "test-windows.7z",
    version: "r245.4" as const,
    url: "https://github.com/Purfview/whisper-standalone-win/releases/download/Faster-Whisper-XXL/test-windows.7z",
    sizeBytes: archiveBytes.length,
    executableRelativePath: path.join("Faster-Whisper-XXL", "faster-whisper-xxl.exe")
  }];
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(archiveBytes, { status: 200 })));
  const manager = new FasterWhisperManager({
    baseDir,
    platform: "win32",
    arch: "x64",
    extractArchive: vi.fn().mockResolvedValue(undefined),
    binaryAssets
  });

  await expect(manager.downloadBinary("xxl")).rejects.toThrow(
    "Faster-Whisper-XXL archive did not contain faster-whisper-xxl.exe."
  );
});
```

- [ ] **Step 3: Run tests and verify they fail**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app exec vitest run src/main/fasterWhisperManager.test.ts --project main
```

Expected:

```text
FAIL  main  src/main/fasterWhisperManager.test.ts
Property 'binary' does not exist
```

- [ ] **Step 4: Implement the manager contract**

In `apps/desktop-app/src/main/fasterWhisperManager.ts`, add the 7z import and these types/constants near the top:

```ts
import { extractSevenZipArchive } from "./sevenZipExtractor.js";

type BinaryVariant = "xxl";
type ExtractArchive = typeof extractSevenZipArchive;

type BinaryAsset = {
  platform: NodeJS.Platform;
  arch: NodeJS.Architecture;
  name: string;
  version: "r245.4";
  url: string;
  sizeBytes: number;
  executableRelativePath: string;
};

const FASTER_WHISPER_XXL_UNSUPPORTED =
  "Faster-Whisper-XXL binary download is not available on this platform.";
const RELEASE_ASSET_ALLOWED_HOSTS = new Set([
  "github.com",
  "objects.githubusercontent.com",
  "release-assets.githubusercontent.com"
]);
const FASTER_WHISPER_XXL_ASSETS: BinaryAsset[] = [
  {
    platform: "win32",
    arch: "x64",
    name: "Faster-Whisper-XXL_r245.4_windows.7z",
    version: "r245.4",
    url: "https://github.com/Purfview/whisper-standalone-win/releases/download/Faster-Whisper-XXL/Faster-Whisper-XXL_r245.4_windows.7z",
    sizeBytes: 1424256246,
    executableRelativePath: path.join("Faster-Whisper-XXL", "faster-whisper-xxl.exe")
  },
  {
    platform: "linux",
    arch: "x64",
    name: "Faster-Whisper-XXL_r245.4_linux.7z",
    version: "r245.4",
    url: "https://github.com/Purfview/whisper-standalone-win/releases/download/Faster-Whisper-XXL/Faster-Whisper-XXL_r245.4_linux.7z",
    sizeBytes: 1657690937,
    executableRelativePath: path.join("Faster-Whisper-XXL", "faster-whisper-xxl")
  }
];
```

Change the class fields and constructor:

```ts
  private readonly platform: NodeJS.Platform;
  private readonly arch: NodeJS.Architecture;
  private readonly extractArchive: ExtractArchive;
  private readonly binaryAssets: readonly BinaryAsset[];

  constructor(
    options: {
      baseDir?: string;
      platform?: NodeJS.Platform;
      arch?: NodeJS.Architecture;
      extractArchive?: ExtractArchive;
      binaryAssets?: readonly BinaryAsset[];
    } = {}
  ) {
    this.baseDir = options.baseDir ?? path.join(app.getPath("userData"), "faster-whisper");
    this.binDir = path.join(this.baseDir, "bin");
    this.modelsDir = path.join(this.baseDir, "models");
    this.platform = options.platform ?? process.platform;
    this.arch = options.arch ?? process.arch;
    this.extractArchive = options.extractArchive ?? extractSevenZipArchive;
    this.binaryAssets = options.binaryAssets ?? FASTER_WHISPER_XXL_ASSETS;
  }
```

Replace `getPaths`, `getStatus`, `buildBinaryStatus`, and `getTargetPath` with:

```ts
  async getPaths() {
    await this.ensureDirs();
    return {
      binaryDir: this.binDir,
      modelsDir: this.modelsDir,
      xxlBinaryPath: this.getXxlTargetPath()
    };
  }

  async getStatus(modelDirOverride?: string) {
    const paths = await this.getPaths();
    const targetModelDir = modelDirOverride?.trim() || paths.modelsDir;
    const [binaryStatus, modelList] = await Promise.all([
      this.buildBinaryStatus(paths.xxlBinaryPath),
      this.listDownloadedModels(targetModelDir)
    ]);
    return {
      paths,
      binary: binaryStatus,
      models: modelList.models,
      modelsBaseDir: modelList.baseDir
    };
  }

  private async buildBinaryStatus(targetPath: string) {
    const exists = await this.fileExists(targetPath);
    const asset = this.getCurrentPlatformAsset();
    return {
      variant: "xxl" as const,
      exists,
      path: targetPath,
      downloadable: Boolean(asset),
      ...(asset
        ? { asset: { name: asset.name, version: asset.version, sizeBytes: asset.sizeBytes } }
        : { reason: FASTER_WHISPER_XXL_UNSUPPORTED })
    };
  }

  private getXxlTargetPath(): string {
    const executable = this.platform === "win32" ? "faster-whisper-xxl.exe" : "faster-whisper-xxl";
    return path.join(this.binDir, "Faster-Whisper-XXL", executable);
  }
```

Add `downloadBinary` and helpers inside the class:

```ts
  async downloadBinary(
    variant: BinaryVariant,
    progress?: ProgressCallback
  ): Promise<{ path: string; asset: string; version: string }> {
    if (variant !== "xxl") {
      throw new Error("Invalid Faster-Whisper binary variant.");
    }
    await this.ensureDirs();
    const asset = this.getCurrentPlatformAsset();
    if (!asset) {
      throw new Error(FASTER_WHISPER_XXL_UNSUPPORTED);
    }

    const downloadsDir = path.join(this.binDir, ".downloads");
    const archivePath = path.join(downloadsDir, `${asset.name}.download`);
    const stagingDir = path.join(downloadsDir, `${asset.name}.staging`);
    await fs.rm(stagingDir, { recursive: true, force: true });
    await fs.mkdir(downloadsDir, { recursive: true });

    try {
      await this.downloadFile(asset.url, archivePath, (percent) => {
        progress?.(Math.min(80, Math.round(percent * 0.8)), "Downloading Faster-Whisper-XXL");
      }, {
        expectedSizeBytes: asset.sizeBytes,
        allowedHosts: RELEASE_ASSET_ALLOWED_HOSTS,
        label: "Faster-Whisper-XXL"
      });
      progress?.(85, "Extracting Faster-Whisper-XXL");
      await this.extractArchive({ archivePath, destinationDir: stagingDir });

      const extractedRoot = path.join(stagingDir, "Faster-Whisper-XXL");
      const extractedBinary = path.join(stagingDir, asset.executableRelativePath);
      if (!(await this.fileExists(extractedBinary))) {
        throw new Error(`Faster-Whisper-XXL archive did not contain ${path.basename(asset.executableRelativePath)}.`);
      }

      const targetRoot = path.join(this.binDir, "Faster-Whisper-XXL");
      await fs.rm(targetRoot, { recursive: true, force: true });
      await fs.rename(extractedRoot, targetRoot);
      const targetPath = path.join(this.binDir, asset.executableRelativePath);
      await this.ensureExecutable(targetPath);
      progress?.(100, "Faster-Whisper-XXL ready");
      return { path: targetPath, asset: asset.name, version: asset.version };
    } finally {
      await fs.rm(archivePath, { force: true });
      await fs.rm(stagingDir, { recursive: true, force: true });
    }
  }

  private getCurrentPlatformAsset(): BinaryAsset | null {
    return this.binaryAssets.find(
      (asset) => asset.platform === this.platform && asset.arch === this.arch
    ) ?? null;
  }

  private async ensureExecutable(targetPath: string): Promise<void> {
    if (this.platform !== "win32") {
      await fs.chmod(targetPath, 0o755);
    }
  }
```

Change `downloadFile` to accept binary options and return the byte count:

```ts
  private async downloadFile(
    url: string,
    targetPath: string,
    progress?: (percent: number) => void,
    options?: {
      expectedSizeBytes?: number;
      allowedHosts?: ReadonlySet<string>;
      label?: string;
    }
  ): Promise<number> {
    const response = await fetch(url);
    if (!response.ok || !response.body) {
      throw new Error(`Download failed: ${response.status} ${response.statusText}`);
    }
    if (options?.allowedHosts) {
      assertExpectedDownloadUrl(response.url || url, options.allowedHosts, options.label ?? "Download");
    }

    const total = options?.expectedSizeBytes ?? Number(response.headers.get("content-length") ?? 0);
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
    if (options?.expectedSizeBytes !== undefined && downloaded !== options.expectedSizeBytes) {
      throw new Error(`${options.label ?? "Download"} download size mismatch.`);
    }
    progress?.(100);
    this.log.info(`Downloaded ${url} to ${targetPath}`);
    return downloaded;
  }
```

Add this helper below the class:

```ts
function assertExpectedDownloadUrl(input: string, allowedHosts: ReadonlySet<string>, label: string): void {
  const parsed = new URL(input);
  if (parsed.protocol !== "https:") {
    throw new Error(`${label} release asset download must use https.`);
  }
  if (!allowedHosts.has(parsed.hostname.toLowerCase())) {
    throw new Error(`${label} release asset redirected to unsupported host: ${parsed.hostname}`);
  }
}
```

- [ ] **Step 5: Run manager tests and verify they pass**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app exec vitest run src/main/fasterWhisperManager.test.ts --project main
```

Expected:

```text
PASS  main  src/main/fasterWhisperManager.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add apps/desktop-app/src/main/fasterWhisperManager.ts apps/desktop-app/src/main/fasterWhisperManager.test.ts
git commit -m "feat: install faster-whisper xxl binaries"
```

---

### Task 3: Add Narrow Binary Download IPC and Preload API

**Files:**
- Modify: `apps/desktop-app/src/main/ipc/handlers/fasterWhisperHandlers.ts`
- Modify: `apps/desktop-app/src/main/ipc/handlers/fasterWhisperHandlers.test.ts`
- Modify: `apps/desktop-app/src/preload.cts`
- Modify: `apps/desktop-app/src/main/ipc/securitySurface.test.ts`

- [ ] **Step 1: Write failing IPC tests**

In `apps/desktop-app/src/main/ipc/handlers/fasterWhisperHandlers.test.ts`, update the channel registration expectation to include binary download:

```ts
expect(handle.mock.calls.map(([channel]) => channel).sort()).toEqual([
  "usp:faster-whisper-download-binary",
  "usp:faster-whisper-download-model",
  "usp:faster-whisper-open-binary-folder",
  "usp:faster-whisper-open-models-folder",
  "usp:faster-whisper-status"
].sort());
```

Append:

```ts
it("downloads the app-managed XXL binary without renderer URLs or paths", async () => {
  const downloadBinary = vi.fn().mockResolvedValue({
    path: "/tmp/fw/bin/Faster-Whisper-XXL/faster-whisper-xxl",
    asset: "Faster-Whisper-XXL_r245.4_linux.7z",
    version: "r245.4"
  });
  const send = vi.fn();
  registerFasterWhisperHandlers({
    fasterWhisperManager: {
      getStatus: vi.fn(),
      getPaths: vi.fn(),
      listDownloadedModels: vi.fn(),
      downloadModel: vi.fn(),
      downloadBinary
    },
    logger: { error: vi.fn() }
  } as never);

  await expect(
    registeredHandler("usp:faster-whisper-download-binary")(
      { sender: { send } },
      { variant: "xxl", jobId: "job-1" }
    )
  ).resolves.toEqual({
    ok: true,
    id: "job-1",
    path: "/tmp/fw/bin/Faster-Whisper-XXL/faster-whisper-xxl",
    asset: "Faster-Whisper-XXL_r245.4_linux.7z",
    version: "r245.4"
  });
  expect(downloadBinary).toHaveBeenCalledWith("xxl", expect.any(Function));
});

it("rejects binary download payloads with renderer supplied paths or URLs", async () => {
  const downloadBinary = vi.fn();
  const send = vi.fn();
  registerFasterWhisperHandlers({
    fasterWhisperManager: {
      getStatus: vi.fn(),
      getPaths: vi.fn(),
      listDownloadedModels: vi.fn(),
      downloadModel: vi.fn(),
      downloadBinary
    },
    logger: { error: vi.fn() }
  } as never);

  await expect(
    registeredHandler("usp:faster-whisper-download-binary")(
      { sender: { send } },
      { variant: "xxl", url: "https://example.test/file.7z", path: "/tmp/file" }
    )
  ).resolves.toEqual({
    ok: false,
    id: expect.stringMatching(/^fw-binary-/),
    error: "Faster-Whisper binary download payload is invalid."
  });
  expect(downloadBinary).not.toHaveBeenCalled();
});

it("emits binary download progress events", async () => {
  const send = vi.fn();
  const downloadBinary = vi.fn(async (_variant: "xxl", progress: (percent: number, status: string) => void) => {
    progress(40, "Downloading Faster-Whisper-XXL");
    return { path: "/tmp/fw/bin/Faster-Whisper-XXL/faster-whisper-xxl", asset: "asset.7z", version: "r245.4" };
  });
  registerFasterWhisperHandlers({
    fasterWhisperManager: {
      getStatus: vi.fn(),
      getPaths: vi.fn(),
      listDownloadedModels: vi.fn(),
      downloadModel: vi.fn(),
      downloadBinary
    },
    logger: { error: vi.fn() }
  } as never);

  await registeredHandler("usp:faster-whisper-download-binary")(
    { sender: { send } },
    { variant: "xxl", jobId: "job-1" }
  );

  expect(send).toHaveBeenCalledWith("usp:faster-whisper-download-progress", {
    id: "job-1",
    type: "binary",
    variant: "xxl",
    percent: 40,
    status: "Downloading Faster-Whisper-XXL"
  });
});
```

- [ ] **Step 2: Run IPC tests and verify they fail**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app exec vitest run src/main/ipc/handlers/fasterWhisperHandlers.test.ts --project main
```

Expected:

```text
FAIL  main  src/main/ipc/handlers/fasterWhisperHandlers.test.ts
Missing handler for usp:faster-whisper-download-binary
```

- [ ] **Step 3: Implement IPC payload parsing and handler**

In `apps/desktop-app/src/main/ipc/handlers/fasterWhisperHandlers.ts`, add:

```ts
type BinaryPayload = { variant: "xxl"; jobId?: string };

const BINARY_DOWNLOAD_PAYLOAD_ERROR = "Faster-Whisper binary download payload is invalid.";
const BINARY_DOWNLOAD_PAYLOAD_KEYS = new Set(["variant", "jobId"]);
```

Add:

```ts
function readBinaryPayload(payload: unknown): BinaryPayload {
  const record = assertPlainPayload(payload, BINARY_DOWNLOAD_PAYLOAD_KEYS, BINARY_DOWNLOAD_PAYLOAD_ERROR);
  if (
    !record ||
    record.variant !== "xxl" ||
    (record.jobId !== undefined && typeof record.jobId !== "string")
  ) {
    throw new Error(BINARY_DOWNLOAD_PAYLOAD_ERROR);
  }
  return {
    variant: "xxl",
    jobId: record.jobId
  };
}
```

Register this handler before model download:

```ts
  ipcMain.handle("usp:faster-whisper-download-binary", async (event, rawPayload: unknown) => {
    let downloadId = `fw-binary-${Date.now()}`;
    let progress: ((percent: number, status: string) => void) | null = null;
    try {
      const payload = readBinaryPayload(rawPayload);
      downloadId = payload.jobId || downloadId;
      progress = (percent: number, status: string) => {
        event.sender.send("usp:faster-whisper-download-progress", {
          id: downloadId,
          type: "binary",
          variant: payload.variant,
          percent,
          status
        });
      };
      const result = await context.fasterWhisperManager.downloadBinary(payload.variant, progress);
      return { ok: true, id: downloadId, ...result };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      context.logger.error("Faster-Whisper binary download failed", error);
      progress?.(0, `Error: ${message}`);
      return { ok: false, id: downloadId, error: message };
    }
  });
```

- [ ] **Step 4: Update preload API**

In `apps/desktop-app/src/preload.cts`, add `downloadFasterWhisperBinary` without exposing a separate paths API:

```ts
  getFasterWhisperStatus: (payload?: { configId?: string }): Promise<any> =>
    ipcRenderer.invoke("usp:faster-whisper-status", payload),
  downloadFasterWhisperBinary: (payload: { variant: "xxl"; jobId?: string }): Promise<any> =>
    ipcRenderer.invoke("usp:faster-whisper-download-binary", payload),
  downloadFasterWhisperModel: (payload: { model: string; configId?: string; jobId?: string }): Promise<any> =>
    ipcRenderer.invoke("usp:faster-whisper-download-model", payload),
```

- [ ] **Step 5: Update security surface test**

In `apps/desktop-app/src/main/ipc/securitySurface.test.ts`, add expectations in the existing Faster-Whisper IPC test:

```ts
expect(preload).not.toContain("getFasterWhisperPaths");
expect(preload).not.toContain("usp:faster-whisper-paths");
expect(fasterWhisperHandlers).not.toContain("usp:faster-whisper-paths");
expect(preload).toContain("downloadFasterWhisperBinary");
expect(preload).not.toContain("binaryUrl");
expect(preload).not.toContain("binaryPath");
expect(fasterWhisperHandlers).toContain("BINARY_DOWNLOAD_PAYLOAD_KEYS");
expect(fasterWhisperHandlers).not.toContain("url:");
```

- [ ] **Step 6: Run IPC and security tests**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app exec vitest run src/main/ipc/handlers/fasterWhisperHandlers.test.ts src/main/ipc/securitySurface.test.ts --project main
```

Expected:

```text
PASS  main  src/main/ipc/handlers/fasterWhisperHandlers.test.ts
PASS  main  src/main/ipc/securitySurface.test.ts
```

- [ ] **Step 7: Commit**

```bash
git add apps/desktop-app/src/main/ipc/handlers/fasterWhisperHandlers.ts apps/desktop-app/src/main/ipc/handlers/fasterWhisperHandlers.test.ts apps/desktop-app/src/preload.cts apps/desktop-app/src/main/ipc/securitySurface.test.ts
git commit -m "feat: expose faster-whisper xxl binary ipc"
```

---

### Task 4: Update Renderer State and Binary Card

**Files:**
- Modify: `apps/desktop-app/src/renderer/components/settings/transcription/composables/useFasterWhisper.ts`
- Modify: `apps/desktop-app/src/renderer/components/settings/transcription/FasterWhisperBinariesCard.vue`
- Modify: `apps/desktop-app/src/renderer/components/settings/TranscriptionFeatureSettings.vue`
- Modify: `apps/desktop-app/src/renderer/locales/en.json`
- Modify: `apps/desktop-app/src/renderer/locales/zh.json`
- Test: `apps/desktop-app/src/renderer/components/settings/SettingsFeatures.test.ts`
- Test: `apps/desktop-app/src/renderer/components/settings/SettingsFeatures.browser.test.ts`

- [ ] **Step 1: Write failing renderer tests**

In `apps/desktop-app/src/renderer/components/settings/SettingsFeatures.test.ts`, replace the binary card test with:

```ts
it("renders Faster-Whisper-XXL binary status and supported download action", () => {
  const wrapper = mount(FasterWhisperBinariesCard, {
    props: {
      t: (key: string) => key,
      paths: { binaryDir: "/tmp/fw/bin" },
      binaryStatus: {
        variant: "xxl",
        exists: false,
        path: "/tmp/fw/bin/Faster-Whisper-XXL/faster-whisper-xxl",
        downloadable: true,
        asset: {
          name: "Faster-Whisper-XXL_r245.4_linux.7z",
          version: "r245.4",
          sizeBytes: 1657690937
        }
      },
      isBusy: false,
      downloadProgress: 0,
      downloadMessage: "",
      downloadError: null
    }
  });

  expect(wrapper.text()).toContain("Faster-Whisper-XXL");
  expect(wrapper.text()).not.toContain("CPU");
  expect(wrapper.text()).not.toContain("GPU");
  expect(wrapper.find('[data-testid="feature-transcription-download-xxl"]').exists()).toBe(true);
});

it("does not render a binary download action on unsupported platforms", () => {
  const wrapper = mount(FasterWhisperBinariesCard, {
    props: {
      t: (key: string) => key,
      paths: { binaryDir: "/tmp/fw/bin" },
      binaryStatus: {
        variant: "xxl",
        exists: false,
        path: "/tmp/fw/bin/Faster-Whisper-XXL/faster-whisper-xxl",
        downloadable: false,
        reason: "Faster-Whisper-XXL binary download is not available on this platform."
      },
      isBusy: false,
      downloadProgress: 0,
      downloadMessage: "",
      downloadError: null
    }
  });

  expect(wrapper.text()).toContain("feature-transcription-unsupported");
  expect(wrapper.find('[data-testid="feature-transcription-download-xxl"]').exists()).toBe(false);
});
```

Add a settings-level test:

```ts
it("downloads Faster-Whisper-XXL and writes only the executable path", async () => {
  const store = seedStore();
  const configA = createTranscriptionConfig({
    id: "config-a",
    provider: "faster-whisper",
    fasterWhisperBinary: "manual",
    fasterWhisperDevice: "cpu"
  });
  store.settings!.features.transcription.activeConfigId = configA.id;
  store.settings!.features.transcription.configs = [configA];
  const setTranscriptionConfigs = vi.spyOn(store, "setTranscriptionConfigs").mockResolvedValue();
  const downloadFasterWhisperBinary = vi.fn().mockResolvedValue({
    ok: true,
    path: "/tmp/fw/bin/Faster-Whisper-XXL/faster-whisper-xxl",
    asset: "Faster-Whisper-XXL_r245.4_linux.7z",
    version: "r245.4"
  });
  Object.assign(window.usp, {
    downloadFasterWhisperBinary,
    getFasterWhisperStatus: vi.fn().mockResolvedValue({
      ok: true,
      paths: {
        binaryDir: "/tmp/fw/bin",
        modelsDir: "/tmp/fw/models",
        xxlBinaryPath: "/tmp/fw/bin/Faster-Whisper-XXL/faster-whisper-xxl"
      },
      binary: {
        variant: "xxl",
        exists: false,
        path: "/tmp/fw/bin/Faster-Whisper-XXL/faster-whisper-xxl",
        downloadable: true,
        asset: {
          name: "Faster-Whisper-XXL_r245.4_linux.7z",
          version: "r245.4",
          sizeBytes: 1657690937
        }
      },
      models: [],
      modelsBaseDir: "/tmp/fw/models"
    })
  });
  const wrapper = mount(TranscriptionFeatureSettings);

  await flushPromises();
  await wrapper.get('[data-testid="feature-transcription-download-xxl"]').trigger("click");
  await flushPromises();

  expect(downloadFasterWhisperBinary).toHaveBeenCalledWith({
    variant: "xxl",
    jobId: expect.stringMatching(/^fw-binary-/)
  });
  expect(setTranscriptionConfigs).toHaveBeenCalledWith([
    expect.objectContaining({
      id: "config-a",
      fasterWhisperBinary: "/tmp/fw/bin/Faster-Whisper-XXL/faster-whisper-xxl",
      fasterWhisperDevice: "cpu"
    })
  ], "config-a");
});
```

- [ ] **Step 2: Run renderer tests and verify they fail**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app exec vitest run src/renderer/components/settings/SettingsFeatures.test.ts --project jsdom
```

Expected:

```text
FAIL  jsdom  src/renderer/components/settings/SettingsFeatures.test.ts
Cannot read properties of undefined (reading 'variant')
```

- [ ] **Step 3: Update composable types and binary download handler**

In `apps/desktop-app/src/renderer/components/settings/transcription/composables/useFasterWhisper.ts`, replace the path/status interfaces with:

```ts
interface FasterWhisperPaths {
  binaryDir: string;
  modelsDir: string;
  xxlBinaryPath: string;
}

interface FasterWhisperBinaryStatus {
  variant: "xxl";
  exists: boolean;
  path: string;
  downloadable: boolean;
  reason?: string;
  asset?: {
    name: string;
    version: string;
    sizeBytes: number;
  };
}

interface FasterWhisperStatus {
  ok: boolean;
  paths: FasterWhisperPaths;
  binary: FasterWhisperBinaryStatus;
  models: DownloadedModel[];
  modelsBaseDir: string;
  error?: string;
}

interface DownloadProgress {
  id: string;
  type: "binary" | "model";
  percent: number;
  status: string;
}
```

Change `binaryStatus`:

```ts
const binaryStatus = computed(() => status.value?.binary ?? null);
const activeDownloadType = ref<"binary" | "model" | null>(null);
const binaryDownloadProgress = computed(() => activeDownloadType.value === "binary" ? downloadProgress.value : 0);
const binaryDownloadMessage = computed(() => activeDownloadType.value === "binary" ? downloadMessage.value : "");
const binaryDownloadError = computed(() => activeDownloadType.value === "binary" ? downloadError.value : null);
const modelDownloadProgress = computed(() => activeDownloadType.value === "model" ? downloadProgress.value : 0);
const modelDownloadMessage = computed(() => activeDownloadType.value === "model" ? downloadMessage.value : "");
const modelDownloadError = computed(() => activeDownloadType.value === "model" ? downloadError.value : null);
```

In `handleDownloadProgress`:

```ts
function handleDownloadProgress(payload: DownloadProgress) {
  activeDownloadType.value = payload.type;
  downloadProgress.value = payload.percent;
  downloadMessage.value = payload.status;
}
```

At the start of `handleDownloadModel`, add:

```ts
activeDownloadType.value = "model";
```

Add `handleDownloadBinary`:

```ts
async function handleDownloadBinary() {
  if (!activeConfig.value) {
    return;
  }
  isBusy.value = true;
  activeDownloadType.value = "binary";
  downloadProgress.value = 0;
  downloadError.value = null;
  try {
    const result = await window.usp.downloadFasterWhisperBinary({
      variant: "xxl",
      jobId: `fw-binary-${crypto.randomUUID()}`
    });
    if (!result.ok) {
      downloadError.value = result.error;
      return;
    }
    updateConfig({
      fasterWhisperBinary: result.path
    });
    await refreshStatus();
  } finally {
    isBusy.value = false;
  }
}
```

Return the new values:

```ts
    binaryDownloadProgress,
    binaryDownloadMessage,
    binaryDownloadError,
    modelDownloadProgress,
    modelDownloadMessage,
    modelDownloadError,
    handleDownloadBinary,
```

- [ ] **Step 4: Update binary card**

Replace `apps/desktop-app/src/renderer/components/settings/transcription/FasterWhisperBinariesCard.vue` with:

```vue
<template>
  <UiSurface as="section" class="fw-card">
    <header>
      <h3>{{ t("feature-transcription-fw-binaries") }}</h3>
      <UiButton v-if="paths" size="sm" variant="ghost" @click="$emit('openBinaryFolder')">
        <IconFolder size="sm" />
        {{ t("button-open-cache") }}
      </UiButton>
    </header>
    <div class="fw-card__row">
      <div class="fw-card__identity">
        <span>Faster-Whisper-XXL</span>
        <small v-if="binaryStatus?.asset">{{ binaryStatus.asset.version }}</small>
      </div>
      <UiBadge :tone="binaryStatus?.exists ? 'success' : binaryStatus?.downloadable ? 'warning' : 'neutral'">
        {{
          binaryStatus?.exists
            ? t("feature-transcription-ready")
            : binaryStatus?.downloadable
              ? t("feature-transcription-missing")
              : t("feature-transcription-unsupported")
        }}
      </UiBadge>
    </div>
    <p v-if="binaryStatus?.path" class="fw-card__path">{{ binaryStatus.path }}</p>
    <p v-if="binaryStatus?.reason" class="fw-card__meta">{{ binaryStatus.reason }}</p>
    <div v-if="downloadMessage || downloadError" class="fw-card__progress">
      <span>{{ downloadError || downloadMessage }}</span>
      <span>{{ downloadProgress }}%</span>
      <UiProgress :value="downloadProgress" :label="t('feature-transcription-download-xxl')" />
    </div>
    <UiButton
      v-if="binaryStatus?.downloadable && !binaryStatus.exists"
      data-testid="feature-transcription-download-xxl"
      size="sm"
      :disabled="isBusy"
      @click="$emit('downloadBinary')"
    >
      <IconDownload size="sm" />
      {{ t("feature-transcription-download-xxl") }}
    </UiButton>
  </UiSurface>
</template>

<script setup lang="ts">
import { IconDownload, IconFolder } from "../../icons";
import { UiBadge, UiButton, UiProgress, UiSurface } from "../../ui";

defineProps<{
  t: (key: string) => string;
  paths: { binaryDir: string } | null;
  binaryStatus: {
    variant: "xxl";
    exists: boolean;
    path: string;
    downloadable: boolean;
    reason?: string;
    asset?: {
      name: string;
      version: string;
      sizeBytes: number;
    };
  } | null;
  isBusy: boolean;
  downloadProgress: number;
  downloadMessage: string;
  downloadError: string | null;
}>();

defineEmits<{
  openBinaryFolder: [];
  downloadBinary: [];
}>();
</script>

<style scoped>
.fw-card {
  display: grid;
  gap: 8px;
}

.fw-card header,
.fw-card__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.fw-card__identity {
  display: grid;
  gap: 2px;
}

.fw-card__identity small,
.fw-card__meta,
.fw-card__path {
  color: var(--ui-text-muted);
  font-size: var(--ui-font-sm);
}

.fw-card__path {
  overflow-wrap: anywhere;
}

.fw-card__progress {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 6px 8px;
  align-items: center;
  color: var(--ui-text-muted);
  font-size: var(--ui-font-sm);
}

.fw-card__progress :deep(.ui-progress) {
  grid-column: 1 / -1;
}

.fw-card h3,
.fw-card__meta,
.fw-card__path {
  margin: 0;
  font-size: 13px;
}
</style>
```

- [ ] **Step 5: Update settings bindings**

In `apps/desktop-app/src/renderer/components/settings/TranscriptionFeatureSettings.vue`, change the card usage:

```vue
        <FasterWhisperBinariesCard
          v-bind="fasterWhisperBinaryBindings"
          @download-binary="handleDownloadBinary"
          @open-binary-folder="openBinaryFolder"
        />
```

Destructure from `useFasterWhisper`:

```ts
  binaryDownloadProgress,
  binaryDownloadMessage,
  binaryDownloadError,
  modelDownloadProgress,
  modelDownloadMessage,
  modelDownloadError,
  handleDownloadBinary,
```

Update bindings:

```ts
const fasterWhisperBinaryBindings = computed(() => ({
  t,
  paths: paths.value,
  binaryStatus: binaryStatus.value,
  isBusy: isBusy.value,
  downloadProgress: binaryDownloadProgress.value,
  downloadMessage: binaryDownloadMessage.value,
  downloadError: binaryDownloadError.value
}));

const fasterWhisperModelBindings = computed(() => ({
  t,
  paths: paths.value,
  availableModels: availableModels.value,
  modelsBaseDir: modelsBaseDir.value,
  isBusy: isBusy.value,
  downloadProgress: modelDownloadProgress.value,
  downloadMessage: modelDownloadMessage.value,
  downloadError: modelDownloadError.value
}));
```

- [ ] **Step 6: Update locale strings**

In `apps/desktop-app/src/renderer/locales/en.json`, add:

```json
  "feature-transcription-download-xxl": "Download Faster-Whisper-XXL",
  "feature-transcription-unsupported": "Unsupported",
```

In `apps/desktop-app/src/renderer/locales/zh.json`, add:

```json
  "feature-transcription-download-xxl": "下载 Faster-Whisper-XXL",
  "feature-transcription-unsupported": "不支持",
```

- [ ] **Step 7: Update browser test mock status**

In `apps/desktop-app/src/renderer/components/settings/SettingsFeatures.browser.test.ts`, replace Faster-Whisper mock status with:

```ts
        getFasterWhisperStatus: vi.fn().mockResolvedValue({
          ok: true,
          paths: {
            binaryDir: "/tmp/fw/bin",
            modelsDir: "/tmp/fw/models",
            xxlBinaryPath: "/tmp/fw/bin/Faster-Whisper-XXL/faster-whisper-xxl"
          },
          binary: {
            variant: "xxl",
            exists: false,
            path: "/tmp/fw/bin/Faster-Whisper-XXL/faster-whisper-xxl",
            downloadable: true,
            asset: {
              name: "Faster-Whisper-XXL_r245.4_linux.7z",
              version: "r245.4",
              sizeBytes: 1657690937
            }
          },
          models: [],
          modelsBaseDir: "/tmp/fw/models"
        }),
        downloadFasterWhisperBinary: vi.fn(),
```

- [ ] **Step 8: Run renderer tests**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app exec vitest run src/renderer/components/settings/SettingsFeatures.test.ts --project jsdom
pnpm --filter @immersive-subs/desktop-app exec vitest run src/renderer/components/settings/SettingsFeatures.browser.test.ts --project browser
```

Expected:

```text
PASS  jsdom  src/renderer/components/settings/SettingsFeatures.test.ts
PASS  browser  src/renderer/components/settings/SettingsFeatures.browser.test.ts
```

- [ ] **Step 9: Commit**

```bash
git add apps/desktop-app/src/renderer/components/settings/transcription/composables/useFasterWhisper.ts apps/desktop-app/src/renderer/components/settings/transcription/FasterWhisperBinariesCard.vue apps/desktop-app/src/renderer/components/settings/TranscriptionFeatureSettings.vue apps/desktop-app/src/renderer/components/settings/SettingsFeatures.test.ts apps/desktop-app/src/renderer/components/settings/SettingsFeatures.browser.test.ts apps/desktop-app/src/renderer/locales/en.json apps/desktop-app/src/renderer/locales/zh.json
git commit -m "feat: add faster-whisper xxl download UI"
```

---

### Task 5: Remove Remaining CPU/GPU Binary Shape References

**Files:**
- Modify any remaining project files found by search.

- [ ] **Step 1: Search for obsolete binary shape**

Run:

```bash
rg -n "cpuBinaryPath|gpuBinaryPath|binaries\\.cpu|binaries\\.gpu|download-cpu|download-gpu|feature-transcription-download-cpu|feature-transcription-download-gpu" apps/desktop-app/src
```

Expected before cleanup:

```text
matches may exist in tests or mocks
```

- [ ] **Step 2: Replace each remaining mock with the final status shape**

Use this exact final shape in any remaining test mocks:

```ts
{
  ok: true,
  paths: {
    binaryDir: "/tmp/fw/bin",
    modelsDir: "/tmp/fw/models",
    xxlBinaryPath: "/tmp/fw/bin/Faster-Whisper-XXL/faster-whisper-xxl"
  },
  binary: {
    variant: "xxl",
    exists: false,
    path: "/tmp/fw/bin/Faster-Whisper-XXL/faster-whisper-xxl",
    downloadable: true,
    asset: {
      name: "Faster-Whisper-XXL_r245.4_linux.7z",
      version: "r245.4",
      sizeBytes: 1657690937
    }
  },
  models: [],
  modelsBaseDir: "/tmp/fw/models"
}
```

- [ ] **Step 3: Verify obsolete binary shape is gone**

Run:

```bash
rg -n "cpuBinaryPath|gpuBinaryPath|binaries\\.cpu|binaries\\.gpu|download-cpu|download-gpu|feature-transcription-download-cpu|feature-transcription-download-gpu" apps/desktop-app/src
```

Expected:

```text
no output
```

- [ ] **Step 4: Commit if cleanup changed files**

```bash
git add apps/desktop-app/src
git commit -m "refactor: remove faster-whisper cpu gpu binary shape"
```

If Step 3 already had no output and there are no file changes, skip this commit.

---

### Task 6: Full Verification

**Files:**
- No planned source edits.

- [ ] **Step 1: Run focused Faster-Whisper tests**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app exec vitest run src/main/sevenZipExtractor.test.ts src/main/fasterWhisperManager.test.ts src/main/ipc/handlers/fasterWhisperHandlers.test.ts src/renderer/components/settings/SettingsFeatures.test.ts --project main --project jsdom
```

Expected:

```text
PASS  main  src/main/sevenZipExtractor.test.ts
PASS  main  src/main/fasterWhisperManager.test.ts
PASS  main  src/main/ipc/handlers/fasterWhisperHandlers.test.ts
PASS  jsdom  src/renderer/components/settings/SettingsFeatures.test.ts
```

- [ ] **Step 2: Run desktop app tests**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app test:app
```

Expected:

```text
Test Files  ... passed
Tests       ... passed
```

- [ ] **Step 3: Run desktop typecheck**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app typecheck:app
```

Expected:

```text
typecheck:main
typecheck:preload
typecheck:renderer
```

and exit code `0`.

- [ ] **Step 4: Run repository guardrails**

Run:

```bash
pnpm lint:silent-catches
pnpm lint:ui-boundaries
git diff --check
```

Expected:

```text
no output from git diff --check
```

and all commands exit `0`.

- [ ] **Step 5: Inspect final diff for banned scope**

Run:

```bash
rg -n "migration|legacy|fallback|latest release|latest-release|Whisper-Faster_r186|Whisper-Faster_r189|Whisper-Faster_r192|macOS.*download|darwin.*download" apps/desktop-app/src docs/superpowers/specs docs/superpowers/plans
```

Expected:

```text
docs may contain non-goal wording only; apps/desktop-app/src has no matches for implementation fallback, migration, dynamic latest release, ordinary Faster-Whisper assets, or macOS binary download
```

- [ ] **Step 6: Commit verification cleanup if needed**

If verification required small fixes:

```bash
git add apps/desktop-app docs/superpowers/plans/2026-06-18-faster-whisper-xxl-binary-download.md
git commit -m "test: verify faster-whisper xxl binary download"
```

If no fixes were needed, do not create an empty commit.
