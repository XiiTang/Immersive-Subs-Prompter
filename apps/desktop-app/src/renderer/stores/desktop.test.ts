import { createPinia, setActivePinia } from "pinia";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
    profiles: [
      {
        id: "profile-default",
        name: "Default",
        description: null,
        settings: {
          primarySubtitleFontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
          primarySubtitleFontSize: 14,
          secondarySubtitleFontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
          secondarySubtitleFontSize: 13,
          subtitleTimestampFontSize: 11,
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
          primarySubtitleFontFamily: '"PingFang SC", sans-serif',
          primarySubtitleFontSize: 26,
          secondarySubtitleFontFamily: '"PingFang SC", sans-serif',
          secondarySubtitleFontSize: 25,
          subtitleTimestampFontSize: 11,
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
        profileId: "profile-bilibili"
      }
    ],
    plugins: {
      "official.jellyfinemby": {
        config: {
          servers: []
        }
      }
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
    networkListeners: [],
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
  let pluginCatalogListener: ((catalog: unknown[]) => void) | null = null;
  const api: Partial<RendererApi> = {
    getInitialState: vi.fn().mockResolvedValue(state),
    getSettings: vi.fn().mockResolvedValue(settings),
    getCacheStats: vi.fn().mockResolvedValue({
      totalEntries: 0,
      totalSize: 0,
      oldestEntry: null,
      newestEntry: null
    }),
    getPluginCatalog: vi.fn().mockResolvedValue([]),
    updateSettings: vi.fn(async (partial: Partial<AppSettings>) => ({
      ...settings,
      ...partial
    })),
    onStateChange: vi.fn(),
    onPlayback: vi.fn(),
    onLoopCleared: vi.fn(),
    onSettingsChange: vi.fn(),
    onPluginCatalogChange: vi.fn((listener: (catalog: unknown[]) => void) => {
      pluginCatalogListener = listener;
    }),
    openSettingsWindow: vi.fn().mockResolvedValue({ success: true })
  };

  Object.defineProperty(window, "usp", {
    configurable: true,
    value: api
  });

  return {
    emitPluginCatalog(catalog: unknown[]) {
      pluginCatalogListener?.(catalog);
    }
  };
}

describe("desktop store profile selection", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("initializes the settings editor to the currently applied profile", async () => {
    installRendererApi(createDesktopState(), createSettings());

    const store = useDesktopStore();
    await store.initialize();

    expect(store.editingProfileId).toBe("profile-bilibili");
  });

  it("does not expose an embedded settings-open flag in the store state", () => {
    installRendererApi(createDesktopState(), createSettings());
    const store = useDesktopStore();

    expect("isSettingsOpen" in store.$state).toBe(false);
    expect(typeof window.usp.openSettingsWindow).toBe("function");
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

  it("updates plugin catalog from main-process broadcasts", async () => {
    const bridge = installRendererApi(createDesktopState(), createSettings());

    const store = useDesktopStore();
    await store.initialize();

    expect(store.pluginCatalog).toEqual([]);

    bridge.emitPluginCatalog([
      {
        id: "official.transcription",
        version: "1.0.0",
        displayName: "Speech Transcription",
        description: "Transcribe video audio.",
        enabled: true,
        status: "enabled",
        error: null,
        settings: [
          {
            id: "official.transcription.settings",
            title: "Speech Transcription",
            componentId: "official.transcription.settings"
          }
        ]
      }
    ]);

    expect(store.pluginCatalog).toHaveLength(1);
    expect(store.pluginCatalog[0]?.enabled).toBe(true);
  });

  it("requires main-sanitized transcription plugin settings", () => {
    const store = useDesktopStore();
    const settings = createSettings();
    store.settings = {
      ...settings,
      plugins: {}
    };

    expect(() => store.getTranscriptionPluginConfig()).toThrow(
      "Missing sanitized plugin config: official.transcription"
    );
  });

  it("rolls back optimistic settings when updateSettings rejects", async () => {
    const store = useDesktopStore();
    const original = createSettings();
    store.settings = original;
    vi.stubGlobal("window", {
      usp: {
        updateSettings: vi.fn(async () => {
          throw new Error("At least one network endpoint is required");
        })
      }
    });

    await store.updateSettings({
      network: {
        ...original.network,
        endpoints: []
      }
    });

    expect(store.settings).toEqual(original);
  });

  it("defers high-frequency profile setting persistence while keeping local settings immediate", async () => {
    vi.useFakeTimers();
    const store = useDesktopStore();
    store.settings = createSettings();
    store.editingProfileId = "profile-default";
    const updateSettings = vi.fn(async (partial: Partial<AppSettings>) => ({
      ...store.settings!,
      ...partial
    }));
    vi.stubGlobal("window", {
      usp: {
        updateSettings
      }
    });

    store.updateProfileSetting("subtitleScrollPosition", 40, { persist: "deferred" });
    store.updateProfileSetting("subtitleScrollPosition", 75, { persist: "deferred" });

    expect(store.editingProfileSettings.subtitleScrollPosition).toBe(75);
    expect(updateSettings).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(149);

    expect(updateSettings).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);

    expect(updateSettings).toHaveBeenCalledTimes(1);
    expect(updateSettings.mock.calls[0]?.[0].profiles?.[0]?.settings.subtitleScrollPosition).toBe(75);
  });

  it("flushes deferred profile setting persistence without waiting for the debounce", async () => {
    vi.useFakeTimers();
    const store = useDesktopStore();
    store.settings = createSettings();
    store.editingProfileId = "profile-default";
    const updateSettings = vi.fn(async (partial: Partial<AppSettings>) => ({
      ...store.settings!,
      ...partial
    }));
    vi.stubGlobal("window", {
      usp: {
        updateSettings
      }
    });

    store.updateProfileSetting("subtitleBlockGap", 24, { persist: "deferred" });
    await store.flushDeferredSettingsPersistence();

    expect(updateSettings).toHaveBeenCalledTimes(1);
    expect(updateSettings.mock.calls[0]?.[0].profiles?.[0]?.settings.subtitleBlockGap).toBe(24);

    await vi.advanceTimersByTimeAsync(200);

    expect(updateSettings).toHaveBeenCalledTimes(1);
  });

  it("includes media server counts in the connection label only when Jellyfin / Emby is enabled", () => {
    const store = useDesktopStore();
    store.settings = {
      ...createSettings(),
      plugins: {
        "official.jellyfinemby": {
          config: {
            servers: [
              {
                id: "server-1",
                name: "Home",
                serverUrl: "http://server.local:8096",
                apiKey: "key",
                webSocketPath: "/socket",
                enabled: true
              }
            ]
          }
        }
      }
    } as never;
    store.desktopState = createDesktopState();
    store.pluginCatalog = [
      {
        id: "official.jellyfinemby",
        version: "1.0.0",
        displayName: "Jellyfin / Emby",
        description: "Sync playback and subtitles from Jellyfin or Emby media servers.",
        enabled: false,
        status: "disabled",
        error: null,
        settings: []
      }
    ];

    expect(store.connectionLabel).toBe("Extension: 1");

    store.pluginCatalog = [{ ...store.pluginCatalog[0]!, enabled: true, status: "enabled" }];

    expect(store.connectionLabel).toBe("Extension: 1 · Media Server: 1");
  });

  it("reorders profiles and removes a deleted profile's URL rules", () => {
    const store = useDesktopStore();
    store.settings = createSettings();

    store.reorderProfile(1, 0);

    expect(store.settings?.profiles.map((profile) => profile.id)).toEqual([
      "profile-bilibili",
      "profile-default"
    ]);

    store.deleteProfile("profile-bilibili");

    expect(store.settings?.profiles.map((profile) => profile.id)).toEqual(["profile-default"]);
    expect(store.settings?.rules).toEqual([]);
  });

  it("keeps the fallback profile at the bottom when profiles are reordered", () => {
    const store = useDesktopStore();
    const settings = createSettings();
    const youtubeProfile = {
      ...settings.profiles[1]!,
      id: "profile-youtube",
      name: "YouTube"
    };
    store.settings = {
      ...settings,
      profiles: [settings.profiles[0]!, settings.profiles[1]!, youtubeProfile]
    };

    store.reorderProfile(1, 0);

    expect(store.settings?.profiles.map((profile) => profile.id)).toEqual([
      "profile-bilibili",
      "profile-youtube",
      "profile-default"
    ]);

    store.reorderProfile(2, 0);

    expect(store.settings?.profiles.map((profile) => profile.id)).toEqual([
      "profile-bilibili",
      "profile-youtube",
      "profile-default"
    ]);
  });

  it("adds and duplicates profiles above the fallback profile", () => {
    const store = useDesktopStore();
    const settings = createSettings();
    store.settings = {
      ...settings,
      profiles: [settings.profiles[1]!, settings.profiles[0]!]
    };
    store.editingProfileId = "profile-bilibili";

    store.addProfile();

    expect(store.settings?.profiles.at(-1)?.id).toBe("profile-default");
    expect(store.settings?.profiles.at(-2)?.name).toBe("Profile 3");

    store.duplicateProfile();

    expect(store.settings?.profiles.at(-1)?.id).toBe("profile-default");
    expect(store.settings?.profiles.map((profile) => profile.id)).toContain("profile-bilibili");
  });

  it("reorders URL rules within one profile without moving other profile rules", () => {
    const store = useDesktopStore();
    store.settings = {
      ...createSettings(),
      rules: [
        {
          id: "rule-other",
          name: "Other",
          pattern: "example.com",
          profileId: "profile-default"
        },
        {
          id: "rule-first",
          name: "First",
          pattern: "bilibili.com",
          profileId: "profile-bilibili"
        },
        {
          id: "rule-second",
          name: "Second",
          pattern: "b23.tv",
          profileId: "profile-bilibili"
        }
      ]
    };

    store.reorderProfileRule("profile-bilibili", 1, 0);

    expect(store.settings?.rules.map((rule) => rule.id)).toEqual([
      "rule-other",
      "rule-second",
      "rule-first"
    ]);
  });
});
