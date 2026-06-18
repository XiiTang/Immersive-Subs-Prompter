import { dialog, ipcMain } from "electron";
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

}
