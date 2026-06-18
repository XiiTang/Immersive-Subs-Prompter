import { describe, expect, it, vi } from "vitest";
import { createDefaultAppSettings } from "../common/defaultSettings.js";
import type { AppSettings } from "./types.js";

const electronUpdaterMock = vi.hoisted(() => ({
  autoUpdater: {
    autoDownload: true,
    autoInstallOnAppQuit: true,
    forceDevUpdateConfig: false,
    logger: null as unknown,
    checkForUpdates: vi.fn(),
    downloadUpdate: vi.fn(),
    quitAndInstall: vi.fn(),
    on: vi.fn(function (this: unknown) {
      return this;
    })
  }
}));

vi.mock("electron-updater", () => ({
  default: electronUpdaterMock
}));

function settings(): AppSettings {
  const base = createDefaultAppSettings({
    networkAuthToken: "token"
  });

  return {
    ...base,
    global: {
      ...base.global,
      autoLaunch: false,
      toggleWindowShortcut: "",
      gameProcessBlacklist: [],
      autoHidePanels: false,
      alwaysOnTop: "off",
      panelOpacity: 100,
      language: "en",
      appearance: { theme: "system" },
      autoCheckUpdates: true,
      lastUpdateCheckAt: null
    },
    network: { endpoints: [{ id: "default", host: "127.0.0.1", port: 44501 }], authToken: "token" },
    rules: [],
    cache: { enabled: true, path: "", retentionDays: 7 }
  };
}

describe("createAppReleaseService", () => {
  it("creates the release service from the Electron updater runtime boundary", async () => {
    const { createAppReleaseService } = await import("./appReleaseRuntime.js");
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const service = createAppReleaseService({
      getCurrentVersion: () => "1.0.0",
      getSettings: settings,
      updateSettings: settings,
      isPackaged: false,
      logger
    });

    expect(service.getState().currentVersion).toBe("1.0.0");
    expect(electronUpdaterMock.autoUpdater.autoDownload).toBe(false);
    expect(electronUpdaterMock.autoUpdater.autoInstallOnAppQuit).toBe(false);
    expect(electronUpdaterMock.autoUpdater.forceDevUpdateConfig).toBe(true);
    expect(electronUpdaterMock.autoUpdater.logger).toBe(logger);
  });
});
