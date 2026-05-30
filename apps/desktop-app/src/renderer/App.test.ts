import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { defineComponent } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App.vue";
import { useDesktopStore } from "./stores/desktop";

describe("App", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
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
});
