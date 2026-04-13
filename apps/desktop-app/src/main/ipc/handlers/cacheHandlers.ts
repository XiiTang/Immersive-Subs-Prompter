import { ipcMain, shell } from "electron";
import { IpcContext } from "../ipcRouter.js";
import fs from "fs";

export function registerCacheHandlers(context: IpcContext) {
  ipcMain.handle("usp:cache-stats", async () => {
    try {
      return await context.cacheManager.getStats();
    } catch (error) {
      context.logger.error("Failed to get cache stats", error);
      throw error;
    }
  });

  ipcMain.handle("usp:cache-clear", async () => {
    try {
      await context.cacheManager.clear();
      return { success: true };
    } catch (error) {
      context.logger.error("Failed to clear cache", error);
      throw error;
    }
  });

  ipcMain.handle("usp:cache-cleanup", async () => {
    try {
      const removedCount = await context.cacheManager.cleanup();
      return { success: true, removedCount };
    } catch (error) {
      context.logger.error("Failed to cleanup cache", error);
      throw error;
    }
  });

  ipcMain.handle("usp:cache-open-folder", async () => {
    try {
      const cachePath = context.cacheManager.getCachePath();
      await fs.promises.mkdir(cachePath, { recursive: true });
      await shell.openPath(cachePath);
    } catch (error) {
      context.logger.error("Failed to open cache folder", error);
      throw error;
    }
  });
}
