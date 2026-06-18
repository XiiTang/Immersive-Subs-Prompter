import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FasterWhisperManager } from "./fasterWhisperManager.js";

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function responseWithUrl(body: string, url: string): Response {
  const response = new Response(body, { status: 200 });
  Object.defineProperty(response, "url", { value: url });
  return response;
}

describe("FasterWhisperManager", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reports app-managed paths and missing binaries", async () => {
    const baseDir = await mkdtemp(path.join(tmpdir(), "usp-fw-"));
    const manager = new FasterWhisperManager({ baseDir });

    const status = await manager.getStatus();

    expect(status.paths.binaryDir).toBe(path.join(baseDir, "bin"));
    expect(status.paths.modelsDir).toBe(path.join(baseDir, "models"));
    expect(status.binaries.cpu.exists).toBe(false);
    expect(status.binaries.gpu.exists).toBe(false);
    expect(status.models).toEqual([]);
  });

  it("does not offer app-managed binary downloads on unsupported platforms", async () => {
    const baseDir = await mkdtemp(path.join(tmpdir(), "usp-fw-"));
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const manager = new FasterWhisperManager({ baseDir, platform: "darwin" });

    const status = await manager.getStatus();

    expect(status.binaries.cpu.downloadSupported).toBe(false);
    expect(status.binaries.cpu.downloadUnavailableReason).toContain("Windows");
    await expect(manager.downloadBinary("cpu")).rejects.toThrow("Windows");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not present GPU package download as a completed app-managed binary install", async () => {
    const baseDir = await mkdtemp(path.join(tmpdir(), "usp-fw-"));
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const manager = new FasterWhisperManager({ baseDir, platform: "win32" });

    const status = await manager.getStatus();

    expect(status.binaries.cpu.downloadSupported).toBe(false);
    expect(status.binaries.cpu.downloadUnavailableReason).toContain("trusted binary metadata");
    expect(status.binaries.gpu.downloadSupported).toBe(false);
    expect(status.binaries.gpu.downloadUnavailableReason).toContain("manual");
    await expect(manager.downloadBinary("gpu")).rejects.toThrow("manual");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("disables production app-managed CPU binary download until trusted metadata exists", async () => {
    const baseDir = await mkdtemp(path.join(tmpdir(), "usp-fw-"));
    const manager = new FasterWhisperManager({ baseDir, platform: "win32" });

    const status = await manager.getStatus();

    expect(status.binaries.cpu.exists).toBe(false);
    expect(status.binaries.cpu.downloadSupported).toBe(false);
    expect(status.binaries.cpu.downloadUnavailableReason).toContain("trusted binary metadata");
    await expect(manager.downloadBinary("cpu")).rejects.toThrow("trusted binary metadata");
  });

  it("does not trust an existing production CPU binary when trusted metadata is unavailable", async () => {
    const baseDir = await mkdtemp(path.join(tmpdir(), "usp-fw-"));
    const targetPath = path.join(baseDir, "bin", "faster-whisper.exe");
    await mkdir(path.dirname(targetPath), { recursive: true });
    await writeFile(targetPath, "old-bytes", "utf-8");
    const manager = new FasterWhisperManager({ baseDir, platform: "win32" });

    const status = await manager.getStatus();

    expect(status.binaries.cpu.exists).toBe(false);
    expect(status.binaries.cpu.downloadSupported).toBe(false);
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
});
