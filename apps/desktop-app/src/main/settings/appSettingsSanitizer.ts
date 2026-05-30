import type { AppSettings } from "../types.js";
import { validateGlobalSettingsForUpdate } from "./sanitizers/globalSanitizer.js";
import { validateNetworkSettingsForUpdate } from "./sanitizers/networkSanitizer.js";
import { validateProfilesForUpdate } from "./sanitizers/profileSanitizer.js";
import { validateRulesForUpdate } from "./sanitizers/ruleSanitizer.js";
import {
  validateTranscriptionPluginConfigForUpdate
} from "./sanitizers/transcriptionSanitizer.js";
import {
  validateWordLookupPluginConfigForUpdate
} from "./sanitizers/wordLookupSanitizer.js";
import {
  validateJellyfinembyPluginConfigForUpdate
} from "./sanitizers/jellyfinembySanitizer.js";
import { validateCacheSettingsForUpdate } from "./sanitizers/cacheSanitizer.js";
import { JELLYFINEMBY_PLUGIN_ID, TRANSCRIPTION_PLUGIN_ID, WORD_LOOKUP_PLUGIN_ID } from "../../common/pluginIds.js";
import { DEFAULT_CACHE_SETTINGS, DEFAULT_PROFILE_ID } from "./constants.js";
import { createDefaultAppSettings } from "../../common/defaultSettings.js";
import { createConnectionAuthToken } from "../connectionAuth.js";
import { assertNoUnknownKeys, assertRequiredKeys } from "./utils.js";

const APP_SETTINGS_KEYS = ["global", "network", "profiles", "defaultProfileId", "rules", "plugins", "cache"] as const;
const PLUGIN_SETTINGS_RECORD_KEYS = ["config"] as const;
const BUILTIN_PLUGIN_IDS = [JELLYFINEMBY_PLUGIN_ID, TRANSCRIPTION_PLUGIN_ID, WORD_LOOKUP_PLUGIN_ID] as const;
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
const CACHE_SETTINGS_KEYS = Object.keys(DEFAULT_CACHE_SETTINGS);
type BuiltinPluginId = (typeof BUILTIN_PLUGIN_IDS)[number];

function isBuiltinPluginId(pluginId: string): pluginId is BuiltinPluginId {
  return (BUILTIN_PLUGIN_IDS as readonly string[]).includes(pluginId);
}

function validatePluginSettingsRecordForUpdate(pluginId: string, record: unknown): void {
  if (!record || typeof record !== "object" || Array.isArray(record)) {
    throw new Error(`${pluginId} plugin settings must use the current object setting`);
  }
  assertNoUnknownKeys(record as Record<string, unknown>, PLUGIN_SETTINGS_RECORD_KEYS, `${pluginId} plugin settings`);
  if (!Object.prototype.hasOwnProperty.call(record, "config")) {
    throw new Error(`${pluginId} plugin settings must include the current config object`);
  }
  const config = (record as { config?: unknown }).config;
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    throw new Error(`${pluginId} plugin config must use the current object setting`);
  }

  if (pluginId === JELLYFINEMBY_PLUGIN_ID) {
    validateJellyfinembyPluginConfigForUpdate(config);
  } else if (pluginId === TRANSCRIPTION_PLUGIN_ID) {
    validateTranscriptionPluginConfigForUpdate(config);
  } else if (pluginId === WORD_LOOKUP_PLUGIN_ID) {
    validateWordLookupPluginConfigForUpdate(config);
  }
}

export function sanitizeSettings(input: Partial<AppSettings> | null | undefined): AppSettings {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("settings file must use the current object setting");
  }

  const raw = input as Record<string, unknown>;
  assertNoUnknownKeys(raw, APP_SETTINGS_KEYS, "settings");
  assertRequiredKeys(raw, APP_SETTINGS_KEYS, "settings");

  if (raw.defaultProfileId !== DEFAULT_PROFILE_ID) {
    throw new Error("settings.defaultProfileId must use the fixed current fallback profile");
  }

  validateGlobalSettingsForLoad(raw.global);
  validateNetworkSettingsForUpdate(raw.network);
  const profiles = validateProfilesForUpdate(raw.profiles, DEFAULT_PROFILE_ID);
  validateRulesForUpdate(raw.rules, profiles, DEFAULT_PROFILE_ID);
  validatePluginSettingsForLoad(raw.plugins);
  validateCacheSettingsForLoad(raw.cache);

  return input as AppSettings;
}

function validateGlobalSettingsForLoad(input: unknown): void {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("global settings must use the current object setting");
  }
  const source = input as Record<string, unknown>;
  assertRequiredKeys(source, GLOBAL_SETTINGS_KEYS, "global");
  validateGlobalSettingsForUpdate(input);
}

function validatePluginSettingsForLoad(input: unknown): void {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("plugins settings must use the current object setting");
  }
  const source = input as Record<string, unknown>;
  assertNoUnknownKeys(source, BUILTIN_PLUGIN_IDS, "plugins");
  assertRequiredKeys(source, BUILTIN_PLUGIN_IDS, "plugins");
  for (const pluginId of BUILTIN_PLUGIN_IDS) {
    validatePluginSettingsRecordForUpdate(pluginId, source[pluginId]);
  }
}

function validateCacheSettingsForLoad(input: unknown): void {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("cache settings must use the current object setting");
  }
  assertRequiredKeys(input as Record<string, unknown>, CACHE_SETTINGS_KEYS, "cache");
  validateCacheSettingsForUpdate(input);
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
    for (const [pluginId, record] of Object.entries(plugins as Record<string, unknown>)) {
      if (!isBuiltinPluginId(pluginId)) {
        throw new Error(`plugins contains unknown plugin: ${pluginId}`);
      }
      validatePluginSettingsRecordForUpdate(pluginId, record);
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

export const DEFAULT_SETTINGS: AppSettings = DEFAULT_SETTINGS_FACTORY();
export { DEFAULT_SETTINGS_FACTORY };
