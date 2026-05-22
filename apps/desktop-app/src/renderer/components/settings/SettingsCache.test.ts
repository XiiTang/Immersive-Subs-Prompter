import { createPinia, setActivePinia } from "pinia";
import { mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SettingsCache from "./SettingsCache.vue";
import { useDesktopStore } from "../../stores/desktop";

describe("SettingsCache", () => {
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
        language: "zh"
      },
      network: { host: "127.0.0.1", port: 4312 },
      profiles: [],
      defaultProfileId: "",
      rules: [],
      plugins: { "official.jellyfinemby": { config: { servers: [] } } },
      cache: { enabled: true, path: "/tmp/immersive-subs-cache", retentionDays: 30 }
    } as never;
    store.cacheStats = {
      totalEntries: 2,
      totalSize: 1024 * 1024,
      oldestEntry: "2026-05-01T00:00:00.000Z"
    };
    vi.spyOn(store, "openCacheFolder").mockResolvedValue(undefined);
    vi.spyOn(store, "refreshCacheStats").mockResolvedValue(undefined);
  });

  it("uses localized compact copy without emoji actions", () => {
    const wrapper = mount(SettingsCache);

    expect(wrapper.text()).not.toContain("Storage");
    expect(wrapper.text()).not.toContain("Usage");
    expect(wrapper.text()).not.toContain("📂");
    expect(wrapper.text()).not.toContain("🔄");
    expect(wrapper.get('[data-testid="cache-settings-stack"]').exists()).toBe(true);
    expect(wrapper.get('[data-testid="cache-stats-refresh"]').text()).toBe("");
  });
});
