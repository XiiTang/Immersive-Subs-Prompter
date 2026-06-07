import { app } from "electron";
import { AppEventBus } from "../appEventBus.js";
import { StateManager } from "../stateManager.js";
import { ConnectionManager } from "../connectionManager.js";
import { SettingsStore } from "../settings/SettingsStore.js";
import { SubtitleCacheManager } from "../subtitleCacheManager.js";
import { createLogger } from "../logger.js";
import { AppSettings, DesktopState, PlaybackState, TranscriptionConfig } from "../types.js";
import { TranscriptionService } from "../transcriptionService.js";
import { AutoLaunchManager } from "./autoLaunchManager.js";
import { DisplayManager } from "./displayManager.js";
import { GameProcessMonitor } from "./gameProcessMonitor.js";
import { ShortcutManager } from "./shortcutManager.js";
import { TrayManager } from "./trayManager.js";
import { WindowManager } from "./windowManager.js";
import { SettingsWindowManager } from "./settingsWindowManager.js";
import { WordLookupWindowManager } from "./wordLookupWindowManager.js";
import { IpcRouter } from "../ipc/ipcRouter.js";
import { resolveBundledResource } from "../resourcePaths.js";
import { PluginRegistryStore } from "../plugins/pluginRegistryStore.js";
import { getPluginRootPath, getRegistryPath } from "../plugins/pluginPaths.js";
import { PluginManager } from "../plugins/pluginManager.js";
import { areNetworkSettingsEqual } from "../networkSettings.js";
import { MediaSourceController } from "../mediaSources/mediaSourceController.js";

type WindowControllerOptions = {
  bus: AppEventBus;
  stateManager: StateManager;
  connectionManager: ConnectionManager;
  settingsStore: SettingsStore;
  cacheManager: SubtitleCacheManager;
  transcriptionService: TranscriptionService;
  getSettings: () => AppSettings;
  setSettings: (settings: AppSettings) => void;
};

export class WindowController {
  private readonly log = createLogger("desktop");
  private readonly displayManager: DisplayManager;
  private readonly autoLaunchManager: AutoLaunchManager;
  private readonly shortcutManager: ShortcutManager;
  private readonly trayManager: TrayManager;
  private readonly windowManager: WindowManager;
  private readonly settingsWindowManager: SettingsWindowManager;
  private readonly wordLookupWindowManager: WordLookupWindowManager;
  private readonly gameProcessMonitor: GameProcessMonitor;
  private readonly ipcRouter: IpcRouter;
  private readonly pluginManager: PluginManager;
  private readonly mediaSourceController: MediaSourceController;

  constructor(private readonly options: WindowControllerOptions) {
    this.displayManager = new DisplayManager(options.stateManager);
    this.autoLaunchManager = new AutoLaunchManager();
    this.shortcutManager = new ShortcutManager();
    this.trayManager = new TrayManager({
      getTrayIconPath: () => this.getTrayIconPath(),
      getLanguage: () => this.options.getSettings().global.language,
      onShow: () => this.showMainWindow(),
      onQuickShow: () => this.quickShowMainWindow()
    });
    this.windowManager = new WindowManager({
      getSettings: this.options.getSettings,
      getWindowIconPath: () => this.getWindowIconPath(),
      onDidFinishLoad: () => {
        this.pushSettings();
        this.pushState(this.options.stateManager.getState());
      },
      onHide: () => this.wordLookupWindowManager?.close(),
      onClosed: () => {
        this.wordLookupWindowManager?.close();
        this.displayManager.reset();
      }
    });
    this.settingsWindowManager = new SettingsWindowManager({
      getWindowIconPath: () => this.getWindowIconPath(),
      onDidFinishLoad: () => {
        this.pushSettings();
        this.pushState(this.options.stateManager.getState());
      }
    });
    this.wordLookupWindowManager = new WordLookupWindowManager({
      getMainWindow: () => this.windowManager.getWindow(),
      getSettings: this.options.getSettings,
      updateWordLookupPanelSize: (size) => this.updateWordLookupPanelSize(size),
      logger: this.log
    });
    this.gameProcessMonitor = new GameProcessMonitor({
      getBlacklist: () => this.options.getSettings().global.gameProcessBlacklist,
      onBlocked: () => this.shortcutManager.blockForGame(),
      onUnblocked: () => this.shortcutManager.unblockAfterGame()
    });

    const pluginRoot = getPluginRootPath();
    const registryStore = new PluginRegistryStore(getRegistryPath(pluginRoot));
    this.pluginManager = new PluginManager({
      rootDir: pluginRoot,
      registryStore,
      appVersion: app.getVersion(),
      getSettings: this.options.getSettings,
      replaceSettings: (settings) => this.replaceAppSettings(settings),
      transcriptionRuntime: {
        transcribe: (videoUrl, config) =>
          this.options.transcriptionService.transcribe(videoUrl, config as unknown as TranscriptionConfig)
      },
      onCatalogChanged: () => this.pushPluginCatalog(),
      onPluginContributionsRemoved: (pluginKey) => this.mediaSourceController.handlePluginRemoved(pluginKey)
    });
    this.mediaSourceController = new MediaSourceController({
      bus: this.options.bus,
      stateManager: this.options.stateManager,
      getAdapters: () => this.pluginManager.getMediaSourceAdapters()
    });

    this.ipcRouter = new IpcRouter({
      stateManager: this.options.stateManager,
      connectionManager: this.options.connectionManager,
      settingsStore: this.options.settingsStore,
      cacheManager: this.options.cacheManager,
      pluginManager: this.pluginManager,
      getSettings: this.options.getSettings,
      setSettings: this.options.setSettings,
      updateAppSettings: (partial) => this.updateAppSettings(partial),
      pushPluginCatalog: () => this.pushPluginCatalog(),
      displayManager: this.displayManager,
      wordLookupWindowManager: this.wordLookupWindowManager,
      getMainWindow: () => this.windowManager.getWindow(),
      openSettingsWindow: () => this.openSettingsWindow(),
      logger: this.log
    });
  }

  initialize() {
    const previousSettings = this.options.getSettings();
    const loadedSettings = this.options.settingsStore.get();
    this.options.setSettings(loadedSettings);
    this.options.stateManager.handleSettingsUpdated(previousSettings);
    const defaultSelection = this.options.stateManager.selectProfileForUrl(null);
    this.options.stateManager.applyProfileSelection(defaultSelection.profile, defaultSelection.rule);

    this.autoLaunchManager.apply(loadedSettings.global.autoLaunch);
    this.applyGlobalShortcut();
    this.trayManager.ensureTray();
    this.gameProcessMonitor.start();
    this.mediaSourceController.start();
    this.setupBusListeners();
    this.ipcRouter.register();
    this.pluginManager.loadEnabledPlugins().catch((err) => {
      this.log.error("Failed to load enabled plugins", err);
    });
    this.windowManager.createWindow();
  }

  handleBeforeQuit() {
    this.gameProcessMonitor.stop();
    this.shortcutManager.clearRegistration();
    this.options.cacheManager.stop();
    void Promise.all([this.pluginManager.shutdown(), this.mediaSourceController.stop()]).catch((error) => {
      this.log.error("Failed to stop plugin runtime", error);
    });
    this.options.connectionManager.stop();
    this.trayManager.destroy();
  }

  showMainWindow() {
    this.windowManager.showWindow();
  }

  toggleMainWindow() {
    this.windowManager.toggleWindow();
  }

  openSettingsWindow() {
    return this.settingsWindowManager.openSettingsWindow();
  }

  /**
   * Quick show: Show window, lock to top, and set opacity to 100%
   */
  quickShowMainWindow() {
    // Show the window first
    this.windowManager.showWindow();
    const window = this.windowManager.getWindow();
    const shouldKeepSnapLayout = process.platform === "win32" && !!window && window.isSnapped();

    // Keep snapped Windows layouts intact instead of forcing a top-most overlay state.
    this.updateAppSettings({
      global: {
        ...this.options.getSettings().global,
        alwaysOnTop: shouldKeepSnapLayout ? this.options.getSettings().global.alwaysOnTop : "screen-saver",
        panelOpacity: 100
      }
    });
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
    this.windowManager.getWindow()?.webContents.send("usp:state", state);
    this.settingsWindowManager.getWindow()?.webContents.send("usp:state", state);
  }

  private sendPlaybackUpdate(playback: PlaybackState) {
    const window = this.windowManager.getWindow();
    if (!window) return;
    window.webContents.send("usp:time", playback);
  }

  private pushSettings() {
    const settings = this.options.getSettings();
    this.windowManager.getWindow()?.webContents.send("usp:settings", settings);
    this.settingsWindowManager.getWindow()?.webContents.send("usp:settings", settings);
  }

  private async pushPluginCatalog() {
    const catalog = await this.pluginManager.listCatalog();
    this.windowManager.getWindow()?.webContents.send("usp:plugin-catalog", catalog);
    this.settingsWindowManager.getWindow()?.webContents.send("usp:plugin-catalog", catalog);
  }

  private applyGlobalShortcut() {
    const shortcut = this.options.getSettings().global.toggleWindowShortcut.trim();
    this.shortcutManager.applyShortcut(shortcut, () => this.toggleMainWindow());
  }

  private updateAppSettings(partial: Partial<AppSettings>) {
    const previous = this.options.getSettings();
    const previousGlobal = previous.global;
    const previousNetwork = previous.network;
    const appSettings = this.options.settingsStore.update(partial);
    this.options.setSettings(appSettings);
    this.options.stateManager.handleSettingsUpdated(previous);

    if (previousGlobal.autoLaunch !== appSettings.global.autoLaunch) {
      this.autoLaunchManager.apply(appSettings.global.autoLaunch);
    }

    if (previousGlobal.toggleWindowShortcut !== appSettings.global.toggleWindowShortcut) {
      this.applyGlobalShortcut();
    }

    if (previousGlobal.alwaysOnTop !== appSettings.global.alwaysOnTop) {
      this.windowManager.updateAlwaysOnTop(appSettings.global.alwaysOnTop);
      this.wordLookupWindowManager.updateAlwaysOnTop();
    }

    if (previousGlobal.language !== appSettings.global.language) {
      this.trayManager.updateLanguage();
    }

    if (!areNetworkSettingsEqual(previousNetwork, appSettings.network)) {
      this.options.connectionManager.applyNetworkSettings();
    }
    this.refreshPluginRuntimeSettings();

    this.options.bus.emit("state:changed", this.options.stateManager.getState());
    this.pushSettings();
    this.gameProcessMonitor.refresh();
    return appSettings;
  }

  private replaceAppSettings(next: AppSettings) {
    const previous = this.options.getSettings();
    const previousGlobal = previous.global;
    const previousNetwork = previous.network;
    const appSettings = this.options.settingsStore.replace(next);
    this.options.setSettings(appSettings);
    this.options.stateManager.handleSettingsUpdated(previous);

    if (previousGlobal.autoLaunch !== appSettings.global.autoLaunch) {
      this.autoLaunchManager.apply(appSettings.global.autoLaunch);
    }
    if (previousGlobal.toggleWindowShortcut !== appSettings.global.toggleWindowShortcut) {
      this.applyGlobalShortcut();
    }
    if (previousGlobal.alwaysOnTop !== appSettings.global.alwaysOnTop) {
      this.windowManager.updateAlwaysOnTop(appSettings.global.alwaysOnTop);
      this.wordLookupWindowManager.updateAlwaysOnTop();
    }
    if (previousGlobal.language !== appSettings.global.language) {
      this.trayManager.updateLanguage();
    }
    if (!areNetworkSettingsEqual(previousNetwork, appSettings.network)) {
      this.options.connectionManager.applyNetworkSettings();
    }
    this.refreshPluginRuntimeSettings();

    this.options.bus.emit("state:changed", this.options.stateManager.getState());
    this.pushSettings();
    this.gameProcessMonitor.refresh();
    return appSettings;
  }

  private refreshPluginRuntimeSettings() {
    void this.pluginManager.refreshRuntimeConfigs()
      .catch((error) => {
        this.log.error("Failed to refresh plugin runtime settings", error);
      });
  }

  private updateWordLookupPanelSize(size: { width: number; height: number }) {
    const pluginKey = this.pluginManager.getWordLookupProvider()?.pluginKey;
    if (!pluginKey) {
      return;
    }
    const currentConfig = this.options.getSettings().plugins[pluginKey]?.config;
    this.updateAppSettings({
      plugins: {
        [pluginKey]: {
          config: {
            ...(currentConfig && typeof currentConfig === "object" ? currentConfig : {}),
            panelWidth: size.width,
            panelHeight: size.height
          }
        }
      }
    });
  }

  private getWindowIconPath(): string {
    return resolveBundledResource(this.getWindowIconName());
  }

  private getTrayIconPath(): string {
    return resolveBundledResource(this.getTrayIconName());
  }

  private getWindowIconName(): string {
    switch (process.platform) {
      case "win32":
        return "icon.ico";
      default:
        return "icon.png";
    }
  }

  private getTrayIconName(): string {
    switch (process.platform) {
      case "win32":
        return "icon.ico";
      case "darwin":
        return "trayTemplate.png";
      default:
        return "icon.png";
    }
  }
}
