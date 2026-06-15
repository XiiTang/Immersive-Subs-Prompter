import type { SupportedLanguage } from "../../i18n";
import { translate } from "../../i18n";
import type { FeatureId } from "../../../common/featureDefaults";

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

const FEATURE_SETTINGS_SECTION_DEFS = [
  {
    id: "feature-wordLookup",
    featureId: "wordLookup",
    labelKey: "feature-word-lookup-title",
    icon: "wordLookup"
  },
  {
    id: "feature-transcription",
    featureId: "transcription",
    labelKey: "feature-transcription-title",
    icon: "transcription"
  },
  {
    id: "feature-jellyfinEmby",
    featureId: "jellyfinEmby",
    labelKey: "feature-jellyfin-emby-title",
    icon: "mediaServer"
  }
] as const satisfies ReadonlyArray<{
  id: FeatureSettingsSectionId;
  featureId: FeatureId;
  labelKey: string;
  icon: SettingsNavIconKey;
}>;

type FeatureEnablement = Partial<Record<FeatureId, { enabled: boolean }>>;

export function buildSettingsSections(language: SupportedLanguage, features?: FeatureEnablement | null) {
  const baseSections = SETTINGS_SECTION_DEFS.map((section) => ({
    id: section.id,
    label: translate(section.labelKey, language),
    icon: section.icon
  }));
  const featureSections = FEATURE_SETTINGS_SECTION_DEFS
    .filter((section) => features?.[section.featureId]?.enabled)
    .map((section) => ({
      id: section.id,
      label: translate(section.labelKey, language),
      icon: section.icon
    }));

  return [...baseSections, ...featureSections];
}

type BaseSettingsSectionId = (typeof SETTINGS_SECTION_DEFS)[number]["id"];
type FeatureSettingsSectionId = `feature-${FeatureId}`;
export type SettingsSectionId = BaseSettingsSectionId | FeatureSettingsSectionId;
export type SettingsNavIconKey =
  | "settings"
  | "profiles"
  | "features"
  | "transcription"
  | "wordLookup"
  | "mediaServer";
