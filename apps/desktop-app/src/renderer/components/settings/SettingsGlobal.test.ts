import { createPinia, setActivePinia } from "pinia";
import { mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import type { AppSettings } from "../../../main/types";
import SettingsGlobal from "./SettingsGlobal.vue";
import { useDesktopStore } from "../../stores/desktop";

function createSettings(): AppSettings {
  return {
    global: {
      closeBehavior: "tray",
      autoLaunch: false,
      toggleWindowShortcut: "CommandOrControl+Shift+S",
      gameProcessBlacklist: [],
      autoHidePanels: false,
      alwaysOnTop: "off",
      panelOpacity: 100,
      language: "en",
      appearance: { theme: "system" }
    },
    network: {
      host: "127.0.0.1",
      port: 44501,
      authToken: "token"
    },
    profiles: [],
    defaultProfileId: "",
    rules: [],
    plugins: {},
    cache: {
      enabled: true,
      path: "",
      retentionDays: 30
    }
  };
}

describe("SettingsGlobal", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("includes appearance and subtitle cache controls in the global settings page", () => {
    const store = useDesktopStore();
    store.settings = createSettings();

    const wrapper = mount(SettingsGlobal);

    expect(wrapper.text()).toContain("Global Settings");
    expect(wrapper.text()).toContain("Appearance");
    expect(wrapper.text()).toContain("Subtitle Cache");
    expect(wrapper.find("#appearance-theme-label").exists()).toBe(true);
    expect(wrapper.find("#cache-path-label").exists()).toBe(true);
  });
});
