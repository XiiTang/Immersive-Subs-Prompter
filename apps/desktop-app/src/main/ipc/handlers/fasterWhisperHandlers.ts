import { ipcMain } from "electron";
import type { IpcContext } from "../ipcRouter.js";
import { openFolder } from "../openFolder.js";

type ModelsDirectoryPayload = { configId?: string };
type BinaryPayload = { variant: "xxl"; jobId?: string };
type ModelPayload = { model: string; configId?: string; jobId?: string };

const CONFIG_NOT_FOUND_MESSAGE = "Faster-Whisper transcription config was not found.";
const MODELS_DIRECTORY_PAYLOAD_ERROR = "Faster-Whisper models directory payload is invalid.";
const BINARY_DOWNLOAD_PAYLOAD_ERROR = "Faster-Whisper binary download payload is invalid.";
const MODEL_DOWNLOAD_PAYLOAD_ERROR = "Faster-Whisper model download payload is invalid.";
const MODELS_DIRECTORY_PAYLOAD_KEYS = new Set(["configId"]);
const BINARY_DOWNLOAD_PAYLOAD_KEYS = new Set(["variant", "jobId"]);
const MODEL_DOWNLOAD_PAYLOAD_KEYS = new Set(["model", "configId", "jobId"]);

function assertPlainPayload(
  payload: unknown,
  allowedKeys: ReadonlySet<string>,
  errorMessage: string
): Record<string, unknown> | undefined {
  if (payload === undefined) {
    return undefined;
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error(errorMessage);
  }
  const record = payload as Record<string, unknown>;
  if (Object.keys(record).some((key) => !allowedKeys.has(key))) {
    throw new Error(errorMessage);
  }
  return record;
}

function readModelsDirectoryPayload(payload: unknown): ModelsDirectoryPayload | undefined {
  const record = assertPlainPayload(payload, MODELS_DIRECTORY_PAYLOAD_KEYS, MODELS_DIRECTORY_PAYLOAD_ERROR);
  if (!record) {
    return undefined;
  }
  if (record.configId !== undefined && typeof record.configId !== "string") {
    throw new Error(MODELS_DIRECTORY_PAYLOAD_ERROR);
  }
  return { configId: record.configId };
}

function readBinaryPayload(payload: unknown): BinaryPayload {
  const record = assertPlainPayload(payload, BINARY_DOWNLOAD_PAYLOAD_KEYS, BINARY_DOWNLOAD_PAYLOAD_ERROR);
  if (!record || record.variant !== "xxl" || (record.jobId !== undefined && typeof record.jobId !== "string")) {
    throw new Error(BINARY_DOWNLOAD_PAYLOAD_ERROR);
  }
  return {
    variant: "xxl",
    jobId: record.jobId
  };
}

function readModelPayload(payload: unknown): ModelPayload {
  const record = assertPlainPayload(payload, MODEL_DOWNLOAD_PAYLOAD_KEYS, MODEL_DOWNLOAD_PAYLOAD_ERROR);
  if (
    !record ||
    typeof record.model !== "string" ||
    (record.configId !== undefined && typeof record.configId !== "string") ||
    (record.jobId !== undefined && typeof record.jobId !== "string")
  ) {
    throw new Error(MODEL_DOWNLOAD_PAYLOAD_ERROR);
  }
  return {
    model: record.model,
    configId: record.configId,
    jobId: record.jobId
  };
}

function resolveModelsDirOverride(context: IpcContext, payload?: ModelsDirectoryPayload): string | undefined {
  const configId = payload?.configId?.trim();
  if (!configId) {
    return undefined;
  }
  const config = context.getSettings().features.transcription.configs.find((item) => item.id === configId);
  if (!config) {
    throw new Error(CONFIG_NOT_FOUND_MESSAGE);
  }
  return config.fasterWhisperModelDir.trim() || undefined;
}

async function resolveModelsDirForOpen(context: IpcContext, payload?: ModelsDirectoryPayload): Promise<string> {
  const override = resolveModelsDirOverride(context, payload);
  if (override) {
    return override;
  }
  return (await context.fasterWhisperManager.getPaths()).modelsDir;
}

export function registerFasterWhisperHandlers(context: IpcContext): void {
  ipcMain.handle("usp:faster-whisper-open-binary-folder", async () => {
    const paths = await context.fasterWhisperManager.getPaths();
    const result = await openFolder(paths.binaryDir, "Faster-Whisper binary folder");
    if (!result.ok) {
      context.logger.error("Failed to open Faster-Whisper binary folder", result.error);
    }
    return result;
  });

  ipcMain.handle("usp:faster-whisper-open-models-folder", async (_event, payload?: unknown) => {
    let result: Awaited<ReturnType<typeof openFolder>>;
    try {
      result = await openFolder(
        await resolveModelsDirForOpen(context, readModelsDirectoryPayload(payload)),
        "Faster-Whisper models folder"
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result = { ok: false, error: message };
    }
    if (!result.ok) {
      context.logger.error("Failed to open Faster-Whisper models folder", result.error);
    }
    return result;
  });

  ipcMain.handle("usp:faster-whisper-status", async (_event, payload?: unknown) => {
    try {
      return {
        ok: true,
        ...(await context.fasterWhisperManager.getStatus(
          resolveModelsDirOverride(context, readModelsDirectoryPayload(payload))
        ))
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      context.logger.error("Failed to get Faster-Whisper status", error);
      return { ok: false, error: message };
    }
  });

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

  ipcMain.handle("usp:faster-whisper-download-model", async (event, rawPayload: unknown) => {
    let downloadId = `fw-model-${Date.now()}`;
    let progress: ((percent: number, status: string) => void) | null = null;
    try {
      const payload = readModelPayload(rawPayload);
      downloadId = payload.jobId || downloadId;
      progress = (percent: number, status: string) => {
        event.sender.send("usp:faster-whisper-download-progress", {
          id: downloadId,
          type: "model",
          model: payload.model,
          percent,
          status
        });
      };
      const result = await context.fasterWhisperManager.downloadModel(
        payload.model,
        resolveModelsDirOverride(context, payload),
        progress
      );
      return { ok: true, id: downloadId, ...result };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      context.logger.error("Faster-Whisper model download failed", error);
      progress?.(0, `Error: ${message}`);
      return { ok: false, id: downloadId, error: message };
    }
  });
}
