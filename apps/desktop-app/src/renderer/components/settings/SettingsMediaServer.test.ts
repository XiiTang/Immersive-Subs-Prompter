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

  it("edits plugin-owned servers", () => {
    const wrapper = mount(SettingsMediaServer, {
      global: {
        stubs: {
          IconAdd: true,
          IconDelete: true
        }
      }
    });

    expect(wrapper.text()).toContain("Home Jellyfin");
    expect(wrapper.get('[data-testid="mediaserver-config-state"]').attributes("data-state")).toBe("checked");
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

  it("renames the selected server directly from the config card", async () => {
    const store = useDesktopStore();
    const wrapper = mount(SettingsMediaServer, {
      global: {
        stubs: {
          IconAdd: true,
          IconDelete: true
        }
      }
    });

    await wrapper.get('[data-testid="mediaserver-config-name-action"]').trigger("click");
    const input = wrapper.get<HTMLInputElement>('[data-testid="mediaserver-config-name-input"]');
    await input.setValue("Living Room Emby");
    await input.trigger("blur");

    expect(store.getJellyfinembyPluginConfig().servers[0]?.name).toBe("Living Room Emby");
  });

  it("shows enabled and disabled server states with check indicators", () => {
    const store = useDesktopStore();
    const config = store.getJellyfinembyPluginConfig();
    store.setPluginConfig("official.jellyfinemby", {
      servers: [
        ...config.servers,
        {
          id: "server-2",
          name: "Remote Emby",
          serverUrl: "http://localhost:8097",
          apiKey: "secret",
          webSocketPath: "/socket",
          enabled: false
        }
      ]
    });

    const wrapper = mount(SettingsMediaServer, {
      global: {
        stubs: {
          IconAdd: true,
          IconDelete: true
        }
      }
    });

    const indicators = wrapper.findAll('[data-testid="mediaserver-config-state"]');
    expect(indicators.map((indicator) => indicator.attributes("data-state"))).toEqual(["checked", "unchecked"]);
  });

  it("toggles server enabled state from the config card indicator", async () => {
    const store = useDesktopStore();
    const wrapper = mount(SettingsMediaServer, {
      global: {
        stubs: {
          IconAdd: true,
          IconDelete: true
        }
      }
    });

    await wrapper.get('[data-testid="mediaserver-config-state"]').trigger("click");

    expect(store.getJellyfinembyPluginConfig().servers[0]?.enabled).toBe(false);
  });
});
