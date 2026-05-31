import { createPinia, setActivePinia } from "pinia";
import { mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import type { ProfileDefinition } from "../../../../main/types";
import { useDesktopStore } from "../../../stores/desktop";
import ProfileList from "./ProfileList.vue";

const profile: ProfileDefinition = {
  id: "profile-default",
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
    store.settings = {
      global: {
        autoLaunch: false,
        toggleWindowShortcut: "CommandOrControl+Shift+S",
        gameProcessBlacklist: [],
        autoHidePanels: false,
        alwaysOnTop: "off",
        panelOpacity: 100,
        language: "en",
        appearance: { theme: "system" }
      },
      network: {
        endpoints: [{ id: "default", host: "127.0.0.1", port: 44501 }],
        authToken: "0123456789abcdef0123456789abcdef"
      },
      profiles: [profile],
      defaultProfileId: profile.id,
      rules: [],
      plugins: {},
      cache: { enabled: true, path: "", retentionDays: 30 }
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

    await duplicate.trigger("click");

    expect(wrapper.emitted("duplicate")).toHaveLength(1);
  });
});
