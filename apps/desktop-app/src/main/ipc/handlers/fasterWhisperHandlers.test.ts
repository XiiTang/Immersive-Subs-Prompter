import { beforeEach, describe, expect, it, vi } from "vitest";
import { registerFasterWhisperHandlers } from "./fasterWhisperHandlers.js";

const { handle } = vi.hoisted(() => ({
  handle: vi.fn()
}));

vi.mock("electron", () => ({
  ipcMain: {
    handle
  }
}));

function registeredHandler(channel: string) {
  const call = handle.mock.calls.find(([registeredChannel]) => registeredChannel === channel);
  if (!call) {
    throw new Error(`Missing handler for ${channel}`);
  }
  return call[1] as (...args: unknown[]) => Promise<unknown>;
}

describe("registerFasterWhisperHandlers", () => {
  beforeEach(() => {
    handle.mockReset();
  });

  it("returns Faster-Whisper status through IPC", async () => {
    const status = {
      paths: { binaryDir: "/bin", modelsDir: "/models", cpuBinaryPath: "/bin/cpu", gpuBinaryPath: "/bin/gpu" },
      binaries: {
        cpu: { exists: false, path: "/bin/cpu" },
        gpu: { exists: false, path: "/bin/gpu" }
      },
      models: [],
      modelsBaseDir: "/models"
    };
    registerFasterWhisperHandlers({
      fasterWhisperManager: {
        getStatus: vi.fn().mockResolvedValue(status),
        getPaths: vi.fn(),
        listDownloadedModels: vi.fn(),
        downloadBinary: vi.fn(),
        downloadModel: vi.fn()
      },
      logger: { error: vi.fn() }
    } as never);

    await expect(registeredHandler("usp:faster-whisper-status")({}, "/models")).resolves.toEqual({
      ok: true,
      ...status
    });
  });

  it("converts Faster-Whisper status failures into IPC errors", async () => {
    registerFasterWhisperHandlers({
      fasterWhisperManager: {
        getStatus: vi.fn().mockRejectedValue(new Error("disk failed")),
        getPaths: vi.fn(),
        listDownloadedModels: vi.fn(),
        downloadBinary: vi.fn(),
        downloadModel: vi.fn()
      },
      logger: { error: vi.fn() }
    } as never);

    await expect(registeredHandler("usp:faster-whisper-status")({}, "/models")).resolves.toEqual({
      ok: false,
      error: "disk failed"
    });
  });

  it("passes the selected model directory to model downloads", async () => {
    const downloadModel = vi.fn().mockResolvedValue({
      path: "/custom/models/faster-whisper-base",
      baseDir: "/custom/models",
      files: ["config.json", "model.bin", "tokenizer.json", "vocabulary.txt"]
    });
    const send = vi.fn();
    registerFasterWhisperHandlers({
      fasterWhisperManager: {
        getStatus: vi.fn(),
        getPaths: vi.fn(),
        listDownloadedModels: vi.fn(),
        downloadBinary: vi.fn(),
        downloadModel
      },
      logger: { error: vi.fn() }
    } as never);

    await expect(
      registeredHandler("usp:faster-whisper-download-model")(
        { sender: { send } },
        { model: "base", modelDir: "/custom/models", jobId: "job-1" }
      )
    ).resolves.toEqual({
      ok: true,
      id: "job-1",
      path: "/custom/models/faster-whisper-base",
      baseDir: "/custom/models",
      files: ["config.json", "model.bin", "tokenizer.json", "vocabulary.txt"]
    });
    expect(downloadModel).toHaveBeenCalledWith("base", "/custom/models", expect.any(Function));
  });
});
