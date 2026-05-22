import { AppearanceTheme, CloseBehavior, GlobalSettings } from "../../types.js";
import { DEFAULT_GLOBAL_SETTINGS, SUPPORTED_LANGUAGES } from "../constants.js";
import { sanitizeProcessList } from "../utils.js";

function isCloseBehavior(value: unknown): value is CloseBehavior {
  return value === "quit" || value === "tray";
}

function isAppearanceTheme(value: unknown): value is AppearanceTheme {
  return value === "system" || value === "light" || value === "dark";
}

export function sanitizeGlobalSettings(input: Partial<GlobalSettings> | null | undefined): GlobalSettings {
  const source = input ?? {};
  const closeBehavior = isCloseBehavior(source.closeBehavior) ? source.closeBehavior : DEFAULT_GLOBAL_SETTINGS.closeBehavior;
  const autoLaunch = typeof source.autoLaunch === "boolean" ? source.autoLaunch : DEFAULT_GLOBAL_SETTINGS.autoLaunch;
  const toggleWindowShortcut =
    typeof source.toggleWindowShortcut === "string" && source.toggleWindowShortcut.trim().length
      ? source.toggleWindowShortcut.trim()
      : DEFAULT_GLOBAL_SETTINGS.toggleWindowShortcut;
  const gameProcessBlacklist = sanitizeProcessList(source.gameProcessBlacklist);
  const autoHidePanels = typeof source.autoHidePanels === "boolean" ? source.autoHidePanels : DEFAULT_GLOBAL_SETTINGS.autoHidePanels;
  let alwaysOnTop: "off" | "floating" | "screen-saver" = DEFAULT_GLOBAL_SETTINGS.alwaysOnTop;
  if (typeof source.alwaysOnTop === "boolean") {
    alwaysOnTop = source.alwaysOnTop ? "floating" : "off";
  } else if (source.alwaysOnTop === "off" || source.alwaysOnTop === "floating" || source.alwaysOnTop === "screen-saver") {
    alwaysOnTop = source.alwaysOnTop;
  }
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
    closeBehavior,
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
