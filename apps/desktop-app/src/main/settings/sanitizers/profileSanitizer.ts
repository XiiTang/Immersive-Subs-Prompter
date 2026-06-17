import type { ProfileDefinition, ProfileSettings } from "../../types.js";
import { SUBTITLE_FONT_OPTIONS } from "../../../common/subtitleFonts.js";
import {
  MAX_SUBTITLE_FONT_SIZE,
  MAX_TIMESTAMP_FONT_SIZE,
  MIN_SUBTITLE_FONT_SIZE,
  MIN_TIMESTAMP_FONT_SIZE
} from "../../../common/subtitleSizing.js";
import { assertNoUnknownKeys } from "../utils.js";

const PROFILE_KEYS = ["id", "name", "enabled", "description", "settings"] as const;
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

function validateProfileSettingsForUpdate(input: unknown): void {
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
    if (id === fallbackProfileId) {
      if (Object.prototype.hasOwnProperty.call(source, "enabled")) {
        throw new Error("fallback profile must not include enabled setting");
      }
    } else if (typeof source.enabled !== "boolean") {
      throw new Error("profile.enabled must use the current boolean setting");
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
