import { AppEventBus } from "../appEventBus.js";
import { StateManager } from "../stateManager.js";
import { ConnectionManager } from "../connectionManager.js";
import { SettingsStore } from "../settings/SettingsStore.js";
import { SubtitleCacheManager } from "../subtitleCacheManager.js";
import { createLogger } from "../logger.js";
import { AppSettings, DesktopState, PlaybackState, TranscriptionPluginConfig } from "../types.js";
import { MediaServerController } from "../mediaServerController.js";
import { TranscriptionService } from "../transcriptionService.js";
import { FasterWhisperManager } from "../fasterWhisperManager.js";
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
import { PluginHost } from "../plugins/pluginHost.js";
import { PluginRegistryStore } from "../plugins/pluginRegistryStore.js";
import { getRegistryPath } from "../plugins/pluginPaths.js";
import { TRANSCRIPTION_MANIFEST } from "../plugins/official/transcription/manifest.js";
import { registerTranscriptionPluginMain } from "../plugins/official/transcription/registerMain.js";
import { WORD_LOOKUP_MANIFEST } from "../plugins/official/wordLookup/manifest.js";
import { registerWordLookupPluginMain } from "../plugins/official/wordLookup/registerMain.js";
import type { WordLookupPluginConfig } from "../plugins/official/wordLookup/wordLookupTypes.js";
import { JELLYFINEMBY_MANIFEST } from "../plugins/official/jellyfinemby/manifest.js";
import { registerJellyfinembyPluginMain } from "../plugins/official/jellyfinemby/registerMain.js";
import { TRANSCRIPTION_PLUGIN_ID, WORD_LOOKUP_PLUGIN_ID } from "../../common/pluginIds.js";
import { areNetworkSettingsEqual } from "../networkSettings.js";

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
  private readonly pluginHost: PluginHost;

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

    const registryStore = new PluginRegistryStore(getRegistryPath());
    this.pluginHost = new PluginHost(registryStore);
    this.pluginHost.registerBundledPlugin(TRANSCRIPTION_MANIFEST, () =>
      registerTranscriptionPluginMain({
        stateManager: this.options.stateManager,
        transcriptionService: this.options.transcriptionService,
        cacheManager: this.options.cacheManager,
        getTranscriptionSettings: () =>
          this.options.getSettings().plugins[TRANSCRIPTION_PLUGIN_ID]?.config as unknown as TranscriptionPluginConfig,
        logger: this.log
      })
    );
    this.pluginHost.registerBundledPlugin(WORD_LOOKUP_MANIFEST, () =>
      registerWordLookupPluginMain({
        getWordLookupSettings: () =>
          this.options.getSettings().plugins[WORD_LOOKUP_PLUGIN_ID]?.config as unknown as WordLookupPluginConfig
      })
    );
    this.pluginHost.registerBundledPlugin(JELLYFINEMBY_MANIFEST, () =>
      registerJellyfinembyPluginMain({
        mediaServerController: this.options.mediaServerController
      })
    );

    this.ipcRouter = new IpcRouter({
      stateManager: this.options.stateManager,
      connectionManager: this.options.connectionManager,
      settingsStore: this.options.settingsStore,
      cacheManager: this.options.cacheManager,
      transcriptionService: this.options.transcriptionService,
      fasterWhisperManager: this.options.fasterWhisperManager,
      pluginHost: this.pluginHost,
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
    this.setupBusListeners();
    this.ipcRouter.register();
    this.pluginHost.loadEnabledPlugins().catch((err) => {
      this.log.error("Failed to load enabled plugins", err);
    });
    this.windowManager.createWindow();
  }

  handleBeforeQuit() {
    this.gameProcessMonitor.stop();
    this.shortcutManager.clearRegistration();
    this.options.cacheManager.stop();
    this.options.mediaServerController.deactivate();
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
    const catalog = await this.pluginHost.listCatalog();
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
    this.options.mediaServerController.handleSettingsUpdated();

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

    this.options.bus.emit("state:changed", this.options.stateManager.getState());
    this.pushSettings();
    this.gameProcessMonitor.refresh();
    return appSettings;
  }

  private updateWordLookupPanelSize(size: { width: number; height: number }) {
    const currentConfig = this.options.getSettings().plugins[WORD_LOOKUP_PLUGIN_ID]?.config;
    this.updateAppSettings({
      plugins: {
        [WORD_LOOKUP_PLUGIN_ID]: {
          config: {
            ...(currentConfig && typeof currentConfig === "object" ? currentConfig : {}),
            panelSize: size
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
