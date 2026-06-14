import { createPinia, setActivePinia } from "pinia";
import { mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createDefaultAppSettings, DEFAULT_PROFILE_ID } from "../../../../common/defaultSettings.js";
import type { ProfileDefinition } from "../../../../main/types";
import { useDesktopStore } from "../../../stores/desktop";
import ProfileList from "./ProfileList.vue";

const profile: ProfileDefinition = {
  id: DEFAULT_PROFILE_ID,
  name: "Default",
  settings: {
    primarySubtitleFontFamily: "Inter",
    primarySubtitleFontSize: 18,
    secondarySubtitleFontFamily: "Inter",
    secondarySubtitleFontSize: 17,
    subtitleTimestampFontSize: 11,
    subtitlePrimaryColor: "#ffffff",
    subtitleSecondaryColor: "#b8c0cc",
    subtitleActivePrimaryColor: "#ffffff",
    subtitleActiveSecondaryColor: "#9fb0c8",
    subtitleAutoScrollTimeout: 5,
    subtitleScrollPosition: 50,
    subtitlePrimarySecondaryGap: 8,
    subtitleLineHeight: 1.4,
    subtitleBlockGap: 12,
    subtitleAutoHideMetaRow: false,
    primarySubtitlePriority: [],
    secondarySubtitlePriority: [],
    ytDlpArgs: ""
  }
};

describe("ProfileList", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    const store = useDesktopStore();
    const settings = createDefaultAppSettings({
      networkAuthToken: "0123456789abcdef0123456789abcdef"
    });
    store.settings = {
      ...settings,
      global: {
        ...settings.global,
        language: "en"
      },
      profiles: [profile],
      defaultProfileId: profile.id,
      rules: []
    };
  });

  it("uses the shared icon button primitive for the duplicate action", async () => {
    const wrapper = mount(ProfileList, {
      props: {
        profiles: [profile],
        rules: [],
        editingProfileId: profile.id,
        defaultProfileId: profile.id,
        canDelete: false
      }
    });

    const duplicate = wrapper.get('[aria-label="Duplicate"]');
    expect(duplicate.classes()).toContain("ui-icon-button");
    expect(duplicate.text()).toBe("");
    expect(duplicate.find("svg").exists()).toBe(true);
    expect(wrapper.findAll('[data-slot="toolbar"]').length).toBeGreaterThanOrEqual(1);
    expect(wrapper.findAll('[data-slot="icon-button"]').length).toBeGreaterThanOrEqual(3);

    await duplicate.trigger("click");

    expect(wrapper.emitted("duplicate")).toHaveLength(1);
  });
});
