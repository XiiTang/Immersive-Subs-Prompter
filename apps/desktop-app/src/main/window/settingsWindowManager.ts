import { BrowserWindow } from "electron";
import path from "path";
import { fileURLToPath } from "url";

type SettingsWindowManagerOptions = {
  getWindowIconPath: () => string;
  onDidFinishLoad?: (window: BrowserWindow) => void;
  onClosed?: () => void;
};

const SETTINGS_WINDOW_WIDTH = 1000;
const SETTINGS_WINDOW_HEIGHT = 760;

export class SettingsWindowManager {
  private settingsWindow: BrowserWindow | null = null;
  private readonly __dirname = path.dirname(fileURLToPath(import.meta.url));

  constructor(private readonly options: SettingsWindowManagerOptions) {}

  getWindow() {
    return this.settingsWindow;
  }

  openSettingsWindow() {
    if (this.settingsWindow && !this.settingsWindow.isDestroyed()) {
      if (this.settingsWindow.isMinimized()) {
        this.settingsWindow.restore();
      }
      this.settingsWindow.show();
      this.settingsWindow.focus();
      return this.settingsWindow;
    }

    this.settingsWindow = new BrowserWindow({
      width: SETTINGS_WINDOW_WIDTH,
      height: SETTINGS_WINDOW_HEIGHT,
      minWidth: SETTINGS_WINDOW_WIDTH,
      minHeight: SETTINGS_WINDOW_HEIGHT,
      maxWidth: SETTINGS_WINDOW_WIDTH,
      maxHeight: SETTINGS_WINDOW_HEIGHT,
      resizable: false,
      fullscreenable: false,
      titleBarStyle: "hidden",
      ...(process.platform === "win32" && {
        titleBarOverlay: {
          color: "#0d1117",
          symbolColor: "#e5e5e5",
          height: 48
        }
      }),
      backgroundColor: "#101418",
      webPreferences: {
        preload: path.join(this.__dirname, "../../preload.cjs"),
        contextIsolation: true,
        nodeIntegration: false
      },
      icon: this.options.getWindowIconPath()
    });

    this.settingsWindow.loadFile(path.join(this.__dirname, "../../renderer/settings.html"));
    this.settingsWindow.webContents.once("did-finish-load", () => {
      if (this.settingsWindow) {
        this.options.onDidFinishLoad?.(this.settingsWindow);
      }
    });
    this.settingsWindow.on("closed", () => {
      this.settingsWindow = null;
      this.options.onClosed?.();
    });

    return this.settingsWindow;
  }
}
