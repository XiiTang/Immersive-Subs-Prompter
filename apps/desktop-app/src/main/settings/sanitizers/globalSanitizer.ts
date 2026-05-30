import { AppearanceTheme, GlobalSettings } from "../../types.js";
import { SUPPORTED_LANGUAGES } from "../constants.js";
import { assertNoUnknownKeys } from "../utils.js";

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
