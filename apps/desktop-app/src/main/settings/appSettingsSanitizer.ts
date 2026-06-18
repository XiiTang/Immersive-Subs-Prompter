import type { AppSettings, FeatureSettings } from "../types.js";
import { validateGlobalSettingsForUpdate } from "./sanitizers/globalSanitizer.js";
import { validateNetworkSettingsForUpdate } from "./sanitizers/networkSanitizer.js";
import { validateProfilesForUpdate } from "./sanitizers/profileSanitizer.js";
import { validateRulesForUpdate } from "./sanitizers/ruleSanitizer.js";
import { validateCacheSettingsForUpdate } from "./sanitizers/cacheSanitizer.js";
import { DEFAULT_CACHE_SETTINGS, DEFAULT_PROFILE_ID } from "../../common/defaultSettings.js";
import { createDefaultAppSettings } from "../../common/defaultSettings.js";
import { parseJellyfinEmbyServerUrls } from "../../common/jellyfinEmbyServerUrls.js";
import { DEFAULT_TRANSCRIPTION_YTDLP_ARGS } from "../../common/transcriptionDefaults.js";
import { createConnectionAuthToken } from "../connectionAuth.js";
import { validateYtDlpArgLine } from "../ytDlpArgPolicy.js";
import { assertHttpUrl } from "../networkUrlSafety.js";
import { assertNoUnknownKeys } from "./utils.js";

const APP_SETTINGS_KEYS = ["global", "network", "profiles", "defaultProfileId", "rules", "features", "cache"] as const;
const FEATURE_SETTINGS_KEYS = ["wordLookup", "transcription", "jellyfinEmby"] as const;
const FEATURE_RECORD_KEYS = ["enabled", "config"] as const;
const WORD_LOOKUP_CONFIG_KEYS = ["wordListPath", "modifierKey", "panelWidth", "panelHeight"] as const;
const TRANSCRIPTION_FEATURE_KEYS = ["enabled", "activeConfigId", "configs"] as const;
const TRANSCRIPTION_CONFIG_KEYS = [
  "id",
  "name",
  "provider",
  "baseUrl",
  "apiKey",
  "model",
  "language",
  "prompt",
  "enableWordTimestamps",
  "extraParams",
  "ytDlpArgs",
  "fasterWhisperBinary",
  "fasterWhisperModel",
  "fasterWhisperModelDir",
  "fasterWhisperDevice",
  "fasterWhisperVadFilter",
  "fasterWhisperVadThreshold",
  "fasterWhisperVadMethod",
  "fasterWhisperUseKim2"
] as const;
const JELLYFIN_EMBY_CONFIG_KEYS = ["servers"] as const;
const JELLYFIN_EMBY_SERVER_KEYS = ["id", "name", "serverUrls", "apiKey", "enabled"] as const;
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
  validateFeatureSettingsSnapshot(input.features);
  validateCacheSettingsForUpdate(input.cache);
}

function hasRequiredKeys(input: unknown, keys: readonly string[]): boolean {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return false;
  }
  const source = input as Record<string, unknown>;
  return keys.every((key) => Object.prototype.hasOwnProperty.call(source, key));
}

function validateFeatureSettingsSnapshot(input: unknown): void {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("features settings must use the current object setting");
  }
  const source = input as Record<string, unknown>;
  assertNoUnknownKeys(source, FEATURE_SETTINGS_KEYS, "features");
  validateWordLookupFeature(source.wordLookup, true);
  validateTranscriptionFeature(source.transcription, true);
  validateJellyfinEmbyFeature(source.jellyfinEmby, true);
}

function validateFeatureSettingsForUpdate(input: unknown): void {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("features settings must use the current object setting");
  }
  const source = input as Record<string, unknown>;
  assertNoUnknownKeys(source, FEATURE_SETTINGS_KEYS, "features");
  if (Object.prototype.hasOwnProperty.call(source, "wordLookup")) {
    validateWordLookupFeature(source.wordLookup, false);
  }
  if (Object.prototype.hasOwnProperty.call(source, "transcription")) {
    validateTranscriptionFeature(source.transcription, false);
  }
  if (Object.prototype.hasOwnProperty.call(source, "jellyfinEmby")) {
    validateJellyfinEmbyFeature(source.jellyfinEmby, false);
  }
}

function validateFeatureRecord(input: unknown, context: string, requireAllKeys: boolean): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error(`${context} must use the current object setting`);
  }
  const record = input as Record<string, unknown>;
  assertNoUnknownKeys(record, FEATURE_RECORD_KEYS, context);
  if (requireAllKeys && !hasRequiredKeys(record, FEATURE_RECORD_KEYS)) {
    throw new Error(`${context} must include current settings`);
  }
  if (Object.prototype.hasOwnProperty.call(record, "enabled") && typeof record.enabled !== "boolean") {
    throw new Error(`${context}.enabled must use the current boolean setting`);
  }
  if (!Object.prototype.hasOwnProperty.call(record, "config")) {
    if (requireAllKeys) {
      throw new Error(`${context}.config must use the current object setting`);
    }
    return {};
  }
  if (!record.config || typeof record.config !== "object" || Array.isArray(record.config)) {
    throw new Error(`${context}.config must use the current object setting`);
  }
  return record.config as Record<string, unknown>;
}

function validateWordLookupFeature(input: unknown, requireAllKeys: boolean): void {
  const config = validateFeatureRecord(input, "features.wordLookup", requireAllKeys);
  validateConfigObject(config, WORD_LOOKUP_CONFIG_KEYS, "features.wordLookup.config", requireAllKeys);
  if (Object.prototype.hasOwnProperty.call(config, "wordListPath")) {
    requireString(config, "wordListPath", "features.wordLookup.config");
  }
  if (
    Object.prototype.hasOwnProperty.call(config, "modifierKey") &&
    config.modifierKey !== "alt" &&
    config.modifierKey !== "ctrl" &&
    config.modifierKey !== "shift"
  ) {
    throw new Error("features.wordLookup.config.modifierKey must be alt, ctrl, or shift");
  }
  for (const key of ["panelWidth", "panelHeight"] as const) {
    if (Object.prototype.hasOwnProperty.call(config, key)) {
      requireNumber(config, key, "features.wordLookup.config");
    }
  }
  if (Object.prototype.hasOwnProperty.call(config, "panelWidth")) {
    requireNumberRange(config.panelWidth, "features.wordLookup.config.panelWidth", 260, 720);
  }
  if (Object.prototype.hasOwnProperty.call(config, "panelHeight")) {
    requireNumberRange(config.panelHeight, "features.wordLookup.config.panelHeight", 180, 640);
  }
}

function validateTranscriptionFeature(input: unknown, requireAllKeys: boolean): void {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("features.transcription must use the current object setting");
  }
  const record = input as Record<string, unknown>;
  assertNoUnknownKeys(record, TRANSCRIPTION_FEATURE_KEYS, "features.transcription");
  if (requireAllKeys && !hasRequiredKeys(record, TRANSCRIPTION_FEATURE_KEYS)) {
    throw new Error("features.transcription must include current settings");
  }
  if (Object.prototype.hasOwnProperty.call(record, "enabled")) {
    requireBoolean(record, "enabled", "features.transcription");
  }
  if (Object.prototype.hasOwnProperty.call(record, "activeConfigId")) {
    if (typeof record.activeConfigId !== "string" || !record.activeConfigId.trim()) {
      throw new Error("features.transcription.activeConfigId must reference an existing config");
    }
  }
  if (!Object.prototype.hasOwnProperty.call(record, "configs")) {
    if (requireAllKeys) {
      throw new Error("features.transcription.configs must use the current array setting");
    }
    return;
  }
  if (!Array.isArray(record.configs)) {
    throw new Error("features.transcription.configs must use the current array setting");
  }
  if (!record.configs.length) {
    throw new Error("features.transcription.configs must include at least one config");
  }
  const seenIds = new Set<string>();
  record.configs.forEach((config, index) => {
    validateTranscriptionConfigRecord(config, `features.transcription.configs.${index}`, seenIds);
  });
  if (typeof record.activeConfigId === "string" && !seenIds.has(record.activeConfigId)) {
    throw new Error("features.transcription.activeConfigId must reference an existing config");
  }
}

function validateTranscriptionConfigRecord(input: unknown, context: string, seenIds: Set<string>): void {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error(`${context} must use the current object setting`);
  }
  const config = input as Record<string, unknown>;
  assertNoUnknownKeys(config, TRANSCRIPTION_CONFIG_KEYS, context);
  if (!hasRequiredKeys(config, TRANSCRIPTION_CONFIG_KEYS)) {
    throw new Error(`${context} must include current settings`);
  }
  for (const key of [
    "id",
    "name",
    "baseUrl",
    "apiKey",
    "model",
    "language",
    "prompt",
    "ytDlpArgs",
    "fasterWhisperBinary",
    "fasterWhisperModel",
    "fasterWhisperModelDir",
    "fasterWhisperVadMethod"
  ] as const) {
    requireString(config, key, context);
  }
  if (!(config.id as string).trim()) {
    throw new Error(`${context}.id must be a non-empty string`);
  }
  if (!(config.name as string).trim()) {
    throw new Error(`${context}.name must be a non-empty string`);
  }
  if (seenIds.has(config.id as string)) {
    throw new Error(`${context}.id must be unique`);
  }
  seenIds.add(config.id as string);
  if (config.provider !== "whisper-api" && config.provider !== "faster-whisper") {
    throw new Error(`${context}.provider must be whisper-api or faster-whisper`);
  }
  if (config.provider === "whisper-api") {
    const baseUrl = (config.baseUrl as string).trim();
    if (!baseUrl) {
      throw new Error(`${context}.baseUrl must be a non-empty string for whisper-api`);
    }
    assertHttpUrl(baseUrl, `${context}.baseUrl`);
  }
  validateYtDlpArgLine(
    (config.ytDlpArgs as string).trim() || DEFAULT_TRANSCRIPTION_YTDLP_ARGS,
    "transcription",
    `${context}.ytDlpArgs`
  );
  if (config.fasterWhisperDevice !== "cpu" && config.fasterWhisperDevice !== "cuda") {
    throw new Error(`${context}.fasterWhisperDevice must be cpu or cuda`);
  }
  for (const key of [
    "enableWordTimestamps",
    "fasterWhisperVadFilter",
    "fasterWhisperUseKim2"
  ] as const) {
    requireBoolean(config, key, context);
  }
  if (!config.extraParams || typeof config.extraParams !== "object" || Array.isArray(config.extraParams)) {
    throw new Error(`${context}.extraParams must use the current object setting`);
  }
  for (const [key, value] of Object.entries(config.extraParams as Record<string, unknown>)) {
    if (!key.trim() || key !== key.trim()) {
      throw new Error(`${context}.extraParams keys must be non-empty strings without edge whitespace`);
    }
    if (typeof value !== "string") {
      throw new Error(`${context}.extraParams.${key} must use the current string setting`);
    }
  }
  requireNumber(config, "fasterWhisperVadThreshold", context);
  requireNumberRange(config.fasterWhisperVadThreshold, `${context}.fasterWhisperVadThreshold`, 0, 1);
}

function validateJellyfinEmbyFeature(input: unknown, requireAllKeys: boolean): void {
  const config = validateFeatureRecord(input, "features.jellyfinEmby", requireAllKeys);
  validateConfigObject(config, JELLYFIN_EMBY_CONFIG_KEYS, "features.jellyfinEmby.config", requireAllKeys);
  if (!Object.prototype.hasOwnProperty.call(config, "servers")) {
    return;
  }
  if (!Array.isArray(config.servers)) {
    throw new Error("features.jellyfinEmby.config.servers must use the current array setting");
  }
  config.servers.forEach((server, index) => {
    const context = `features.jellyfinEmby.config.servers.${index}`;
    if (!server || typeof server !== "object" || Array.isArray(server)) {
      throw new Error(`${context} must use the current object setting`);
    }
    const record = server as Record<string, unknown>;
    assertNoUnknownKeys(record, JELLYFIN_EMBY_SERVER_KEYS, context);
    if (!hasRequiredKeys(record, JELLYFIN_EMBY_SERVER_KEYS)) {
      throw new Error(`${context} must include current settings`);
    }
    requireString(record, "id", context);
    requireString(record, "name", context);
    requireString(record, "serverUrls", context);
    requireString(record, "apiKey", context);
    requireBoolean(record, "enabled", context);
    const serverUrls = parseJellyfinEmbyServerUrls(record.serverUrls as string, `${context}.serverUrls`);
    if (record.enabled === true) {
      if (!serverUrls.length) {
        throw new Error(`${context}.serverUrls must include at least one URL when enabled`);
      }
      if (!(record.apiKey as string).trim()) {
        throw new Error(`${context}.apiKey must be a non-empty string when enabled`);
      }
    }
  });
}

function validateConfigObject(
  config: Record<string, unknown>,
  keys: readonly string[],
  context: string,
  requireAllKeys: boolean
): void {
  assertNoUnknownKeys(config, keys, context);
  if (requireAllKeys && !hasRequiredKeys(config, keys)) {
    throw new Error(`${context} must include current settings`);
  }
}

function requireString(source: Record<string, unknown>, key: string, context: string): void {
  if (typeof source[key] !== "string") {
    throw new Error(`${context}.${key} must use the current string setting`);
  }
}

function requireNumber(source: Record<string, unknown>, key: string, context: string): void {
  if (typeof source[key] !== "number" || !Number.isFinite(source[key])) {
    throw new Error(`${context}.${key} must use the current finite number setting`);
  }
}

function requireNumberRange(value: unknown, context: string, min: number, max: number): void {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) {
    throw new Error(`${context} must be between ${min} and ${max}`);
  }
}

function requireBoolean(source: Record<string, unknown>, key: string, context: string): void {
  if (typeof source[key] !== "boolean") {
    throw new Error(`${context}.${key} must use the current boolean setting`);
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
  if (Object.prototype.hasOwnProperty.call(input, "features")) {
    validateFeatureSettingsForUpdate((input as { features?: unknown }).features);
  }
  if (Object.prototype.hasOwnProperty.call(input, "cache")) {
    validateCacheSettingsForUpdate((input as { cache?: unknown }).cache);
  }
  validateSettingsSnapshot(mergeSettings(current, input));
}

export function mergeSettings(base: AppSettings, patch: Partial<AppSettings>): AppSettings {
  const next: AppSettings = {
    global: base.global,
    network: base.network,
    profiles: base.profiles,
    defaultProfileId: base.defaultProfileId,
    rules: base.rules,
    features: base.features,
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
  if (patch.features) {
    next.features = mergeFeatureSettings(base.features, patch.features);
  }
  if (patch.cache) {
    next.cache = {
      ...next.cache,
      ...patch.cache
    };
  }

  return next;
}

function mergeFeatureSettings(base: FeatureSettings, patch: Partial<FeatureSettings>): FeatureSettings {
  return {
    wordLookup: patch.wordLookup
      ? {
          enabled: patch.wordLookup.enabled ?? base.wordLookup.enabled,
          config: { ...base.wordLookup.config, ...patch.wordLookup.config }
        }
      : base.wordLookup,
    transcription: patch.transcription
      ? {
          enabled: patch.transcription.enabled ?? base.transcription.enabled,
          activeConfigId: patch.transcription.activeConfigId ?? base.transcription.activeConfigId,
          configs: patch.transcription.configs
            ? patch.transcription.configs.map((config) => ({
                ...config,
                extraParams: { ...config.extraParams }
              }))
            : base.transcription.configs.map((config) => ({
                ...config,
                extraParams: { ...config.extraParams }
              }))
        }
      : base.transcription,
    jellyfinEmby: patch.jellyfinEmby
      ? {
          enabled: patch.jellyfinEmby.enabled ?? base.jellyfinEmby.enabled,
          config: {
            ...base.jellyfinEmby.config,
            ...patch.jellyfinEmby.config
          }
        }
      : base.jellyfinEmby
  };
}

const DEFAULT_SETTINGS_FACTORY = (): AppSettings => {
  return createDefaultAppSettings({
    networkAuthToken: createConnectionAuthToken()
  });
};

export { DEFAULT_SETTINGS_FACTORY };
