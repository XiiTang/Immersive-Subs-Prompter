import { createPinia, setActivePinia } from "pinia";
import { flushPromises, mount } from "@vue/test-utils";
import { defineComponent, h, nextTick } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppSettings, DesktopState, ProfileDefinition, SubtitleTrack } from "../../../main/types.js";
import SubtitleView from "./SubtitleView.vue";
import TranscriptSurface from "./TranscriptSurface.vue";
import { useDesktopStore } from "../../stores/desktop";
import type { WordLookupResult } from "../../plugins/wordLookupTypes";
import { DEFAULT_WORD_LOOKUP_PLUGIN_CONFIG } from "../../../common/wordLookupDefaults.js";

const TEST_AUTHOR = { id: "test", name: "Test" };
const TRANSCRIPTION_PLUGIN_KEY = "test/transcription";
const WORD_LOOKUP_PLUGIN_KEY = "test/word-lookup";
const JELLYFINEMBY_PLUGIN_KEY = "test/jellyfinemby";

const topControlPanelStub = defineComponent({
  name: "TopControlPanelStub",
  props: {
    transcriptionEnabled: {
      type: Boolean,
      default: false
    },
    transcriptionConfigs: {
      type: Array,
      default: () => []
    },
    statusBanner: {
      type: Object,
      default: () => ({ text: "", tone: "info" })
    }
  },
  render() {
    return h("div", { class: "top-control-panel-stub" }, [
      h("div", { "data-testid": "transcription-enabled" }, String(this.transcriptionEnabled)),
      h("div", { "data-testid": "transcription-config-count" }, String(this.transcriptionConfigs.length)),
      h("div", { "data-testid": "status-banner-tone" }, String((this.statusBanner as any).tone)),
      h("div", { "data-testid": "status-banner-text" }, String((this.statusBanner as any).text))
    ]);
  }
});

const tallTopControlPanelStub = defineComponent({
  name: "TallTopControlPanelStub",
  render() {
    return h("section", { class: "top-control-panel top-control-panel-stub" });
  }
});

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
      primarySubtitleFontFamily: 'Georgia, "Times New Roman", serif',
      primarySubtitleFontSize: 20,
      secondarySubtitleFontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
      secondarySubtitleFontSize: 18,
      subtitleTimestampFontSize: 11,
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

function createTranscriptionPluginConfig(): Record<string, unknown> {
  return {
    provider: "whisper-api",
    baseUrl: "https://api.openai.com/v1",
    apiKey: "",
    model: "whisper-1",
    language: "",
    prompt: "",
    enableWordTimestamps: false,
    extraParamsJson: "{}",
    ytDlpArgs: "",
    fasterWhisperBinary: "faster-whisper",
    fasterWhisperModel: "base",
    fasterWhisperModelDir: "",
    fasterWhisperDevice: "cpu",
    fasterWhisperVadFilter: true,
    fasterWhisperVadThreshold: 0.5,
    fasterWhisperVadMethod: "",
    fasterWhisperUseKim2: false
  };
}

function createSettings(): AppSettings {
  return {
    global: {
      autoLaunch: false,
      toggleWindowShortcut: "CommandOrControl+Shift+S",
      gameProcessBlacklist: [],
      autoHidePanels: false,
      alwaysOnTop: "off",
      panelOpacity: 100,
      language: "en",
      appearance: {
        theme: "system"
      }
    },
    network: {
      endpoints: [{ id: "default", host: "127.0.0.1", port: 4312 }],
      authToken: "0123456789abcdef0123456789abcdef"
    },
    profiles: [createProfile()],
    defaultProfileId: "profile-1",
    rules: [],
    plugins: {
      [JELLYFINEMBY_PLUGIN_KEY]: { config: { servers: [] } },
      [TRANSCRIPTION_PLUGIN_KEY]: {
        config: createTranscriptionPluginConfig()
      },
      [WORD_LOOKUP_PLUGIN_KEY]: {
        config: {
          ...DEFAULT_WORD_LOOKUP_PLUGIN_CONFIG,
          panelWidth: DEFAULT_WORD_LOOKUP_PLUGIN_CONFIG.panelWidth,
          panelHeight: DEFAULT_WORD_LOOKUP_PLUGIN_CONFIG.panelHeight
        } as unknown as Record<string, unknown>
      }
    },
    cache: {
      enabled: false,
      path: "",
      retentionDays: 30
    }
  };
}

function createDesktopState(options: { withSecondary?: boolean } = {}): DesktopState {
  const withSecondary = options.withSecondary ?? true;
  const primary = createTrack("primary", [
    { start: 0, end: 1000, text: "alpha beta" },
    { start: 1000, end: 2000, text: "gamma delta" },
    { start: 2000, end: 3000, text: "third line with enough text to wrap inside the transcript viewport" },
    { start: 3000, end: 4000, text: "fourth line with enough text to keep the reader scrollable" },
    { start: 4000, end: 5000, text: "fifth line extends the transcript for scroll position assertions" }
  ]);
  const secondary = withSecondary
    ? createTrack("secondary", [
      { start: 0, end: 1000, text: "第一行" },
      { start: 1000, end: 2000, text: "第二行" },
      { start: 2000, end: 3000, text: "第三行副字幕" },
      { start: 3000, end: 4000, text: "第四行副字幕" },
      { start: 4000, end: 5000, text: "第五行副字幕" }
    ])
    : null;

  return {
    connectionCount: 1,
    networkListeners: [],
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
      loop: null
    },
    subtitleTracks: secondary ? [primary, secondary] : [primary],
    selectedPrimarySubtitleId: primary.id,
    selectedSecondarySubtitleId: secondary?.id ?? null,
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

  it("renders the top control panel", async () => {
    const store = useDesktopStore();
    store.settings = createSettings();
    store.desktopState = createDesktopState();
    store.playback = store.desktopState.playback;
    store.editingProfileId = "profile-1";

    const wrapper = mount(SubtitleView, {
      attachTo: document.body,
      global: {
        stubs: {
          TopControlPanel: topControlPanelStub
        }
      }
    });

    await nextTick();

    expect(wrapper.find(".top-control-panel-stub").exists()).toBe(true);

    wrapper.unmount();
  });

  it("passes semantic status tones to the top control panel", async () => {
    const store = useDesktopStore();
    store.settings = createSettings();
    store.desktopState = {
      ...createDesktopState(),
      status: "error",
      error: "Timed out"
    };
    store.playback = store.desktopState.playback;
    store.editingProfileId = "profile-1";

    const wrapper = mount(SubtitleView, {
      attachTo: document.body,
      global: {
        stubs: {
          TopControlPanel: topControlPanelStub
        }
      }
    });

    await nextTick();

    expect(wrapper.get('[data-testid="status-banner-tone"]').text()).toBe("danger");
    expect(wrapper.get('[data-testid="status-banner-text"]').text()).toContain("Timed out");

    wrapper.unmount();
  });

  it("keeps the transcript surface geometry independent from the control cap height", async () => {
    const clientWidthDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientWidth");
    const clientHeightDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientHeight");
    Object.defineProperty(HTMLElement.prototype, "clientWidth", { configurable: true, get: () => 180 });
    Object.defineProperty(HTMLElement.prototype, "clientHeight", {
      configurable: true,
      get() {
        if (this.classList?.contains("top-control-panel-stub")) {
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
          TopControlPanel: tallTopControlPanelStub
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
          TopControlPanel: topControlPanelStub
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

    expect(wrapper.getComponent(TranscriptSurface).props("primaryFontFamily")).toContain("Georgia");
    expect(wrapper.getComponent(TranscriptSurface).props("primaryFontSize")).toBe(20);
    expect(wrapper.getComponent(TranscriptSurface).props("secondaryFontFamily")).toContain("Helvetica Neue");
    expect(wrapper.getComponent(TranscriptSurface).props("secondaryFontSize")).toBe(18);
    expect(initialPrimaryLine.style.fontFamily).toContain("Georgia");
    expect(initialPrimaryLine.style.fontSize).toBe("20px");
    expect(initialSecondaryLine.style.fontFamily).toContain("Helvetica Neue");
    expect(initialSecondaryLine.style.fontSize).toBe("18px");
    expect(initialPrimaryLine.style.color).toBe("rgb(119, 136, 153)");
    expect(initialSecondaryLine.style.color).toBe("rgb(170, 187, 204)");

    store.settings!.profiles[0] = {
      ...store.settings!.profiles[0]!,
      settings: {
        ...store.settings!.profiles[0]!.settings,
        primarySubtitleFontFamily: '"Times New Roman", Times, serif',
        primarySubtitleFontSize: 24,
        secondarySubtitleFontFamily: 'Arial, "Helvetica Neue", Helvetica, sans-serif',
        secondarySubtitleFontSize: 17,
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

    expect(wrapper.getComponent(TranscriptSurface).props("primaryFontFamily")).toContain("Times New Roman");
    expect(wrapper.getComponent(TranscriptSurface).props("primaryFontSize")).toBe(24);
    expect(wrapper.getComponent(TranscriptSurface).props("secondaryFontFamily")).toContain("Arial");
    expect(wrapper.getComponent(TranscriptSurface).props("secondaryFontSize")).toBe(17);
    expect(updatedPrimaryLine.style.fontFamily).toContain("Times New Roman");
    expect(updatedPrimaryLine.style.fontSize).toBe("24px");
    expect(updatedPrimaryLine.style.lineHeight).not.toBe(initialPrimaryLineHeight);
    expect(updatedPrimaryLine.style.color).toBe("rgb(255, 0, 0)");
    expect(updatedSecondaryLine.style.fontFamily).toContain("Arial");
    expect(updatedSecondaryLine.style.fontSize).toBe("17px");
    expect(updatedSecondaryLine.style.color).toBe("rgb(0, 255, 0)");
    expect(Number.parseFloat(updatedSecondaryLine.style.top)).toBeGreaterThan(initialSecondaryTop);

    store.settings!.profiles[0] = {
      ...store.settings!.profiles[0]!,
      settings: {
        ...store.settings!.profiles[0]!.settings,
        subtitleScrollPosition: 80
      }
    };

    await nextTick();
    await nextTick();

    expect(wrapper.getComponent(TranscriptSurface).props("scrollPositionRatio")).toBe(0.8);

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
          TopControlPanel: topControlPanelStub
        }
      }
    });

    await nextTick();
    await nextTick();

    expect(wrapper.findAll('[data-testid="cue-action-ab"]').every((button) => button.text() === "AB")).toBe(true);

    await wrapper.get('[data-testid="cue-action-ab"]').trigger("click");
    await nextTick();

    expect(
      wrapper.findAll('[data-testid="cue-action-ab"]').some((button) =>
        button.classes().includes("is-active")
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
        button.classes().includes("is-active")
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

  it("keeps the pending A-B start across playback ticks when no secondary subtitle is selected", async () => {
    const clientWidthDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientWidth");
    const clientHeightDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientHeight");
    Object.defineProperty(HTMLElement.prototype, "clientWidth", { configurable: true, get: () => 180 });
    Object.defineProperty(HTMLElement.prototype, "clientHeight", { configurable: true, get: () => 220 });

    const store = useDesktopStore();
    store.settings = createSettings();
    store.desktopState = createDesktopState({ withSecondary: false });
    store.playback = store.desktopState.playback;
    store.editingProfileId = "profile-1";

    const wrapper = mount(SubtitleView, {
      attachTo: document.body,
      global: {
        stubs: {
          TopControlPanel: topControlPanelStub
        }
      }
    });

    await nextTick();
    await nextTick();

    await wrapper.get('[data-testid="cue-action-ab"]').trigger("click");
    await nextTick();

    expect(wrapper.get('[data-testid="cue-action-ab"]').text()).toBe("A");

    const nextPlayback = {
      ...store.playback!,
      currentTime: 600,
      lastUpdate: Date.now(),
      loop: null
    };
    store.playback = nextPlayback;
    store.desktopState = {
      ...store.desktopState!,
      playback: nextPlayback
    };

    await nextTick();
    await nextTick();

    expect(wrapper.get('[data-testid="cue-action-ab"]').text()).toBe("A");

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
          TopControlPanel: topControlPanelStub
        }
      }
    });

    await nextTick();
    await nextTick();

    const loopPlayback = {
      ...store.playback!,
      currentTime: 3500,
      loop: {
        mode: "single",
        startMs: 0,
        endMs: 1000,
        startCueIndex: 0,
        endCueIndex: 0,
        anchorCueIndex: 0,
        origin: "single-loop",
        status: "running",
        boundaryTransition: "none"
      },
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
        button.classes().includes("is-active")
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

  it("clamps single-cue loop playback to the looped cue so the active highlight does not flicker at the boundary", async () => {
    const clientWidthDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientWidth");
    const clientHeightDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientHeight");
    Object.defineProperty(HTMLElement.prototype, "clientWidth", { configurable: true, get: () => 180 });
    Object.defineProperty(HTMLElement.prototype, "clientHeight", { configurable: true, get: () => 220 });

    const store = useDesktopStore();
    store.settings = createSettings();
    store.desktopState = createDesktopState();
    store.playback = {
      ...store.desktopState.playback,
      currentTime: 1010,
      loop: {
        mode: "single",
        startMs: 0,
        endMs: 1000,
        startCueIndex: 0,
        endCueIndex: 0,
        anchorCueIndex: 0,
        origin: "single-loop",
        status: "running",
        boundaryTransition: "none"
      }
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
          TopControlPanel: topControlPanelStub
        }
      }
    });

    await nextTick();
    await nextTick();

    expect(wrapper.get(".transcript-block--active").attributes("data-transcript-block-id")).toBe("block-0");

    wrapper.unmount();
    if (clientWidthDescriptor) {
      Object.defineProperty(HTMLElement.prototype, "clientWidth", clientWidthDescriptor);
    }
    if (clientHeightDescriptor) {
      Object.defineProperty(HTMLElement.prototype, "clientHeight", clientHeightDescriptor);
    }
  });

  it("wraps A-B loop playback back into the selected range so playback follow keeps moving inside the loop", async () => {
    const clientWidthDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientWidth");
    const clientHeightDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientHeight");
    Object.defineProperty(HTMLElement.prototype, "clientWidth", { configurable: true, get: () => 180 });
    Object.defineProperty(HTMLElement.prototype, "clientHeight", { configurable: true, get: () => 220 });

    const store = useDesktopStore();
    store.settings = createSettings();
    store.desktopState = createDesktopState();
    vi.spyOn(store, "controlVideo").mockResolvedValue(false);
    store.playback = {
      ...store.desktopState.playback,
      currentTime: 2300,
      loop: null
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
          TopControlPanel: topControlPanelStub
        }
      }
    });

    await nextTick();
    await nextTick();

    const abButtons = wrapper.findAll('[data-testid="cue-action-ab"]');
    await abButtons[1]!.trigger("click");
    await nextTick();
    await abButtons[3]!.trigger("click");
    await nextTick();

    const loopPlayback = {
      ...store.playback!,
      currentTime: 4010,
      loop: {
        mode: "ab",
        startMs: 1000,
        endMs: 4000,
        startCueIndex: 1,
        endCueIndex: 3,
        anchorCueIndex: 1,
        origin: "ab-loop",
        status: "running",
        boundaryTransition: "loop-wrap"
      },
      lastUpdate: Date.now()
    };
    store.playback = loopPlayback;
    store.desktopState = {
      ...store.desktopState!,
      playback: loopPlayback
    };

    await nextTick();
    await nextTick();

    expect(wrapper.get(".transcript-block--active").attributes("data-transcript-block-id")).toBe("block-1");

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
          TopControlPanel: topControlPanelStub
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

  it("hides transcription controls when the transcription plugin is not enabled", async () => {
    const store = useDesktopStore();
    store.settings = createSettings();
    store.desktopState = createDesktopState();
    store.playback = store.desktopState.playback;
    store.editingProfileId = "profile-1";
    store.pluginCatalog = [
      {
        pluginKey: TRANSCRIPTION_PLUGIN_KEY,
        id: "transcription",
        author: TEST_AUTHOR,
        version: "1.0.0",
        displayName: "Speech Transcription",
        description: "Transcribe video audio.",
        sourceUrl: "https://plugins.example.test/transcription.json",
        status: "disabled",
        enabled: false,
        error: null,
        permissions: ["transcriptionProvider"],
        contributions: { transcription: true }
      }
    ];

    const wrapper = mount(SubtitleView, {
      attachTo: document.body,
      global: {
        stubs: {
          TopControlPanel: topControlPanelStub
        }
      }
    });

    await nextTick();

    expect(wrapper.get('[data-testid="transcription-enabled"]').text()).toBe("false");
    expect(wrapper.get('[data-testid="transcription-config-count"]').text()).toBe("0");

    store.pluginCatalog = [
      {
        ...store.pluginCatalog[0]!,
        status: "enabled",
        enabled: true
      }
    ];

    await nextTick();

    expect(wrapper.get('[data-testid="transcription-enabled"]').text()).toBe("true");
  });

  it("opens word lookup when the trigger key is pressed after hovering a token", async () => {
    let resolveLookup: (result: WordLookupResult) => void = () => undefined;
    const lookupWord = vi.fn().mockImplementation(() => new Promise<WordLookupResult>((resolve) => {
      resolveLookup = resolve;
    }));
    const lookupResult: WordLookupResult = {
      token: "alpha",
      normalizedToken: "alpha",
      matches: [
        {
          word: "alpha",
          content: "first letter",
          aliases: [],
          fileOrder: 0,
          matchQuality: 0
        }
      ]
    };
    const openWordLookupWindow = vi.fn().mockResolvedValue({ success: true });
    const notifyWordLookupTriggerLeave = vi.fn().mockResolvedValue(undefined);
    const originalUsp = window.usp;
    Object.defineProperty(window, "usp", {
      configurable: true,
      value: {
        ...originalUsp,
        lookupWord,
        openWordLookupWindow,
        notifyWordLookupTriggerLeave,
        openExternal: vi.fn()
      }
    });

    const store = useDesktopStore();
    const settings = createSettings();
    store.settings = {
      ...settings,
      plugins: {
        ...settings.plugins,
        [WORD_LOOKUP_PLUGIN_KEY]: {
          config: {
            wordListPath: "/tmp/words.jsonl",
            modifierKey: "alt",
            panelWidth: 360,
            panelHeight: 300
          }
        }
      }
    };
    store.desktopState = createDesktopState();
    store.playback = store.desktopState.playback;
    store.editingProfileId = "profile-1";
    store.pluginCatalog = [
      {
        pluginKey: WORD_LOOKUP_PLUGIN_KEY,
        id: "word-lookup",
        author: TEST_AUTHOR,
        version: "1.0.0",
        displayName: "Word Lookup",
        description: "Look up words.",
        sourceUrl: "https://plugins.example.test/word-lookup.json",
        status: "enabled",
        enabled: true,
        error: null,
        permissions: ["wordLookupProvider"],
        contributions: { wordLookup: true }
      }
    ];

    const wrapper = mount(SubtitleView, {
      attachTo: document.body,
      global: {
        stubs: {
          TopControlPanel: topControlPanelStub
        }
      }
    });

    await nextTick();
    await nextTick();

    const alphaToken = wrapper.findAll('[data-testid="word-lookup-token"]').find((token) => token.text() === "alpha");
    expect(alphaToken).toBeTruthy();

    await alphaToken!.trigger("mouseenter", { clientX: 120, clientY: 140 });
    expect(lookupWord).not.toHaveBeenCalled();

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Alt", altKey: true }));
    await flushPromises();
    await nextTick();

    expect(lookupWord).toHaveBeenCalledWith("alpha");
    await alphaToken!.trigger("mouseleave");
    expect(openWordLookupWindow).not.toHaveBeenCalled();
    expect(notifyWordLookupTriggerLeave).not.toHaveBeenCalled();

    resolveLookup(lookupResult);
    await flushPromises();
    await nextTick();

    expect(openWordLookupWindow).toHaveBeenCalledWith(expect.objectContaining({
      panelSize: { width: 360, height: 300 },
      matches: [
        {
          word: "alpha",
          content: "first letter",
          aliases: [],
          fileOrder: 0,
          matchQuality: 0
        }
      ],
      anchorRect: expect.objectContaining({
        width: expect.any(Number),
        height: expect.any(Number)
      })
    }));
    expect(document.body.querySelector(".word-lookup-popover")).toBeNull();
    expect(wrapper.find(".word-lookup-popover").exists()).toBe(false);
    expect(notifyWordLookupTriggerLeave).toHaveBeenCalledTimes(1);

    wrapper.unmount();
    Object.defineProperty(window, "usp", {
      configurable: true,
      value: originalUsp
    });
  });

  it("does not treat leaving a previous duplicate token as leaving the current hovered token", async () => {
    const lookupResolvers: Array<(result: WordLookupResult) => void> = [];
    const lookupWord = vi.fn().mockImplementation((token: string) => new Promise<WordLookupResult>((resolve) => {
      lookupResolvers.push(resolve);
    }));
    const lookupResult: WordLookupResult = {
      token: "alpha",
      normalizedToken: "alpha",
      matches: [
        {
          word: "alpha",
          content: "first letter",
          aliases: [],
          fileOrder: 0,
          matchQuality: 0
        }
      ]
    };
    const openWordLookupWindow = vi.fn().mockResolvedValue({ success: true });
    const notifyWordLookupTriggerLeave = vi.fn().mockResolvedValue(undefined);
    const originalUsp = window.usp;
    Object.defineProperty(window, "usp", {
      configurable: true,
      value: {
        ...originalUsp,
        lookupWord,
        openWordLookupWindow,
        notifyWordLookupTriggerLeave,
        openExternal: vi.fn()
      }
    });

    const store = useDesktopStore();
    const desktopState = createDesktopState();
    desktopState.primarySubtitles!.cues[0]!.text = "alpha alpha";
    const settings = createSettings();
    store.settings = {
      ...settings,
      plugins: {
        ...settings.plugins,
        [WORD_LOOKUP_PLUGIN_KEY]: {
          config: {
            wordListPath: "/tmp/words.jsonl",
            modifierKey: "alt",
            panelWidth: 360,
            panelHeight: 300
          }
        }
      }
    };
    store.desktopState = desktopState;
    store.playback = store.desktopState.playback;
    store.editingProfileId = "profile-1";
    store.pluginCatalog = [
      {
        pluginKey: WORD_LOOKUP_PLUGIN_KEY,
        id: "word-lookup",
        author: TEST_AUTHOR,
        version: "1.0.0",
        displayName: "Word Lookup",
        description: "Look up words.",
        sourceUrl: "https://plugins.example.test/word-lookup.json",
        status: "enabled",
        enabled: true,
        error: null,
        permissions: ["wordLookupProvider"],
        contributions: { wordLookup: true }
      }
    ];

    const wrapper = mount(SubtitleView, {
      attachTo: document.body,
      global: {
        stubs: {
          TopControlPanel: topControlPanelStub
        }
      }
    });

    await nextTick();
    await nextTick();

    const alphaTokens = wrapper.findAll('[data-testid="word-lookup-token"]').filter((token) => token.text() === "alpha");
    expect(alphaTokens.length).toBeGreaterThanOrEqual(2);

    await alphaTokens[0]!.trigger("mouseenter", { clientX: 110, clientY: 140, altKey: true });
    await alphaTokens[1]!.trigger("mouseenter", { clientX: 150, clientY: 140, altKey: true });
    await alphaTokens[0]!.trigger("mouseleave");
    lookupResolvers[1]?.(lookupResult);
    await flushPromises();
    await nextTick();

    expect(openWordLookupWindow).toHaveBeenCalledTimes(1);
    expect(notifyWordLookupTriggerLeave).not.toHaveBeenCalled();

    wrapper.unmount();
    Object.defineProperty(window, "usp", {
      configurable: true,
      value: originalUsp
    });
  });
});
