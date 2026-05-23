import { createPinia, setActivePinia } from "pinia";
import { mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
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
      network: {
        endpoints: [{ id: "default", host: "127.0.0.1", port: 4312 }],
        authToken: "0123456789abcdef0123456789abcdef"
      },
      profiles: [],
      defaultProfileId: "",
      rules: [],
      plugins: {
        "official.jellyfinemby": {
          config: {
            servers: [
              {
                id: "server-1",
                name: "Home Jellyfin",
                serverUrl: "http://localhost:8096",
                apiKey: "secret",
                webSocketPath: "/socket",
                enabled: true
              }
            ]
          }
        }
      },
      cache: { enabled: false, path: "", retentionDays: 30 }
    } as never;
    Object.defineProperty(window, "usp", {
      configurable: true,
      value: {
        updateSettings: vi.fn(async () => store.settings)
      }
    });
  });

  it("edits plugin-owned servers without a global media-server toggle", () => {
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
    expect(wrapper.findAll(".toggle__text").map((item) => item.text())).toEqual(["On"]);
    expect(wrapper.text()).toContain("Home Jellyfin");
  });

  it("allows deleting the last configured server", async () => {
    const store = useDesktopStore();
    const wrapper = mount(SettingsMediaServer, {
      global: {
        stubs: {
          IconAdd: true,
          IconDelete: true
        }
      }
    });

    await wrapper.get(".mediaserver-config-list__item").trigger("click");
    await wrapper.get('[aria-label="Delete"]').trigger("click");

    expect(store.getJellyfinembyPluginConfig().servers).toEqual([]);
  });
});
