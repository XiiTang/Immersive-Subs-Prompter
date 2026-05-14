import type { AppSettings, PluginSettingsRecord } from "../types.js";
import { sanitizeGlobalSettings } from "./sanitizers/globalSanitizer.js";
import { sanitizeNetworkSettings } from "./sanitizers/networkSanitizer.js";
import { sanitizeProfiles } from "./sanitizers/profileSanitizer.js";
import { sanitizeRules } from "./sanitizers/ruleSanitizer.js";
import { sanitizeTranscriptionPluginConfig } from "./sanitizers/transcriptionSanitizer.js";
import { sanitizeWordLookupPluginConfig } from "./sanitizers/wordLookupSanitizer.js";
import { sanitizeJellyfinembyPluginConfig } from "./sanitizers/jellyfinembySanitizer.js";
import { sanitizeCacheSettings } from "./sanitizers/cacheSanitizer.js";
import defaultSettings from "../default-settings.json" with { type: "json" };
import { JELLYFINEMBY_PLUGIN_ID, TRANSCRIPTION_PLUGIN_ID, WORD_LOOKUP_PLUGIN_ID } from "../../common/pluginIds.js";

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

export function sanitizeSettings(input: Partial<AppSettings> | null | undefined): AppSettings {
  if (!input || typeof input !== "object") {
    return DEFAULT_SETTINGS_FACTORY();
  }

  const raw = input as Partial<AppSettings>;
  const global = sanitizeGlobalSettings(raw.global);
  const network = sanitizeNetworkSettings(raw.network);
  const profiles = sanitizeProfiles(raw.profiles);
  const requestedDefaultId =
    typeof raw.defaultProfileId === "string" && raw.defaultProfileId.trim().length
      ? raw.defaultProfileId.trim()
      : profiles[0].id;
  const defaultProfileId = profiles.some((profile) => profile.id === requestedDefaultId)
    ? requestedDefaultId
    : profiles[0].id;
  const rules = sanitizeRules(raw.rules, profiles, defaultProfileId);
  const plugins = sanitizePluginSettings(raw.plugins);
  const cache = sanitizeCacheSettings(raw.cache);
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
  if (typeof patch.defaultProfileId === "string") {
    next.defaultProfileId = patch.defaultProfileId;
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
  return sanitizeSettings(defaultSettings as any);
};

export const DEFAULT_SETTINGS: AppSettings = DEFAULT_SETTINGS_FACTORY();
export { DEFAULT_SETTINGS_FACTORY };
