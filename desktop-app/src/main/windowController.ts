import {
  app,
  BrowserWindow,
  globalShortcut,
  ipcMain,
  Menu,
  nativeImage,
  screen,
  shell,
  Tray
} from "electron";
import activeWindow from "active-win";
import { createHash } from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { AppEventBus } from "./appEventBus.js";
import { StateManager } from "./stateManager.js";
import { ConnectionManager } from "./connectionManager.js";
import { SettingsStore, DEFAULT_SETTINGS } from "./settings.js";
import { SubtitleCacheManager } from "./subtitleCacheManager.js";
import { createLogger } from "./logger.js";
import { AppSettings, DesktopState, PlaybackState, SubtitleTrack, TranscriptionConfig, VideoControlCommand } from "./types.js";
import { JellyfinController } from "./jellyfinController.js";
import { TranscriptionService } from "./transcriptionService.js";
import { FasterWhisperManager } from "./fasterWhisperManager.js";



const GAME_PROCESS_POLL_INTERVAL_MS = 10000;

type WindowControllerOptions = {
  bus: AppEventBus;
  stateManager: StateManager;
  connectionManager: ConnectionManager;
  settingsStore: SettingsStore;
  cacheManager: SubtitleCacheManager;
  jellyfinController: JellyfinController;
  transcriptionService: TranscriptionService;
  fasterWhisperManager: FasterWhisperManager;
  getSettings: () => AppSettings;
  setSettings: (settings: AppSettings) => void;
};

export class WindowController {
  private mainWindow: BrowserWindow | null = null;
  private tray: Tray | null = null;
  private isQuitting = false;
  private gameProcessMonitor: NodeJS.Timeout | null = null;
  private isGlobalShortcutBlockedByGame = false;
  private isGlobalShortcutRegistered = false;
  private lastRegisteredShortcut: string | null = null;
  private hasLoggedMissingShortcut = false;
  private isDisplayFullscreen = false;
  private displayFullscreenPreviousBounds: Electron.Rectangle | null = null;
  private readonly __dirname = path.dirname(fileURLToPath(import.meta.url));
  private readonly log = createLogger("desktop");

  constructor(private readonly options: WindowControllerOptions) { }

  initialize() {
    const previousSettings = this.options.getSettings();
    const loadedSettings = this.options.settingsStore.get() ?? DEFAULT_SETTINGS;
    this.options.setSettings(loadedSettings);
    this.options.stateManager.handleSettingsUpdated(previousSettings, loadedSettings);
    const defaultSelection = this.options.stateManager.selectProfileForUrl(null);
    this.options.stateManager.applyProfileSelection(defaultSelection.profile, defaultSelection.rule);

    this.applyAutoLaunch(loadedSettings.global.autoLaunch);
    this.registerGlobalShortcut();
    this.ensureTray();
    this.startGameProcessMonitor();
    this.setupBusListeners();
    this.setupIpcHandlers();
    this.createWindow();
  }

  handleBeforeQuit() {
    this.isQuitting = true;
    this.stopGameProcessMonitor();
    globalShortcut.unregisterAll();
    this.options.cacheManager.stop();
    this.options.connectionManager.stop();
    if (this.tray) {
      this.tray.destroy();
      this.tray = null;
    }
  }

  showMainWindow() {
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

  toggleMainWindow() {
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

  toggleDisplayFullscreenOnCurrentDisplay(): boolean {
    if (!this.mainWindow) {
      return false;
    }

    if (this.isDisplayFullscreen) {
      if (this.displayFullscreenPreviousBounds) {
        this.mainWindow.setBounds(this.displayFullscreenPreviousBounds);
      }
      this.displayFullscreenPreviousBounds = null;
      this.isDisplayFullscreen = false;
      this.options.stateManager.setFullscreen(false);
      return false;
    }

    const previousBounds = this.mainWindow.getBounds();
    const targetDisplay = screen.getDisplayMatching(previousBounds);
    this.displayFullscreenPreviousBounds = previousBounds;
    this.mainWindow.setBounds(targetDisplay.bounds);
    this.isDisplayFullscreen = true;
    this.options.stateManager.setFullscreen(true);
    return true;
  }

  private setupBusListeners() {
    this.options.bus.on("state:changed", (state) => {
      this.pushState(state);
    });
    this.options.bus.on("state:playback", (playback) => {
      this.sendPlaybackUpdate(playback);
    });
    this.options.bus.on("playback:loop-cleared", () => {
      if (this.mainWindow) {
        this.mainWindow.webContents.send("usp:loop-cleared");
      }
    });
  }

  private setupIpcHandlers() {
    ipcMain.handle("usp:get-state", () => {
      return this.options.stateManager.getState();
    });

    ipcMain.handle("usp:select-track", (_event, payload) => {
      this.options.connectionManager.setSubtitleTrack(payload);
    });

    ipcMain.handle("usp:control", (_event, command: VideoControlCommand) => {
      this.log.debug("IPC usp:control invoked", { type: command?.type });
      const ok = this.options.connectionManager.sendControlCommand(command);
      this.log.debug("IPC usp:control completed", { ok });
      return ok;
    });

    ipcMain.handle("usp:get-settings", () => this.options.getSettings());
    ipcMain.handle("usp:update-settings", (_event, payload: Partial<AppSettings>) => {
      return this.updateAppSettings(payload);
    });
    ipcMain.handle("usp:faster-whisper-paths", async () => {
      return this.options.fasterWhisperManager.getPaths();
    });
    ipcMain.handle("usp:faster-whisper-download-binary", async (_event, variant: "cpu" | "gpu") => {
      try {
        const path = await this.options.fasterWhisperManager.downloadBinary(variant);
        return { ok: true, path };
      } catch (error) {
        const message =
          error && typeof error === "object" && "message" in error ? (error as Error).message : String(error);
        this.log.error("Faster-Whisper binary download failed", error);
        return { ok: false, error: message };
      }
    });
    ipcMain.handle("usp:faster-whisper-download-model", async (_event, model: string) => {
      try {
        const result = await this.options.fasterWhisperManager.downloadModel(model);
        return { ok: true, ...result };
      } catch (error) {
        const message =
          error && typeof error === "object" && "message" in error ? (error as Error).message : String(error);
        this.log.error("Faster-Whisper model download failed", error);
        return { ok: false, error: message };
      }
    });
    ipcMain.handle("usp:open-path", async (_event, targetPath: string) => {
      try {
        if (!targetPath) {
          throw new Error("Path is empty");
        }
        await fs.promises.mkdir(targetPath, { recursive: true });
        await shell.openPath(targetPath);
        return { ok: true };
      } catch (error) {
        const message =
          error && typeof error === "object" && "message" in error ? (error as Error).message : String(error);
        this.log.error("Failed to open path", error);
        return { ok: false, error: message };
      }
    });
    ipcMain.handle("usp:start-transcription", async () => {
      const config = this.resolveActiveTranscriptionConfig();
      if (!config) {
        const message = "No transcription configuration available.";
        this.options.stateManager.setTranscriptionStatus("error", message, null);
        return { ok: false, error: message };
      }

      const state = this.options.stateManager.getState();
      if (state.activeSource === "jellyfin") {
        const message = "当前为 Jellyfin 模式，语音转录暂不支持。";
        this.options.stateManager.setTranscriptionStatus("error", message, config.name);
        return { ok: false, error: message };
      }

      if (!state.videoUrl) {
        const message = "No active video to transcribe.";
        this.options.stateManager.setTranscriptionStatus("error", message, config.name);
        return { ok: false, error: message };
      }

      const targetVideoUrl = state.videoUrl;
      this.options.stateManager.setTranscriptionStatus("running", null, config.name);
      const cacheKey = this.buildTranscriptionCacheKey(targetVideoUrl, config);

      const applyTrackToState = (track: SubtitleTrack, message: string) => {
        this.options.stateManager.addOrReplaceSubtitleTrack(track, true);
        this.options.stateManager.updateState((draft) => {
          draft.status = "ready";
          draft.error = null;
        });
        this.options.stateManager.setTranscriptionStatus("success", message, config.name);
      };

      // Fast-path: reuse cached transcription for the current video
      const cached = await this.options.cacheManager.get(cacheKey, "transcription");
      if (cached?.tracks?.length) {
        const cachedTrack = cached.tracks[0];
        const latestState = this.options.stateManager.getState();
        if (latestState.videoUrl === targetVideoUrl) {
          applyTrackToState(
            cachedTrack,
            `Transcription completed (${cachedTrack.cues.length} lines).`
          );
          return { ok: true, trackId: cachedTrack.id, cached: true };
        }
        await this.options.cacheManager.set(cacheKey, "transcription", { tracks: [cachedTrack] });
        this.log.info(
          "Cached transcription available for previous video, storing silently",
          { videoUrl: targetVideoUrl }
        );
        this.options.stateManager.setTranscriptionStatus(
          "success",
          `Transcription cached for previous video.`,
          config.name
        );
        return { ok: true, trackId: cachedTrack.id, cached: true };
      }

      try {
        const track = await this.options.transcriptionService.transcribe(targetVideoUrl, config);
        await this.options.cacheManager.set(cacheKey, "transcription", { tracks: [track] });

        const latestState = this.options.stateManager.getState();
        if (latestState.videoUrl !== targetVideoUrl) {
          this.log.info("Transcription finished for a previous video, cached silently", {
            targetVideoUrl,
            currentVideoUrl: latestState.videoUrl
          });
          this.options.stateManager.setTranscriptionStatus(
            "success",
            "Transcription cached for previous video.",
            config.name
          );
          return { ok: true, trackId: track.id, cached: true };
        }

        applyTrackToState(track, `Transcription completed (${track.cues.length} lines).`);
        return { ok: true, trackId: track.id };
      } catch (error) {
        const message =
          error && typeof error === "object" && "message" in error ? (error as Error).message : String(error);
        this.options.stateManager.setTranscriptionStatus("error", message, config.name);
        return { ok: false, error: message };
      }
    });
    ipcMain.handle("usp:toggle-display-fullscreen", () => {
      return this.toggleDisplayFullscreenOnCurrentDisplay();
    });

    ipcMain.handle("usp:cache-stats", async () => {
      try {
        return await this.options.cacheManager.getStats();
      } catch (error) {
        this.log.error("Failed to get cache stats", error);
        throw error;
      }
    });

    ipcMain.handle("usp:cache-clear", async () => {
      try {
        await this.options.cacheManager.clear();
        return { success: true };
      } catch (error) {
        this.log.error("Failed to clear cache", error);
        throw error;
      }
    });

    ipcMain.handle("usp:cache-cleanup", async () => {
      try {
        const removedCount = await this.options.cacheManager.cleanup();
        return { success: true, removedCount };
      } catch (error) {
        this.log.error("Failed to cleanup cache", error);
        throw error;
      }
    });

    ipcMain.handle("usp:cache-open-folder", async () => {
      try {
        const cachePath = this.options.cacheManager.getCachePath();
        await fs.promises.mkdir(cachePath, { recursive: true });
        await shell.openPath(cachePath);
      } catch (error) {
        this.log.error("Failed to open cache folder", error);
        throw error;
      }
    });
  }

  private resolveActiveTranscriptionConfig(): TranscriptionConfig | null {
    const transcription = this.options.getSettings().transcription;
    if (!transcription || !Array.isArray(transcription.configs) || !transcription.configs.length) {
      return null;
    }
    const active =
      transcription.configs.find((config) => config.id === transcription.activeConfigId) ??
      transcription.configs[0];
    return active;
  }

  private buildTranscriptionCacheKey(videoUrl: string, config: TranscriptionConfig): string {
    const provider = config.provider === "faster-whisper" ? "faster-whisper" : "whisper-api";
    const signaturePayload = {
      id: config.id,
      provider,
      model: provider === "faster-whisper" ? config.fasterWhisperModel : config.model,
      language: config.language,
      prompt: config.prompt,
      enableWordTimestamps: config.enableWordTimestamps,
      ytDlpArgs: config.ytDlpArgs,
      baseUrl: provider === "whisper-api" ? config.baseUrl : "",
      extraParams: provider === "whisper-api" ? config.extraParams : undefined,
      fasterWhisper:
        provider === "faster-whisper"
          ? {
              device: config.fasterWhisperDevice,
              modelDir: config.fasterWhisperModelDir,
              vadFilter: config.fasterWhisperVadFilter,
              vadThreshold: config.fasterWhisperVadThreshold,
              vadMethod: config.fasterWhisperVadMethod,
              useKim2: config.fasterWhisperUseKim2
            }
          : undefined
    };
    const signature = createHash("sha256").update(JSON.stringify(signaturePayload)).digest("hex").slice(0, 12);
    return `${videoUrl}#${signature}`;
  }

  private ensureTray() {
    if (this.tray) {
      return;
    }
    const iconPath = this.getIconPath();
    const icon = nativeImage.createFromPath(iconPath);
    this.tray = new Tray(icon);
    this.tray.setToolTip("Immersive Subs Prompter");
    this.tray.setContextMenu(
      Menu.buildFromTemplate([
        {
          label: "Show Window",
          click: () => this.showMainWindow()
        },
        { type: "separator" },
        {
          label: "Quit",
          click: () => {
            this.isQuitting = true;
            this.tray?.destroy();
            this.tray = null;
            app.quit();
          }
        }
      ])
    );
    this.tray.on("click", () => {
      this.showMainWindow();
    });
  }

  private createWindow() {
    const settings = this.options.getSettings();
    this.mainWindow = new BrowserWindow({
      width: 460,
      height: 640,
      frame: false,
      transparent: true,
      backgroundColor: "#00000000",
      resizable: true,
      fullscreenable: false,
      titleBarStyle: "hidden",
      webPreferences: {
        preload: path.join(this.__dirname, "../preload.js"),
        contextIsolation: true,
        nodeIntegration: false
      },
      icon: this.getIconPath()
    });

    const initialLevel = settings.global.alwaysOnTop;
    if (initialLevel === "off") {
      this.mainWindow.setAlwaysOnTop(false);
    } else {
      this.mainWindow.setAlwaysOnTop(true, initialLevel);
    }
    this.mainWindow.loadFile(path.join(this.__dirname, "../renderer/index.html"));

    this.mainWindow.on("close", (event) => {
      if (!this.isQuitting && settings.global.closeBehavior === "tray") {
        event.preventDefault();
        this.mainWindow?.hide();
        this.mainWindow?.setSkipTaskbar(true);
      }
    });

    this.mainWindow.on("show", () => {
      this.mainWindow?.setSkipTaskbar(false);
    });

    this.mainWindow.on("hide", () => {
      if (this.options.getSettings().global.closeBehavior === "tray") {
        this.mainWindow?.setSkipTaskbar(true);
      }
    });

    if (process.env.NODE_ENV === "development") {
      this.mainWindow.webContents.openDevTools();
    }

    this.mainWindow.webContents.once("did-finish-load", () => {
      this.pushSettings();
      this.pushState(this.options.stateManager.getState());
    });

    this.mainWindow.on("closed", () => {
      this.mainWindow = null;
      this.displayFullscreenPreviousBounds = null;
      this.isDisplayFullscreen = false;
    });
  }

  private pushState(state: DesktopState) {
    if (!this.mainWindow) return;
    this.mainWindow.webContents.send("usp:state", state);
  }

  private sendPlaybackUpdate(playback: PlaybackState) {
    if (!this.mainWindow) return;
    this.mainWindow.webContents.send("usp:time", playback);
  }

  private pushSettings() {
    if (!this.mainWindow) return;
    this.mainWindow.webContents.send("usp:settings", this.options.getSettings());
  }

  private getAutostartDesktopEntryPath() {
    const configDir = path.join(app.getPath("home"), ".config", "autostart");
    return path.join(configDir, "immersive-subs-prompter.desktop");
  }

  private applyAutoLaunch(enabled: boolean) {
    if (process.platform === "win32" || process.platform === "darwin") {
      try {
        app.setLoginItemSettings({
          openAtLogin: enabled,
          path: process.execPath
        });
      } catch (error) {
        this.log.error("Failed to update login item settings", error);
      }
      return;
    }

    if (process.platform === "linux") {
      const desktopFile = this.getAutostartDesktopEntryPath();
      try {
        if (enabled) {
          fs.mkdirSync(path.dirname(desktopFile), { recursive: true });
          const execPath = process.execPath;
          const entry = [
            "[Desktop Entry]",
            "Type=Application",
            "Version=1.0",
            "Name=Immersive Subs Prompter",
            `Exec=\"${execPath}\"`,
            "Terminal=false",
            "X-GNOME-Autostart-enabled=true"
          ].join("\n");
          fs.writeFileSync(desktopFile, `${entry}\n`, "utf-8");
        } else if (fs.existsSync(desktopFile)) {
          fs.rmSync(desktopFile);
        }
      } catch (error) {
        this.log.error("Failed to update autostart entry", error);
      }
    }
  }

  private registerGlobalShortcut() {
    if (this.isGlobalShortcutBlockedByGame) {
      return;
    }

    const shortcut = (this.options.getSettings().global.toggleWindowShortcut ?? "").trim();

    if (!shortcut) {
      if (!this.hasLoggedMissingShortcut) {
        this.log.warn("No global shortcut configured");
        this.hasLoggedMissingShortcut = true;
      }
      this.clearGlobalShortcutRegistration();
      return;
    }

    this.hasLoggedMissingShortcut = false;

    if (this.isGlobalShortcutRegistered && this.lastRegisteredShortcut === shortcut) {
      return;
    }

    this.clearGlobalShortcutRegistration();

    try {
      const success = globalShortcut.register(shortcut, () => {
        this.log.info(`Global shortcut triggered: ${shortcut}`);
        this.toggleMainWindow();
      });

      if (success) {
        this.isGlobalShortcutRegistered = true;
        this.lastRegisteredShortcut = shortcut;
        this.log.info(`Global shortcut registered: ${shortcut}`);
      } else {
        this.log.error(`Failed to register shortcut: ${shortcut} (may be in use)`);
      }
    } catch (error) {
      this.log.error(`Exception registering shortcut: ${shortcut}`, error);
    }
  }

  private clearGlobalShortcutRegistration() {
    globalShortcut.unregisterAll();
    this.isGlobalShortcutRegistered = false;
    this.lastRegisteredShortcut = null;
  }

  private async evaluateGameProcessFocusState() {
    const blacklist = this.getNormalizedGameProcessBlacklist();

    if (!blacklist.size) {
      if (this.isGlobalShortcutBlockedByGame) {
        this.isGlobalShortcutBlockedByGame = false;
      }
      this.registerGlobalShortcut();
      return;
    }

    try {
      const active = await activeWindow();

      const appName = active?.owner?.name?.trim() || "";
      const processPath = active?.owner?.path || "";
      const processFileName = processPath ? path.basename(processPath) : "";

      const normalizedAppName = appName.toLowerCase();
      const normalizedProcessFileName = processFileName.toLowerCase();

      let matchedValue = "";
      if (normalizedAppName && blacklist.has(normalizedAppName)) {
        matchedValue = appName;
      } else if (normalizedProcessFileName && blacklist.has(normalizedProcessFileName)) {
        matchedValue = processFileName;
      }

      if (matchedValue) {
        if (!this.isGlobalShortcutBlockedByGame) {
          this.log.info(`[GameBlacklist] Matched "${matchedValue}" - disabling shortcuts`);
        }
        this.isGlobalShortcutBlockedByGame = true;
        this.clearGlobalShortcutRegistration();
        return;
      }

      if (this.isGlobalShortcutBlockedByGame) {
        this.isGlobalShortcutBlockedByGame = false;
        this.log.info(`[GameBlacklist] Switched to "${processFileName || appName}" - enabling shortcuts`);
      }

      this.registerGlobalShortcut();
    } catch (error) {
      this.log.warn("[GameBlacklist] Failed to check active window:", error);
      if (this.isGlobalShortcutBlockedByGame) {
        this.isGlobalShortcutBlockedByGame = false;
      }
      this.registerGlobalShortcut();
    }
  }

  private startGameProcessMonitor() {
    if (this.gameProcessMonitor) {
      return;
    }
    void this.evaluateGameProcessFocusState();
    this.gameProcessMonitor = setInterval(() => {
      void this.evaluateGameProcessFocusState();
    }, GAME_PROCESS_POLL_INTERVAL_MS);
  }

  private stopGameProcessMonitor() {
    if (!this.gameProcessMonitor) {
      return;
    }
    clearInterval(this.gameProcessMonitor);
    this.gameProcessMonitor = null;
  }

  private getNormalizedGameProcessBlacklist(): Set<string> {
    const list = this.options.getSettings().global.gameProcessBlacklist ?? [];
    const normalized = new Set<string>();
    for (const entry of list) {
      if (typeof entry !== "string") {
        continue;
      }
      const trimmed = entry.trim().toLowerCase();
      if (trimmed.length) {
        normalized.add(trimmed);
      }
    }
    return normalized;
  }

  private updateAppSettings(partial: Partial<AppSettings>) {
    const previous = this.options.getSettings();
    const previousGlobal = previous.global;
    const appSettings = this.options.settingsStore.update(partial);
    this.options.setSettings(appSettings);
    this.options.stateManager.handleSettingsUpdated(previous, appSettings);
    this.options.jellyfinController.handleSettingsUpdated();

    if (previousGlobal.autoLaunch !== appSettings.global.autoLaunch) {
      this.applyAutoLaunch(appSettings.global.autoLaunch);
    }

    if (previousGlobal.toggleWindowShortcut !== appSettings.global.toggleWindowShortcut) {
      this.registerGlobalShortcut();
    }

    if (previousGlobal.closeBehavior !== appSettings.global.closeBehavior && this.mainWindow) {
      if (appSettings.global.closeBehavior === "quit") {
        this.mainWindow.setSkipTaskbar(false);
      } else if (!this.mainWindow.isVisible()) {
        this.mainWindow.setSkipTaskbar(true);
      }
    }

    if (previousGlobal.alwaysOnTop !== appSettings.global.alwaysOnTop && this.mainWindow) {
      const level = appSettings.global.alwaysOnTop;
      if (level === "off") {
        this.mainWindow.setAlwaysOnTop(false);
      } else {
        this.mainWindow.setAlwaysOnTop(true, level);
      }
    }

    this.options.bus.emit("state:changed", this.options.stateManager.getState());
    this.pushSettings();
    void this.evaluateGameProcessFocusState();
    return appSettings;
  }

  private getIconPath(): string {
    if (app.isPackaged) {
      return path.join(process.resourcesPath, "icon.png");
    }
    return path.join(app.getAppPath(), "resources", "icon.png");
  }
}
