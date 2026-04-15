import { createPinia, setActivePinia } from "pinia";
import { mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import SettingsRules from "./SettingsRules.vue";
import { useDesktopStore } from "../../stores/desktop";

describe("SettingsRules", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    document.body.innerHTML = "";
    document.body.style.margin = "0";
    document.body.style.padding = "24px";
    document.body.style.width = "1120px";
  });

  it("renders rules as a left list and a right editor", async () => {
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
      network: { host: "127.0.0.1", port: 4312 },
      profiles: [{ id: "profile-1", name: "Default", description: null, settings: {} as any }],
      defaultProfileId: "profile-1",
      rules: [{ id: "rule-1", name: "Netflix", matchType: "contains", pattern: "netflix.com", profileId: "profile-1", isEnabled: true }],
      mediaServer: { enabled: false, configs: [] },
      plugins: {},
      cache: { enabled: false, path: "", retentionDays: 30 }
    } as any;

    const wrapper = mount(SettingsRules, {
      attachTo: document.body,
      global: {
        stubs: {
          IconDelete: true
        }
      }
    });

    expect(wrapper.get('[data-testid="rules-list"]').exists()).toBe(true);
    expect(wrapper.get('[data-testid="rules-editor"]').exists()).toBe(true);
    expect(wrapper.text()).toContain("Netflix");
  }, 30000);
});
