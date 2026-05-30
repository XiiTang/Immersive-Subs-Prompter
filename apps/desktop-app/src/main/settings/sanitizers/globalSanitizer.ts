import { AppearanceTheme, GlobalSettings } from "../../types.js";
import { DEFAULT_GLOBAL_SETTINGS, SUPPORTED_LANGUAGES } from "../constants.js";
import { assertNoUnknownKeys, sanitizeProcessList } from "../utils.js";

const GLOBAL_SETTINGS_KEYS = [
  "autoLaunch",
  "toggleWindowShortcut",
  "gameProcessBlacklist",
  "autoHidePanels",
  "alwaysOnTop",
  "panelOpacity",
  "language",
  "appearance"
] as const;
const APPEARANCE_SETTINGS_KEYS = ["theme"] as const;

function isAppearanceTheme(value: unknown): value is AppearanceTheme {
  return value === "system" || value === "light" || value === "dark";
}

function isAlwaysOnTopLevel(value: unknown): value is GlobalSettings["alwaysOnTop"] {
  return value === "off" || value === "floating" || value === "screen-saver";
}

export function validateGlobalSettingsForUpdate(input: unknown): void {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("global settings must use the current object setting");
  }
  const source = input as Record<string, unknown>;
  assertNoUnknownKeys(source, GLOBAL_SETTINGS_KEYS, "global");
  if (Object.prototype.hasOwnProperty.call(source, "autoLaunch") && typeof source.autoLaunch !== "boolean") {
    throw new Error("global.autoLaunch must use the current boolean setting");
  }
  if (Object.prototype.hasOwnProperty.call(source, "toggleWindowShortcut") && typeof source.toggleWindowShortcut !== "string") {
    throw new Error("global.toggleWindowShortcut must use the current string setting");
  }
  if (Object.prototype.hasOwnProperty.call(source, "gameProcessBlacklist")) {
    if (!Array.isArray(source.gameProcessBlacklist) || source.gameProcessBlacklist.some((entry) => typeof entry !== "string")) {
      throw new Error("global.gameProcessBlacklist must use the current string array setting");
    }
  }
  if (Object.prototype.hasOwnProperty.call(source, "autoHidePanels") && typeof source.autoHidePanels !== "boolean") {
    throw new Error("global.autoHidePanels must use the current boolean setting");
  }
  if (Object.prototype.hasOwnProperty.call(source, "alwaysOnTop") && !isAlwaysOnTopLevel(source.alwaysOnTop)) {
    throw new Error("global.alwaysOnTop must use the current string setting");
  }
  if (Object.prototype.hasOwnProperty.call(source, "panelOpacity")) {
    if (typeof source.panelOpacity !== "number" || !Number.isFinite(source.panelOpacity)) {
      throw new Error("global.panelOpacity must use the current finite number setting");
    }
    if (source.panelOpacity < 0 || source.panelOpacity > 100 || !Number.isInteger(source.panelOpacity)) {
      throw new Error("global.panelOpacity must be an integer between 0 and 100");
    }
  }
  if (Object.prototype.hasOwnProperty.call(source, "language")) {
    if (typeof source.language !== "string" || !SUPPORTED_LANGUAGES.includes(source.language)) {
      throw new Error("global.language must use the current supported language setting");
    }
  }
  if (Object.prototype.hasOwnProperty.call(source, "appearance")) {
    if (!source.appearance || typeof source.appearance !== "object" || Array.isArray(source.appearance)) {
      throw new Error("global.appearance must use the current object setting");
    }
    const appearance = source.appearance as Record<string, unknown>;
    assertNoUnknownKeys(appearance, APPEARANCE_SETTINGS_KEYS, "global.appearance");
    if (!isAppearanceTheme(appearance.theme)) {
      throw new Error("global.appearance.theme must use the current string setting");
    }
  }
}

export function sanitizeGlobalSettings(input: Partial<GlobalSettings> | null | undefined): GlobalSettings {
  const source = input ?? {};
  const autoLaunch = typeof source.autoLaunch === "boolean" ? source.autoLaunch : DEFAULT_GLOBAL_SETTINGS.autoLaunch;
  const toggleWindowShortcut =
    typeof source.toggleWindowShortcut === "string"
      ? source.toggleWindowShortcut.trim()
      : DEFAULT_GLOBAL_SETTINGS.toggleWindowShortcut;
  const gameProcessBlacklist = sanitizeProcessList(source.gameProcessBlacklist);
  const autoHidePanels = typeof source.autoHidePanels === "boolean" ? source.autoHidePanels : DEFAULT_GLOBAL_SETTINGS.autoHidePanels;
  const alwaysOnTop = isAlwaysOnTopLevel(source.alwaysOnTop)
    ? source.alwaysOnTop
    : DEFAULT_GLOBAL_SETTINGS.alwaysOnTop;
  let panelOpacity = Number(source.panelOpacity);
  if (!Number.isFinite(panelOpacity)) {
    panelOpacity = DEFAULT_GLOBAL_SETTINGS.panelOpacity;
  }
  panelOpacity = Math.min(100, Math.max(0, Math.round(panelOpacity)));
  const languageCandidate =
    typeof source.language === "string" ? source.language.trim().toLowerCase() : "";
  const language =
    languageCandidate && SUPPORTED_LANGUAGES.includes(languageCandidate)
      ? languageCandidate
      : DEFAULT_GLOBAL_SETTINGS.language;
  const appearanceSource =
    source.appearance && typeof source.appearance === "object"
      ? source.appearance
      : {};
  const appearance = {
    theme: isAppearanceTheme((appearanceSource as { theme?: unknown }).theme)
      ? (appearanceSource as { theme: AppearanceTheme }).theme
      : DEFAULT_GLOBAL_SETTINGS.appearance.theme
  };
  return {
    autoLaunch,
    toggleWindowShortcut,
    gameProcessBlacklist,
    autoHidePanels,
    alwaysOnTop,
    panelOpacity,
    language,
    appearance
  };
}
