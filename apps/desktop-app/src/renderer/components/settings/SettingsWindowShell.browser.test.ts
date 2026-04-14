import { createPinia, setActivePinia } from "pinia";
import { shallowMount } from "@vue/test-utils";
import { defineComponent, h } from "vue";
import { beforeEach, describe, expect, it } from "vitest";
import SettingsWindowShell from "./SettingsWindowShell.vue";
import { useDesktopStore } from "../../stores/desktop";

const sectionStub = (testId: string) =>
  defineComponent({
    name: `SectionStub${testId}`,
    render() {
      return h("section", { "data-testid": testId });
    }
  });

describe("SettingsWindowShell browser layout", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    const store = useDesktopStore();
    store.settings = {
      global: {
        closeBehavior: "tray",
        autoLaunch: false,
        toggleWindowShortcut: "CommandOrControl+Shift+S",
        gameProcessBlacklist: [],
        autoHidePanels: false,
        autoHideActiveZoneHeight: 80,
        alwaysOnTop: "off",
        panelOpacity: 100,
        language: "en"
      },
      network: { host: "127.0.0.1", port: 4312 },
      profiles: [],
      defaultProfileId: "",
      rules: [],
      mediaServer: { enabled: false, configs: [] },
      plugins: {},
      cache: { enabled: false, path: "", retentionDays: 30 }
    } as never;
  });

  it("keeps a fixed nav and a padded document column with visible scrollbar gutter", async () => {
    const wrapper = shallowMount(SettingsWindowShell, {
      attachTo: document.body,
      global: {
        plugins: [createPinia()],
        stubs: {
          SettingsNav: sectionStub("settings-nav-content"),
          SettingsGlobal: sectionStub("settings-section-general-content"),
          SettingsProfiles: sectionStub("settings-section-profiles-content"),
          SettingsRules: sectionStub("settings-section-rules-content"),
          SettingsMediaServer: sectionStub("settings-section-media-server-content"),
          SettingsCache: sectionStub("settings-section-cache-content"),
          SettingsPlugins: sectionStub("settings-section-plugins-content")
        }
      }
    });

    const shell = wrapper.get('[data-testid="settings-shell"]');
    const content = wrapper.get('[data-testid="settings-content"]');
    const sections = wrapper.findAll(".settings-document__section");

    expect(shell.classes()).toContain("settings-window-shell--document");
    expect(content.attributes("data-scroll-mode")).toBe("document");
    expect(sections).toHaveLength(6);
  });
});
