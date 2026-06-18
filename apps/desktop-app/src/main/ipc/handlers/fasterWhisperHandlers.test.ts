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

  it("registers the current Faster-Whisper IPC channels", () => {
    registerFasterWhisperHandlers({
      fasterWhisperManager: {
        getStatus: vi.fn(),
        getPaths: vi.fn(),
        listDownloadedModels: vi.fn(),
        downloadBinary: vi.fn(),
        downloadModel: vi.fn()
      },
      logger: { error: vi.fn() }
    } as never);

    expect(handle.mock.calls.map(([channel]) => channel).sort()).toEqual([
      "usp:faster-whisper-download-binary",
      "usp:faster-whisper-download-model",
      "usp:faster-whisper-open-binary-folder",
      "usp:faster-whisper-open-models-folder",
      "usp:faster-whisper-status"
    ].sort());
  });

  it("resolves selected config model directory in main for Faster-Whisper status", async () => {
    const status = {
      paths: {
        binaryDir: "/bin",
        modelsDir: "/models",
        xxlBinaryPath: "/bin/Faster-Whisper-XXL/faster-whisper-xxl"
      },
      binary: {
        variant: "xxl",
        exists: false,
        path: "/bin/Faster-Whisper-XXL/faster-whisper-xxl",
        downloadable: true,
        asset: {
          name: "Faster-Whisper-XXL_r245.4_linux.7z",
          version: "r245.4",
          sizeBytes: 1657690937
        }
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
        downloadBinary,
        downloadModel: vi.fn()
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
        downloadBinary,
        downloadModel: vi.fn()
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
        downloadBinary,
        downloadModel: vi.fn()
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
          xxlBinaryPath: "/tmp/fw/bin/Faster-Whisper-XXL/faster-whisper-xxl"
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
          xxlBinaryPath: "/tmp/fw/bin/Faster-Whisper-XXL/faster-whisper-xxl"
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
          xxlBinaryPath: "/tmp/fw/bin/Faster-Whisper-XXL/faster-whisper-xxl"
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
          xxlBinaryPath: "/tmp/fw/bin/Faster-Whisper-XXL/faster-whisper-xxl"
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
