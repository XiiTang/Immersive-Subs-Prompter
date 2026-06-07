import { app } from "electron";
import { AppEventBus } from "./appEventBus.js";
import { StateManager } from "./stateManager.js";
import { ConnectionManager } from "./connectionManager.js";
import { WindowController } from "./window/windowController.js";
import { SubtitleCacheManager } from "./subtitleCacheManager.js";
import { SubtitleService } from "./subtitleService.js";
import { YtDlpManager } from "./ytDlpManager.js";
import { TranscriptionService } from "./transcriptionService.js";
import { SettingsStore } from "./settings/SettingsStore.js";
import { AppSettings } from "./types.js";
import { resolveBundledResource } from "./resourcePaths.js";

let appSettings: AppSettings;

const getSettings = () => appSettings;
const setSettings = (settings: AppSettings) => {
  appSettings = settings;
};

let windowController: WindowController | null = null;

app.whenReady().then(() => {
  if (process.platform === "darwin") {
    app.dock?.setIcon(resolveBundledResource("icon.png"));
  }

  const settingsStore = new SettingsStore();
  setSettings(settingsStore.get());

  const bus = new AppEventBus();
  const cacheManager = new SubtitleCacheManager(() => getSettings().cache);
  const ytDlpManager = new YtDlpManager();
  const transcriptionService = new TranscriptionService(() => ytDlpManager.getBinaryPath());
  const stateManager = new StateManager(bus, getSettings);
  const subtitleService = new SubtitleService(
    () => ytDlpManager.getBinaryPath(),
    () => stateManager.getActiveProfileSettings(),
    cacheManager
  );
  const connectionManager = new ConnectionManager({
    getNetworkSettings: () => getSettings().network,
    getSettings,
    subtitleService,
    stateManager,
    bus
  });
  windowController = new WindowController({
    bus,
    stateManager,
    connectionManager,
    settingsStore,
    cacheManager,
    transcriptionService,
    getSettings,
    setSettings
  });

  windowController.initialize();
  connectionManager.start();

  app.on("activate", () => {
    windowController?.showMainWindow();
  });
});

app.on("before-quit", () => {
  windowController?.handleBeforeQuit();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
