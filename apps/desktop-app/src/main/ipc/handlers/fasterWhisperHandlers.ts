import { ipcMain } from "electron";
import { IpcContext } from "../ipcRouter.js";

type BinaryPayload = { variant: "cpu" | "gpu"; jobId?: string };
type ModelPayload = { model: string; jobId?: string };

export function registerFasterWhisperHandlers(context: IpcContext) {
  ipcMain.handle("usp:faster-whisper-paths", async () => {
    return context.fasterWhisperManager.getPaths();
  });

  ipcMain.handle("usp:faster-whisper-status", async (_event, modelDir?: string) => {
    try {
      const result = await context.fasterWhisperManager.getStatus(modelDir);
      return { ok: true, ...result };
    } catch (error) {
      const message =
        error && typeof error === "object" && "message" in error ? (error as Error).message : String(error);
      context.logger.error("Failed to get Faster-Whisper status", error);
      return { ok: false, error: message };
    }
  });

  ipcMain.handle(
    "usp:faster-whisper-download-binary",
    async (event, payload: BinaryPayload) => {
      const { variant, jobId } = payload;
      const downloadId = jobId || `fw-bin-${Date.now()}`;
      const progress = (percent: number, status: string) => {
        event.sender.send("usp:faster-whisper-download-progress", {
          id: downloadId,
          type: "binary",
          variant,
          percent,
          status
        });
      };
      try {
        const path = await context.fasterWhisperManager.downloadBinary(variant, progress);
        return { ok: true, path, id: downloadId };
      } catch (error) {
        const message =
          error && typeof error === "object" && "message" in error ? (error as Error).message : String(error);
        context.logger.error("Faster-Whisper binary download failed", error);
        event.sender.send("usp:faster-whisper-download-progress", {
          id: downloadId,
          type: "binary",
          variant,
          percent: 0,
          status: `Error: ${message}`
        });
        return { ok: false, error: message };
      }
    }
  );

  ipcMain.handle(
    "usp:faster-whisper-download-model",
    async (event, payload: ModelPayload) => {
      const { model, jobId } = payload;
      const downloadId = jobId || `fw-model-${Date.now()}`;
      const progress = (percent: number, status: string) => {
        event.sender.send("usp:faster-whisper-download-progress", {
          id: downloadId,
          type: "model",
          model,
          percent,
          status
        });
      };
      try {
        const result = await context.fasterWhisperManager.downloadModel(model, progress);
        return { ok: true, id: downloadId, ...result };
      } catch (error) {
        const message =
          error && typeof error === "object" && "message" in error ? (error as Error).message : String(error);
        context.logger.error("Faster-Whisper model download failed", error);
        event.sender.send("usp:faster-whisper-download-progress", {
          id: downloadId,
          type: "model",
          model,
          percent: 0,
          status: `Error: ${message}`
        });
        return { ok: false, error: message };
      }
    }
  );
}
