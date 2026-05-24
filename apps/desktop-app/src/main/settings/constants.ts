import { app } from "electron";
import path from "path";
import {
  GlobalSettings,
  NetworkSettings,
  ProfileSettings,
  SubtitleCacheSettings,
  TranscriptionConfig,
  TranscriptionPluginConfig
} from "../types.js";

import { DEFAULT_SUBTITLE_FONT_FAMILY } from "../../common/subtitleFonts.js";
import { DEFAULT_YTDLP_ARGS } from "../../common/ytdlpDefaults.js";
import { clampPort } from "./utils.js";
import { BASE_TRANSCRIPTION_CONFIG, DEFAULT_TRANSCRIPTION_YTDLP_ARGS } from "../../common/transcriptionDefaults.js";
import { createConnectionAuthToken } from "../connectionAuth.js";

export { DEFAULT_YTDLP_ARGS };
export const DEFAULT_PROFILE_ID = "default-profile";
export const DEFAULT_PROFILE_NAME = "Default Profile";

export const DEFAULT_SUBTITLE_PRIMARY_COLOR = "#f5f5f5";
export const DEFAULT_SUBTITLE_SECONDARY_COLOR = "#c7d2fe";
export const DEFAULT_SUBTITLE_ACTIVE_PRIMARY_COLOR = "#fff8dc";
export const DEFAULT_SUBTITLE_ACTIVE_SECONDARY_COLOR = "#fff9c4";

export const SUPPORTED_LANGUAGES = ["en", "zh"];
export const DEFAULT_LANGUAGE = "en";

export const DEFAULT_GLOBAL_SETTINGS: GlobalSettings = {
  closeBehavior: "tray",
  autoLaunch: false,
  toggleWindowShortcut: "CommandOrControl+Shift+S",
  gameProcessBlacklist: [],
  autoHidePanels: false,
  alwaysOnTop: "off",
  panelOpacity: 100,
  language: DEFAULT_LANGUAGE,
  appearance: {
    theme: "system"
  }
};

export const DEFAULT_WS_HOST = (process.env.USP_WS_HOST ?? "127.0.0.1").trim() || "127.0.0.1";
export const DEFAULT_WS_PORT = clampPort(Number(process.env.USP_WS_PORT ?? 44501));
export const DEFAULT_WS_ENDPOINT_ID = "default";

export const DEFAULT_NETWORK_SETTINGS: NetworkSettings = {
  endpoints: [
    {
      id: DEFAULT_WS_ENDPOINT_ID,
      host: DEFAULT_WS_HOST,
      port: DEFAULT_WS_PORT
    }
  ],
  authToken: createConnectionAuthToken()
};

export const DEFAULT_PROFILE_SETTINGS: ProfileSettings = {
  primarySubtitleFontFamily: DEFAULT_SUBTITLE_FONT_FAMILY,
  primarySubtitleFontSize: 14,
  secondarySubtitleFontFamily: DEFAULT_SUBTITLE_FONT_FAMILY,
  secondarySubtitleFontSize: 13,
  subtitleAutoHideMetaRow: true,
  subtitlePrimarySecondaryGap: 3,
  subtitleLineHeight: 1.45,
  subtitlePrimaryColor: DEFAULT_SUBTITLE_PRIMARY_COLOR,
  subtitleSecondaryColor: DEFAULT_SUBTITLE_SECONDARY_COLOR,
  subtitleActivePrimaryColor: DEFAULT_SUBTITLE_ACTIVE_PRIMARY_COLOR,
  subtitleActiveSecondaryColor: DEFAULT_SUBTITLE_ACTIVE_SECONDARY_COLOR,
  ytDlpArgs: "",
  subtitleAutoScrollTimeout: 3,
  subtitleScrollPosition: 33,
  subtitleBlockGap: 12,
  primarySubtitlePriority: [],
  secondarySubtitlePriority: []
};

export const DEFAULT_TRANSCRIPTION_CONFIG_ID = "default-transcription";
export const DEFAULT_FASTER_WHISPER_MODEL_DIR = path.join(app.getPath("userData"), "faster-whisper", "models");

export const DEFAULT_TRANSCRIPTION_CONFIG: TranscriptionConfig = {
  id: DEFAULT_TRANSCRIPTION_CONFIG_ID,
  ...BASE_TRANSCRIPTION_CONFIG,
  fasterWhisperModelDir: DEFAULT_FASTER_WHISPER_MODEL_DIR
};

export const DEFAULT_TRANSCRIPTION_PLUGIN_CONFIG: TranscriptionPluginConfig = {
  activeConfigId: DEFAULT_TRANSCRIPTION_CONFIG_ID,
  configs: [DEFAULT_TRANSCRIPTION_CONFIG]
};

export { DEFAULT_TRANSCRIPTION_YTDLP_ARGS } from "../../common/transcriptionDefaults.js";

export const DEFAULT_CACHE_SETTINGS: SubtitleCacheSettings = {
  enabled: true,
  path: path.join(app.getPath("userData"), "subtitle-cache"),
  retentionDays: 7
};
