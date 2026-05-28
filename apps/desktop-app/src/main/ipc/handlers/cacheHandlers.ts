import { ipcMain, shell } from "electron";
import { IpcContext } from "../ipcRouter.js";
import fs from "fs";

export function registerCacheHandlers(context: IpcContext) {
  ipcMain.handle("usp:cache-stats", async () => {
    return context.cacheManager.getStats();
  });

  ipcMain.handle("usp:cache-clear", async () => {
    await context.cacheManager.clear();
    return { success: true };
  });

  ipcMain.handle("usp:cache-cleanup", async () => {
    const removedCount = await context.cacheManager.cleanup();
    return { success: true, removedCount };
  });

  ipcMain.handle("usp:cache-open-folder", async () => {
    const cachePath = context.cacheManager.getCachePath();
    await fs.promises.mkdir(cachePath, { recursive: true });
    await shell.openPath(cachePath);
  });
}
