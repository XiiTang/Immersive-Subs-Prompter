import { BrowserWindow } from "electron";
import { ConnectionManager } from "../connectionManager.js";
import { FasterWhisperManager } from "../fasterWhisperManager.js";
import { StateManager } from "../stateManager.js";
import { SettingsStore } from "../settings/index.js";
import { SubtitleCacheManager } from "../subtitleCacheManager.js";
import { TranscriptionService } from "../transcriptionService.js";
import { AppSettings } from "../types.js";
import { DisplayManager } from "../window/displayManager.js";
import { createLogger } from "../logger.js";
import { registerStateHandlers } from "./handlers/stateHandlers.js";
import { registerSettingsHandlers } from "./handlers/settingsHandlers.js";
import { registerSubtitleHandlers } from "./handlers/subtitleHandlers.js";
import { registerTranscriptionHandlers } from "./handlers/transcriptionHandlers.js";
import { registerCacheHandlers } from "./handlers/cacheHandlers.js";
import { registerFasterWhisperHandlers } from "./handlers/fasterWhisperHandlers.js";
import { registerWindowHandlers } from "./handlers/windowHandlers.js";

export type IpcContext = {
  stateManager: StateManager;
  connectionManager: ConnectionManager;
  settingsStore: SettingsStore;
  cacheManager: SubtitleCacheManager;
  transcriptionService: TranscriptionService;
  fasterWhisperManager: FasterWhisperManager;
  getSettings: () => AppSettings;
  setSettings: (settings: AppSettings) => void;
  updateAppSettings: (partial: Partial<AppSettings>) => AppSettings;
  displayManager: DisplayManager;
  getMainWindow: () => BrowserWindow | null;
  openSettingsWindow: () => BrowserWindow | null;
  logger: ReturnType<typeof createLogger>;
};

export class IpcRouter {
  constructor(private readonly context: IpcContext) {}

  register() {
    registerStateHandlers(this.context);
    registerSettingsHandlers(this.context);
    registerSubtitleHandlers(this.context);
    registerTranscriptionHandlers(this.context);
    registerCacheHandlers(this.context);
    registerFasterWhisperHandlers(this.context);
    registerWindowHandlers(this.context);
  }
}
