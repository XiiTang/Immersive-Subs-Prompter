import { ipcMain } from "electron";
import { IpcContext } from "../ipcRouter.js";
import { openFolder } from "../openFolder.js";

export function registerCacheHandlers(context: IpcContext) {
  ipcMain.handle("usp:cache-stats", async () => {
    return context.cacheManager.getStats();
  });

  ipcMain.handle("usp:cache-open-folder", async () => {
    const result = await openFolder(context.cacheManager.getCachePath(), "Cache folder");
    if (!result.ok) {
      context.logger.error("Failed to open cache folder", result.error);
    }
    return result;
  });
}
