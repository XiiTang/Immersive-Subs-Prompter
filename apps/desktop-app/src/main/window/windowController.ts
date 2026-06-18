import { app } from "electron";
import { AppEventBus } from "../appEventBus.js";
import { StateManager } from "../stateManager.js";
import { ConnectionManager } from "../connectionManager.js";
import { SettingsStore } from "../settings/SettingsStore.js";
import { SubtitleCacheManager } from "../subtitleCacheManager.js";
import { createLogger } from "../logger.js";
import { AppSettings, DesktopState, JellyfinEmbyFeatureSettings, PlaybackState } from "../types.js";
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
import { areNetworkSettingsEqual } from "../networkSettings.js";
import { MediaSourceController } from "../mediaSources/mediaSourceController.js";
import { createAppReleaseService } from "../appReleaseRuntime.js";
import type { AppReleaseService } from "../appReleaseService.js";
import { WordLookupService } from "../features/wordLookupService.js";
import { JellyfinEmbyMediaSource } from "../features/jellyfinEmbyMediaSource.js";
import { FasterWhisperManager } from "../fasterWhisperManager.js";

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
  private readonly wordLookupService: WordLookupService;
  private readonly fasterWhisperManager: FasterWhisperManager;
  private readonly jellyfinEmbyMediaSource: JellyfinEmbyMediaSource;
  private readonly mediaSourceController: MediaSourceController;
  private readonly releaseService: AppReleaseService;

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
        this.pushReleaseState();
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
        this.pushReleaseState();
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

    this.wordLookupService = new WordLookupService(() => this.options.getSettings().features.wordLookup);
    this.fasterWhisperManager = new FasterWhisperManager();
    this.jellyfinEmbyMediaSource = new JellyfinEmbyMediaSource({
      getSettings: () => this.options.getSettings().features.jellyfinEmby
    });
    this.mediaSourceController = new MediaSourceController({
      bus: this.options.bus,
      stateManager: this.options.stateManager,
      getSources: () => [this.jellyfinEmbyMediaSource]
    });
    this.releaseService = createAppReleaseService({
      getCurrentVersion: () => app.getVersion(),
      getSettings: this.options.getSettings,
      updateSettings: (partial) => this.updateAppSettings(partial),
      isPackaged: app.isPackaged,
      logger: this.log,
      onStateChange: (state) => this.pushReleaseState(state)
    });

    this.ipcRouter = new IpcRouter({
      stateManager: this.options.stateManager,
      connectionManager: this.options.connectionManager,
      settingsStore: this.options.settingsStore,
      cacheManager: this.options.cacheManager,
      releaseService: this.releaseService,
      wordLookupService: this.wordLookupService,
      fasterWhisperManager: this.fasterWhisperManager,
      transcriptionFeature: {
        stateManager: this.options.stateManager,
        cacheManager: this.options.cacheManager,
        transcriptionService: this.options.transcriptionService,
        getSettings: () => this.options.getSettings().features.transcription
      },
      getSettings: this.options.getSettings,
      setSettings: this.options.setSettings,
      updateAppSettings: (partial) => this.updateAppSettings(partial),
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
    this.windowManager.createWindow();
    setTimeout(() => {
      void this.releaseService.maybeCheckAutomatically();
    }, 5000);
  }

  handleBeforeQuit() {
    this.gameProcessMonitor.stop();
    this.shortcutManager.clearRegistration();
    this.options.cacheManager.stop();
    void this.mediaSourceController.stop().catch((error) => {
      this.log.error("Failed to stop media source runtime", error);
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

  private pushReleaseState(state = this.releaseService.getState()) {
    this.windowManager.getWindow()?.webContents.send("usp:release-state", state);
    this.settingsWindowManager.getWindow()?.webContents.send("usp:release-state", state);
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
    this.handleFeatureSettingsUpdated(previous);

    this.options.bus.emit("state:changed", this.options.stateManager.getState());
    this.pushSettings();
    this.gameProcessMonitor.refresh();
    return appSettings;
  }

  private handleFeatureSettingsUpdated(previous: AppSettings) {
    const current = this.options.getSettings();
    if (areJellyfinEmbyFeatureSettingsEqual(previous.features.jellyfinEmby, current.features.jellyfinEmby)) {
      return;
    }

    void this.jellyfinEmbyMediaSource.handleSettingsUpdated().catch((error) => {
      this.log.error("Failed to refresh Jellyfin / Emby settings", error);
    });
    this.mediaSourceController.handleSourceSettingsChanged(this.jellyfinEmbyMediaSource.sourceId);
  }

  private updateWordLookupPanelSize(size: { width: number; height: number }) {
    const currentFeature = this.options.getSettings().features.wordLookup;
    this.updateAppSettings({
      features: {
        wordLookup: {
          enabled: currentFeature.enabled,
          config: {
            ...currentFeature.config,
            panelWidth: size.width,
            panelHeight: size.height
          }
        }
      }
    } as Partial<AppSettings>);
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

function areJellyfinEmbyFeatureSettingsEqual(
  left: JellyfinEmbyFeatureSettings,
  right: JellyfinEmbyFeatureSettings
): boolean {
  if (left.enabled !== right.enabled) {
    return false;
  }
  const leftServers = left.config.servers;
  const rightServers = right.config.servers;
  if (leftServers.length !== rightServers.length) {
    return false;
  }
  return leftServers.every((server, index) => {
    const other = rightServers[index];
    return Boolean(
      other &&
      server.id === other.id &&
      server.name === other.name &&
      server.serverUrls === other.serverUrls &&
      server.apiKey === other.apiKey &&
      server.enabled === other.enabled
    );
  });
}
