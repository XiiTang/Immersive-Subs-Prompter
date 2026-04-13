import { ipcMain } from "electron";
import { IpcContext } from "../ipcRouter.js";

export function registerSubtitleHandlers(context: IpcContext) {
  ipcMain.handle("usp:select-track", (_event, payload) => {
    context.connectionManager.setSubtitleTrack(payload);
  });
}
