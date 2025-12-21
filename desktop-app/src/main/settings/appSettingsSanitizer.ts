import {
  AppSettings,
  CloseBehavior,
  GlobalSettings,
  ProfileSettings
} from "../types.js";
import {
  DEFAULT_CACHE_SETTINGS,
  DEFAULT_MEDIA_SERVER_SETTINGS,
  DEFAULT_NETWORK_SETTINGS,
  DEFAULT_TRANSCRIPTION_SETTINGS
} from "./constants.js";
import { sanitizeGlobalSettings } from "./sanitizers/globalSanitizer.js";
import { sanitizeNetworkSettings } from "./sanitizers/networkSanitizer.js";
import { createDefaultProfile, sanitizeProfileSettings, sanitizeProfiles } from "./sanitizers/profileSanitizer.js";
import { sanitizeRules } from "./sanitizers/ruleSanitizer.js";
import { sanitizeMediaServerSettings } from "./sanitizers/mediaServerSanitizer.js";
import { sanitizeTranscriptionSettings } from "./sanitizers/transcriptionSanitizer.js";
import { sanitizeCacheSettings } from "./sanitizers/cacheSanitizer.js";
import defaultSettings from "../default-settings.json" with { type: "json" };

type LegacySettingsShape = Partial<ProfileSettings> &
  Partial<GlobalSettings> & {
    closeBehavior?: CloseBehavior;
  };

export function sanitizeSettings(input: Partial<AppSettings> | LegacySettingsShape | null | undefined): AppSettings {
  if (!input || typeof input !== "object") {
    return DEFAULT_SETTINGS_FACTORY();
  }

  const looksModern =
    "global" in input ||
    "network" in input ||
    "profiles" in input ||
    "rules" in input ||
    "defaultProfileId" in input ||
    "mediaServer" in input ||
    "jellyfinemby" in input ||
    "transcription" in input ||
    "cache" in input;

  if (looksModern) {
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
    const mediaServer = sanitizeMediaServerSettings((raw as any).mediaServer ?? (raw as any).jellyfinemby);
    const transcription = sanitizeTranscriptionSettings(raw.transcription);
    const cache = sanitizeCacheSettings(raw.cache);
    return {
      global,
      network,
      profiles,
      defaultProfileId,
      rules,
      mediaServer,
      transcription,
      cache
    };
  }

  const legacy = input as LegacySettingsShape;
  const profile = createDefaultProfile();
  profile.settings = sanitizeProfileSettings(legacy);
  const global = sanitizeGlobalSettings(legacy);
  return {
    global,
    network: { ...DEFAULT_NETWORK_SETTINGS },
    profiles: [profile],
    defaultProfileId: profile.id,
    rules: [],
    mediaServer: { ...DEFAULT_MEDIA_SERVER_SETTINGS },
    transcription: { ...DEFAULT_TRANSCRIPTION_SETTINGS },
    cache: { ...DEFAULT_CACHE_SETTINGS }
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
    transcription: base.transcription,
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
  if ((patch as any).jellyfinemby) {
    next.mediaServer = {
      ...next.mediaServer,
      ...(patch as any).jellyfinemby
    };
  }
  if (patch.transcription) {
    next.transcription = {
      ...next.transcription,
      ...patch.transcription
    };
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
