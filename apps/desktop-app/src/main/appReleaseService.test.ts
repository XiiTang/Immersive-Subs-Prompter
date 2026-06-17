import { EventEmitter } from "node:events";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProgressInfo, UpdateInfo } from "builder-util-runtime";
import { cloneFeatureSettings } from "../common/featureDefaults.js";
import { AppReleaseService, type UpdaterLike } from "./appReleaseService.js";
import type { AppSettings } from "./types.js";

function settings(overrides: Partial<AppSettings["global"]> = {}): AppSettings {
  return {
    global: {
      autoLaunch: false,
      toggleWindowShortcut: "",
      gameProcessBlacklist: [],
      autoHidePanels: false,
      alwaysOnTop: "off",
      panelOpacity: 100,
      language: "en",
      appearance: { theme: "system" },
      autoCheckUpdates: true,
      lastUpdateCheckAt: null,
      ...overrides
    },
    network: { endpoints: [{ id: "default", host: "127.0.0.1", port: 44501 }], authToken: "token" },
    profiles: [],
    defaultProfileId: "",
    rules: [],
    features: cloneFeatureSettings(),
    cache: { enabled: true, path: "", retentionDays: 7 }
  };
}

class FakeUpdater extends EventEmitter implements UpdaterLike {
  autoDownload = false;
  autoInstallOnAppQuit = true;
  forceDevUpdateConfig = false;
  logger: unknown = null;
  checkForUpdates = vi.fn();
  downloadUpdate = vi.fn();
  quitAndInstall = vi.fn();
}

function updateInfo(version = "1.2.0"): UpdateInfo {
  return {
    version,
    files: [],
    path: "",
    sha512: "sha512",
    releaseDate: "2026-06-17T12:00:00Z",
    releaseName: `Version ${version}`,
    releaseNotes: "Release notes"
  } as UpdateInfo;
}

describe("AppReleaseService", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-17T12:00:00Z"));
  });

  it("configures electron-updater without implicit download or install-on-quit", () => {
    const updater = new FakeUpdater();
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    new AppReleaseService({
      updater,
      getCurrentVersion: () => "1.0.0",
      getSettings: () => settings({ autoCheckUpdates: true }),
      updateSettings: () => settings(),
      isPackaged: false,
      logger,
      now: () => Date.now()
    });

    expect(updater.autoDownload).toBe(false);
    expect(updater.autoInstallOnAppQuit).toBe(false);
    expect(updater.forceDevUpdateConfig).toBe(true);
    expect(updater.logger).toBe(logger);
  });

  it("keeps automatic checks separate from manual downloads", async () => {
    const updater = new FakeUpdater();
    updater.checkForUpdates.mockResolvedValue({ updateInfo: updateInfo() });
    const service = new AppReleaseService({
      updater,
      getCurrentVersion: () => "1.0.0",
      getSettings: () => settings({ autoCheckUpdates: true }),
      updateSettings: () => settings({ lastUpdateCheckAt: Date.now() }),
      now: () => Date.now()
    });

    const state = await service.maybeCheckAutomatically();

    expect(state.status).toBe("available");
    expect(updater.downloadUpdate).not.toHaveBeenCalled();
    expect(updater.autoDownload).toBe(false);
  });

  it("reports an available update", async () => {
    const updater = new FakeUpdater();
    updater.checkForUpdates.mockResolvedValue({ updateInfo: updateInfo() });
    let currentSettings = settings();
    const states: string[] = [];
    const service = new AppReleaseService({
      updater,
      getCurrentVersion: () => "1.0.0",
      getSettings: () => currentSettings,
      updateSettings: (partial) => {
        currentSettings = { ...currentSettings, global: { ...currentSettings.global, ...partial.global } };
        return currentSettings;
      },
      now: () => Date.now(),
      onStateChange: (state) => states.push(state.status)
    });

    const state = await service.checkForUpdates();

    expect(state.status).toBe("available");
    expect(state.latestVersion).toBe("1.2.0");
    expect(state.updateInfo?.releaseNotes).toBe("Release notes");
    expect(currentSettings.global.lastUpdateCheckAt).toBe(Date.now());
    expect(states).toEqual(["checking", "available"]);
  });

  it("reports unavailable when no update exists", async () => {
    const updater = new FakeUpdater();
    updater.checkForUpdates.mockResolvedValue(null);
    const service = new AppReleaseService({
      updater,
      getCurrentVersion: () => "1.0.0",
      getSettings: () => settings(),
      updateSettings: () => settings({ lastUpdateCheckAt: Date.now() }),
      now: () => Date.now()
    });

    const state = await service.checkForUpdates();

    expect(state.status).toBe("unavailable");
    expect(state.latestVersion).toBeNull();
  });

  it("rate-limits automatic checks", async () => {
    const updater = new FakeUpdater();
    const service = new AppReleaseService({
      updater,
      getCurrentVersion: () => "1.0.0",
      getSettings: () => settings({ lastUpdateCheckAt: Date.now() - 60_000 }),
      updateSettings: () => settings(),
      now: () => Date.now()
    });

    const state = await service.maybeCheckAutomatically();

    expect(state.status).toBe("idle");
    expect(updater.checkForUpdates).not.toHaveBeenCalled();
  });

  it("records check failures for rate limiting", async () => {
    const updater = new FakeUpdater();
    updater.checkForUpdates.mockRejectedValue(new Error("feed unavailable"));
    let currentSettings = settings();
    const service = new AppReleaseService({
      updater,
      getCurrentVersion: () => "1.0.0",
      getSettings: () => currentSettings,
      updateSettings: (partial) => {
        currentSettings = { ...currentSettings, global: { ...currentSettings.global, ...partial.global } };
        return currentSettings;
      },
      now: () => Date.now()
    });

    const state = await service.maybeCheckAutomatically();

    expect(state.status).toBe("error");
    expect(state.error?.code).toBe("check-failed");
    expect(currentSettings.global.lastUpdateCheckAt).toBe(Date.now());
  });

  it("downloads updates and reflects progress", async () => {
    const updater = new FakeUpdater();
    updater.checkForUpdates.mockResolvedValue({ updateInfo: updateInfo() });
    updater.downloadUpdate.mockImplementation(async () => {
      updater.emit("download-progress", {
        percent: 50,
        bytesPerSecond: 1024,
        transferred: 512,
        total: 1024
      } satisfies ProgressInfo);
      updater.emit("update-downloaded", updateInfo());
      return [];
    });
    const service = new AppReleaseService({
      updater,
      getCurrentVersion: () => "1.0.0",
      getSettings: () => settings(),
      updateSettings: () => settings({ lastUpdateCheckAt: Date.now() }),
      now: () => Date.now()
    });

    await service.checkForUpdates();
    const state = await service.downloadUpdate();

    expect(updater.downloadUpdate).toHaveBeenCalledTimes(1);
    expect(state.status).toBe("downloaded");
    expect(state.progress?.percent).toBe(50);
  });

  it("does not install until an update is downloaded", async () => {
    const updater = new FakeUpdater();
    const service = new AppReleaseService({
      updater,
      getCurrentVersion: () => "1.0.0",
      getSettings: () => settings(),
      updateSettings: () => settings(),
      now: () => Date.now()
    });

    const result = await service.installDownloadedUpdate();

    expect(result).toEqual({ ok: false, error: "No downloaded update is ready to install" });
    expect(updater.quitAndInstall).not.toHaveBeenCalled();
  });

  it("installs after downloaded state", async () => {
    const updater = new FakeUpdater();
    updater.checkForUpdates.mockResolvedValue({ updateInfo: updateInfo() });
    updater.downloadUpdate.mockImplementation(async () => {
      updater.emit("update-downloaded", updateInfo());
      return [];
    });
    const service = new AppReleaseService({
      updater,
      getCurrentVersion: () => "1.0.0",
      getSettings: () => settings(),
      updateSettings: () => settings({ lastUpdateCheckAt: Date.now() }),
      now: () => Date.now()
    });

    await service.checkForUpdates();
    await service.downloadUpdate();
    const result = await service.installDownloadedUpdate();

    expect(result).toEqual({ ok: true });
    expect(updater.quitAndInstall).toHaveBeenCalledWith(true, true);
    expect(service.getState().status).toBe("installing");
  });
});
