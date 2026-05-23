import type { SupportedLanguage } from "../../i18n";
import { translate } from "../../i18n";

const SETTINGS_SECTION_DEFS = [
  {
    id: "general",
    labelKey: "section-global-settings",
    fallback: "Global Settings"
  },
  {
    id: "profiles",
    labelKey: "section-profiles",
    fallback: "Profiles"
  },
  {
    id: "plugins",
    labelKey: "section-plugins",
    fallback: "Plugins"
  }
] as const;

export function buildSettingsSections(language: SupportedLanguage) {
  return SETTINGS_SECTION_DEFS.map((section) => ({
    id: section.id,
    label: translate(section.labelKey, section.fallback, language)
  }));
}

export type SettingsSectionId = string;
