import { createPinia, setActivePinia } from "pinia";
import { mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppSettings } from "../../../main/types";
import type { ReleaseState } from "../../../main/releases/releaseManifest";
import { useDesktopStore } from "../../stores/desktop";
import SettingsReleaseUpdate from "./SettingsReleaseUpdate.vue";

const checksum = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

function settings(): AppSettings {
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
      lastUpdateCheckAt: null
    },
    network: { endpoints: [{ id: "default", host: "127.0.0.1", port: 44501 }], authToken: "token" },
    profiles: [],
    defaultProfileId: "",
    rules: [],
    plugins: {},
    cache: { enabled: true, path: "", retentionDays: 7 }
  };
}

function idleState(): ReleaseState {
  return {
    status: "idle",
    currentVersion: "1.0.0",
    latestVersion: null,
    checkedAt: null,
    manifest: null,
    platformKey: "darwin-arm64",
    platformArtifact: null,
    error: null
  };
}

function availableState(): ReleaseState {
  return {
    status: "available",
    currentVersion: "1.0.0",
    latestVersion: "1.2.0",
    checkedAt: Date.UTC(2026, 5, 10),
    platformKey: "darwin-arm64",
    platformArtifact: {
      fileName: "Immersive-Subs-Prompter-1.2.0-darwin-arm64.dmg",
      url: "https://github.com/XiiTang/Immersive-Subs-Prompter/releases/download/v1.2.0/mac.dmg",
      sha256: checksum,
      signed: false
    },
    manifest: {
      schemaVersion: 1,
      version: "1.2.0",
      releasedAt: "2026-06-10T12:00:00Z",
      releaseUrl: "https://github.com/XiiTang/Immersive-Subs-Prompter/releases/tag/v1.2.0",
      minimumSupportedVersion: "1.0.0",
      notes: { en: "English notes", zh: "中文说明" },
      desktop: {},
      extension: {
        chrome: {
          version: "1.2.0",
          artifactUrl: "https://github.com/XiiTang/Immersive-Subs-Prompter/releases/download/v1.2.0/chrome.zip",
          sha256: checksum,
          storeStatus: "manual-review"
        },
        firefox: {
          version: "1.2.0",
          artifactUrl: "https://github.com/XiiTang/Immersive-Subs-Prompter/releases/download/v1.2.0/firefox.zip",
          sha256: checksum,
          storeStatus: "manual-review"
        }
      }
    },
    error: null
  };
}

describe("SettingsReleaseUpdate", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("shows current version and manual check action", () => {
    const store = useDesktopStore();
    store.settings = settings();
    store.releaseState = idleState();
    vi.spyOn(store, "checkForUpdates").mockResolvedValue();

    const wrapper = mount(SettingsReleaseUpdate);

    expect(wrapper.text()).toContain("Updates");
    expect(wrapper.text()).toContain("Current version");
    expect(wrapper.text()).toContain("1.0.0");
    expect(wrapper.find('[data-testid="release-check"]').exists()).toBe(true);
    expect(wrapper.findAll('[data-slot="setting-row"]').length).toBeGreaterThanOrEqual(2);
  });

  it("shows available release notes and opens the download page", async () => {
    const store = useDesktopStore();
    store.settings = settings();
    store.releaseState = availableState();
    const openSpy = vi.spyOn(store, "openReleaseDownload").mockResolvedValue();

    const wrapper = mount(SettingsReleaseUpdate);
    await wrapper.get('[data-testid="release-open-download"]').trigger("click");

    expect(wrapper.text()).toContain("1.2.0");
    expect(wrapper.text()).toContain("English notes");
    expect(wrapper.text()).toContain("2026-06-10");
    expect(wrapper.text()).toContain("Immersive-Subs-Prompter-1.2.0-darwin-arm64.dmg");
    expect(wrapper.text()).toContain(`SHA-256 ${checksum}`);
    expect(openSpy).toHaveBeenCalledTimes(1);
  });
});
