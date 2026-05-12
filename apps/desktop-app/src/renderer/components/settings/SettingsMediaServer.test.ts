import { createPinia, setActivePinia } from "pinia";
import { mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import SettingsMediaServer from "./SettingsMediaServer.vue";
import { useDesktopStore } from "../../stores/desktop";

describe("SettingsMediaServer", () => {
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
        alwaysOnTop: "off",
        panelOpacity: 100,
        language: "en"
      },
      network: { host: "127.0.0.1", port: 4312 },
      profiles: [],
      defaultProfileId: "",
      rules: [],
      mediaServer: {
        enabled: true,
        configs: [
          {
            id: "server-1",
            name: "Home Jellyfin",
            serverUrl: "http://localhost:8096",
            apiKey: "secret",
            webSocketPath: "/socket",
            enabled: true
          }
        ]
      },
      plugins: {},
      cache: { enabled: false, path: "", retentionDays: 30 }
    } as never;
  });

  it("keeps enable controls concise in the server editor", () => {
    const wrapper = mount(SettingsMediaServer, {
      global: {
        stubs: {
          IconAdd: true,
          IconDelete: true
        }
      }
    });

    expect(wrapper.text()).not.toContain("Enable Media Server");
    expect(wrapper.text()).not.toContain("Enable This Server");
    expect(wrapper.findAll(".toggle__text").map((item) => item.text())).toEqual(["On", "On"]);
  });
});
