import type { SupportedLanguage } from "../../i18n";
import { translate } from "../../i18n";

const SETTINGS_SECTION_DEFS = [
  {
    id: "general",
    labelKey: "section-global-settings",
    fallback: "Global",
    icon: "settings"
  },
  {
    id: "profiles",
    labelKey: "section-profiles",
    fallback: "Profiles",
    icon: "profiles"
  },
  {
    id: "plugins",
    labelKey: "section-plugins",
    fallback: "Plugins",
    icon: "plugins"
  }
] as const;

export function buildSettingsSections(language: SupportedLanguage) {
  return SETTINGS_SECTION_DEFS.map((section) => ({
    id: section.id,
    label: translate(section.labelKey, section.fallback, language),
    icon: section.icon
  }));
}

export type SettingsSectionId = string;
export type SettingsNavIconKey =
  | "settings"
  | "profiles"
  | "plugins"
  | "transcription"
  | "wordLookup"
  | "mediaServer";
