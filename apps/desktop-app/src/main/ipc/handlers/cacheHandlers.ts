import { ipcMain, shell } from "electron";
import { IpcContext } from "../ipcRouter.js";
import fs from "fs";

export function registerCacheHandlers(context: IpcContext) {
  ipcMain.handle("usp:cache-stats", async () => {
    return context.cacheManager.getStats();
  });

  ipcMain.handle("usp:cache-open-folder", async () => {
    const cachePath = context.cacheManager.getCachePath();
    await fs.promises.mkdir(cachePath, { recursive: true });
    await shell.openPath(cachePath);
  });
}
