import { ipcMain } from "electron";
import { IpcContext } from "../ipcRouter.js";

export function registerWindowHandlers(context: IpcContext) {
  ipcMain.handle("usp:open-settings-window", () => {
    const window = context.openSettingsWindow();
    if (!window || window.isDestroyed()) {
      return { success: false, error: "Settings window not available" };
    }
    return { success: true };
  });

  ipcMain.handle("usp:toggle-display-fullscreen", () => {
    return context.displayManager.toggleFullscreen(context.getMainWindow());
  });
}
