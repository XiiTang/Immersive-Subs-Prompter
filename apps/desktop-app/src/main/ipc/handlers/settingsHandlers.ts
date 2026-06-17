import { dialog, ipcMain, shell } from "electron";
import fs from "fs";
import { AppSettings } from "../../types.js";
import { IpcContext } from "../ipcRouter.js";

export function registerSettingsHandlers(context: IpcContext) {
  ipcMain.handle("usp:get-settings", () => context.getSettings());

  ipcMain.handle("usp:update-settings", (_event, payload: Partial<AppSettings>) => {
    return context.updateAppSettings(payload);
  });

  ipcMain.handle("usp:select-word-list-file", async () => {
    const result = await dialog.showOpenDialog({
      title: "Select Word List",
      properties: ["openFile"],
      filters: [
        { name: "JSONL", extensions: ["jsonl"] },
        { name: "JSON", extensions: ["json"] },
        { name: "All Files", extensions: ["*"] }
      ]
    });
    return {
      canceled: result.canceled,
      path: result.canceled ? null : result.filePaths[0] ?? null
    };
  });

  ipcMain.handle("usp:open-path", async (_event, targetPath: string) => {
    try {
      if (!targetPath) {
        throw new Error("Path is empty");
      }
      await fs.promises.mkdir(targetPath, { recursive: true });
      await shell.openPath(targetPath);
      return { ok: true };
    } catch (error) {
      const message =
        error && typeof error === "object" && "message" in error ? (error as Error).message : String(error);
      context.logger.error("Failed to open path", error);
      return { ok: false, error: message };
    }
  });

}
