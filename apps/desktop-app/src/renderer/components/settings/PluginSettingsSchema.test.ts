import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppSettings } from "../../../main/types";
import { useDesktopStore } from "../../stores/desktop";
import PluginSettingsSchema from "./PluginSettingsSchema.vue";

function createSettings(): AppSettings {
  return {
    global: {
      autoLaunch: false,
      toggleWindowShortcut: "",
      gameProcessBlacklist: [],
      autoHidePanels: false,
      alwaysOnTop: "off",
      panelOpacity: 100,
      language: "en",
      appearance: { theme: "system" }
    },
    network: {
      endpoints: [],
      authToken: "0123456789abcdef0123456789abcdef"
    },
    profiles: [],
    defaultProfileId: "",
    rules: [],
    plugins: {
      "xiitang/jellyfinemby": {
        config: { servers: [] }
      }
    },
    cache: { enabled: false, path: "", retentionDays: 7 }
  };
}

describe("PluginSettingsSchema", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    setActivePinia(createPinia());
  });

  it("renders server-list fields as structured Jellyfin / Emby server editors", async () => {
    const store = useDesktopStore();
    store.settings = createSettings();
    store.pluginCatalog = [
      {
        pluginKey: "xiitang/jellyfinemby",
        id: "jellyfinemby",
        author: { id: "xiitang", name: "XiiTang", url: "https://github.com/XiiTang" },
        version: "1.0.0",
        displayName: "Jellyfin / Emby",
        description: "Connect media servers.",
        sourceUrl: "https://plugins.example.test/jellyfinemby.json",
        status: "enabled",
        enabled: true,
        error: null,
        permissions: ["settingsSchema", "mediaSourceAdapter"],
        settings: [
          {
            id: "jellyfinemby.settings",
            title: "Jellyfin / Emby",
            schema: [{ id: "servers", label: "Servers", type: "serverList", defaultValue: [] }]
          }
        ]
      }
    ];
    const updateSpy = vi.spyOn(store, "setPluginConfig");

    const wrapper = mount(PluginSettingsSchema, {
      props: { sectionId: "xiitang/jellyfinemby::jellyfinemby.settings" }
    });

    expect(wrapper.find('input[value="[]"]').exists()).toBe(false);
    expect(wrapper.find(".plugin-server-list__delete").exists()).toBe(false);
    expect(wrapper.findAll('[data-slot="setting-row"]').length).toBeGreaterThanOrEqual(1);

    await wrapper.get('[data-testid="plugin-server-list-add-servers"]').trigger("click");

    expect(updateSpy).toHaveBeenCalledWith("xiitang/jellyfinemby", {
      servers: [
          {
            id: expect.any(String),
            name: "",
            serverUrl: "",
            apiKey: "",
            enabled: true
          }
        ]
    });
  });
});
