import { ipcMain } from "electron";
import type { IpcContext } from "../ipcRouter.js";

export function registerReleaseHandlers(context: IpcContext) {
  ipcMain.handle("usp:get-release-state", () => context.releaseService.getState());
  ipcMain.handle("usp:check-for-updates", () => context.releaseService.checkForUpdates());
  ipcMain.handle("usp:download-release-update", () => context.releaseService.downloadUpdate());
  ipcMain.handle("usp:install-release-update", () => context.releaseService.installDownloadedUpdate());
}
