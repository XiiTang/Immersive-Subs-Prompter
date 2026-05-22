import { ProfileDefinition, ProfileSettings } from "../../types.js";
import { normalizeSubtitleFontFamily } from "../../../common/subtitleFonts.js";
import { DEFAULT_PROFILE_ID, DEFAULT_PROFILE_NAME, DEFAULT_PROFILE_SETTINGS } from "../constants.js";
import { ensureUniqueId, normalizeColor, sanitizePriorityList } from "../utils.js";

export function sanitizeProfileSettings(input: Partial<ProfileSettings> | null | undefined): ProfileSettings {
  const source = input ?? {};
  const subtitleFontFamily = normalizeSubtitleFontFamily(source.subtitleFontFamily);

  let subtitleFontSize = Number(source.subtitleFontSize);
  if (!Number.isFinite(subtitleFontSize)) {
    subtitleFontSize = DEFAULT_PROFILE_SETTINGS.subtitleFontSize;
  }
  subtitleFontSize = Math.min(48, Math.max(10, Math.round(subtitleFontSize)));

  const subtitleAutoHideMetaRow =
    typeof source.subtitleAutoHideMetaRow === "boolean"
      ? source.subtitleAutoHideMetaRow
      : DEFAULT_PROFILE_SETTINGS.subtitleAutoHideMetaRow;

  let subtitlePrimarySecondaryGap = Number(source.subtitlePrimarySecondaryGap);
  if (!Number.isFinite(subtitlePrimarySecondaryGap)) {
    subtitlePrimarySecondaryGap = DEFAULT_PROFILE_SETTINGS.subtitlePrimarySecondaryGap;
  }
  subtitlePrimarySecondaryGap = Math.min(60, Math.max(0, Math.round(subtitlePrimarySecondaryGap)));

  let subtitleLineHeight = Number(source.subtitleLineHeight);
  if (!Number.isFinite(subtitleLineHeight)) {
    subtitleLineHeight = DEFAULT_PROFILE_SETTINGS.subtitleLineHeight;
  }
  subtitleLineHeight = Number(Math.min(3, Math.max(1, subtitleLineHeight)).toFixed(2));

  const subtitlePrimaryColor = normalizeColor(
    source.subtitlePrimaryColor,
    DEFAULT_PROFILE_SETTINGS.subtitlePrimaryColor
  );
  const subtitleSecondaryColor = normalizeColor(
    source.subtitleSecondaryColor,
    DEFAULT_PROFILE_SETTINGS.subtitleSecondaryColor
  );
  const subtitleActivePrimaryColor = normalizeColor(
    source.subtitleActivePrimaryColor,
    DEFAULT_PROFILE_SETTINGS.subtitleActivePrimaryColor
  );
  const subtitleActiveSecondaryColor = normalizeColor(
    source.subtitleActiveSecondaryColor,
    DEFAULT_PROFILE_SETTINGS.subtitleActiveSecondaryColor
  );

  const ytDlpArgs = typeof source.ytDlpArgs === "string" ? source.ytDlpArgs.trim() : DEFAULT_PROFILE_SETTINGS.ytDlpArgs;

  let subtitleAutoScrollTimeout = Number(source.subtitleAutoScrollTimeout);
  if (!Number.isFinite(subtitleAutoScrollTimeout)) {
    subtitleAutoScrollTimeout = DEFAULT_PROFILE_SETTINGS.subtitleAutoScrollTimeout;
  }
  subtitleAutoScrollTimeout = Math.max(1, Math.round(subtitleAutoScrollTimeout));

  let subtitleScrollPosition = Number(source.subtitleScrollPosition);
  if (!Number.isFinite(subtitleScrollPosition)) {
    subtitleScrollPosition = DEFAULT_PROFILE_SETTINGS.subtitleScrollPosition;
  }
  subtitleScrollPosition = Math.min(100, Math.max(0, Math.round(subtitleScrollPosition)));

  let subtitleBlockGap = Number(source.subtitleBlockGap);
  if (!Number.isFinite(subtitleBlockGap)) {
    subtitleBlockGap = DEFAULT_PROFILE_SETTINGS.subtitleBlockGap;
  }
  subtitleBlockGap = Math.min(60, Math.max(0, Math.round(subtitleBlockGap)));

  const primarySubtitlePriority = sanitizePriorityList(source.primarySubtitlePriority);
  const secondarySubtitlePriority = sanitizePriorityList(source.secondarySubtitlePriority);

  return {
    subtitleFontFamily,
    subtitleFontSize,
    subtitleAutoHideMetaRow,
    subtitlePrimarySecondaryGap,
    subtitleLineHeight,
    subtitlePrimaryColor,
    subtitleSecondaryColor,
    subtitleActivePrimaryColor,
    subtitleActiveSecondaryColor,
    ytDlpArgs,
    subtitleAutoScrollTimeout,
    subtitleScrollPosition,
    subtitleBlockGap,
    primarySubtitlePriority,
    secondarySubtitlePriority
  };
}

export function createDefaultProfile(): ProfileDefinition {
  return {
    id: DEFAULT_PROFILE_ID,
    name: DEFAULT_PROFILE_NAME,
    description: null,
    settings: sanitizeProfileSettings(DEFAULT_PROFILE_SETTINGS)
  };
}

export function ensureFallbackProfileLast(
  profiles: ProfileDefinition[],
  fallbackProfileId: string
): ProfileDefinition[] {
  const fallback =
    profiles.find((profile) => profile.id === fallbackProfileId) ??
    (fallbackProfileId === DEFAULT_PROFILE_ID ? createDefaultProfile() : null);

  if (!fallback) {
    return profiles;
  }

  return [
    ...profiles.filter((profile) => profile.id !== fallback.id),
    fallback
  ];
}

export function sanitizeProfiles(input: unknown): ProfileDefinition[] {
  if (!Array.isArray(input) || !input.length) {
    return [createDefaultProfile()];
  }

  const used = new Set<string>();
  const profiles: ProfileDefinition[] = [];

  for (const raw of input) {
    if (!raw || typeof raw !== "object") {
      continue;
    }
    const source = raw as Partial<ProfileDefinition>;
    const id = ensureUniqueId(source.id, used, "profile");
    const name = typeof source.name === "string" && source.name.trim().length ? source.name.trim() : "Unnamed Profile";
    const description =
      typeof source.description === "string" && source.description.trim().length ? source.description.trim() : null;
    const settings = sanitizeProfileSettings(source.settings);
    profiles.push({ id, name, description, settings });
  }

  if (!profiles.length) {
    return [createDefaultProfile()];
  }

  return profiles;
}
