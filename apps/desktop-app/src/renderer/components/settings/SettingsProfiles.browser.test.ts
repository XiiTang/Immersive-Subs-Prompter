import { createPinia, setActivePinia } from "pinia";
import { mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppSettings, DesktopState, ProfileDefinition } from "../../../main/types.js";
import SettingsProfiles from "./SettingsProfiles.vue";
import { useDesktopStore } from "../../stores/desktop";

function createProfile(id = "profile-1", name = "Default"): ProfileDefinition {
  return {
    id,
    name,
    description: null,
    settings: {
      subtitleFontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
      subtitleFontSize: 14,
      subtitleAutoHideMetaRow: true,
      subtitlePrimarySecondaryGap: 3,
      subtitleLineHeight: 1.45,
      subtitlePrimaryColor: "#f5f5f5",
      subtitleSecondaryColor: "#c7d2fe",
      subtitleActivePrimaryColor: "#fff8dc",
      subtitleActiveSecondaryColor: "#fff9c4",
      ytDlpArgs: "",
      subtitleAutoScrollTimeout: 3,
      subtitleScrollPosition: 33,
      subtitleBlockGap: 12,
      primarySubtitlePriority: [],
      secondarySubtitlePriority: []
    }
  };
}

function createSettings(): AppSettings {
  return {
    global: {
      closeBehavior: "tray",
      autoLaunch: false,
      toggleWindowShortcut: "CommandOrControl+Shift+S",
      gameProcessBlacklist: [],
      autoHidePanels: false,
      alwaysOnTop: "off",
      panelOpacity: 100,
      language: "en"
    },
    network: {
      host: "127.0.0.1",
      port: 4312
    },
    profiles: [createProfile()],
    defaultProfileId: "profile-1",
    rules: [],
    plugins: { "official.jellyfinemby": { config: { servers: [] } } },
    cache: {
      enabled: false,
      path: "",
      retentionDays: 30
    }
  };
}

function createDesktopState(appliedProfileId = "profile-1", appliedProfileName = "Default"): DesktopState {
  return {
    connectionCount: 1,
    activeTabId: 1,
    pageUrl: "https://example.com/watch",
    videoUrl: "https://example.com/watch",
    title: "Demo",
    site: "example",
    activeSource: "extension",
    status: "ready",
    error: null,
    playback: {
      currentTime: 0,
      duration: null,
      playbackRate: 1,
      lastUpdate: Date.now(),
      loop: null
    },
    subtitleTracks: [],
    selectedPrimarySubtitleId: null,
    selectedSecondarySubtitleId: null,
    primarySubtitles: null,
    secondarySubtitles: null,
    appliedProfileId,
    appliedProfileName,
    appliedRuleId: null,
    appliedRuleName: null,
    appliedRulePattern: null,
    appliedRuleMatchType: null,
    pendingMediaServerItemId: null,
    mediaServer: {
      connected: false,
      sessions: [],
      selectedSessionId: null,
      lastUpdated: null
    },
    isFullscreen: false,
    transcription: {
      status: "idle",
      message: null,
      configName: null,
      lastFinishedAt: null
    }
  };
}

describe("SettingsProfiles", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    document.body.innerHTML = "";
    document.body.style.margin = "0";
    document.body.style.padding = "24px";
    document.body.style.background = "#101418";
    document.body.style.width = "1120px";
  });

  it("renders subtitle font as a curated select instead of free-form input", () => {
    const store = useDesktopStore();
    store.settings = createSettings();
    store.editingProfileId = "profile-1";

    const wrapper = mount(SettingsProfiles, {
      global: {
        stubs: {
          IconAdd: true,
          IconDelete: true
        }
      }
    });

    const fontSelect = wrapper.find('[data-testid="subtitle-font-select"]');

    expect(fontSelect.exists()).toBe(true);
    expect(fontSelect.element.tagName).toBe("BUTTON");
    expect(fontSelect.attributes("role")).toBe("combobox");
    expect(fontSelect.text()).toContain("Helvetica Neue");
    expect(
      wrapper
        .findAll('input[type="text"]')
        .some((input) => (input.attributes("placeholder") ?? "").includes("LXGW WenKai"))
    ).toBe(false);
  });

  it("does not render a separate subtitle line spacing control", () => {
    const store = useDesktopStore();
    store.settings = createSettings();
    store.editingProfileId = "profile-1";

    const wrapper = mount(SettingsProfiles, {
      global: {
        stubs: {
          IconAdd: true,
          IconDelete: true
        }
      }
    });

    expect(wrapper.text()).not.toContain("Subtitle Line Spacing");
    expect(wrapper.text()).not.toContain("字幕行间距");
  });

  it("marks the currently applied profile in the profile list", () => {
    const store = useDesktopStore();
    store.settings = {
      ...createSettings(),
      profiles: [createProfile("profile-1", "Default"), createProfile("profile-2", "Bilibili")]
    };
    store.desktopState = createDesktopState("profile-2", "Bilibili");
    store.editingProfileId = "profile-2";

    const wrapper = mount(SettingsProfiles, {
      global: {
        stubs: {
          IconAdd: true,
          IconDelete: true
        }
      }
    });

    const profileItems = wrapper.findAll(".profile-list__item");

    expect(profileItems).toHaveLength(2);
    expect(profileItems[0]?.text()).not.toContain("Applied");
    expect(profileItems[1]?.text()).toContain("Applied");
  });

  it("renders a profile-level toggle for auto-hiding transcript timestamps and actions", () => {
    const store = useDesktopStore();
    store.settings = createSettings();
    store.editingProfileId = "profile-1";

    const wrapper = mount(SettingsProfiles, {
      global: {
        stubs: {
          IconAdd: true,
          IconDelete: true
        }
      }
    });

    const toggle = wrapper.get('[data-testid="subtitle-meta-auto-hide-toggle"]');

    expect(toggle.element.tagName).toBe("BUTTON");
    expect(toggle.attributes("role")).toBe("switch");
    expect(toggle.attributes("aria-checked")).toBe("true");
  });

  it("renders the default profile editor with the applied profile selected", () => {
    const store = useDesktopStore();
    store.settings = {
      ...createSettings(),
      profiles: [createProfile("profile-1", "Default"), createProfile("profile-2", "Bilibili")]
    };
    store.desktopState = createDesktopState("profile-2", "Bilibili");
    store.editingProfileId = "profile-2";

    const wrapper = mount(SettingsProfiles, {
      attachTo: document.body,
      global: {
        stubs: {
          IconAdd: true,
          IconDelete: true
        }
      }
    });

    expect(wrapper.findAll(".profile-list__item")).toHaveLength(2);
    expect(wrapper.find('[data-testid="subtitle-font-select"]').exists()).toBe(true);
    expect(wrapper.text()).toContain("Bilibili");
    expect(wrapper.text()).toContain("Applied");
  });

  it("shows URL rules inside the selected profile and summarizes them in the profile list", () => {
    const store = useDesktopStore();
    store.settings = {
      ...createSettings(),
      profiles: [createProfile("profile-default", "Default"), createProfile("profile-youtube", "YouTube")],
      defaultProfileId: "profile-default",
      rules: [
        {
          id: "rule-youtube",
          name: "YouTube",
          matchType: "contains",
          pattern: "youtube.com",
          profileId: "profile-youtube",
          isEnabled: true
        },
        {
          id: "rule-youtu-be",
          name: "youtu.be",
          matchType: "contains",
          pattern: "youtu.be",
          profileId: "profile-youtube",
          isEnabled: true
        }
      ]
    };
    store.editingProfileId = "profile-youtube";

    const wrapper = mount(SettingsProfiles, {
      attachTo: document.body,
      global: {
        stubs: {
          IconAdd: true,
          IconDelete: true
        }
      }
    });

    expect(wrapper.get('[data-testid="profile-url-rules"]').exists()).toBe(true);
    expect(wrapper.text()).toContain("Applies to these URLs");
    expect(wrapper.text()).toContain("youtube.com");
    expect(wrapper.text()).toContain("youtu.be");
  });

  it("renders the fallback profile as a fixed bottom row without set-default controls", () => {
    const store = useDesktopStore();
    store.settings = {
      ...createSettings(),
      profiles: [createProfile("profile-youtube", "YouTube"), createProfile("profile-default", "Fallback")],
      defaultProfileId: "profile-default",
      rules: []
    };
    store.editingProfileId = "profile-youtube";

    const wrapper = mount(SettingsProfiles, {
      attachTo: document.body,
      global: {
        stubs: {
          IconAdd: true,
          IconDelete: true
        }
      }
    });

    const items = wrapper.findAll(".profile-list__item");

    expect(items).toHaveLength(2);
    expect(items[0]?.attributes("draggable")).toBe("true");
    expect(items[1]?.attributes("draggable")).toBe("false");
    expect(items[1]?.text()).toContain("Fallback");
    expect(wrapper.text()).not.toContain("Set as Default");
  });

  it("uses drag ordering controls and a textless leading enable checkbox for profile URL rules", () => {
    const store = useDesktopStore();
    store.settings = {
      ...createSettings(),
      profiles: [createProfile("profile-default", "Default"), createProfile("profile-youtube", "YouTube")],
      defaultProfileId: "profile-default",
      rules: [
        {
          id: "rule-youtube",
          name: "YouTube",
          matchType: "contains",
          pattern: "youtube.com",
          profileId: "profile-youtube",
          isEnabled: true
        },
        {
          id: "rule-youtu-be",
          name: "youtu.be",
          matchType: "contains",
          pattern: "youtu.be",
          profileId: "profile-youtube",
          isEnabled: true
        }
      ]
    };
    store.editingProfileId = "profile-youtube";

    const wrapper = mount(SettingsProfiles, {
      attachTo: document.body,
      global: {
        stubs: {
          IconAdd: true,
          IconDelete: true
        }
      }
    });

    const firstRule = wrapper.get(".profile-url-rule");

    expect(firstRule.attributes("draggable")).toBe("true");
    expect(firstRule.text()).not.toContain("Move up");
    expect(firstRule.text()).not.toContain("Move down");
    expect(firstRule.find(".toggle__text").exists()).toBe(false);
    expect(firstRule.element.firstElementChild?.classList.contains("profile-url-rule__toggle")).toBe(true);
  });

  it("edits URL rules directly in each rule row instead of a separate edit form", () => {
    const store = useDesktopStore();
    store.settings = {
      ...createSettings(),
      profiles: [createProfile("profile-default", "Default"), createProfile("profile-youtube", "YouTube")],
      defaultProfileId: "profile-default",
      rules: [
        {
          id: "rule-youtube",
          name: "YouTube",
          matchType: "contains",
          pattern: "youtube.com",
          profileId: "profile-youtube",
          isEnabled: true
        }
      ]
    };
    store.editingProfileId = "profile-youtube";

    const wrapper = mount(SettingsProfiles, {
      attachTo: document.body,
      global: {
        stubs: {
          IconAdd: true,
          IconDelete: true
        }
      }
    });

    const firstRule = wrapper.get(".profile-url-rule");
    const patternInput = firstRule.get<HTMLInputElement>('[data-testid="profile-url-rule-pattern"]');
    const matchTypeSelect = firstRule.get('[data-testid="profile-url-rule-match-type"]');

    expect(wrapper.find(".profile-url-rule-form").exists()).toBe(false);
    expect(firstRule.text()).not.toContain("Edit");
    expect(patternInput.element.value).toBe("youtube.com");
    expect(matchTypeSelect.attributes("role")).toBe("combobox");
    expect(matchTypeSelect.text()).toContain("Contains");
  });

  it("uses compact unlabeled URL rule fields with the pattern label as placeholder", () => {
    const store = useDesktopStore();
    store.settings = {
      ...createSettings(),
      profiles: [createProfile("profile-default", "Default"), createProfile("profile-youtube", "YouTube")],
      defaultProfileId: "profile-default",
      rules: [
        {
          id: "rule-youtube",
          name: "YouTube",
          matchType: "contains",
          pattern: "youtube.com",
          profileId: "profile-youtube",
          isEnabled: true
        }
      ]
    };
    store.editingProfileId = "profile-youtube";

    const wrapper = mount(SettingsProfiles, {
      attachTo: document.body,
      global: {
        stubs: {
          IconAdd: true,
          IconDelete: true
        }
      }
    });

    const firstRule = wrapper.get(".profile-url-rule");
    const select = firstRule.get('[data-testid="profile-url-rule-match-type"]');
    const newRulePattern = wrapper.get<HTMLInputElement>('[data-testid="profile-url-new-rule-pattern"]');

    expect(firstRule.text()).not.toContain("Match Type");
    expect(firstRule.text()).not.toContain("Pattern");
    expect(select.classes()).toContain("profile-url-rule__match-select");
    expect(newRulePattern.attributes("placeholder")).toBe("Pattern");
    expect(newRulePattern.element.value).toBe("");
  });

  it("adds a URL rule from the inline new-rule input on blur without an add button", async () => {
    const store = useDesktopStore();
    store.settings = {
      ...createSettings(),
      profiles: [createProfile("profile-default", "Default"), createProfile("profile-youtube", "YouTube")],
      defaultProfileId: "profile-default",
      rules: []
    };
    store.editingProfileId = "profile-youtube";
    Object.defineProperty(window, "usp", {
      configurable: true,
      value: {
        updateSettings: vi.fn(async () => store.settings)
      }
    });

    const wrapper = mount(SettingsProfiles, {
      attachTo: document.body,
      global: {
        stubs: {
          IconAdd: true,
          IconDelete: true
        }
      }
    });

    const newRulePattern = wrapper.get<HTMLInputElement>('[data-testid="profile-url-new-rule-pattern"]');
    await newRulePattern.setValue("music.youtube.com");
    await newRulePattern.trigger("blur");

    expect(wrapper.text()).not.toContain("Add URL Rule");
    expect(store.settings.rules).toEqual([
      expect.objectContaining({
        matchType: "contains",
        pattern: "music.youtube.com",
        profileId: "profile-youtube",
        isEnabled: true
      })
    ]);
    expect((newRulePattern.element as HTMLInputElement).value).toBe("");
  });

  it("shows a confirm icon in the unsaved URL rule action slot", async () => {
    const store = useDesktopStore();
    store.settings = {
      ...createSettings(),
      profiles: [createProfile("profile-default", "Default"), createProfile("profile-youtube", "YouTube")],
      defaultProfileId: "profile-default",
      rules: [
        {
          id: "rule-youtube",
          name: "YouTube",
          matchType: "contains",
          pattern: "youtube.com",
          profileId: "profile-youtube",
          isEnabled: true
        }
      ]
    };
    store.editingProfileId = "profile-youtube";
    Object.defineProperty(window, "usp", {
      configurable: true,
      value: {
        updateSettings: vi.fn(async () => store.settings)
      }
    });

    const wrapper = mount(SettingsProfiles, {
      attachTo: document.body,
      global: {
        stubs: {
          IconAdd: true,
          IconCheck: true,
          IconDelete: true
        }
      }
    });

    const savedRule = wrapper.get(".profile-url-rule:not(.profile-url-rule--new)");
    const newRule = wrapper.get(".profile-url-rule--new");
    const newRulePattern = newRule.get<HTMLInputElement>('[data-testid="profile-url-new-rule-pattern"]');

    expect(savedRule.get('[aria-label="Delete"]').exists()).toBe(true);
    expect(newRule.find('[aria-label="Delete"]').exists()).toBe(false);
    expect(newRule.get('[aria-label="Confirm URL Rule"]').exists()).toBe(true);

    await newRulePattern.setValue("youtu.be");
    await newRule.get('[aria-label="Confirm URL Rule"]').trigger("click");

    expect(store.settings.rules.map((rule) => rule.pattern)).toEqual(["youtube.com", "youtu.be"]);
  });
});
