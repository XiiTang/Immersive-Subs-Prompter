import { createPinia, setActivePinia } from "pinia";
import { mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppSettings } from "../../../main/types";
import type { ReleaseState } from "../../../main/releases/releaseState";
import { createDefaultAppSettings } from "../../../common/defaultSettings";
import { useDesktopStore } from "../../stores/desktop";
import SettingsReleaseUpdate from "./SettingsReleaseUpdate.vue";

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

function state(status: ReleaseState["status"], patch: Partial<ReleaseState> = {}): ReleaseState {
  return {
    status,
    currentVersion: "1.0.0",
    latestVersion: null,
    checkedAt: null,
    updateInfo: null,
    progress: null,
    error: null,
    ...patch
  };
}

describe("SettingsReleaseUpdate", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("shows current version and manual check action", () => {
    const store = useDesktopStore();
    store.settings = settings();
    store.releaseState = state("idle");
    vi.spyOn(store, "checkForUpdates").mockResolvedValue();

    const wrapper = mount(SettingsReleaseUpdate);

    expect(wrapper.text()).toContain("Updates");
    expect(wrapper.text()).toContain("Current version");
    expect(wrapper.text()).toContain("1.0.0");
    expect(wrapper.find('[data-testid="release-check"]').exists()).toBe(true);
  });

  it("shows available update and starts download", async () => {
    const store = useDesktopStore();
    store.settings = settings();
    store.releaseState = state("available", {
      latestVersion: "1.2.0",
      updateInfo: {
        version: "1.2.0",
        releaseName: "Version 1.2.0",
        releaseDate: "2026-06-17T12:00:00Z",
        releaseNotes: "English notes"
      }
    });
    const downloadSpy = vi.spyOn(store, "downloadReleaseUpdate").mockResolvedValue();

    const wrapper = mount(SettingsReleaseUpdate);
    await wrapper.get('[data-testid="release-download"]').trigger("click");

    expect(wrapper.text()).toContain("1.2.0");
    expect(wrapper.text()).toContain("English notes");
    expect(wrapper.text()).toContain("2026-06-17");
    expect(downloadSpy).toHaveBeenCalledTimes(1);
  });

  it("shows download progress", () => {
    const store = useDesktopStore();
    store.settings = settings();
    store.releaseState = state("downloading", {
      latestVersion: "1.2.0",
      progress: {
        percent: 42,
        bytesPerSecond: 1024,
        transferred: 420,
        total: 1000
      }
    });

    const wrapper = mount(SettingsReleaseUpdate);

    expect(wrapper.text()).toContain("Downloading");
    expect(wrapper.text()).toContain("42%");
  });

  it("installs downloaded updates", async () => {
    const store = useDesktopStore();
    store.settings = settings();
    store.releaseState = state("downloaded", {
      latestVersion: "1.2.0",
      updateInfo: {
        version: "1.2.0",
        releaseName: "Version 1.2.0",
        releaseDate: "2026-06-17T12:00:00Z",
        releaseNotes: "English notes"
      }
    });
    const installSpy = vi.spyOn(store, "installReleaseUpdate").mockResolvedValue();

    const wrapper = mount(SettingsReleaseUpdate);
    await wrapper.get('[data-testid="release-install"]').trigger("click");

    expect(wrapper.text()).toContain("Ready to install");
    expect(installSpy).toHaveBeenCalledTimes(1);
  });

  it("shows update errors", () => {
    const store = useDesktopStore();
    store.settings = settings();
    store.releaseState = state("error", {
      error: {
        code: "check-failed",
        message: "feed unavailable"
      }
    });

    const wrapper = mount(SettingsReleaseUpdate);

    expect(wrapper.text()).toContain("Update check failed");
    expect(wrapper.text()).toContain("feed unavailable");
  });
});
