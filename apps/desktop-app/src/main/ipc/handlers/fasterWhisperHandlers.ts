import { ipcMain } from "electron";
import type { FasterWhisperBinaryVariant } from "../../fasterWhisperManager.js";
import type { IpcContext } from "../ipcRouter.js";

type BinaryPayload = { variant: FasterWhisperBinaryVariant; jobId?: string };
type ModelPayload = { model: string; modelDir?: string; jobId?: string };

export function registerFasterWhisperHandlers(context: IpcContext): void {
  ipcMain.handle("usp:faster-whisper-paths", () => context.fasterWhisperManager.getPaths());

  ipcMain.handle("usp:faster-whisper-status", async (_event, modelDir?: string) => {
    try {
      return { ok: true, ...(await context.fasterWhisperManager.getStatus(modelDir)) };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      context.logger.error("Failed to get Faster-Whisper status", error);
      return { ok: false, error: message };
    }
  });

  ipcMain.handle("usp:faster-whisper-list-models", async (_event, modelDir?: string) => {
    try {
      return { ok: true, ...(await context.fasterWhisperManager.listDownloadedModels(modelDir)) };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      context.logger.error("Failed to list Faster-Whisper models", error);
      return { ok: false, error: message };
    }
  });

  ipcMain.handle("usp:faster-whisper-download-binary", async (event, payload: BinaryPayload) => {
    const downloadId = payload.jobId || `fw-bin-${Date.now()}`;
    const progress = (percent: number, status: string) => {
      event.sender.send("usp:faster-whisper-download-progress", {
        id: downloadId,
        type: "binary",
        variant: payload.variant,
        percent,
        status
      });
    };
    try {
      const binaryPath = await context.fasterWhisperManager.downloadBinary(payload.variant, progress);
      return { ok: true, id: downloadId, path: binaryPath };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      context.logger.error("Faster-Whisper binary download failed", error);
      progress(0, `Error: ${message}`);
      return { ok: false, id: downloadId, error: message };
    }
  });

  ipcMain.handle("usp:faster-whisper-download-model", async (event, payload: ModelPayload) => {
    const downloadId = payload.jobId || `fw-model-${Date.now()}`;
    const progress = (percent: number, status: string) => {
      event.sender.send("usp:faster-whisper-download-progress", {
        id: downloadId,
        type: "model",
        model: payload.model,
        percent,
        status
      });
    };
    try {
      const result = await context.fasterWhisperManager.downloadModel(payload.model, payload.modelDir, progress);
      return { ok: true, id: downloadId, ...result };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      context.logger.error("Faster-Whisper model download failed", error);
      progress(0, `Error: ${message}`);
      return { ok: false, id: downloadId, error: message };
    }
  });
}
