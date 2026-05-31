import { ipcMain } from "electron";
import { IpcContext } from "../ipcRouter.js";
import type { TrackSelectionPayload } from "../../connectionManager.js";

export function registerSubtitleHandlers(context: IpcContext) {
  ipcMain.handle("usp:select-track", (_event, payload) => {
    context.connectionManager.setSubtitleTrack(readTrackSelectionPayload(payload));
  });
}

function readTrackSelectionPayload(payload: unknown): TrackSelectionPayload {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("subtitle track selection payload must use the current object shape");
  }
  const source = payload as Record<string, unknown>;
  const trackId = source.trackId;
  const role = source.role;
  if (trackId !== null && typeof trackId !== "string") {
    throw new Error("subtitle track selection trackId must be a string or null");
  }
  if (role !== undefined && role !== "primary" && role !== "secondary") {
    throw new Error("subtitle track selection role must be primary or secondary");
  }
  return { trackId, role } as TrackSelectionPayload;
}
