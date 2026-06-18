import { beforeEach, describe, expect, it, vi } from "vitest";
import { registerFasterWhisperHandlers } from "./fasterWhisperHandlers.js";

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
    openPath.mockReset();
    openPath.mockResolvedValue("");
  });

  it("resolves selected config model directory in main for Faster-Whisper status", async () => {
    const status = {
      paths: { binaryDir: "/bin", modelsDir: "/models", cpuBinaryPath: "/bin/cpu", gpuBinaryPath: "/bin/gpu" },
      binaries: {
        cpu: { exists: false, path: "/bin/cpu" },
        gpu: { exists: false, path: "/bin/gpu" }
      },
      models: [],
      modelsBaseDir: "/custom/models"
    };
    const getStatus = vi.fn().mockResolvedValue(status);
    registerFasterWhisperHandlers({
      fasterWhisperManager: {
        getStatus,
        getPaths: vi.fn().mockResolvedValue(status.paths),
        listDownloadedModels: vi.fn(),
        downloadBinary: vi.fn(),
        downloadModel: vi.fn()
      },
      getSettings: vi.fn(() => ({
        features: {
          transcription: {
            configs: [{ id: "config-a", fasterWhisperModelDir: "/custom/models" }]
          }
        }
      })),
      logger: { error: vi.fn() }
    } as never);

    await expect(registeredHandler("usp:faster-whisper-status")({}, { configId: "config-a" })).resolves.toEqual({
      ok: true,
      ...status
    });
    expect(getStatus).toHaveBeenCalledWith("/custom/models");
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

    await expect(registeredHandler("usp:faster-whisper-status")({})).resolves.toEqual({
      ok: false,
      error: "disk failed"
    });
  });

  it("rejects non-object Faster-Whisper models directory payloads", async () => {
    const getStatus = vi.fn();
    registerFasterWhisperHandlers({
      fasterWhisperManager: {
        getStatus,
        getPaths: vi.fn(),
        listDownloadedModels: vi.fn(),
        downloadBinary: vi.fn(),
        downloadModel: vi.fn()
      },
      logger: { error: vi.fn() }
    } as never);

    await expect(registeredHandler("usp:faster-whisper-status")({}, "/custom/models")).resolves.toEqual({
      ok: false,
      error: "Faster-Whisper models directory payload is invalid."
    });
    expect(getStatus).not.toHaveBeenCalled();
  });

  it("rejects model download payloads with unknown path fields", async () => {
    const downloadModel = vi.fn();
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
        { model: "base", directory: "/custom/models", jobId: "job-1" }
      )
    ).resolves.toEqual({
      ok: false,
      id: expect.stringMatching(/^fw-model-/),
      error: "Faster-Whisper model download payload is invalid."
    });
    expect(downloadModel).not.toHaveBeenCalled();
  });

  it("resolves selected config model directory in main for model downloads", async () => {
    const downloadModel = vi.fn().mockResolvedValue({
      path: "/custom/models/faster-whisper-base",
      baseDir: "/custom/models",
      files: ["config.json", "model.bin", "tokenizer.json", "vocabulary.txt"]
    });
    const send = vi.fn();
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
        downloadModel
      },
      getSettings: vi.fn(() => ({
        features: {
          transcription: {
            configs: [{ id: "config-a", fasterWhisperModelDir: "/custom/models" }]
          }
        }
      })),
      logger: { error: vi.fn() }
    } as never);

    await expect(
      registeredHandler("usp:faster-whisper-download-model")(
        { sender: { send } },
        { model: "base", configId: "config-a", jobId: "job-1" }
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

  it("rejects unknown Faster-Whisper config ids instead of opening the default models folder", async () => {
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
            configs: []
          }
        }
      })),
      logger: { error: vi.fn() }
    } as never);

    await expect(
      registeredHandler("usp:faster-whisper-open-models-folder")({}, { configId: "missing" })
    ).resolves.toEqual({
      ok: false,
      error: "Faster-Whisper transcription config was not found."
    });
    expect(openPath).not.toHaveBeenCalled();
  });

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
});
