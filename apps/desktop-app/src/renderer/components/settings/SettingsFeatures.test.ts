import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDefaultAppSettings } from "../../../common/defaultSettings";
import SettingsFeatures from "./SettingsFeatures.vue";
import { useDesktopStore } from "../../stores/desktop";

function seedStore(language = "en") {
  const store = useDesktopStore();
  store.settings = createDefaultAppSettings({
    networkAuthToken: "0123456789abcdef0123456789abcdef"
  });
  store.settings.global.language = language;
  vi.spyOn(store, "setFeatureEnabled").mockResolvedValue();
  vi.spyOn(store, "setFeatureConfig").mockResolvedValue();
  return store;
}

describe("SettingsFeatures", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    setActivePinia(createPinia());
  });

  it("renders fixed built-in features without plugin lifecycle controls", async () => {
    const store = seedStore();
    const wrapper = mount(SettingsFeatures);

    expect(wrapper.text()).toContain("Word Lookup");
    expect(wrapper.text()).toContain("Speech Transcription");
    expect(wrapper.text()).toContain("Jellyfin / Emby");
    expect(wrapper.text()).not.toContain("Install");
    expect(wrapper.text()).not.toContain("Update");
    expect(wrapper.text()).not.toContain("Delete");
    expect(wrapper.text()).not.toContain("Permissions");

    await wrapper.get('[data-testid="feature-enabled-wordLookup"]').trigger("click");
    expect(store.setFeatureEnabled).toHaveBeenCalledWith("wordLookup", true);
  });

  it("labels feature switches with current state", async () => {
    const store = seedStore();
    store.settings!.features.wordLookup.enabled = false;
    const wrapper = mount(SettingsFeatures);

    expect(wrapper.get('[data-testid="feature-enabled-wordLookup"]').attributes("aria-label")).toBe("Disabled");

    store.settings!.features.wordLookup.enabled = true;
    await wrapper.vm.$nextTick();

    expect(wrapper.get('[data-testid="feature-enabled-wordLookup"]').attributes("aria-label")).toBe("Enabled");
  });

  it("updates Word Lookup config through explicit controls", async () => {
    const store = seedStore();
    const wrapper = mount(SettingsFeatures);

    await wrapper.get('[data-testid="feature-word-lookup-path"]').setValue("/tmp/words.jsonl");

    expect(store.setFeatureConfig).toHaveBeenCalledWith("wordLookup", { wordListPath: "/tmp/words.jsonl" });
  });

  it("adds Jellyfin / Emby server rows", async () => {
    const store = seedStore();
    const wrapper = mount(SettingsFeatures);

    await wrapper.get('[data-testid="feature-jellyfin-emby-add-server"]').trigger("click");

    expect(store.setFeatureConfig).toHaveBeenCalledWith("jellyfinEmby", {
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

  it("shows Jellyfin / Emby server validation errors inline", () => {
    const store = seedStore();
    store.settings!.features.jellyfinEmby.config.servers = [
      {
        id: "server-1",
        name: "",
        serverUrl: "not a url",
        apiKey: "",
        enabled: true
      }
    ];

    const wrapper = mount(SettingsFeatures);

    expect(wrapper.text()).toContain("Name is required");
    expect(wrapper.text()).toContain("Server URL must be HTTP(S)");
    expect(wrapper.text()).toContain("API key is required");
  });
});
