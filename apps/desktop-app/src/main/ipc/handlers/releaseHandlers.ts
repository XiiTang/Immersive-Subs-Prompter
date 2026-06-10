import { ipcMain } from "electron";
import type { IpcContext } from "../ipcRouter.js";

export function registerReleaseHandlers(context: IpcContext) {
  ipcMain.handle("usp:get-release-state", () => context.releaseService.getState());
  ipcMain.handle("usp:check-for-updates", () => context.releaseService.checkForUpdates());
  ipcMain.handle("usp:open-release-download", (_event, payload: { url?: string } | null) =>
    context.releaseService.openDownload(payload?.url)
  );
}
