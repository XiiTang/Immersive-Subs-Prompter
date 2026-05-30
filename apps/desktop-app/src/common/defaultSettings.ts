import type {
  AppSettings,
  GlobalSettings,
  NetworkEndpoint,
  ProfileDefinition,
  ProfileRule,
  ProfileSettings,
  SubtitleCacheSettings
} from "../main/types.js";
import { DEFAULT_SUBTITLE_FONT_FAMILY } from "./subtitleFonts.js";
import {
  JELLYFINEMBY_PLUGIN_ID,
  TRANSCRIPTION_PLUGIN_ID,
  WORD_LOOKUP_PLUGIN_ID
} from "./pluginIds.js";
import { createDefaultTranscriptionPluginConfig } from "./transcriptionDefaults.js";
import { createDefaultJellyfinembyPluginConfig } from "./jellyfinembyDefaults.js";
import { DEFAULT_WORD_LOOKUP_PLUGIN_CONFIG } from "./wordLookupDefaults.js";

export const DEFAULT_PROFILE_ID = "default-profile";
export const DEFAULT_PROFILE_NAME = "Default Profile";

export const DEFAULT_GLOBAL_SETTINGS: GlobalSettings = {
  autoLaunch: true,
  toggleWindowShortcut: "CommandOrControl+Shift+S",
  gameProcessBlacklist: ["r5apex_dx12.exe"],
  autoHidePanels: true,
  alwaysOnTop: "screen-saver",
  panelOpacity: 0,
  language: "zh",
  appearance: {
    theme: "system"
  }
};

export const DEFAULT_NETWORK_ENDPOINTS: NetworkEndpoint[] = [
  {
    id: "default",
    host: "127.0.0.1",
    port: 44501
  }
];

export const DEFAULT_SUBTITLE_PRIMARY_COLOR = "#f5f5f5";
export const DEFAULT_SUBTITLE_SECONDARY_COLOR = "#c7d2fe";
export const DEFAULT_SUBTITLE_ACTIVE_PRIMARY_COLOR = "#ff0000";
export const DEFAULT_SUBTITLE_ACTIVE_SECONDARY_COLOR = "#ff1f1f";

export const DEFAULT_PROFILE_SETTINGS: ProfileSettings = {
  primarySubtitleFontFamily: DEFAULT_SUBTITLE_FONT_FAMILY,
  primarySubtitleFontSize: 26,
  secondarySubtitleFontFamily: DEFAULT_SUBTITLE_FONT_FAMILY,
  secondarySubtitleFontSize: 25,
  subtitleTimestampFontSize: 11,
  subtitleAutoHideMetaRow: true,
  subtitlePrimarySecondaryGap: 0,
  subtitleLineHeight: 1,
  subtitlePrimaryColor: DEFAULT_SUBTITLE_PRIMARY_COLOR,
  subtitleSecondaryColor: DEFAULT_SUBTITLE_SECONDARY_COLOR,
  subtitleActivePrimaryColor: DEFAULT_SUBTITLE_ACTIVE_PRIMARY_COLOR,
  subtitleActiveSecondaryColor: DEFAULT_SUBTITLE_ACTIVE_SECONDARY_COLOR,
  ytDlpArgs: "--skip-download --write-subs --write-auto-subs --all-subs --cookies-from-browser firefox",
  subtitleAutoScrollTimeout: 3,
  subtitleScrollPosition: 44,
  subtitleBlockGap: 12,
  primarySubtitlePriority: ["en", "ai-en"],
  secondarySubtitlePriority: ["zh-Hans", "ai-zh", "zh"]
};

export const DEFAULT_CACHE_SETTINGS: SubtitleCacheSettings = {
  enabled: true,
  path: "",
  retentionDays: 7
};

export interface DefaultAppSettingsOptions {
  networkAuthToken: string;
}

const YOUTUBE_PROFILE_ID = "profile-40b9e894-0251-41d6-9e8c-a246f29d3d7b";
const TIKTOK_PROFILE_ID = "profile-d6054c18-c9c1-4ee5-8263-a63b1b1e36bc";
const BILIBILI_PROFILE_ID = "profile-fe180e4d-e963-4d76-83d0-ec7311cbb608";

const YOUTUBE_PROFILE_SETTINGS: ProfileSettings = {
  ...DEFAULT_PROFILE_SETTINGS,
  subtitleLineHeight: 1.1,
  subtitleActivePrimaryColor: "#fff8dc",
  subtitleActiveSecondaryColor: "#fff9c4",
  ytDlpArgs:
    '--skip-download --write-subs --write-auto-subs  --sub-lang "en.*,zh-Hans.*" --sub-format "srt/best" --cookies-from-browser firefox',
  subtitleScrollPosition: 33,
  secondarySubtitlePriority: ["zh", "zh-Hans"]
};

const TIKTOK_PROFILE_SETTINGS: ProfileSettings = {
  ...DEFAULT_PROFILE_SETTINGS,
  subtitleLineHeight: 1.1,
  subtitleActivePrimaryColor: "#fff8dc",
  subtitleActiveSecondaryColor: "#fff9c4",
  ytDlpArgs:
    '--skip-download --write-subs --write-auto-subs  --sub-lang "eng.*,cmn-Hans.*" --sub-format "srt/best" --cookies-from-browser firefox',
  subtitleScrollPosition: 33,
  primarySubtitlePriority: ["eng", "en", "ai-en"],
  secondarySubtitlePriority: ["cmn-Hans", "zh", "ai-zh", "zh-Hans"]
};

const BILIBILI_PROFILE_SETTINGS: ProfileSettings = {
  ...DEFAULT_PROFILE_SETTINGS,
  ytDlpArgs: '--skip-download --write-subs --write-auto-subs  --all-subs --sub-format "srt/best" --cookies-from-browser firefox',
  subtitleScrollPosition: 33,
  secondarySubtitlePriority: ["zh", "ai-zh", "zh-Hans"]
};

export function createDefaultAppSettings(options: DefaultAppSettingsOptions): AppSettings {
  return {
    global: cloneGlobalSettings(DEFAULT_GLOBAL_SETTINGS),
    network: {
      endpoints: cloneNetworkEndpoints(DEFAULT_NETWORK_ENDPOINTS),
      authToken: options.networkAuthToken
    },
    profiles: createDefaultProfiles(),
    defaultProfileId: DEFAULT_PROFILE_ID,
    rules: createDefaultRules(),
    plugins: {
      [JELLYFINEMBY_PLUGIN_ID]: {
        config: createDefaultJellyfinembyPluginConfig() as unknown as Record<string, unknown>
      },
      [TRANSCRIPTION_PLUGIN_ID]: {
        config: createDefaultTranscriptionPluginConfig() as unknown as Record<string, unknown>
      },
      [WORD_LOOKUP_PLUGIN_ID]: {
        config: cloneWordLookupPluginConfig() as unknown as Record<string, unknown>
      }
    },
    cache: { ...DEFAULT_CACHE_SETTINGS }
  };
}

function createDefaultProfiles(): ProfileDefinition[] {
  return [
    {
      id: YOUTUBE_PROFILE_ID,
      name: "Youtube",
      description: null,
      settings: cloneProfileSettings(YOUTUBE_PROFILE_SETTINGS)
    },
    {
      id: TIKTOK_PROFILE_ID,
      name: "tiktok",
      description: null,
      settings: cloneProfileSettings(TIKTOK_PROFILE_SETTINGS)
    },
    {
      id: BILIBILI_PROFILE_ID,
      name: "Bilibili",
      description: null,
      settings: cloneProfileSettings(BILIBILI_PROFILE_SETTINGS)
    },
    {
      id: DEFAULT_PROFILE_ID,
      name: DEFAULT_PROFILE_NAME,
      description: null,
      settings: cloneProfileSettings(DEFAULT_PROFILE_SETTINGS)
    }
  ];
}

function createDefaultRules(): ProfileRule[] {
  return [
    {
      id: "rule-a9016eb2-7e5a-45fe-8c54-22239aaa3083",
      name: "Bilibili",
      pattern: "bilibili.com",
      profileId: BILIBILI_PROFILE_ID
    },
    {
      id: "rule-ee98d6e3-c48d-40e3-a5d0-0b940fe0e33c",
      name: "Youtube",
      pattern: "youtube.com",
      profileId: YOUTUBE_PROFILE_ID
    },
    {
      id: "rule-ff318a0a-e234-4138-bc39-b85d62bec586",
      name: "tiktok",
      pattern: "tiktok.com",
      profileId: TIKTOK_PROFILE_ID
    }
  ];
}

function cloneGlobalSettings(settings: GlobalSettings): GlobalSettings {
  return {
    ...settings,
    gameProcessBlacklist: [...settings.gameProcessBlacklist],
    appearance: { ...settings.appearance }
  };
}

function cloneNetworkEndpoints(endpoints: NetworkEndpoint[]): NetworkEndpoint[] {
  return endpoints.map((endpoint) => ({ ...endpoint }));
}

function cloneProfileSettings(settings: ProfileSettings): ProfileSettings {
  return {
    ...settings,
    primarySubtitlePriority: [...settings.primarySubtitlePriority],
    secondarySubtitlePriority: [...settings.secondarySubtitlePriority]
  };
}

function cloneWordLookupPluginConfig() {
  return {
    ...DEFAULT_WORD_LOOKUP_PLUGIN_CONFIG,
    panelSize: { ...DEFAULT_WORD_LOOKUP_PLUGIN_CONFIG.panelSize }
  };
}
