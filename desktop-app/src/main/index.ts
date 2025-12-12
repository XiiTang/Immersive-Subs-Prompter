import { app } from "electron";
import { AppEventBus } from "./appEventBus.js";
import { StateManager } from "./stateManager.js";
import { ConnectionManager } from "./connectionManager.js";
import { MediaServerController } from "./mediaServerController.js";
import { WindowController } from "./windowController.js";
import { SubtitleCacheManager } from "./subtitleCacheManager.js";
import { SubtitleService } from "./subtitleService.js";
import { YtDlpManager } from "./ytDlpManager.js";
import { TranscriptionService } from "./transcriptionService.js";
import { SettingsStore, DEFAULT_SETTINGS } from "./settings.js";
import { AppSettings } from "./types.js";
import { FasterWhisperManager } from "./fasterWhisperManager.js";

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
  subtitleService,
  stateManager,
  bus,
  cacheManager
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
  connectionManager.start();
  mediaServerController.start();

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
