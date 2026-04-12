import { BrowserWindow } from "electron";
import path from "path";
import { fileURLToPath } from "url";
import { AppSettings } from "../types.js";

type WindowManagerOptions = {
  getSettings: () => AppSettings;
  getWindowIconPath: () => string;
  onDidFinishLoad?: (window: BrowserWindow) => void;
  onShow?: () => void;
  onHide?: () => void;
  onClosed?: () => void;
};

export class WindowManager {
  private mainWindow: BrowserWindow | null = null;
  private readonly __dirname = path.dirname(fileURLToPath(import.meta.url));

  constructor(private readonly options: WindowManagerOptions) { }

  getWindow(): BrowserWindow | null {
    return this.mainWindow;
  }

  createWindow(): BrowserWindow {
    if (this.mainWindow) {
      return this.mainWindow;
    }

    const settings = this.options.getSettings();

    this.mainWindow = new BrowserWindow({
      width: 460,
      height: 640,
      frame: false,
      hasShadow: false,
      transparent: true,
      backgroundColor: "#00000000",
      resizable: true,
      fullscreenable: false,
      titleBarStyle: "hidden",
      webPreferences: {
        preload: path.join(this.__dirname, "../../preload.js"),
        contextIsolation: true,
        nodeIntegration: false
      },
      icon: this.options.getWindowIconPath()
    });

    const level = settings.global.alwaysOnTop;
    if (level === "off") {
      this.mainWindow.setAlwaysOnTop(false);
    } else {
      this.mainWindow.setAlwaysOnTop(true, level);
    }

    this.mainWindow.loadFile(path.join(this.__dirname, "../../renderer/index.html"));

    // Close event: allow window to close normally (Alt+F4, taskbar close, etc.)
    // No need to intercept - window closes and app quits

    this.mainWindow.on("show", () => {
      this.mainWindow?.setSkipTaskbar(false);
      this.options.onShow?.();
    });

    this.mainWindow.on("hide", () => {
      this.options.onHide?.();
    });

    if (process.env.NODE_ENV === "development") {
      this.mainWindow.webContents.openDevTools();
    }

    this.mainWindow.webContents.once("did-finish-load", () => {
      if (this.mainWindow) {
        this.options.onDidFinishLoad?.(this.mainWindow);
      }
    });

    this.mainWindow.on("closed", () => {
      this.mainWindow = null;
      this.options.onClosed?.();
    });

    return this.mainWindow;
  }

  showWindow() {
    if (this.mainWindow) {
      if (this.mainWindow.isMinimized()) {
        this.mainWindow.restore();
      }
      this.mainWindow.show();
      this.mainWindow.focus();
      return;
    }
    this.createWindow();
  }

  toggleWindow() {
    if (!this.mainWindow) {
      this.createWindow();
      return;
    }

    if (this.mainWindow.isVisible()) {
      this.mainWindow.hide();
    } else {
      if (this.mainWindow.isMinimized()) {
        this.mainWindow.restore();
      }
      this.mainWindow.show();
      this.mainWindow.focus();
    }
  }

  updateAlwaysOnTop(level: AppSettings["global"]["alwaysOnTop"]) {
    if (!this.mainWindow) {
      return;
    }
    if (level === "off") {
      this.mainWindow.setAlwaysOnTop(false);
    } else {
      this.mainWindow.setAlwaysOnTop(true, level);
    }
  }
}
