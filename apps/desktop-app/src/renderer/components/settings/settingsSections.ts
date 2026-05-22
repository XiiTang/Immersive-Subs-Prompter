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
    id: "appearance",
    labelKey: "section-appearance",
    fallback: "Appearance",
    anchorId: "settings-section-appearance"
  },
  {
    id: "profiles",
    labelKey: "section-profiles",
    fallback: "Profiles",
    anchorId: "settings-section-profiles"
  },
  {
    id: "cache",
    labelKey: "section-cache",
    fallback: "Subtitle Cache",
    anchorId: "settings-section-cache"
  },
  {
    id: "plugins",
    labelKey: "section-plugins",
    fallback: "Plugins",
    anchorId: "settings-section-plugins"
  }
] as const;

export function buildSettingsSections(language: SupportedLanguage) {
  return SETTINGS_SECTION_DEFS.map((section) => ({
    id: section.id,
    label: translate(section.labelKey, section.fallback, language),
    anchorId: section.anchorId
  }));
}

export type SettingsSectionId = string;
