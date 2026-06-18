import { access, mkdtemp, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FasterWhisperManager } from "./fasterWhisperManager.js";

describe("FasterWhisperManager", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

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
    expect(status.models).toEqual([]);
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

  it("lists downloaded models with required files", async () => {
    const baseDir = await mkdtemp(path.join(tmpdir(), "usp-fw-"));
    const modelDir = path.join(baseDir, "models", "faster-whisper-base");
    await mkdir(modelDir, { recursive: true });
    await Promise.all(["config.json", "model.bin", "tokenizer.json", "vocabulary.txt"].map((file) =>
      writeFile(path.join(modelDir, file), "{}")
    ));

    const manager = new FasterWhisperManager({ baseDir });
    const result = await manager.listDownloadedModels();

    expect(result.models).toEqual([
      {
        name: "base",
        folder: "faster-whisper-base",
        path: modelDir
      }
    ]);
  });

  it("lists official downloaded models that use vocabulary.json", async () => {
    const baseDir = await mkdtemp(path.join(tmpdir(), "usp-fw-"));
    const modelDir = path.join(baseDir, "models", "faster-whisper-large-v3");
    await mkdir(modelDir, { recursive: true });
    await Promise.all([
      "config.json",
      "model.bin",
      "preprocessor_config.json",
      "tokenizer.json",
      "vocabulary.json"
    ].map((file) => writeFile(path.join(modelDir, file), "{}")));

    const manager = new FasterWhisperManager({ baseDir });
    const result = await manager.listDownloadedModels();

    expect(result.models).toEqual([
      {
        name: "large-v3",
        folder: "faster-whisper-large-v3",
        path: modelDir
      }
    ]);
  });

  it("downloads models into the requested model directory", async () => {
    const baseDir = await mkdtemp(path.join(tmpdir(), "usp-fw-"));
    const customModelDir = path.join(baseDir, "custom-models");
    const fetchMock = vi.fn((url: string) => {
      if (url === "https://huggingface.co/api/models/Systran/faster-whisper-base/tree/main") {
        return Promise.resolve(Response.json([
          { type: "file", path: "config.json" },
          { type: "file", path: "model.bin" },
          { type: "file", path: "tokenizer.json" },
          { type: "file", path: "vocabulary.txt" }
        ]));
      }
      return Promise.resolve(new Response(new ReadableStream({ start: (controller) => controller.close() }), { status: 200 }));
    });
    vi.stubGlobal("fetch", fetchMock);
    const manager = new FasterWhisperManager({ baseDir });

    const result = await manager.downloadModel("base", customModelDir);
    const listed = await manager.listDownloadedModels(customModelDir);

    expect(result.path).toBe(path.join(customModelDir, "faster-whisper-base"));
    expect(result.baseDir).toBe(customModelDir);
    expect(fetchMock).toHaveBeenCalledTimes(5);
    expect(listed.models).toEqual([
      {
        name: "base",
        folder: "faster-whisper-base",
        path: path.join(customModelDir, "faster-whisper-base")
      }
    ]);
  });

  it("downloads official aliases from their mapped repositories and file lists", async () => {
    const baseDir = await mkdtemp(path.join(tmpdir(), "usp-fw-"));
    const customModelDir = path.join(baseDir, "custom-models");
    const fetchMock = vi.fn((url: string) => {
      if (url === "https://huggingface.co/api/models/Systran/faster-whisper-large-v3/tree/main") {
        return Promise.resolve(Response.json([
          { type: "file", path: "README.md" },
          { type: "file", path: "config.json" },
          { type: "file", path: "model.bin" },
          { type: "file", path: "preprocessor_config.json" },
          { type: "file", path: "tokenizer.json" },
          { type: "file", path: "vocabulary.json" }
        ]));
      }
      return Promise.resolve(new Response(new ReadableStream({ start: (controller) => controller.close() }), { status: 200 }));
    });
    vi.stubGlobal("fetch", fetchMock);
    const manager = new FasterWhisperManager({ baseDir });

    const result = await manager.downloadModel("large-v3", customModelDir);

    expect(result.path).toBe(path.join(customModelDir, "faster-whisper-large-v3"));
    expect(result.files).toEqual([
      "config.json",
      "model.bin",
      "preprocessor_config.json",
      "tokenizer.json",
      "vocabulary.json"
    ]);
    expect(fetchMock).toHaveBeenCalledWith("https://huggingface.co/api/models/Systran/faster-whisper-large-v3/tree/main");
    expect(fetchMock).toHaveBeenCalledWith("https://huggingface.co/Systran/faster-whisper-large-v3/resolve/main/vocabulary.json");
    expect(fetchMock).not.toHaveBeenCalledWith("https://huggingface.co/Systran/faster-whisper-large-v3/resolve/main/vocabulary.txt");
  });

  it("accepts dotted official aliases, external official repos, and strict Hugging Face repo ids", async () => {
    const baseDir = await mkdtemp(path.join(tmpdir(), "usp-fw-"));
    const fetchMock = vi.fn((url: string) => {
      if (url === "https://huggingface.co/api/models/Systran/faster-whisper-tiny.en/tree/main") {
        return Promise.resolve(Response.json([
          { type: "file", path: "config.json" },
          { type: "file", path: "model.bin" },
          { type: "file", path: "tokenizer.json" },
          { type: "file", path: "vocabulary.txt" }
        ]));
      }
      if (url === "https://huggingface.co/api/models/distil-whisper/distil-large-v3.5-ct2/tree/main") {
        return Promise.resolve(Response.json([
          { type: "file", path: "config.json" },
          { type: "file", path: "model.bin" },
          { type: "file", path: "tokenizer.json" },
          { type: "file", path: "vocabulary.json" }
        ]));
      }
      return Promise.resolve(new Response(new ReadableStream({ start: (controller) => controller.close() }), { status: 200 }));
    });
    vi.stubGlobal("fetch", fetchMock);
    const manager = new FasterWhisperManager({ baseDir });

    const tiny = await manager.downloadModel("tiny.en");
    const distilAlias = await manager.downloadModel("distil-large-v3.5");
    const customRepo = await manager.downloadModel("distil-whisper/distil-large-v3.5-ct2");

    expect(tiny.path).toBe(path.join(baseDir, "models", "faster-whisper-tiny.en"));
    expect(distilAlias.path).toBe(path.join(baseDir, "models", "distil-large-v3.5-ct2"));
    expect(customRepo.path).toBe(path.join(baseDir, "models", "distil-whisper--distil-large-v3.5-ct2"));
    expect(fetchMock).toHaveBeenCalledWith("https://huggingface.co/api/models/Systran/faster-whisper-tiny.en/tree/main");
    expect(fetchMock).toHaveBeenCalledWith("https://huggingface.co/api/models/distil-whisper/distil-large-v3.5-ct2/tree/main");
  });

  it("rejects unsafe model names before building paths or URLs", async () => {
    const baseDir = await mkdtemp(path.join(tmpdir(), "usp-fw-"));
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const manager = new FasterWhisperManager({ baseDir });

    await expect(manager.downloadModel("../base")).rejects.toThrow("Invalid Faster-Whisper model name");
    await expect(manager.downloadModel("base/sub/child")).rejects.toThrow("Invalid Faster-Whisper model name");
    await expect(manager.downloadModel("https://example.test/model")).rejects.toThrow(
      "Invalid Faster-Whisper model name"
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

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
    await expect(readFile(result.path, "utf-8")).resolves.toBe("xxl");
  });

  it("sets executable permissions when installing the Linux XXL binary", async () => {
    const baseDir = await mkdtemp(path.join(tmpdir(), "usp-fw-"));
    const archiveBytes = Buffer.from("archive");
    const binaryAssets = [{
      platform: "linux" as const,
      arch: "x64" as const,
      name: "test-linux.7z",
      version: "r245.4" as const,
      url: "https://github.com/Purfview/whisper-standalone-win/releases/download/Faster-Whisper-XXL/test-linux.7z",
      sizeBytes: archiveBytes.length,
      executableRelativePath: path.join("Faster-Whisper-XXL", "faster-whisper-xxl")
    }];
    const extractArchive = vi.fn(async ({ destinationDir }: { archivePath: string; destinationDir: string }) => {
      const binary = path.join(destinationDir, "Faster-Whisper-XXL", "faster-whisper-xxl");
      await mkdir(path.dirname(binary), { recursive: true });
      await writeFile(binary, "xxl", { mode: 0o644 });
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(archiveBytes, { status: 200 })));
    const manager = new FasterWhisperManager({ baseDir, platform: "linux", arch: "x64", extractArchive, binaryAssets });

    const result = await manager.downloadBinary("xxl");

    expect((await stat(result.path)).mode & 0o777).toBe(0o755);
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
    await expect(access(path.join(baseDir, "bin", "Faster-Whisper-XXL", "faster-whisper-xxl.exe"))).rejects.toThrow();
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
    await expect(access(path.join(baseDir, "bin", "Faster-Whisper-XXL", "faster-whisper-xxl.exe"))).rejects.toThrow();
  });

  it("replaces the existing app-managed XXL directory after a successful re-download", async () => {
    const baseDir = await mkdtemp(path.join(tmpdir(), "usp-fw-"));
    const archiveBytes = Buffer.from("archive");
    const targetBinary = path.join(baseDir, "bin", "Faster-Whisper-XXL", "faster-whisper-xxl.exe");
    const oldFile = path.join(baseDir, "bin", "Faster-Whisper-XXL", "old.txt");
    await mkdir(path.dirname(targetBinary), { recursive: true });
    await writeFile(targetBinary, "old", "utf-8");
    await writeFile(oldFile, "old", "utf-8");
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
      await writeFile(binary, "new", "utf-8");
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(archiveBytes, { status: 200 })));
    const manager = new FasterWhisperManager({ baseDir, platform: "win32", arch: "x64", extractArchive, binaryAssets });

    await manager.downloadBinary("xxl");

    await expect(readFile(targetBinary, "utf-8")).resolves.toBe("new");
    await expect(access(oldFile)).rejects.toThrow();
  });
});
