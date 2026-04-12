import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import SettingsWindowShell from "./SettingsWindowShell.vue";
import SettingsGlobal from "./SettingsGlobal.vue";
import SettingsProfiles from "./SettingsProfiles.vue";

describe("SettingsWindowShell", () => {
  it("renders a fixed left nav and selects General by default", () => {
    const wrapper = mount(SettingsWindowShell, {
      global: {
        stubs: {
          SettingsGlobal: true,
          SettingsProfiles: true,
          SettingsRules: true,
          SettingsTranscription: true,
          SettingsMediaServer: true,
          SettingsCache: true
        }
      }
    });

    expect(wrapper.get('[data-testid="settings-nav"]').exists()).toBe(true);
    expect(wrapper.get('[data-testid="settings-nav-item-general"]').attributes("aria-current")).toBe("page");
    expect(wrapper.findComponent(SettingsGlobal).exists()).toBe(true);
  });

  it("switches active section when a nav item is clicked", async () => {
    const wrapper = mount(SettingsWindowShell, {
      global: {
        stubs: {
          SettingsGlobal: true,
          SettingsProfiles: true,
          SettingsRules: true,
          SettingsTranscription: true,
          SettingsMediaServer: true,
          SettingsCache: true
        }
      }
    });

    await wrapper.get('[data-testid="settings-nav-item-profiles"]').trigger("click");

    expect(wrapper.get('[data-testid="settings-nav-item-profiles"]').attributes("aria-current")).toBe("page");
    expect(wrapper.get('[data-testid="settings-nav-item-general"]').attributes("aria-current")).toBeUndefined();
    expect(wrapper.findComponent(SettingsProfiles).exists()).toBe(true);
  });
});
