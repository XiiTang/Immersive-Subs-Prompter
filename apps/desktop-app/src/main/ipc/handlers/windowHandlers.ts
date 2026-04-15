import { ipcMain, screen } from "electron";
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

  ipcMain.handle("usp:get-window-pointer-state", () => {
    const window = context.getMainWindow();
    if (!window || window.isDestroyed()) {
      return { insideWindow: false, x: null, y: null };
    }

    const cursorPoint = screen.getCursorScreenPoint();
    const bounds = window.getBounds();
    const insideWindow =
      cursorPoint.x >= bounds.x &&
      cursorPoint.x < bounds.x + bounds.width &&
      cursorPoint.y >= bounds.y &&
      cursorPoint.y < bounds.y + bounds.height;

    if (!insideWindow) {
      return { insideWindow: false, x: null, y: null };
    }

    return {
      insideWindow: true,
      x: cursorPoint.x - bounds.x,
      y: cursorPoint.y - bounds.y
    };
  });
}
