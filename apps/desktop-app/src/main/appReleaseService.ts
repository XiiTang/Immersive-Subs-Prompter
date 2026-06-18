import type { ProgressInfo, UpdateInfo } from "builder-util-runtime";
import type { UpdateCheckResult } from "electron-updater";
import type { AppSettings } from "./types.js";
import {
  createInitialReleaseState,
  normalizeProgress,
  normalizeUpdateInfo,
  type ReleaseErrorCode,
  type ReleaseState
} from "./releases/releaseState.js";

const UPDATE_AUTO_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

export interface UpdaterLike {
  autoDownload: boolean;
  autoInstallOnAppQuit: boolean;
  forceDevUpdateConfig?: boolean;
  logger?: unknown;
  checkForUpdates(): Promise<UpdateCheckResult | null>;
  downloadUpdate(): Promise<string[]>;
  quitAndInstall(isSilent?: boolean, isForceRunAfter?: boolean): void;
  on(event: "error", listener: (error: Error) => void): this;
  on(event: "update-available", listener: (info: UpdateInfo) => void): this;
  on(event: "update-not-available", listener: (info: UpdateInfo) => void): this;
  on(event: "download-progress", listener: (progress: ProgressInfo) => void): this;
  on(event: "update-downloaded", listener: (info: UpdateInfo) => void): this;
}

export type AppReleaseServiceOptions = {
  updater: UpdaterLike;
  getCurrentVersion: () => string;
  getSettings: () => AppSettings;
  updateSettings: (partial: Partial<AppSettings>) => AppSettings;
  now?: () => number;
  isPackaged?: boolean;
  logger?: unknown;
  onStateChange?: (state: ReleaseState) => void;
};

export class AppReleaseService {
  private readonly now: () => number;
  private state: ReleaseState;
  private hasDownloadedUpdate = false;

  constructor(private readonly options: AppReleaseServiceOptions) {
    this.now = options.now ?? Date.now;
    this.state = createInitialReleaseState(options.getCurrentVersion());
    this.options.updater.autoDownload = false;
    this.options.updater.autoInstallOnAppQuit = false;
    this.options.updater.logger = options.logger ?? this.options.updater.logger ?? null;
    if (this.options.updater.forceDevUpdateConfig !== undefined) {
      this.options.updater.forceDevUpdateConfig = !options.isPackaged;
    }
    this.registerUpdaterListeners();
  }

  getState(): ReleaseState {
    return this.state;
  }

  async maybeCheckAutomatically(): Promise<ReleaseState> {
    const settings = this.options.getSettings().global;
    if (!settings.autoCheckUpdates) {
      return this.state;
    }
    if (settings.lastUpdateCheckAt !== null && this.now() - settings.lastUpdateCheckAt < UPDATE_AUTO_CHECK_INTERVAL_MS) {
      return this.state;
    }
    return this.checkForUpdates();
  }

  async checkForUpdates(): Promise<ReleaseState> {
    this.hasDownloadedUpdate = false;
    const currentVersion = this.options.getCurrentVersion();
    this.setState({
      ...createInitialReleaseState(currentVersion),
      status: "checking",
      checkedAt: this.state.checkedAt
    });
    const updatedSettings = this.recordCheckAttempt();

    try {
      const result = await this.options.updater.checkForUpdates();
      if (!result?.isUpdateAvailable || !result.updateInfo) {
        this.setState({
          ...this.state,
          status: "unavailable",
          currentVersion,
          latestVersion: null,
          checkedAt: updatedSettings.global.lastUpdateCheckAt,
          updateInfo: null,
          progress: null,
          error: null
        });
        return this.state;
      }

      const updateInfo = normalizeUpdateInfo(result.updateInfo);
      this.setState({
        ...this.state,
        status: "available",
        currentVersion,
        latestVersion: updateInfo.version,
        checkedAt: updatedSettings.global.lastUpdateCheckAt,
        updateInfo,
        progress: null,
        error: null
      });
      return this.state;
    } catch (error) {
      return this.recordError("check-failed", error);
    }
  }

  async downloadUpdate(): Promise<ReleaseState> {
    if (this.hasDownloadedUpdate) {
      return this.state;
    }
    if (!this.state.updateInfo) {
      this.setState({
        ...this.state,
        status: "error",
        error: {
          code: "download-unavailable",
          message: "No update is available to download"
        }
      });
      return this.state;
    }

    this.setState({
      ...this.state,
      status: "downloading",
      progress: this.state.progress ?? {
        percent: 0,
        bytesPerSecond: 0,
        transferred: 0,
        total: 0
      },
      error: null
    });

    try {
      await this.options.updater.downloadUpdate();
      return this.state;
    } catch (error) {
      return this.recordError("download-failed", error);
    }
  }

  async installDownloadedUpdate(): Promise<{ ok: boolean; error?: string }> {
    if (!this.hasDownloadedUpdate) {
      const message = "No downloaded update is ready to install";
      this.setState({
        ...this.state,
        status: "error",
        error: {
          code: "install-unavailable",
          message
        }
      });
      return { ok: false, error: message };
    }

    try {
      this.setState({
        ...this.state,
        status: "installing",
        error: null
      });
      this.options.updater.quitAndInstall(true, true);
      return { ok: true };
    } catch (error) {
      const state = this.recordError("install-failed", error);
      return { ok: false, error: state.error?.message ?? "Install failed" };
    }
  }

  private recordCheckAttempt(): AppSettings {
    return this.options.updateSettings({
      global: {
        ...this.options.getSettings().global,
        lastUpdateCheckAt: this.now()
      }
    });
  }

  private registerUpdaterListeners(): void {
    this.options.updater.on("error", (error) => {
      this.recordError(this.errorCodeForCurrentState(), error);
    });
    this.options.updater.on("update-available", (info) => {
      const updateInfo = normalizeUpdateInfo(info);
      this.setState({
        ...this.state,
        status: "available",
        latestVersion: updateInfo.version,
        updateInfo,
        error: null
      });
    });
    this.options.updater.on("update-not-available", () => {
      this.setState({
        ...this.state,
        status: "unavailable",
        latestVersion: null,
        updateInfo: null,
        progress: null,
        error: null
      });
    });
    this.options.updater.on("download-progress", (progress) => {
      this.setState({
        ...this.state,
        status: "downloading",
        progress: normalizeProgress(progress),
        error: null
      });
    });
    this.options.updater.on("update-downloaded", (info) => {
      this.hasDownloadedUpdate = true;
      const updateInfo = normalizeUpdateInfo(info);
      this.setState({
        ...this.state,
        status: "downloaded",
        latestVersion: updateInfo.version,
        updateInfo,
        progress: this.state.progress,
        error: null
      });
    });
  }

  private errorCodeForCurrentState(): ReleaseErrorCode {
    if (this.state.status === "downloading") {
      return "download-failed";
    }
    if (this.state.status === "installing") {
      return "install-failed";
    }
    return "check-failed";
  }

  private recordError(code: ReleaseErrorCode, error: unknown): ReleaseState {
    const message = error instanceof Error ? error.message : String(error);
    this.setState({
      ...this.state,
      status: "error",
      error: {
        code,
        message
      }
    });
    return this.state;
  }

  private setState(state: ReleaseState): void {
    this.state = state;
    this.options.onStateChange?.(this.state);
  }
}
