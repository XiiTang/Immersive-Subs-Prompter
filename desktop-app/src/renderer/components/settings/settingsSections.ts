import type { SupportedLanguage } from "../../i18n";
import { translate } from "../../i18n";

const SETTINGS_SECTION_DEFS = [
  {
    id: "general",
    labelKey: "section-global-settings",
    fallback: "Global Settings",
    anchorId: "settings-section-general"
  },
  {
    id: "profiles",
    labelKey: "section-profiles",
    fallback: "Profiles",
    anchorId: "settings-section-profiles"
  },
  {
    id: "rules",
    labelKey: "section-rules",
    fallback: "URL Rules",
    anchorId: "settings-section-rules"
  },
  {
    id: "transcription",
    labelKey: "section-transcription",
    fallback: "Speech Transcription",
    anchorId: "settings-section-transcription"
  },
  {
    id: "media-server",
    labelKey: "section-mediaserver",
    fallback: "Media Server Integration",
    anchorId: "settings-section-media-server"
  },
  {
    id: "cache",
    labelKey: "section-cache",
    fallback: "Subtitle Cache",
    anchorId: "settings-section-cache"
  }
] as const;

export function buildSettingsSections(language: SupportedLanguage) {
  return SETTINGS_SECTION_DEFS.map((section) => ({
    id: section.id,
    label: translate(section.labelKey, section.fallback, language),
    anchorId: section.anchorId
  }));
}

export type SettingsSectionId = (typeof SETTINGS_SECTION_DEFS)[number]["id"];
