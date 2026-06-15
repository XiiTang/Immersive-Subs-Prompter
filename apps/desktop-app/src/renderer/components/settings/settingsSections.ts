import type { SupportedLanguage } from "../../i18n";
import { translate } from "../../i18n";

const SETTINGS_SECTION_DEFS = [
  {
    id: "general",
    labelKey: "section-global-settings",
    icon: "settings"
  },
  {
    id: "profiles",
    labelKey: "section-profiles",
    icon: "profiles"
  },
  {
    id: "features",
    labelKey: "section-features",
    icon: "features"
  }
] as const;

export function buildSettingsSections(language: SupportedLanguage) {
  return SETTINGS_SECTION_DEFS.map((section) => ({
    id: section.id,
    label: translate(section.labelKey, language),
    icon: section.icon
  }));
}

export type SettingsSectionId = (typeof SETTINGS_SECTION_DEFS)[number]["id"];
export type SettingsNavIconKey =
  | "settings"
  | "profiles"
  | "features"
  | "transcription"
  | "wordLookup"
  | "mediaServer";
