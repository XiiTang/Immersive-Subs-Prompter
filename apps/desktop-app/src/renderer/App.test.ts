import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { defineComponent } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App.vue";
import { useDesktopStore } from "./stores/desktop";
import { createTopPanelSettings } from "./test/topPanelTestData";

describe("App", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    delete document.documentElement.dataset.theme;
    delete document.documentElement.dataset.themeMode;
  });

  it("does not mount the subtitle view before settings are loaded", () => {
    const store = useDesktopStore();
    const initialize = vi.spyOn(store, "initialize").mockResolvedValue();
    const SubtitleView = defineComponent({
      name: "SubtitleView",
      setup() {
        throw new Error("SubtitleView mounted before settings");
      },
      template: "<div />"
    });

    expect(() =>
      mount(App, {
        global: {
          stubs: {
            SubtitleView
          }
        }
      })
    ).not.toThrow();
    expect(initialize).toHaveBeenCalledTimes(1);
  });

  it("applies the configured appearance theme to the main window document", () => {
    const store = useDesktopStore();
    store.settings = createTopPanelSettings();
    store.settings.global.appearance.theme = "light";
    vi.spyOn(store, "initialize").mockResolvedValue();

    mount(App, {
      global: {
        stubs: {
          SubtitleView: defineComponent({ template: "<div />" })
        }
      }
    });

    expect(document.documentElement.dataset.theme).toBe("light");
    expect(document.documentElement.dataset.themeMode).toBe("light");
  });
});
