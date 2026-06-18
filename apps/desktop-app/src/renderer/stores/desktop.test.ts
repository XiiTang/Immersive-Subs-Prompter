import { createPinia, setActivePinia } from "pinia";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDefaultAppSettings, DEFAULT_PROFILE_ID, DEFAULT_PROFILE_SETTINGS } from "../../common/defaultSettings.js";
import type { AppSettings, DesktopState } from "../../main/types";
import type { RendererApi } from "../../preload.cts";
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
  const base = createDefaultAppSettings({
    networkAuthToken: "0123456789abcdef0123456789abcdef"
  });

  return {
    ...base,
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
      },
      autoCheckUpdates: true,
      lastUpdateCheckAt: null
    },
    network: {
      endpoints: [{ id: "default", host: "127.0.0.1", port: 4312 }],
      authToken: "0123456789abcdef0123456789abcdef"
    },
    profiles: [
      {
        id: DEFAULT_PROFILE_ID,
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
          ytDlpArgs: DEFAULT_PROFILE_SETTINGS.ytDlpArgs,
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
        enabled: true,
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
          ytDlpArgs: DEFAULT_PROFILE_SETTINGS.ytDlpArgs,
          subtitleAutoScrollTimeout: 3,
          subtitleScrollPosition: 44,
          subtitleBlockGap: 12,
          primarySubtitlePriority: [],
          secondarySubtitlePriority: []
        }
      }
    ],
    defaultProfileId: DEFAULT_PROFILE_ID,
    rules: [
      {
        id: "rule-bilibili",
        name: "Bilibili",
        pattern: "bilibili",
        profileId: "profile-bilibili"
      }
    ],
    features: base.features,
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
  let releaseStateListener: ((state: unknown) => void) | null = null;
  const api: Partial<RendererApi> = {
    getInitialState: vi.fn().mockResolvedValue(state),
    getSettings: vi.fn().mockResolvedValue(settings),
    getCacheStats: vi.fn().mockResolvedValue({
      totalEntries: 0,
      totalSize: 0,
      oldestEntry: null,
      newestEntry: null
    }),
    getReleaseState: vi.fn().mockResolvedValue({
      status: "idle",
      currentVersion: "1.0.0",
      latestVersion: null,
      checkedAt: null,
      updateInfo: null,
      progress: null,
      error: null
    }),
    checkForUpdates: vi.fn(),
    downloadReleaseUpdate: vi.fn().mockResolvedValue({
      status: "downloaded",
      currentVersion: "1.0.0",
      latestVersion: "1.2.0",
      checkedAt: Date.now(),
      updateInfo: null,
      progress: null,
      error: null
    }),
    installReleaseUpdate: vi.fn().mockResolvedValue({ ok: true }),
    updateSettings: vi.fn(async (partial: Partial<AppSettings>) => ({
      ...settings,
      ...partial
    })),
    onStateChange: vi.fn(),
    onPlayback: vi.fn(),
    onLoopCleared: vi.fn(),
    onSettingsChange: vi.fn(),
    onReleaseStateChange: vi.fn((listener: (state: unknown) => void) => {
      releaseStateListener = listener;
    }),
    openSettingsWindow: vi.fn().mockResolvedValue({ success: true })
  };

  Object.defineProperty(window, "usp", {
    configurable: true,
    value: api
  });

  return {
    emitReleaseState(state: unknown) {
      releaseStateListener?.(state);
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

  it("does not forward renderer-supplied URLs or paths to release updater bridges", async () => {
    installRendererApi(createDesktopState(), createSettings());
    const store = useDesktopStore();

    await Reflect.apply(store.downloadReleaseUpdate, store, ["https://attacker.example/app.dmg"]);
    await Reflect.apply(store.installReleaseUpdate, store, ["/tmp/attacker-installer"]);

    expect(window.usp.downloadReleaseUpdate).toHaveBeenCalledWith();
    expect(window.usp.installReleaseUpdate).toHaveBeenCalledWith();
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

  it("initializes from renderer state and settings APIs", async () => {
    installRendererApi(createDesktopState(), createSettings());

    const store = useDesktopStore();
    await store.initialize();

    expect(window.usp.getInitialState).toHaveBeenCalledWith();
    expect(window.usp.getSettings).toHaveBeenCalledWith();
    expect(store.initError).toBeNull();
    expect(store.settings?.features.wordLookup.enabled).toBe(false);
  });

  it("updates feature enabled state through settings", async () => {
    const settings = createSettings();
    installRendererApi(createDesktopState(), settings);

    const store = useDesktopStore();
    await store.initialize();

    await store.setFeatureEnabled("wordLookup", true);

    expect(window.usp.updateSettings).toHaveBeenCalledWith({
      features: {
        wordLookup: {
          enabled: true,
          config: settings.features.wordLookup.config
        }
      }
    });
  });

  it("sets active transcription config", async () => {
    const store = useDesktopStore();
    store.settings = createSettings();
    const updateSettings = vi.spyOn(store, "updateSettings").mockResolvedValue();

    await store.setActiveTranscriptionConfig("config-b");

    expect(updateSettings).toHaveBeenCalledWith({
      features: {
        transcription: {
          ...store.settings!.features.transcription,
          activeConfigId: "config-b"
        }
      }
    });
  });

  it("updates transcription configs as a complete list", async () => {
    const store = useDesktopStore();
    store.settings = createSettings();
    const updateSettings = vi.spyOn(store, "updateSettings").mockResolvedValue();
    const nextConfig = {
      ...store.settings!.features.transcription.configs[0]!,
      name: "Updated"
    };

    await store.setTranscriptionConfigs([nextConfig], nextConfig.id);

    expect(updateSettings).toHaveBeenCalledWith({
      features: {
        transcription: {
          enabled: store.settings!.features.transcription.enabled,
          activeConfigId: nextConfig.id,
          configs: [nextConfig]
        }
      }
    });
  });

  it("adds Jellyfin / Emby server configs", async () => {
    const store = useDesktopStore();
    store.settings = createSettings();
    const updateSettings = vi.spyOn(store, "updateSettings").mockResolvedValue();

    const id = await store.addJellyfinEmbyServer();

    expect(id).toMatch(/^jellyfin-emby-/);
    expect(updateSettings).toHaveBeenCalledWith({
      features: {
        jellyfinEmby: {
          enabled: store.settings!.features.jellyfinEmby.enabled,
          config: {
            servers: [
              {
                id,
                name: "Server 1",
                serverUrls: "",
                apiKey: "",
                enabled: false
              }
            ]
          }
        }
      }
    });
  });

  it("updates Jellyfin / Emby server configs", async () => {
    const store = useDesktopStore();
    store.settings = createSettings();
    store.settings.features.jellyfinEmby.config.servers = [
      { id: "server-1", name: "Home", serverUrls: "", apiKey: "", enabled: true }
    ];
    const updateSettings = vi.spyOn(store, "updateSettings").mockResolvedValue();

    await store.updateJellyfinEmbyServer("server-1", {
      serverUrls: "http://localhost:8096, http://127.0.0.1:8096"
    });

    expect(updateSettings).toHaveBeenCalledWith({
      features: {
        jellyfinEmby: {
          enabled: store.settings.features.jellyfinEmby.enabled,
          config: {
            servers: [
              {
                id: "server-1",
                name: "Home",
                serverUrls: "http://localhost:8096, http://127.0.0.1:8096",
                apiKey: "",
                enabled: true
              }
            ]
          }
        }
      }
    });
  });

  it("duplicates Jellyfin / Emby server configs", async () => {
    const store = useDesktopStore();
    store.settings = createSettings();
    store.settings.features.jellyfinEmby.config.servers = [
      {
        id: "server-1",
        name: "Home",
        serverUrls: "http://localhost:8096, http://127.0.0.1:8096",
        apiKey: "token",
        enabled: true
      }
    ];
    const updateSettings = vi.spyOn(store, "updateSettings").mockResolvedValue();

    const id = await store.duplicateJellyfinEmbyServer("server-1");

    expect(id).toMatch(/^jellyfin-emby-/);
    expect(updateSettings).toHaveBeenCalledWith({
      features: {
        jellyfinEmby: {
          enabled: store.settings.features.jellyfinEmby.enabled,
          config: {
            servers: [
              {
                id: "server-1",
                name: "Home",
                serverUrls: "http://localhost:8096, http://127.0.0.1:8096",
                apiKey: "token",
                enabled: true
              },
              {
                id,
                name: "Home Copy",
                serverUrls: "http://localhost:8096, http://127.0.0.1:8096",
                apiKey: "token",
                enabled: true
              }
            ]
          }
        }
      }
    });
  });

  it("keeps renderer settings unchanged when main rejects a settings update", async () => {
    const store = useDesktopStore();
    const original = createSettings();
    const originalUsp = window.usp;
    store.settings = original;
    Object.defineProperty(window, "usp", {
      configurable: true,
      value: {
        updateSettings: vi.fn(async () => {
          throw new Error("At least one network endpoint is required");
        })
      }
    });

    try {
      await store.updateSettings({
        network: {
          ...original.network,
          endpoints: []
        }
      });

      expect(store.settings).toStrictEqual(original);
    } finally {
      Object.defineProperty(window, "usp", {
        configurable: true,
        value: originalUsp
      });
    }
  });

  it("reorders profiles and removes a deleted profile's URL rules", () => {
    const store = useDesktopStore();
    store.settings = createSettings();

    store.reorderProfile(1, 0);

    expect(store.settings?.profiles.map((profile) => profile.id)).toEqual([
      "profile-bilibili",
      DEFAULT_PROFILE_ID
    ]);

    store.deleteProfile("profile-bilibili");

    expect(store.settings?.profiles.map((profile) => profile.id)).toEqual([DEFAULT_PROFILE_ID]);
    expect(store.settings?.rules).toEqual([]);
  });

  it("keeps profile drag operations inside the sortable profile rows", () => {
    const store = useDesktopStore();
    const settings = createSettings();
    const defaultProfile = settings.profiles[0]!;
    const bilibiliProfile = settings.profiles[1]!;
    const youtubeProfile = {
      ...bilibiliProfile,
      id: "profile-youtube",
      name: "YouTube"
    };
    store.settings = {
      ...settings,
      profiles: [bilibiliProfile, youtubeProfile, defaultProfile]
    };

    store.reorderProfile(1, 0);

    expect(store.settings?.profiles.map((profile) => profile.id)).toEqual([
      "profile-youtube",
      "profile-bilibili",
      DEFAULT_PROFILE_ID
    ]);

    store.reorderProfile(0, 2);

    expect(store.settings?.profiles.map((profile) => profile.id)).toEqual([
      "profile-bilibili",
      "profile-youtube",
      DEFAULT_PROFILE_ID
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

    expect(store.settings?.profiles.at(-1)?.id).toBe(DEFAULT_PROFILE_ID);
    expect(store.settings?.profiles.at(-2)?.name).toBe("Profile 3");

    store.duplicateProfile();

    expect(store.settings?.profiles.at(-1)?.id).toBe(DEFAULT_PROFILE_ID);
    expect(store.settings?.profiles.map((profile) => profile.id)).toContain("profile-bilibili");
  });

  it("toggles non-fallback profile enablement without adding enablement to the fallback profile", () => {
    const store = useDesktopStore();
    store.settings = createSettings();

    store.toggleProfileEnabled("profile-bilibili", false);

    expect(store.settings?.profiles.find((profile) => profile.id === "profile-bilibili")?.enabled).toBe(false);

    store.toggleProfileEnabled(DEFAULT_PROFILE_ID, false);

    expect(Object.prototype.hasOwnProperty.call(store.settings?.profiles[0] ?? {}, "enabled")).toBe(false);
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
          profileId: DEFAULT_PROFILE_ID
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
