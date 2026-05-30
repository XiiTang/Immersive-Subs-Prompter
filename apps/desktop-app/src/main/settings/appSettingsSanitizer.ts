import type { AppSettings, PluginSettingsRecord } from "../types.js";
import { sanitizeGlobalSettings, validateGlobalSettingsForUpdate } from "./sanitizers/globalSanitizer.js";
import { sanitizeNetworkSettings } from "./sanitizers/networkSanitizer.js";
import { ensureFallbackProfileLast, sanitizeProfiles, validateProfilesForUpdate } from "./sanitizers/profileSanitizer.js";
import { sanitizeRules, validateRulesForUpdate } from "./sanitizers/ruleSanitizer.js";
import {
  sanitizeTranscriptionPluginConfig,
  validateTranscriptionPluginConfigForUpdate
} from "./sanitizers/transcriptionSanitizer.js";
import {
  sanitizeWordLookupPluginConfig,
  validateWordLookupPluginConfigForUpdate
} from "./sanitizers/wordLookupSanitizer.js";
import {
  sanitizeJellyfinembyPluginConfig,
  validateJellyfinembyPluginConfigForUpdate
} from "./sanitizers/jellyfinembySanitizer.js";
import { sanitizeCacheSettings, validateCacheSettingsForUpdate } from "./sanitizers/cacheSanitizer.js";
import { JELLYFINEMBY_PLUGIN_ID, TRANSCRIPTION_PLUGIN_ID, WORD_LOOKUP_PLUGIN_ID } from "../../common/pluginIds.js";
import { DEFAULT_PROFILE_ID } from "./constants.js";
import { createDefaultAppSettings } from "../../common/defaultSettings.js";
import { createConnectionAuthToken } from "../connectionAuth.js";
import { assertNoUnknownKeys } from "./utils.js";

const APP_SETTINGS_KEYS = ["global", "network", "profiles", "defaultProfileId", "rules", "plugins", "cache"] as const;
const PLUGIN_SETTINGS_RECORD_KEYS = ["config"] as const;

function sanitizePluginConfig(pluginId: string, config: unknown): Record<string, unknown> {
  if (pluginId === JELLYFINEMBY_PLUGIN_ID) {
    return sanitizeJellyfinembyPluginConfig(config as Record<string, unknown>) as unknown as Record<string, unknown>;
  }
  if (pluginId === TRANSCRIPTION_PLUGIN_ID) {
    return sanitizeTranscriptionPluginConfig(config as Record<string, unknown>) as unknown as Record<string, unknown>;
  }
  if (pluginId === WORD_LOOKUP_PLUGIN_ID) {
    return sanitizeWordLookupPluginConfig(config as Record<string, unknown>) as unknown as Record<string, unknown>;
  }
  return config && typeof config === "object" ? (config as Record<string, unknown>) : {};
}

function sanitizePluginSettings(
  input: Partial<AppSettings>["plugins"]
): Record<string, PluginSettingsRecord> {
  const result: Record<string, PluginSettingsRecord> = {
    [JELLYFINEMBY_PLUGIN_ID]: {
      config: sanitizeJellyfinembyPluginConfig(undefined) as unknown as Record<string, unknown>
    },
    [TRANSCRIPTION_PLUGIN_ID]: {
      config: sanitizeTranscriptionPluginConfig(undefined) as unknown as Record<string, unknown>
    },
    [WORD_LOOKUP_PLUGIN_ID]: {
      config: sanitizeWordLookupPluginConfig(undefined) as unknown as Record<string, unknown>
    }
  };
  if (!input || typeof input !== "object") return result;
  for (const [pluginId, record] of Object.entries(input as Record<string, unknown>)) {
    if (!record || typeof record !== "object") continue;
    const config = (record as { config?: unknown }).config;
    result[pluginId] = {
      config: sanitizePluginConfig(pluginId, config)
    };
  }
  return result;
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
  if (!input || typeof input !== "object") {
    return DEFAULT_SETTINGS_FACTORY();
  }

  const raw = input as Partial<AppSettings>;
  const defaults = DEFAULT_SETTINGS_FACTORY();
  const global = sanitizeGlobalSettings(raw.global ?? defaults.global);
  const network = sanitizeNetworkSettings(raw.network ?? defaults.network);
  const sanitizedProfiles = sanitizeProfiles(raw.profiles ?? defaults.profiles);
  const defaultProfileId = DEFAULT_PROFILE_ID;
  const profiles = ensureFallbackProfileLast(sanitizedProfiles, defaultProfileId);
  const rules = sanitizeRules(raw.rules ?? defaults.rules, profiles, defaultProfileId);
  const plugins = sanitizePluginSettings(raw.plugins ?? defaults.plugins);
  const cache = sanitizeCacheSettings(raw.cache ?? defaults.cache);
  return {
    global,
    network,
    profiles,
    defaultProfileId,
    rules,
    plugins,
    cache
  };
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
