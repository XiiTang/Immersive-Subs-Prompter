import { BrowserWindow } from "electron";
import { ConnectionManager } from "../connectionManager.js";
import { StateManager } from "../stateManager.js";
import { SettingsStore } from "../settings/SettingsStore.js";
import { SubtitleCacheManager } from "../subtitleCacheManager.js";
import { AppSettings } from "../types.js";
import { DisplayManager } from "../window/displayManager.js";
import { createLogger } from "../logger.js";
import { WordLookupWindowManager } from "../window/wordLookupWindowManager.js";
import { AppReleaseService } from "../appReleaseService.js";
import type { WordLookupService } from "../features/wordLookupService.js";
import type { TranscriptionFeatureServiceOptions } from "../features/transcriptionFeatureService.js";
import type { FasterWhisperManager } from "../fasterWhisperManager.js";
import { registerStateHandlers } from "./handlers/stateHandlers.js";
import { registerSettingsHandlers } from "./handlers/settingsHandlers.js";
import { registerSubtitleHandlers } from "./handlers/subtitleHandlers.js";
import { registerTranscriptionHandlers } from "./handlers/transcriptionHandlers.js";
import { registerCacheHandlers } from "./handlers/cacheHandlers.js";
import { registerWindowHandlers } from "./handlers/windowHandlers.js";
import { registerReleaseHandlers } from "./handlers/releaseHandlers.js";
import { registerFasterWhisperHandlers } from "./handlers/fasterWhisperHandlers.js";

export type IpcContext = {
  stateManager: StateManager;
  connectionManager: ConnectionManager;
  settingsStore: SettingsStore;
  cacheManager: SubtitleCacheManager;
  releaseService: AppReleaseService;
  wordLookupService: WordLookupService;
  fasterWhisperManager: FasterWhisperManager;
  transcriptionFeature: TranscriptionFeatureServiceOptions;
  getSettings: () => AppSettings;
  setSettings: (settings: AppSettings) => void;
  updateAppSettings: (partial: Partial<AppSettings>) => AppSettings;
  displayManager: DisplayManager;
  wordLookupWindowManager: WordLookupWindowManager;
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
    registerWindowHandlers(this.context);
    registerReleaseHandlers(this.context);
    registerFasterWhisperHandlers(this.context);
  }
}
