import { dialog, ipcMain, shell, type OpenDialogOptions } from "electron";
import fs from "fs";
import { AppSettings } from "../../types.js";
import { IpcContext } from "../ipcRouter.js";

export function registerSettingsHandlers(context: IpcContext) {
  ipcMain.handle("usp:get-settings", () => context.getSettings());

  ipcMain.handle("usp:update-settings", (_event, payload: Partial<AppSettings>) => {
    return context.updateAppSettings(payload);
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

  ipcMain.handle("usp:open-external", async (_event, url: string) => {
    if (!url || typeof url !== "string") {
      return { ok: false, error: "Invalid URL" };
    }
    try {
      await shell.openExternal(url);
      return { ok: true };
    } catch (error) {
      context.logger.error(`Failed to open external link: ${url}`, error);
      const message =
        error && typeof error === "object" && "message" in error ? (error as Error).message : String(error);
      return { ok: false, error: message };
    }
  });

  ipcMain.handle("usp:select-word-list-file", async () => {
    const window = context.openSettingsWindow() ?? context.getMainWindow() ?? undefined;
    const options: OpenDialogOptions = {
      title: "Select word list",
      properties: ["openFile"],
      filters: [
        { name: "JSONL word lists", extensions: ["jsonl", "json"] },
        { name: "All files", extensions: ["*"] }
      ]
    };
    const result = window
      ? await dialog.showOpenDialog(window, options)
      : await dialog.showOpenDialog(options);
    if (result.canceled || !result.filePaths[0]) {
      return { canceled: true, path: null };
    }
    return { canceled: false, path: result.filePaths[0] };
  });
}
