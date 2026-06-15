import { beforeEach, describe, expect, it, vi } from "vitest";
import { cloneFeatureSettings } from "../common/featureDefaults.js";
import { AppReleaseService } from "./appReleaseService.js";
import type { AppSettings } from "./types.js";

const checksum = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

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

function remoteManifest(version = "1.2.0") {
  return {
    schemaVersion: 1,
    version,
    releasedAt: "2026-06-10T12:00:00Z",
    releaseUrl: `https://github.com/XiiTang/Immersive-Subs-Prompter/releases/tag/v${version}`,
    minimumSupportedVersion: "1.0.0",
    notes: { en: "English notes", zh: "中文说明" },
    desktop: {
      "darwin-arm64": {
        fileName: `Immersive-Subs-Prompter-${version}-darwin-arm64.dmg`,
        url: `https://github.com/XiiTang/Immersive-Subs-Prompter/releases/download/v${version}/mac.dmg`,
        sha256: checksum,
        signed: false
      }
    },
    extension: {
      chrome: {
        version,
        artifactUrl: `https://github.com/XiiTang/Immersive-Subs-Prompter/releases/download/v${version}/chrome.zip`,
        sha256: checksum,
        storeStatus: "manual-review"
      },
      firefox: {
        version,
        artifactUrl: `https://github.com/XiiTang/Immersive-Subs-Prompter/releases/download/v${version}/firefox.zip`,
        sha256: checksum,
        storeStatus: "manual-review"
      }
    }
  };
}

describe("AppReleaseService", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-10T12:00:00Z"));
  });

  it("reports an available update", async () => {
    let currentSettings = settings();
    const service = new AppReleaseService({
      getCurrentVersion: () => "1.0.0",
      getSettings: () => currentSettings,
      updateSettings: (partial) => {
        currentSettings = {
          ...currentSettings,
          global: {
            ...currentSettings.global,
            ...partial.global
          }
        };
        return currentSettings;
      },
      fetchManifest: vi.fn().mockResolvedValue(remoteManifest("1.2.0")),
      openExternal: vi.fn(),
      platform: "darwin",
      arch: "arm64",
      now: () => Date.now()
    });

    const state = await service.checkForUpdates();

    expect(state.status).toBe("available");
    expect(state.latestVersion).toBe("1.2.0");
    expect(state.platformArtifact?.fileName).toContain("darwin-arm64");
    expect(currentSettings.global.lastUpdateCheckAt).toBe(Date.now());
  });

  it("reports unavailable when the manifest is not newer", async () => {
    const service = new AppReleaseService({
      getCurrentVersion: () => "1.2.0",
      getSettings: () => settings(),
      updateSettings: () => settings(),
      fetchManifest: vi.fn().mockResolvedValue(remoteManifest("1.2.0")),
      openExternal: vi.fn(),
      platform: "darwin",
      arch: "arm64",
      now: () => Date.now()
    });

    expect((await service.checkForUpdates()).status).toBe("unavailable");
  });

  it("rate-limits automatic checks", async () => {
    const fetchManifest = vi.fn().mockResolvedValue(remoteManifest("1.2.0"));
    const service = new AppReleaseService({
      getCurrentVersion: () => "1.0.0",
      getSettings: () => settings({ lastUpdateCheckAt: Date.now() - 60_000 }),
      updateSettings: () => settings(),
      fetchManifest,
      openExternal: vi.fn(),
      platform: "darwin",
      arch: "arm64",
      now: () => Date.now()
    });

    const state = await service.maybeCheckAutomatically();

    expect(state.status).toBe("idle");
    expect(fetchManifest).not.toHaveBeenCalled();
  });

  it("records failed automatic checks for rate limiting", async () => {
    let currentSettings = settings();
    const fetchManifest = vi.fn().mockRejectedValue(new Error("offline"));
    const service = new AppReleaseService({
      getCurrentVersion: () => "1.0.0",
      getSettings: () => currentSettings,
      updateSettings: (partial) => {
        currentSettings = {
          ...currentSettings,
          global: {
            ...currentSettings.global,
            ...partial.global
          }
        };
        return currentSettings;
      },
      fetchManifest,
      openExternal: vi.fn(),
      platform: "darwin",
      arch: "arm64",
      now: () => Date.now()
    });

    const state = await service.maybeCheckAutomatically();

    expect(state.status).toBe("error");
    expect(state.checkedAt).toBe(Date.now());
    expect(currentSettings.global.lastUpdateCheckAt).toBe(Date.now());
  });

  it("reports network errors without inventing a manifest state", async () => {
    const service = new AppReleaseService({
      getCurrentVersion: () => "1.0.0",
      getSettings: () => settings(),
      updateSettings: () => settings(),
      fetchManifest: vi.fn().mockRejectedValue(new Error("offline")),
      openExternal: vi.fn(),
      platform: "darwin",
      arch: "arm64",
      now: () => Date.now()
    });

    const state = await service.checkForUpdates();

    expect(state.status).toBe("error");
    expect(state.error?.code).toBe("network-error");
    expect(state.manifest).toBeNull();
  });

  it("opens the selected download URL", async () => {
    const openExternal = vi.fn().mockResolvedValue(undefined);
    const service = new AppReleaseService({
      getCurrentVersion: () => "1.0.0",
      getSettings: () => settings(),
      updateSettings: () => settings(),
      fetchManifest: vi.fn().mockResolvedValue(remoteManifest("1.2.0")),
      openExternal,
      platform: "darwin",
      arch: "arm64",
      now: () => Date.now()
    });

    await service.checkForUpdates();
    await service.openDownload();

    expect(openExternal).toHaveBeenCalledWith(
      "https://github.com/XiiTang/Immersive-Subs-Prompter/releases/download/v1.2.0/mac.dmg"
    );
  });
});
