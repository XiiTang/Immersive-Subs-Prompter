import { ipcMain } from "electron";
import { startNativeWindowDrag, isNativeDragAvailable } from "../../nativeWindowDrag.js";
import { IpcContext } from "../ipcRouter.js";

export function registerWindowHandlers(context: IpcContext) {
  ipcMain.handle("usp:toggle-display-fullscreen", () => {
    return context.displayManager.toggleFullscreen(context.getMainWindow());
  });

  ipcMain.handle("usp:start-window-drag", async () => {
    const window = context.getMainWindow();
    if (!window || window.isDestroyed()) {
      return { success: false, error: "Window not available" };
    }

    if (isNativeDragAvailable()) {
      try {
        const hwnd = window.getNativeWindowHandle();
        const success = await startNativeWindowDrag(hwnd);
        return { success, native: true };
      } catch (error) {
        context.logger.error("Native window drag failed", error);
        return { success: false, error: String(error) };
      }
    }

    return { success: false, native: false, error: "Native drag not available on this platform" };
  });
}
