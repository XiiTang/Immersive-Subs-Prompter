import { createPinia, setActivePinia } from "pinia";
import { mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
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
      autoHideActiveZoneHeight: 80,
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
    mediaServer: {
      enabled: false,
      configs: []
    },
    transcription: {
      enabled: true,
      activeConfigId: null,
      configs: []
    },
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
    expect(fontSelect.element.tagName).toBe("SELECT");
    expect(fontSelect.findAll("option").length).toBeGreaterThan(1);
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

    expect(toggle.element.tagName).toBe("INPUT");
    expect(toggle.attributes("type")).toBe("checkbox");
    expect((toggle.element as HTMLInputElement).checked).toBe(true);
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
});
