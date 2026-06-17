import type { AppSettings, DesktopState, ProfileDefinition, SubtitleTrack } from "../../main/types.js";
import { cloneFeatureSettings } from "../../common/featureDefaults.js";

function createTrack(id: string, cues: SubtitleTrack["cues"]): SubtitleTrack {
  return {
    id,
    sourceFile: `${id}.vtt`,
    cues
  };
}

function createTopPanelProfile(): ProfileDefinition {
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

export function createTopPanelSettings(autoHidePanels = true): AppSettings {
  return {
    global: {
      autoLaunch: false,
      toggleWindowShortcut: "CommandOrControl+Shift+S",
      gameProcessBlacklist: [],
      autoHidePanels,
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
    profiles: [createTopPanelProfile()],
    defaultProfileId: "profile-1",
    rules: [],
    features: cloneFeatureSettings(),
    cache: {
      enabled: false,
      path: "",
      retentionDays: 30
    }
  };
}

export function createTopPanelDesktopState(): DesktopState {
  const primary = createTrack("primary", [
    { start: 0, end: 1000, text: "alpha beta" },
    { start: 1000, end: 2000, text: "gamma delta" }
  ]);
  const secondary = createTrack("secondary", [
    { start: 0, end: 1000, text: "第一行" },
    { start: 1000, end: 2000, text: "第二行" }
  ]);

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
      currentTime: 1200,
      duration: 5000,
      playbackRate: 1,
      lastUpdate: Date.now(),
      loop: null
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
    transcription: {
      status: "idle",
      message: null,
      configName: null,
      lastFinishedAt: null
    }
  };
}

export function createTopControlPanelProps(overrides: Record<string, unknown> = {}) {
  return {
    title: "Demo",
    profileLabel: "Profile: Default",
    displayUrl: "https://example.com/watch",
    subtitleTracks: createTopPanelDesktopState().subtitleTracks,
    primaryTrackId: "primary",
    secondaryTrackId: "secondary",
    transcriptionEnabled: false,
    transcriptionConfigs: [],
    activeTranscriptionId: "",
    canTranscribe: false,
    isTranscribing: false,
    statusBanner: {
      text: "Subtitles loaded",
      tone: "success"
    },
    hasActiveVideo: true,
    isPlaying: true,
    displayedPlaybackTime: 1200,
    playbackDuration: 5000,
    sliderMax: 5000,
    sliderStep: 100,
    sliderValue: 1200,
    sliderEnabled: true,
    sliderFillStyle: {
      "--slider-progress": "24%"
    },
    autoHideEnabled: true,
    formatSourceFile: (sourceFile: string) => sourceFile,
    t: (_key: string, params: Record<string, any> = {}) => {
      let text = _key;
      for (const [name, value] of Object.entries(params)) {
        text = text.split(`{${name}}`).join(String(value));
      }
      return text;
    },
    ...overrides
  };
}
