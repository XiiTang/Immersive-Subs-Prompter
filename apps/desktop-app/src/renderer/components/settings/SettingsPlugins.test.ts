import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SettingsPlugins from "./SettingsPlugins.vue";
import { useDesktopStore } from "../../stores/desktop";

describe("SettingsPlugins", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("shows only enable or disable actions for bundled official plugins", () => {
    const store = useDesktopStore();
    store.settings = {
      global: {
        closeBehavior: "tray",
        autoLaunch: false,
        toggleWindowShortcut: "CommandOrControl+Shift+S",
        gameProcessBlacklist: [],
        autoHidePanels: false,
        alwaysOnTop: "off",
        panelOpacity: 100,
        language: "en"
      },
      network: { host: "127.0.0.1", port: 44501 },
      profiles: [],
      defaultProfileId: "",
      rules: [],
      mediaServer: { enabled: false, configs: [] },
      plugins: {},
      cache: { enabled: false, path: "", retentionDays: 30 }
    } as never;
    store.pluginCatalog = [
      {
        id: "official.transcription",
        version: "1.0.0",
        displayName: "Speech Transcription",
        description: "Transcribe video audio.",
        enabled: false,
        status: "disabled",
        error: null,
        settings: []
      }
    ];

    const enableSpy = vi.spyOn(store, "enablePlugin").mockResolvedValue();
    const disableSpy = vi.spyOn(store, "disablePlugin").mockResolvedValue();

    const wrapper = mount(SettingsPlugins);

    expect(wrapper.text()).toContain("Enable");
    expect(wrapper.text()).not.toContain("Install");
    expect(wrapper.text()).not.toContain("Uninstall");

    wrapper.get("button").trigger("click");
    expect(enableSpy).toHaveBeenCalledWith("official.transcription");
    expect(disableSpy).not.toHaveBeenCalled();
  });
});
