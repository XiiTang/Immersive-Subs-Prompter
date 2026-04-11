import { createPinia, setActivePinia } from "pinia";
import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import { beforeEach, describe, expect, it } from "vitest";
import type { AppSettings, DesktopState, ProfileDefinition, SubtitleTrack } from "../../../main/types.js";
import SubtitleView from "./SubtitleView.vue";
import { useDesktopStore } from "../../stores/desktop";

function createTrack(id: string, cues: SubtitleTrack["cues"]): SubtitleTrack {
  return {
    id,
    sourceFile: `${id}.vtt`,
    cues
  };
}

function createProfile(): ProfileDefinition {
  return {
    id: "profile-1",
    name: "Default",
    description: null,
    settings: {
      subtitleFontFamily: 'Georgia, "Times New Roman", serif',
      subtitleFontSize: 20,
      subtitleAutoHideMetaRow: true,
      subtitlePrimarySecondaryGap: 4,
      subtitleLineHeight: 1.6,
      subtitlePrimaryColor: "#112233",
      subtitleSecondaryColor: "#445566",
      subtitleActivePrimaryColor: "#778899",
      subtitleActiveSecondaryColor: "#aabbcc",
      ytDlpArgs: "",
      subtitleAutoScrollTimeout: 3,
      subtitleScrollPosition: 40,
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

function createDesktopState(): DesktopState {
  const primary = createTrack("primary", [
    { start: 0, end: 1000, text: "alpha beta" },
    { start: 1000, end: 2000, text: "gamma delta" },
    { start: 2000, end: 3000, text: "third line with enough text to wrap inside the transcript viewport" },
    { start: 3000, end: 4000, text: "fourth line with enough text to keep the reader scrollable" },
    { start: 4000, end: 5000, text: "fifth line extends the transcript for scroll position assertions" }
  ]);
  const secondary = createTrack("secondary", [
    { start: 0, end: 1000, text: "第一行" },
    { start: 1000, end: 2000, text: "第二行" },
    { start: 2000, end: 3000, text: "第三行副字幕" },
    { start: 3000, end: 4000, text: "第四行副字幕" },
    { start: 4000, end: 5000, text: "第五行副字幕" }
  ]);

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
      currentTime: 2300,
      duration: 5000,
      playbackRate: 1,
      lastUpdate: Date.now(),
      isLooping: false,
      loopCueIndex: null
    },
    subtitleTracks: [primary, secondary],
    selectedPrimarySubtitleId: primary.id,
    selectedSecondarySubtitleId: secondary.id,
    primarySubtitles: primary,
    secondarySubtitles: secondary,
    appliedProfileId: "profile-1",
    appliedProfileName: "Default",
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
    transcription: null
  };
}

describe("SubtitleView", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("keeps the transcript surface geometry independent from the control cap height", async () => {
    const clientWidthDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientWidth");
    const clientHeightDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientHeight");
    Object.defineProperty(HTMLElement.prototype, "clientWidth", { configurable: true, get: () => 180 });
    Object.defineProperty(HTMLElement.prototype, "clientHeight", {
      configurable: true,
      get() {
        if (this.classList?.contains("video-info-section-stub")) {
          return 96;
        }
        return 220;
      }
    });

    const store = useDesktopStore();
    store.settings = createSettings();
    store.desktopState = createDesktopState();
    store.playback = {
      ...store.desktopState.playback,
      currentTime: 0
    };
    store.desktopState = {
      ...store.desktopState,
      playback: store.playback
    };
    store.editingProfileId = "profile-1";

    const wrapper = mount(SubtitleView, {
      attachTo: document.body,
      global: {
        stubs: {
          VideoInfoSection: {
            template: "<section class='video-info-section video-info-section-stub'></section>"
          }
        }
      }
    });

    await nextTick();
    await nextTick();

    expect(wrapper.get(".transcript-surface").attributes("style")).not.toContain("top:");

    wrapper.unmount();
    if (clientWidthDescriptor) {
      Object.defineProperty(HTMLElement.prototype, "clientWidth", clientWidthDescriptor);
    }
    if (clientHeightDescriptor) {
      Object.defineProperty(HTMLElement.prototype, "clientHeight", clientHeightDescriptor);
    }
  });

  it("propagates active profile typography, colors, gap, and scroll position into the transcript surface", async () => {
    const clientWidthDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientWidth");
    const clientHeightDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientHeight");
    Object.defineProperty(HTMLElement.prototype, "clientWidth", { configurable: true, get: () => 180 });
    Object.defineProperty(HTMLElement.prototype, "clientHeight", { configurable: true, get: () => 220 });

    const store = useDesktopStore();
    store.settings = createSettings();
    store.desktopState = createDesktopState();
    store.playback = store.desktopState.playback;
    store.editingProfileId = "profile-1";

    const wrapper = mount(SubtitleView, {
      attachTo: document.body,
      global: {
        stubs: {
          VideoInfoSection: {
            template: "<div class='video-info-section-stub'></div>"
          }
        }
      }
    });

    await nextTick();
    await nextTick();

    const viewport = wrapper.get(".transcript-surface__viewport").element as HTMLElement;
    const initialScrollTop = viewport.scrollTop;
    const initialPrimaryLine = wrapper.get(
      ".transcript-block--active .transcript-block__line--primary"
    ).element as HTMLElement;
    const initialSecondaryLine = wrapper.get(
      ".transcript-block--active .transcript-block__line--secondary"
    ).element as HTMLElement;
    const initialSecondaryTop = Number.parseFloat(initialSecondaryLine.style.top);
    const initialPrimaryLineHeight = initialPrimaryLine.style.lineHeight;

    expect(initialPrimaryLine.style.fontFamily).toContain("Georgia");
    expect(initialPrimaryLine.style.fontSize).toBe("20px");
    expect(initialPrimaryLine.style.color).toBe("rgb(119, 136, 153)");
    expect(initialSecondaryLine.style.color).toBe("rgb(170, 187, 204)");

    store.settings!.profiles[0] = {
      ...store.settings!.profiles[0]!,
      settings: {
        ...store.settings!.profiles[0]!.settings,
        subtitleFontFamily: '"Times New Roman", Times, serif',
        subtitleFontSize: 24,
        subtitlePrimarySecondaryGap: 18,
        subtitleLineHeight: 2,
        subtitleActivePrimaryColor: "#ff0000",
        subtitleActiveSecondaryColor: "#00ff00"
      }
    };

    await nextTick();
    await nextTick();

    const updatedPrimaryLine = wrapper.get(
      ".transcript-block--active .transcript-block__line--primary"
    ).element as HTMLElement;
    const updatedSecondaryLine = wrapper.get(
      ".transcript-block--active .transcript-block__line--secondary"
    ).element as HTMLElement;

    expect(updatedPrimaryLine.style.fontFamily).toContain("Times New Roman");
    expect(updatedPrimaryLine.style.fontSize).toBe("24px");
    expect(updatedPrimaryLine.style.lineHeight).not.toBe(initialPrimaryLineHeight);
    expect(updatedPrimaryLine.style.color).toBe("rgb(255, 0, 0)");
    expect(updatedSecondaryLine.style.color).toBe("rgb(0, 255, 0)");
    expect(Number.parseFloat(updatedSecondaryLine.style.top)).toBeGreaterThan(initialSecondaryTop);

    const scrollTopBeforePositionChange = viewport.scrollTop;

    store.settings!.profiles[0] = {
      ...store.settings!.profiles[0]!,
      settings: {
        ...store.settings!.profiles[0]!.settings,
        subtitleScrollPosition: 80
      }
    };

    await nextTick();
    await nextTick();

    expect(viewport.scrollTop).not.toBe(scrollTopBeforePositionChange);

    wrapper.unmount();
    if (clientWidthDescriptor) {
      Object.defineProperty(HTMLElement.prototype, "clientWidth", clientWidthDescriptor);
    }
    if (clientHeightDescriptor) {
      Object.defineProperty(HTMLElement.prototype, "clientHeight", clientHeightDescriptor);
    }
  });

  it("keeps the pending A-B start across pure playback ticks", async () => {
    const clientWidthDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientWidth");
    const clientHeightDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientHeight");
    Object.defineProperty(HTMLElement.prototype, "clientWidth", { configurable: true, get: () => 180 });
    Object.defineProperty(HTMLElement.prototype, "clientHeight", { configurable: true, get: () => 220 });

    const store = useDesktopStore();
    store.settings = createSettings();
    store.desktopState = createDesktopState();
    store.playback = store.desktopState.playback;
    store.editingProfileId = "profile-1";

    const wrapper = mount(SubtitleView, {
      attachTo: document.body,
      global: {
        stubs: {
          VideoInfoSection: {
            template: "<div class='video-info-section-stub'></div>"
          }
        }
      }
    });

    await nextTick();
    await nextTick();

    await wrapper.get('[data-testid="cue-action-ab"]').trigger("click");
    await nextTick();

    expect(
      wrapper.findAll('[data-testid="cue-action-ab"]').some((button) =>
        button.classes().includes("transcript-block__ab-btn--active")
      )
    ).toBe(true);

    const nextPlayback = {
      ...store.playback!,
      currentTime: 600,
      lastUpdate: Date.now()
    };
    store.playback = nextPlayback;
    store.desktopState = {
      ...store.desktopState!,
      playback: nextPlayback
    };

    await nextTick();
    await nextTick();

    expect(
      wrapper.findAll('[data-testid="cue-action-ab"]').some((button) =>
        button.classes().includes("transcript-block__ab-btn--active")
      )
    ).toBe(true);

    wrapper.unmount();
    if (clientWidthDescriptor) {
      Object.defineProperty(HTMLElement.prototype, "clientWidth", clientWidthDescriptor);
    }
    if (clientHeightDescriptor) {
      Object.defineProperty(HTMLElement.prototype, "clientHeight", clientHeightDescriptor);
    }
  });

  it("keeps the looped cue rail visible after playback moves to another block", async () => {
    const clientWidthDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientWidth");
    const clientHeightDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientHeight");
    Object.defineProperty(HTMLElement.prototype, "clientWidth", { configurable: true, get: () => 180 });
    Object.defineProperty(HTMLElement.prototype, "clientHeight", { configurable: true, get: () => 220 });

    const store = useDesktopStore();
    store.settings = createSettings();
    store.desktopState = createDesktopState();
    store.playback = store.desktopState.playback;
    store.editingProfileId = "profile-1";

    const wrapper = mount(SubtitleView, {
      attachTo: document.body,
      global: {
        stubs: {
          VideoInfoSection: {
            template: "<div class='video-info-section-stub'></div>"
          }
        }
      }
    });

    await nextTick();
    await nextTick();

    const loopPlayback = {
      ...store.playback!,
      currentTime: 3500,
      isLooping: true,
      loopCueIndex: 0,
      lastUpdate: Date.now()
    };
    store.playback = loopPlayback;
    store.desktopState = {
      ...store.desktopState!,
      playback: loopPlayback
    };

    await nextTick();
    await nextTick();

    expect(
      wrapper.findAll('[data-testid="cue-action-loop"]').some((button) =>
        button.classes().includes("transcript-block__loop-btn--active")
      )
    ).toBe(true);

    wrapper.unmount();
    if (clientWidthDescriptor) {
      Object.defineProperty(HTMLElement.prototype, "clientWidth", clientWidthDescriptor);
    }
    if (clientHeightDescriptor) {
      Object.defineProperty(HTMLElement.prototype, "clientHeight", clientHeightDescriptor);
    }
  });

  it("propagates the profile auto-hide-meta-row setting into transcript blocks", async () => {
    const store = useDesktopStore();
    store.settings = createSettings();
    store.desktopState = createDesktopState();
    store.playback = store.desktopState.playback;
    store.editingProfileId = "profile-1";

    const wrapper = mount(SubtitleView, {
      global: {
        stubs: {
          VideoInfoSection: {
            template: "<div class='video-info-section-stub'></div>"
          }
        }
      }
    });

    await nextTick();
    await nextTick();

    const quietMetaRows = wrapper.findAll('[data-testid="transcript-meta-row"][data-meta-state="quiet"]');
    expect(quietMetaRows.length).toBeGreaterThan(0);
    expect(quietMetaRows[0]?.attributes("data-auto-hide-quiet")).toBe("true");

    store.settings!.profiles[0] = {
      ...store.settings!.profiles[0]!,
      settings: {
        ...store.settings!.profiles[0]!.settings,
        subtitleAutoHideMetaRow: false
      }
    };

    await nextTick();
    await nextTick();

    const updatedQuietMetaRows = wrapper.findAll('[data-testid="transcript-meta-row"][data-meta-state="quiet"]');
    expect(updatedQuietMetaRows.length).toBeGreaterThan(0);
    expect(updatedQuietMetaRows[0]?.attributes("data-auto-hide-quiet")).toBe("false");

    wrapper.unmount();
  });
});
