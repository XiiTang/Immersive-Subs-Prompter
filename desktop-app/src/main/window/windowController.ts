import { app } from "electron";
import path from "path";
import { AppEventBus } from "../appEventBus.js";
import { StateManager } from "../stateManager.js";
import { ConnectionManager } from "../connectionManager.js";
import { SettingsStore, DEFAULT_SETTINGS } from "../settings/index.js";
import { SubtitleCacheManager } from "../subtitleCacheManager.js";
import { createLogger } from "../logger.js";
import { AppSettings, DesktopState, PlaybackState } from "../types.js";
import { MediaServerController } from "../mediaServerController.js";
import { TranscriptionService } from "../transcriptionService.js";
import { FasterWhisperManager } from "../fasterWhisperManager.js";
import { preloadNativeAPIs } from "../nativeWindowDrag.js";
import { AutoLaunchManager } from "./autoLaunchManager.js";
import { DisplayManager } from "./displayManager.js";
import { GameProcessMonitor } from "./gameProcessMonitor.js";
import { ShortcutManager } from "./shortcutManager.js";
import { TrayManager } from "./trayManager.js";
import { WindowManager } from "./windowManager.js";
import { IpcRouter } from "../ipc/ipcRouter.js";

type WindowControllerOptions = {
  bus: AppEventBus;
  stateManager: StateManager;
  connectionManager: ConnectionManager;
  settingsStore: SettingsStore;
  cacheManager: SubtitleCacheManager;
  mediaServerController: MediaServerController;
  transcriptionService: TranscriptionService;
  fasterWhisperManager: FasterWhisperManager;
  getSettings: () => AppSettings;
  setSettings: (settings: AppSettings) => void;
};

export class WindowController {
  private isQuitting = false;
  private readonly log = createLogger("desktop");
  private readonly displayManager: DisplayManager;
  private readonly autoLaunchManager: AutoLaunchManager;
  private readonly shortcutManager: ShortcutManager;
  private readonly trayManager: TrayManager;
  private readonly windowManager: WindowManager;
  private readonly gameProcessMonitor: GameProcessMonitor;
  private readonly ipcRouter: IpcRouter;

  constructor(private readonly options: WindowControllerOptions) {
    this.displayManager = new DisplayManager(options.stateManager);
    this.autoLaunchManager = new AutoLaunchManager();
    this.shortcutManager = new ShortcutManager();
    this.trayManager = new TrayManager({
      getIconPath: () => this.getIconPath(),
      onShow: () => this.showMainWindow(),
      onQuit: () => {
        this.isQuitting = true;
      }
    });
    this.windowManager = new WindowManager({
      getSettings: this.options.getSettings,
      getIconPath: () => this.getIconPath(),
      shouldPreventClose: () => !this.isQuitting,
      onDidFinishLoad: () => {
        this.pushSettings();
        this.pushState(this.options.stateManager.getState());
      },
      onClosed: () => this.displayManager.reset()
    });
    this.gameProcessMonitor = new GameProcessMonitor({
      getBlacklist: () => this.options.getSettings().global.gameProcessBlacklist ?? [],
      onBlocked: () => this.shortcutManager.blockForGame(),
      onUnblocked: () => this.shortcutManager.unblockAfterGame()
    });
    this.ipcRouter = new IpcRouter({
      stateManager: this.options.stateManager,
      connectionManager: this.options.connectionManager,
      settingsStore: this.options.settingsStore,
      cacheManager: this.options.cacheManager,
      transcriptionService: this.options.transcriptionService,
      fasterWhisperManager: this.options.fasterWhisperManager,
      getSettings: this.options.getSettings,
      setSettings: this.options.setSettings,
      updateAppSettings: (partial) => this.updateAppSettings(partial),
      displayManager: this.displayManager,
      getMainWindow: () => this.windowManager.getWindow(),
      logger: this.log
    });
  }

  initialize() {
    const previousSettings = this.options.getSettings();
    const loadedSettings = this.options.settingsStore.get() ?? DEFAULT_SETTINGS;
    this.options.setSettings(loadedSettings);
    this.options.stateManager.handleSettingsUpdated(previousSettings, loadedSettings);
    const defaultSelection = this.options.stateManager.selectProfileForUrl(null);
    this.options.stateManager.applyProfileSelection(defaultSelection.profile, defaultSelection.rule);

    this.autoLaunchManager.apply(loadedSettings.global.autoLaunch);
    this.applyGlobalShortcut();
    this.trayManager.ensureTray();
    this.gameProcessMonitor.start();
    this.setupBusListeners();
    this.ipcRouter.register();
    this.windowManager.createWindow();

    preloadNativeAPIs().catch((err) => {
      this.log.warn("Failed to preload native drag APIs", err);
    });
  }

  handleBeforeQuit() {
    this.isQuitting = true;
    this.gameProcessMonitor.stop();
    this.shortcutManager.clearRegistration();
    this.options.cacheManager.stop();
    this.options.connectionManager.stop();
    this.trayManager.destroy();
  }

  showMainWindow() {
    this.windowManager.showWindow();
  }

  toggleMainWindow() {
    this.windowManager.toggleWindow();
  }

  toggleDisplayFullscreenOnCurrentDisplay(): boolean {
    return this.displayManager.toggleFullscreen(this.windowManager.getWindow());
  }

  private setupBusListeners() {
    this.options.bus.on("state:changed", (state) => {
      this.pushState(state);
    });
    this.options.bus.on("state:playback", (playback) => {
      this.sendPlaybackUpdate(playback);
    });
    this.options.bus.on("playback:loop-cleared", () => {
      const window = this.windowManager.getWindow();
      if (window) {
        window.webContents.send("usp:loop-cleared");
      }
    });
  }

  private pushState(state: DesktopState) {
    const window = this.windowManager.getWindow();
    if (!window) return;
    window.webContents.send("usp:state", state);
  }

  private sendPlaybackUpdate(playback: PlaybackState) {
    const window = this.windowManager.getWindow();
    if (!window) return;
    window.webContents.send("usp:time", playback);
  }

  private pushSettings() {
    const window = this.windowManager.getWindow();
    if (!window) return;
    window.webContents.send("usp:settings", this.options.getSettings());
  }

  private applyGlobalShortcut() {
    const shortcut = (this.options.getSettings().global.toggleWindowShortcut ?? "").trim();
    this.shortcutManager.applyShortcut(shortcut, () => this.toggleMainWindow());
  }

  private updateAppSettings(partial: Partial<AppSettings>) {
    const previous = this.options.getSettings();
    const previousGlobal = previous.global;
    const previousNetwork = previous.network;
    const appSettings = this.options.settingsStore.update(partial);
    this.options.setSettings(appSettings);
    this.options.stateManager.handleSettingsUpdated(previous, appSettings);
    this.options.mediaServerController.handleSettingsUpdated();

    if (previousGlobal.autoLaunch !== appSettings.global.autoLaunch) {
      this.autoLaunchManager.apply(appSettings.global.autoLaunch);
    }

    if (previousGlobal.toggleWindowShortcut !== appSettings.global.toggleWindowShortcut) {
      this.applyGlobalShortcut();
    }

    if (previousGlobal.closeBehavior !== appSettings.global.closeBehavior) {
      const window = this.windowManager.getWindow();
      if (window) {
        if (appSettings.global.closeBehavior === "quit") {
          window.setSkipTaskbar(false);
        } else if (!window.isVisible()) {
          window.setSkipTaskbar(true);
        }
      }
    }

    if (previousGlobal.alwaysOnTop !== appSettings.global.alwaysOnTop) {
      this.windowManager.updateAlwaysOnTop(appSettings.global.alwaysOnTop);
    }

    if (
      previousNetwork.host !== appSettings.network.host ||
      previousNetwork.port !== appSettings.network.port
    ) {
      this.options.connectionManager.applyNetworkSettings();
    }

    this.options.bus.emit("state:changed", this.options.stateManager.getState());
    this.pushSettings();
    this.gameProcessMonitor.refresh();
    return appSettings;
  }

  private getIconPath(): string {
    if (app.isPackaged) {
      return path.join(process.resourcesPath, "icon.png");
    }
    return path.join(app.getAppPath(), "resources", "icon.png");
  }
}
