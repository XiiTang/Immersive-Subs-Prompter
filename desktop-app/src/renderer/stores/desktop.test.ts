import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppSettings, DesktopState, RendererApi } from "../preload.cts";
import { useDesktopStore } from "./desktop";

function createTrack(id: string) {
  return {
    id,
    sourceFile: `${id}.vtt`,
    cues: [
      { start: 0, end: 1000, text: `${id}-one` },
      { start: 1000, end: 2000, text: `${id}-two` }
    ]
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
    profiles: [
      {
        id: "profile-default",
        name: "Default",
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
      },
      {
        id: "profile-bilibili",
        name: "Bilibili",
        description: null,
        settings: {
          subtitleFontFamily: '"PingFang SC", sans-serif',
          subtitleFontSize: 26,
          subtitleAutoHideMetaRow: true,
          subtitlePrimarySecondaryGap: 0,
          subtitleLineHeight: 1,
          subtitlePrimaryColor: "#ffffff",
          subtitleSecondaryColor: "#cccccc",
          subtitleActivePrimaryColor: "#ff0000",
          subtitleActiveSecondaryColor: "#00ff00",
          ytDlpArgs: "",
          subtitleAutoScrollTimeout: 3,
          subtitleScrollPosition: 44,
          subtitleBlockGap: 12,
          primarySubtitlePriority: [],
          secondarySubtitlePriority: []
        }
      }
    ],
    defaultProfileId: "profile-default",
    rules: [
      {
        id: "rule-bilibili",
        name: "Bilibili",
        pattern: "bilibili",
        matchType: "contains",
        profileId: "profile-bilibili",
        isEnabled: true
      }
    ],
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
  const primaryTrack = createTrack("primary");
  const secondaryTrack = createTrack("secondary");

  return {
    connectionCount: 1,
    activeTabId: 1,
    pageUrl: "https://www.bilibili.com/video/BV1xx411c7mD",
    videoUrl: "https://www.bilibili.com/video/BV1xx411c7mD",
    title: "Demo",
    site: "bilibili",
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
    subtitleTracks: [primaryTrack, secondaryTrack],
    selectedPrimarySubtitleId: primaryTrack.id,
    selectedSecondarySubtitleId: secondaryTrack.id,
    primarySubtitles: primaryTrack,
    secondarySubtitles: secondaryTrack,
    appliedProfileId: "profile-bilibili",
    appliedProfileName: "Bilibili",
    appliedRuleId: "rule-bilibili",
    appliedRuleName: "Bilibili",
    appliedRulePattern: "bilibili",
    appliedRuleMatchType: "contains",
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

function installRendererApi(state: DesktopState, settings: AppSettings) {
  const api: Partial<RendererApi> = {
    getInitialState: vi.fn().mockResolvedValue(state),
    getSettings: vi.fn().mockResolvedValue(settings),
    getCacheStats: vi.fn().mockResolvedValue({
      totalEntries: 0,
      totalSize: 0,
      oldestEntry: null,
      newestEntry: null
    }),
    onStateChange: vi.fn(),
    onPlayback: vi.fn(),
    onLoopCleared: vi.fn(),
    onSettingsChange: vi.fn()
  };

  Object.defineProperty(window, "usp", {
    configurable: true,
    value: api
  });
}

describe("desktop store profile selection", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.restoreAllMocks();
  });

  it("initializes the settings editor to the currently applied profile", async () => {
    installRendererApi(createDesktopState(), createSettings());

    const store = useDesktopStore();
    await store.initialize();

    expect(store.editingProfileId).toBe("profile-bilibili");
  });

  it("re-focuses the settings editor on the currently applied profile when opening settings", () => {
    const store = useDesktopStore();
    store.settings = createSettings();
    store.desktopState = createDesktopState();
    store.editingProfileId = "profile-default";

    store.setSettingsOpen(true);

    expect(store.editingProfileId).toBe("profile-bilibili");
  });

  it("reuses transcript blocks across pure playback updates", () => {
    const store = useDesktopStore();
    store.settings = createSettings();
    store.desktopState = createDesktopState();
    store.playback = store.desktopState.playback;

    const initialBlocks = store.transcriptBlocks;

    const nextPlayback = {
      ...store.playback!,
      currentTime: 500,
      lastUpdate: Date.now()
    };
    store.playback = nextPlayback;
    store.desktopState = {
      ...store.desktopState!,
      playback: nextPlayback
    };

    expect(store.transcriptBlocks).toBe(initialBlocks);
  });
});
