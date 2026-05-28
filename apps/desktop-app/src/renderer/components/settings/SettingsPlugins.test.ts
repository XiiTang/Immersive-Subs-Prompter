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
      network: {
        endpoints: [{ id: "default", host: "127.0.0.1", port: 44501 }],
        authToken: "0123456789abcdef0123456789abcdef"
      },
      profiles: [],
      defaultProfileId: "",
      rules: [],
      plugins: { "official.jellyfinemby": { config: { servers: [] } } },
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

  it("localizes official plugin names and descriptions in Chinese", async () => {
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
        language: "zh"
      },
      network: {
        endpoints: [{ id: "default", host: "127.0.0.1", port: 44501 }],
        authToken: "0123456789abcdef0123456789abcdef"
      },
      profiles: [],
      defaultProfileId: "",
      rules: [],
      plugins: {},
      cache: { enabled: false, path: "", retentionDays: 30 }
    } as never;
    store.pluginCatalog = [
      {
        id: "official.transcription",
        version: "1.0.0",
        displayName: "Speech Transcription",
        description: "Transcribe video audio.",
        enabled: true,
        status: "enabled",
        error: null,
        settings: []
      }
    ];

    const wrapper = mount(SettingsPlugins);

    await vi.waitFor(() => {
      expect(wrapper.text()).toContain("语音转写");
      expect(wrapper.text()).toContain("使用 Whisper API 或 Faster-Whisper 本地 CLI 转写视频音频。");
    });
    expect(wrapper.text()).not.toContain("Speech Transcription");
    expect(wrapper.text()).not.toContain("Transcribe video audio.");
  });
});
