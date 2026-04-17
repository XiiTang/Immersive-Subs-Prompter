import type { ProfileSettings } from "../../../main/types";
import { BASE_TRANSCRIPTION_CONFIG } from "../../../common/transcriptionDefaults.js";
import { DEFAULT_SUBTITLE_FONT_FAMILY } from "../../../common/subtitleFonts.js";

export const DEFAULT_PROFILE_TEMPLATE: ProfileSettings = {
  subtitleFontFamily: DEFAULT_SUBTITLE_FONT_FAMILY,
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
};

export const DEFAULT_PANEL_OPACITY = 100;

export type CacheStats = {
  totalEntries: number;
  totalSize: number;
  oldestEntry: number | null;
  newestEntry: number | null;
};

export const DEFAULT_TRANSCRIPTION_PLUGIN_CONFIG = {
  activeConfigId: "default-transcription",
  configs: [
    {
      id: "default-transcription",
      ...BASE_TRANSCRIPTION_CONFIG
    }
  ]
};
