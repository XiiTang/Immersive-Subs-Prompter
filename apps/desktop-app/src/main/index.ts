import { app } from "electron";
import { AppEventBus } from "./appEventBus.js";
import { StateManager } from "./stateManager.js";
import { ConnectionManager } from "./connectionManager.js";
import { MediaServerController } from "./mediaServerController.js";
import { WindowController } from "./window/windowController.js";
import { SubtitleCacheManager } from "./subtitleCacheManager.js";
import { SubtitleService } from "./subtitleService.js";
import { YtDlpManager } from "./ytDlpManager.js";
import { TranscriptionService } from "./transcriptionService.js";
import { SettingsStore, DEFAULT_SETTINGS } from "./settings/index.js";
import { AppSettings } from "./types.js";
import { FasterWhisperManager } from "./fasterWhisperManager.js";
import { resolveBundledResource } from "./resourcePaths.js";

let appSettings: AppSettings = DEFAULT_SETTINGS;

const getSettings = () => appSettings;
const setSettings = (settings: AppSettings) => {
  appSettings = settings;
};

const bus = new AppEventBus();
const cacheManager = new SubtitleCacheManager(() => getSettings().cache);
const ytDlpManager = new YtDlpManager();
const transcriptionService = new TranscriptionService(() => ytDlpManager.getBinaryPath());
const fasterWhisperManager = new FasterWhisperManager();

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
const mediaServerController = new MediaServerController({
  bus,
  stateManager,
  getSettings,
  cacheManager
});

let windowController: WindowController | null = null;
let settingsStore: SettingsStore | null = null;

app.whenReady().then(() => {
  if (process.platform === "darwin") {
    app.dock?.setIcon(resolveBundledResource("icon.png"));
  }

  settingsStore = new SettingsStore();
  windowController = new WindowController({
    bus,
    stateManager,
    connectionManager,
    settingsStore,
    cacheManager,
    mediaServerController,
    transcriptionService,
    fasterWhisperManager,
    getSettings,
    setSettings
  });

  windowController.initialize();
  mediaServerController.start();
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
