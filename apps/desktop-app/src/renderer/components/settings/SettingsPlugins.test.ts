import { flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SettingsPlugins from "./SettingsPlugins.vue";
import type { PluginManifest } from "../../../main/plugins/pluginManifest";
import { useDesktopStore } from "../../stores/desktop";

const previewManifest = {
  id: "word-lookup",
  author: { id: "xiitang", name: "XiiTang", url: "https://github.com/XiiTang" },
  version: "1.2.3",
  displayName: "Community Word Lookup",
  description: "Looks up subtitle words.",
  appCompatibility: { minVersion: "1.0.0" },
  package: {
    url: "https://plugins.example.test/word-lookup.usp-plugin",
    sha256: "a".repeat(64)
  },
  entry: { main: "main.js" },
  permissions: ["settingsSchema", "wordLookupProvider"]
} satisfies PluginManifest;

function seedSettings(language = "en") {
  const store = useDesktopStore();
  store.settings = {
    global: {
      autoLaunch: false,
      toggleWindowShortcut: "CommandOrControl+Shift+S",
      gameProcessBlacklist: [],
      autoHidePanels: false,
      alwaysOnTop: "off",
      panelOpacity: 100,
      language,
      appearance: { theme: "system" }
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
  return store;
}

describe("SettingsPlugins", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    setActivePinia(createPinia());
  });

  it("installs a plugin from an install link", async () => {
    const store = seedSettings();
    store.pluginCatalog = [];
    const previewSpy = vi.spyOn(store, "previewPluginInstall").mockResolvedValue(previewManifest);
    const installSpy = vi.spyOn(store, "installPlugin").mockResolvedValue();
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);

    const wrapper = mount(SettingsPlugins);

    await wrapper.get('input[name="plugin-install-url"]').setValue("https://plugins.example.test/manifest.json");
    await wrapper.get("form").trigger("submit");

    expect(previewSpy).toHaveBeenCalledWith("https://plugins.example.test/manifest.json");
    expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining("Community Word Lookup"));
    expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining("Author: XiiTang (xiitang)"));
    expect(installSpy).toHaveBeenCalledWith("https://plugins.example.test/manifest.json", previewManifest);
  });

  it("shows installed plugin metadata, permissions, update, delete, and enable state", async () => {
    const store = seedSettings();
    store.pluginCatalog = [
      {
        pluginKey: "xiitang/word-lookup",
        id: "word-lookup",
        author: { id: "xiitang", name: "XiiTang", url: "https://github.com/XiiTang" },
        version: "1.2.3",
        displayName: "Community Word Lookup",
        description: "Looks up subtitle words.",
        sourceUrl: "https://plugins.example.test/manifest.json",
        enabled: true,
        status: "enabled",
        error: null,
        permissions: ["settingsSchema", "wordLookupProvider"],
        settings: []
      }
    ];
    const updateSpy = vi.spyOn(store, "updatePlugin").mockResolvedValue();
    const deleteSpy = vi.spyOn(store, "deletePlugin").mockResolvedValue();
    const disableSpy = vi.spyOn(store, "disablePlugin").mockResolvedValue();

    const wrapper = mount(SettingsPlugins);

    expect(wrapper.text()).toContain("Community Word Lookup");
    expect(wrapper.text()).toContain("XiiTang (xiitang)");
    expect(wrapper.text()).toContain("settingsSchema");
    expect(wrapper.text()).toContain("wordLookupProvider");
    expect(wrapper.text()).toContain("https://plugins.example.test/manifest.json");

    const buttons = wrapper.findAll("button");
    await buttons.find((button) => button.text() === "Update")!.trigger("click");
    await buttons.find((button) => button.text() === "Delete")!.trigger("click");
    await buttons.find((button) => button.text() === "Disable")!.trigger("click");

    expect(updateSpy).toHaveBeenCalledWith("xiitang/word-lookup");
    expect(deleteSpy).toHaveBeenCalledWith("xiitang/word-lookup");
    expect(disableSpy).toHaveBeenCalledWith("xiitang/word-lookup");
  });

  it("renders recommended plugin install links as prefilled install actions", async () => {
    const store = seedSettings("zh");
    store.pluginCatalog = [];
    vi.spyOn(store, "previewPluginInstall").mockResolvedValue(previewManifest);
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const installSpy = vi.spyOn(store, "installPlugin").mockResolvedValue();

    const wrapper = mount(SettingsPlugins);
    const recommendedButton = wrapper.find('[data-testid="recommended-plugin-install-xiitang/word-lookup"]');

    expect(wrapper.text()).toContain("Word Lookup");
    expect(wrapper.text()).toContain("XiiTang (xiitang)");
    await recommendedButton.trigger("click");

    expect(installSpy).toHaveBeenCalledWith(expect.stringContaining("word-lookup"), previewManifest);
  });

  it("reports installed plugin action failures", async () => {
    const store = seedSettings();
    store.pluginCatalog = [
      {
        pluginKey: "xiitang/word-lookup",
        id: "word-lookup",
        author: { id: "xiitang", name: "XiiTang" },
        version: "1.2.3",
        displayName: "Community Word Lookup",
        description: "Looks up subtitle words.",
        sourceUrl: "https://plugins.example.test/manifest.json",
        enabled: true,
        status: "enabled",
        error: null,
        permissions: [],
        settings: []
      }
    ];
    vi.spyOn(store, "updatePlugin").mockRejectedValue(new Error("update failed"));

    const wrapper = mount(SettingsPlugins);

    await wrapper.findAll("button").find((button) => button.text() === "Update")!.trigger("click");
    await flushPromises();

    expect(wrapper.text()).toContain("update failed");
  });
});
