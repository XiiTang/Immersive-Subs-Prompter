import { ProfileDefinition, ProfileSettings } from "../../types.js";
import { normalizeSubtitleFontFamily, SUBTITLE_FONT_OPTIONS } from "../../../common/subtitleFonts.js";
import { DEFAULT_PROFILE_ID, DEFAULT_PROFILE_NAME, DEFAULT_PROFILE_SETTINGS } from "../constants.js";
import { assertNoUnknownKeys, ensureUniqueId, normalizeColor, sanitizePriorityList } from "../utils.js";

const MIN_SUBTITLE_FONT_SIZE = 3;
const MAX_SUBTITLE_FONT_SIZE = 96;
const MIN_TIMESTAMP_FONT_SIZE = 6;
const MAX_TIMESTAMP_FONT_SIZE = 24;
const PROFILE_KEYS = ["id", "name", "description", "settings"] as const;
const PROFILE_SETTINGS_KEYS = [
  "primarySubtitleFontFamily",
  "primarySubtitleFontSize",
  "secondarySubtitleFontFamily",
  "secondarySubtitleFontSize",
  "subtitleTimestampFontSize",
  "subtitleAutoHideMetaRow",
  "subtitlePrimarySecondaryGap",
  "subtitleLineHeight",
  "subtitlePrimaryColor",
  "subtitleSecondaryColor",
  "subtitleActivePrimaryColor",
  "subtitleActiveSecondaryColor",
  "ytDlpArgs",
  "subtitleAutoScrollTimeout",
  "subtitleScrollPosition",
  "subtitleBlockGap",
  "primarySubtitlePriority",
  "secondarySubtitlePriority"
] as const;

function sanitizeSubtitleFontSize(value: unknown, fallback: number): number {
  let fontSize = Number(value);
  if (!Number.isFinite(fontSize)) {
    fontSize = fallback;
  }
  return Math.min(MAX_SUBTITLE_FONT_SIZE, Math.max(MIN_SUBTITLE_FONT_SIZE, Math.round(fontSize)));
}

function sanitizeTimestampFontSize(value: unknown, fallback: number): number {
  let fontSize = Number(value);
  if (!Number.isFinite(fontSize)) {
    fontSize = fallback;
  }
  return Math.min(MAX_TIMESTAMP_FONT_SIZE, Math.max(MIN_TIMESTAMP_FONT_SIZE, Math.round(fontSize)));
}

export function sanitizeProfileSettings(input: Partial<ProfileSettings> | null | undefined): ProfileSettings {
  const source = input ?? {};
  const primarySubtitleFontFamily = normalizeSubtitleFontFamily(source.primarySubtitleFontFamily);
  const secondarySubtitleFontFamily = normalizeSubtitleFontFamily(source.secondarySubtitleFontFamily);
  const primarySubtitleFontSize = sanitizeSubtitleFontSize(
    source.primarySubtitleFontSize,
    DEFAULT_PROFILE_SETTINGS.primarySubtitleFontSize
  );
  const secondarySubtitleFontSize = sanitizeSubtitleFontSize(
    source.secondarySubtitleFontSize,
    DEFAULT_PROFILE_SETTINGS.secondarySubtitleFontSize
  );
  const subtitleTimestampFontSize = sanitizeTimestampFontSize(
    source.subtitleTimestampFontSize,
    DEFAULT_PROFILE_SETTINGS.subtitleTimestampFontSize
  );

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
    primarySubtitleFontFamily,
    primarySubtitleFontSize,
    secondarySubtitleFontFamily,
    secondarySubtitleFontSize,
    subtitleTimestampFontSize,
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

function validateFiniteNumberField(
  source: Record<string, unknown>,
  field: keyof ProfileSettings,
  min?: number,
  max?: number
): void {
  const value = source[field];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`profile.${field} must use the current finite number setting`);
  }
  if ((min !== undefined && value < min) || (max !== undefined && value > max)) {
    if (min !== undefined && max !== undefined) {
      throw new Error(`profile.${field} must be between ${min} and ${max}`);
    }
    if (min !== undefined) {
      throw new Error(`profile.${field} must be at least ${min}`);
    }
    throw new Error(`profile.${field} must be at most ${max}`);
  }
}

function validateStringField(source: Record<string, unknown>, field: keyof ProfileSettings): void {
  if (typeof source[field] !== "string") {
    throw new Error(`profile.${field} must use the current string setting`);
  }
}

function validateNonEmptyStringField(source: Record<string, unknown>, field: keyof ProfileSettings): void {
  validateStringField(source, field);
  if (!(source[field] as string).trim()) {
    throw new Error(`profile.${field} must use the current non-empty string setting`);
  }
}

function validateSubtitleFontFamilyField(source: Record<string, unknown>, field: keyof ProfileSettings): void {
  validateStringField(source, field);
  if (!SUBTITLE_FONT_OPTIONS.some((option) => option.value === source[field])) {
    throw new Error(`profile.${field} must use a supported current font setting`);
  }
}

function validateBooleanField(source: Record<string, unknown>, field: keyof ProfileSettings): void {
  if (typeof source[field] !== "boolean") {
    throw new Error(`profile.${field} must use the current boolean setting`);
  }
}

function validatePriorityList(source: Record<string, unknown>, field: keyof ProfileSettings): void {
  const value = source[field];
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
    throw new Error(`profile.${field} must use the current string array setting`);
  }
}

export function validateProfileSettingsForUpdate(input: unknown): void {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("profile.settings must use the current object setting");
  }
  const source = input as Record<string, unknown>;
  assertNoUnknownKeys(source, PROFILE_SETTINGS_KEYS, "profile.settings");

  validateSubtitleFontFamilyField(source, "primarySubtitleFontFamily");
  validateFiniteNumberField(source, "primarySubtitleFontSize", MIN_SUBTITLE_FONT_SIZE, MAX_SUBTITLE_FONT_SIZE);
  validateSubtitleFontFamilyField(source, "secondarySubtitleFontFamily");
  validateFiniteNumberField(source, "secondarySubtitleFontSize", MIN_SUBTITLE_FONT_SIZE, MAX_SUBTITLE_FONT_SIZE);
  validateFiniteNumberField(source, "subtitleTimestampFontSize", MIN_TIMESTAMP_FONT_SIZE, MAX_TIMESTAMP_FONT_SIZE);
  validateBooleanField(source, "subtitleAutoHideMetaRow");
  validateFiniteNumberField(source, "subtitlePrimarySecondaryGap", 0, 60);
  validateFiniteNumberField(source, "subtitleLineHeight", 1, 3);
  validateNonEmptyStringField(source, "subtitlePrimaryColor");
  validateNonEmptyStringField(source, "subtitleSecondaryColor");
  validateNonEmptyStringField(source, "subtitleActivePrimaryColor");
  validateNonEmptyStringField(source, "subtitleActiveSecondaryColor");
  validateStringField(source, "ytDlpArgs");
  validateFiniteNumberField(source, "subtitleAutoScrollTimeout", 1);
  validateFiniteNumberField(source, "subtitleScrollPosition", 0, 100);
  validateFiniteNumberField(source, "subtitleBlockGap", 0, 60);
  validatePriorityList(source, "primarySubtitlePriority");
  validatePriorityList(source, "secondarySubtitlePriority");
}

export function validateProfilesForUpdate(input: unknown, fallbackProfileId: string): ProfileDefinition[] {
  if (!Array.isArray(input) || !input.length) {
    throw new Error("profiles must use the current non-empty array setting");
  }

  const used = new Set<string>();
  const profiles: ProfileDefinition[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      throw new Error("profile must use the current object setting");
    }
    const source = raw as Record<string, unknown>;
    assertNoUnknownKeys(source, PROFILE_KEYS, "profile");
    const id = typeof source.id === "string" ? source.id.trim() : "";
    if (!id) {
      throw new Error("profile.id must use the current string setting");
    }
    if (used.has(id)) {
      throw new Error(`duplicate profile id: ${id}`);
    }
    used.add(id);

    const name = typeof source.name === "string" ? source.name.trim() : "";
    if (!name) {
      throw new Error("profile.name must use the current string setting");
    }
    if (
      source.description !== undefined &&
      source.description !== null &&
      typeof source.description !== "string"
    ) {
      throw new Error("profile.description must use the current string or null setting");
    }
    validateProfileSettingsForUpdate(source.settings);
    profiles.push(source as unknown as ProfileDefinition);
  }

  if (!used.has(fallbackProfileId)) {
    throw new Error("profiles must include the current fallback profile");
  }
  if (profiles.at(-1)?.id !== fallbackProfileId) {
    throw new Error("profiles must keep the current fallback profile last");
  }

  return profiles;
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
