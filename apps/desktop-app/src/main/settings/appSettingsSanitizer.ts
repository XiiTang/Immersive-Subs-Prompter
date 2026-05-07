import { AppSettings, PluginSettingsRecord } from "../types.js";
import { sanitizeGlobalSettings } from "./sanitizers/globalSanitizer.js";
import { sanitizeNetworkSettings } from "./sanitizers/networkSanitizer.js";
import { sanitizeProfiles } from "./sanitizers/profileSanitizer.js";
import { sanitizeRules } from "./sanitizers/ruleSanitizer.js";
import { sanitizeMediaServerSettings } from "./sanitizers/mediaServerSanitizer.js";
import { sanitizeTranscriptionPluginConfig } from "./sanitizers/transcriptionSanitizer.js";
import { sanitizeWordLookupPluginConfig } from "./sanitizers/wordLookupSanitizer.js";
import { sanitizeCacheSettings } from "./sanitizers/cacheSanitizer.js";
import defaultSettings from "../default-settings.json" with { type: "json" };
import { TRANSCRIPTION_PLUGIN_ID, WORD_LOOKUP_PLUGIN_ID } from "../../common/pluginIds.js";

function sanitizePluginSettings(
  input: Partial<AppSettings>["plugins"]
): Record<string, PluginSettingsRecord> {
  if (!input || typeof input !== "object") return {};
  const result: Record<string, PluginSettingsRecord> = {};
  for (const [pluginId, record] of Object.entries(input as Record<string, unknown>)) {
    if (!record || typeof record !== "object") continue;
    const config = (record as { config?: unknown }).config;
    result[pluginId] = {
      config:
        pluginId === TRANSCRIPTION_PLUGIN_ID
          ? (sanitizeTranscriptionPluginConfig(config as Record<string, unknown>) as unknown as Record<string, unknown>)
          : pluginId === WORD_LOOKUP_PLUGIN_ID
            ? (sanitizeWordLookupPluginConfig(config as Record<string, unknown>) as unknown as Record<string, unknown>)
            : config && typeof config === "object"
              ? (config as Record<string, unknown>)
              : {}
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
  const mediaServer = sanitizeMediaServerSettings(raw.mediaServer);
  const plugins = sanitizePluginSettings(raw.plugins);
  const cache = sanitizeCacheSettings(raw.cache);
  return {
    global,
    network,
    profiles,
    defaultProfileId,
    rules,
    mediaServer,
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
    mediaServer: base.mediaServer,
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
  if ((patch as any).mediaServer) {
    next.mediaServer = {
      ...next.mediaServer,
      ...(patch as any).mediaServer
    };
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
