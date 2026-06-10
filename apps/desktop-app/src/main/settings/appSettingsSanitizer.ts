import type { AppSettings } from "../types.js";
import { validateGlobalSettingsForUpdate } from "./sanitizers/globalSanitizer.js";
import { validateNetworkSettingsForUpdate } from "./sanitizers/networkSanitizer.js";
import { validateProfilesForUpdate } from "./sanitizers/profileSanitizer.js";
import { validateRulesForUpdate } from "./sanitizers/ruleSanitizer.js";
import { validateCacheSettingsForUpdate } from "./sanitizers/cacheSanitizer.js";
import { DEFAULT_CACHE_SETTINGS, DEFAULT_PROFILE_ID } from "../../common/defaultSettings.js";
import { createDefaultAppSettings } from "../../common/defaultSettings.js";
import { createConnectionAuthToken } from "../connectionAuth.js";
import { assertNoUnknownKeys } from "./utils.js";

const APP_SETTINGS_KEYS = ["global", "network", "profiles", "defaultProfileId", "rules", "plugins", "cache"] as const;
const PLUGIN_SETTINGS_RECORD_KEYS = ["config"] as const;
const GLOBAL_SETTINGS_KEYS = [
  "autoLaunch",
  "toggleWindowShortcut",
  "gameProcessBlacklist",
  "autoHidePanels",
  "alwaysOnTop",
  "panelOpacity",
  "language",
  "appearance",
  "autoCheckUpdates",
  "lastUpdateCheckAt"
] as const;
const CACHE_SETTINGS_KEYS = Object.keys(DEFAULT_CACHE_SETTINGS);

function validatePluginSettingsRecordForUpdate(pluginKey: string, record: unknown): void {
  if (!record || typeof record !== "object" || Array.isArray(record)) {
    throw new Error(`${pluginKey} plugin settings must use the current object setting`);
  }
  assertNoUnknownKeys(record as Record<string, unknown>, PLUGIN_SETTINGS_RECORD_KEYS, `${pluginKey} plugin settings`);
  if (!Object.prototype.hasOwnProperty.call(record, "config")) {
    throw new Error(`${pluginKey} plugin settings must include the current config object`);
  }
  const config = (record as { config?: unknown }).config;
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    throw new Error(`${pluginKey} plugin config must use the current object setting`);
  }
}

export function sanitizeSettings(input: unknown): AppSettings {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("saved settings must use the current object setting");
  }

  validateSettingsSnapshot(input as AppSettings);
  return input as AppSettings;
}

function validateSettingsSnapshot(input: AppSettings): void {
  assertNoUnknownKeys(input as unknown as Record<string, unknown>, APP_SETTINGS_KEYS, "settings");
  if (input.defaultProfileId !== DEFAULT_PROFILE_ID) {
    throw new Error("settings.defaultProfileId must use the fixed current fallback profile");
  }
  if (!hasRequiredKeys(input.global, GLOBAL_SETTINGS_KEYS)) {
    throw new Error("global settings must include current settings");
  }
  if (!hasRequiredKeys(input.cache, CACHE_SETTINGS_KEYS)) {
    throw new Error("cache settings must include current settings");
  }
  validateGlobalSettingsForUpdate(input.global);
  validateNetworkSettingsForUpdate(input.network);
  const profiles = validateProfilesForUpdate(input.profiles, input.defaultProfileId);
  validateRulesForUpdate(input.rules, profiles, input.defaultProfileId);
  validatePluginSettingsSnapshot(input.plugins);
  validateCacheSettingsForUpdate(input.cache);
}

function hasRequiredKeys(input: unknown, keys: readonly string[]): boolean {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return false;
  }
  const source = input as Record<string, unknown>;
  return keys.every((key) => Object.prototype.hasOwnProperty.call(source, key));
}

function validatePluginSettingsSnapshot(input: unknown): void {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("plugins settings must use the current object setting");
  }
  const source = input as Record<string, unknown>;
  for (const [pluginKey, record] of Object.entries(source)) {
    validatePluginSettingsRecordForUpdate(pluginKey, record);
  }
}

export function validateSettingsForUpdate(
  input: Partial<AppSettings> | null | undefined,
  current: AppSettings
): void {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("settings update must use the current object setting");
  }
  assertNoUnknownKeys(input as Record<string, unknown>, APP_SETTINGS_KEYS, "settings");
  if (Object.prototype.hasOwnProperty.call(input, "defaultProfileId")) {
    throw new Error("defaultProfileId cannot be changed through settings updates");
  }
  if (Object.prototype.hasOwnProperty.call(input, "global")) {
    validateGlobalSettingsForUpdate((input as { global?: unknown }).global);
  }
  if (Object.prototype.hasOwnProperty.call(input, "network")) {
    validateNetworkSettingsForUpdate((input as { network?: unknown }).network);
  }
  const profiles = Object.prototype.hasOwnProperty.call(input, "profiles")
    ? validateProfilesForUpdate((input as { profiles?: unknown }).profiles, current.defaultProfileId)
    : current.profiles;
  if (
    Object.prototype.hasOwnProperty.call(input, "rules") ||
    Object.prototype.hasOwnProperty.call(input, "profiles")
  ) {
    validateRulesForUpdate(
      Object.prototype.hasOwnProperty.call(input, "rules")
        ? (input as { rules?: unknown }).rules
        : current.rules,
      profiles,
      current.defaultProfileId
    );
  }
  const plugins = (input as { plugins?: unknown }).plugins;
  if (plugins !== undefined) {
    if (!plugins || typeof plugins !== "object" || Array.isArray(plugins)) {
      throw new Error("plugins settings must use the current object setting");
    }
    for (const [pluginKey, record] of Object.entries(plugins as Record<string, unknown>)) {
      validatePluginSettingsRecordForUpdate(pluginKey, record);
    }
  }
  if (Object.prototype.hasOwnProperty.call(input, "cache")) {
    validateCacheSettingsForUpdate((input as { cache?: unknown }).cache);
  }
}

export function mergeSettings(base: AppSettings, patch: Partial<AppSettings>): AppSettings {
  const next: AppSettings = {
    global: base.global,
    network: base.network,
    profiles: base.profiles,
    defaultProfileId: base.defaultProfileId,
    rules: base.rules,
    plugins: base.plugins,
    cache: base.cache
  };

  if (patch.global) {
    next.global = { ...base.global, ...patch.global };
  }
  if (patch.network) {
    next.network = { ...base.network, ...patch.network };
  }
  if (patch.profiles) {
    next.profiles = patch.profiles;
  }
  if (patch.rules) {
    next.rules = patch.rules;
  }
  if (patch.plugins) {
    next.plugins = { ...base.plugins, ...patch.plugins };
  }
  if (patch.cache) {
    next.cache = {
      ...next.cache,
      ...patch.cache
    };
  }

  return next;
}

const DEFAULT_SETTINGS_FACTORY = (): AppSettings => {
  return createDefaultAppSettings({
    networkAuthToken: createConnectionAuthToken()
  });
};

export { DEFAULT_SETTINGS_FACTORY };
