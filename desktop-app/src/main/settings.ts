import { randomUUID } from "crypto";
import { app } from "electron";
import fs from "fs";
import path from "path";
import {
  AppSettings,
  CloseBehavior,
  GlobalSettings,
  JellyfinConfig,
  JellyfinSettings,
  ProfileDefinition,
  ProfileRule,
  ProfileSettings,
  SubtitleCacheSettings,
  UrlMatchType
} from "./types.js";
import { createLogger } from "./logger.js";
import { DEFAULT_AUTO_HIDE_ZONE_HEIGHT, clampAutoHideZoneHeight } from "../common/autoHide.js";

export const DEFAULT_YTDLP_ARGS = "--skip-download --write-subs --all-subs --cookies-from-browser firefox";
export const DEFAULT_PROFILE_ID = "default-profile";
const DEFAULT_PROFILE_NAME = "Default Profile";

const DEFAULT_SUBTITLE_PRIMARY_COLOR = "#f5f5f5";
const DEFAULT_SUBTITLE_SECONDARY_COLOR = "#c7d2fe";
const DEFAULT_SUBTITLE_ACTIVE_PRIMARY_COLOR = "#fff8dc";
const DEFAULT_SUBTITLE_ACTIVE_SECONDARY_COLOR = "#fff9c4";

const MATCH_TYPES: UrlMatchType[] = ["contains", "exact", "regex"];

const DEFAULT_GLOBAL_SETTINGS: GlobalSettings = {
  closeBehavior: "tray",
  autoLaunch: false,
  toggleWindowShortcut: "CommandOrControl+Shift+S",
  gameProcessBlacklist: [],
  autoHidePanels: false,
  autoHideActiveZoneHeight: DEFAULT_AUTO_HIDE_ZONE_HEIGHT,
  alwaysOnTop: false,
  panelOpacity: 100
};

export const DEFAULT_PROFILE_SETTINGS: ProfileSettings = {
  subtitleFontFamily: "",
  subtitleFontSize: 14,
  subtitleLineSpacing: 0,
  subtitleTimeTextGap: 2,
  subtitlePrimarySecondaryGap: 3,
  subtitleLineHeight: 1.45,
  subtitlePrimaryColor: DEFAULT_SUBTITLE_PRIMARY_COLOR,
  subtitleSecondaryColor: DEFAULT_SUBTITLE_SECONDARY_COLOR,
  subtitleActivePrimaryColor: DEFAULT_SUBTITLE_ACTIVE_PRIMARY_COLOR,
  subtitleActiveSecondaryColor: DEFAULT_SUBTITLE_ACTIVE_SECONDARY_COLOR,
  ytDlpArgs: "",
  subtitleAutoScrollTimeout: 3,
  subtitleScrollPosition: 33,
  primarySubtitlePriority: [],
  secondarySubtitlePriority: []
};

export const DEFAULT_JELLYFIN_SETTINGS: JellyfinSettings = {
  enabled: false,
  configs: []
};

export const DEFAULT_CACHE_SETTINGS: SubtitleCacheSettings = {
  enabled: true,
  path: path.join(app.getPath("userData"), "subtitle-cache"),
  retentionDays: 7
};

const DEFAULT_SETTINGS_FACTORY = (): AppSettings => ({
  global: { ...DEFAULT_GLOBAL_SETTINGS },
  profiles: [createDefaultProfile()],
  defaultProfileId: DEFAULT_PROFILE_ID,
  rules: [],
  jellyfin: { ...DEFAULT_JELLYFIN_SETTINGS },
  cache: { ...DEFAULT_CACHE_SETTINGS }
});

export const DEFAULT_SETTINGS: AppSettings = DEFAULT_SETTINGS_FACTORY();

function createDefaultProfile(): ProfileDefinition {
  return {
    id: DEFAULT_PROFILE_ID,
    name: DEFAULT_PROFILE_NAME,
    description: null,
    settings: sanitizeProfileSettings(DEFAULT_PROFILE_SETTINGS)
  };
}

function isCloseBehavior(value: unknown): value is CloseBehavior {
  return value === "quit" || value === "tray";
}

function sanitizePriorityList(value: unknown): string[] {
  if (!value) {
    return [];
  }
  const items = Array.isArray(value) ? value : [value];
  return items
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item): item is string => Boolean(item.length));
}

function sanitizeProcessList(value: unknown): string[] {
  if (!value) {
    return [];
  }
  const items = Array.isArray(value) ? value : [value];
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const item of items) {
    if (typeof item !== "string") {
      continue;
    }
    const trimmed = item.trim();
    if (!trimmed.length) {
      continue;
    }
    const lowercase = trimmed.toLowerCase();
    if (seen.has(lowercase)) {
      continue;
    }
    seen.add(lowercase);
    normalized.push(trimmed);
  }
  return normalized;
}

function normalizeColor(value: unknown, fallback: string): string {
  if (typeof value !== "string") {
    return fallback;
  }
  const trimmed = value.trim();
  return trimmed.length ? trimmed : fallback;
}

function sanitizeProfileSettings(input: Partial<ProfileSettings> | null | undefined): ProfileSettings {
  const source = input ?? {};
  const subtitleFontFamily =
    typeof source.subtitleFontFamily === "string" ? source.subtitleFontFamily.trim() : DEFAULT_PROFILE_SETTINGS.subtitleFontFamily;

  let subtitleFontSize = Number(source.subtitleFontSize);
  if (!Number.isFinite(subtitleFontSize)) {
    subtitleFontSize = DEFAULT_PROFILE_SETTINGS.subtitleFontSize;
  }
  subtitleFontSize = Math.min(48, Math.max(10, Math.round(subtitleFontSize)));

  let subtitleLineSpacing = Number(source.subtitleLineSpacing);
  if (!Number.isFinite(subtitleLineSpacing)) {
    subtitleLineSpacing = DEFAULT_PROFILE_SETTINGS.subtitleLineSpacing;
  }
  subtitleLineSpacing = Math.min(60, Math.max(0, Math.round(subtitleLineSpacing)));

  let subtitleTimeTextGap = Number(source.subtitleTimeTextGap);
  if (!Number.isFinite(subtitleTimeTextGap)) {
    subtitleTimeTextGap = DEFAULT_PROFILE_SETTINGS.subtitleTimeTextGap;
  }
  subtitleTimeTextGap = Math.min(60, Math.max(0, Math.round(subtitleTimeTextGap)));

  let subtitlePrimarySecondaryGap = Number(source.subtitlePrimarySecondaryGap);
  if (!Number.isFinite(subtitlePrimarySecondaryGap)) {
    subtitlePrimarySecondaryGap = DEFAULT_PROFILE_SETTINGS.subtitlePrimarySecondaryGap;
  }
  subtitlePrimarySecondaryGap = Math.min(60, Math.max(0, Math.round(subtitlePrimarySecondaryGap)));

  let subtitleLineHeight = Number(source.subtitleLineHeight);
  if (!Number.isFinite(subtitleLineHeight)) {
    subtitleLineHeight = DEFAULT_PROFILE_SETTINGS.subtitleLineHeight;
  }
  subtitleLineHeight = Number(Math.min(3, Math.max(1, subtitleLineHeight)).toFixed(2));

  const subtitlePrimaryColor = normalizeColor(
    source.subtitlePrimaryColor,
    DEFAULT_PROFILE_SETTINGS.subtitlePrimaryColor
  );
  const subtitleSecondaryColor = normalizeColor(
    source.subtitleSecondaryColor,
    DEFAULT_PROFILE_SETTINGS.subtitleSecondaryColor
  );
  const subtitleActivePrimaryColor = normalizeColor(
    source.subtitleActivePrimaryColor,
    DEFAULT_PROFILE_SETTINGS.subtitleActivePrimaryColor
  );
  const subtitleActiveSecondaryColor = normalizeColor(
    source.subtitleActiveSecondaryColor,
    DEFAULT_PROFILE_SETTINGS.subtitleActiveSecondaryColor
  );

  const ytDlpArgs = typeof source.ytDlpArgs === "string" ? source.ytDlpArgs.trim() : DEFAULT_PROFILE_SETTINGS.ytDlpArgs;

  let subtitleAutoScrollTimeout = Number(source.subtitleAutoScrollTimeout);
  if (!Number.isFinite(subtitleAutoScrollTimeout)) {
    subtitleAutoScrollTimeout = DEFAULT_PROFILE_SETTINGS.subtitleAutoScrollTimeout;
  }
  subtitleAutoScrollTimeout = Math.max(1, Math.round(subtitleAutoScrollTimeout));

  let subtitleScrollPosition = Number(source.subtitleScrollPosition);
  if (!Number.isFinite(subtitleScrollPosition)) {
    subtitleScrollPosition = DEFAULT_PROFILE_SETTINGS.subtitleScrollPosition;
  }
  subtitleScrollPosition = Math.min(100, Math.max(0, Math.round(subtitleScrollPosition)));

  const primarySubtitlePriority = sanitizePriorityList(source.primarySubtitlePriority);
  const secondarySubtitlePriority = sanitizePriorityList(source.secondarySubtitlePriority);

  return {
    subtitleFontFamily,
    subtitleFontSize,
    subtitleLineSpacing,
    subtitleTimeTextGap,
    subtitlePrimarySecondaryGap,
    subtitleLineHeight,
    subtitlePrimaryColor,
    subtitleSecondaryColor,
    subtitleActivePrimaryColor,
    subtitleActiveSecondaryColor,
    ytDlpArgs,
    subtitleAutoScrollTimeout,
    subtitleScrollPosition,
    primarySubtitlePriority,
    secondarySubtitlePriority
  };
}

function sanitizeGlobalSettings(input: Partial<GlobalSettings> | null | undefined): GlobalSettings {
  const source = input ?? {};
  const closeBehavior = isCloseBehavior(source.closeBehavior) ? source.closeBehavior : DEFAULT_GLOBAL_SETTINGS.closeBehavior;
  const autoLaunch = typeof source.autoLaunch === "boolean" ? source.autoLaunch : DEFAULT_GLOBAL_SETTINGS.autoLaunch;
  const toggleWindowShortcut =
    typeof source.toggleWindowShortcut === "string" && source.toggleWindowShortcut.trim().length
      ? source.toggleWindowShortcut.trim()
      : DEFAULT_GLOBAL_SETTINGS.toggleWindowShortcut;
  const gameProcessBlacklist = sanitizeProcessList(source.gameProcessBlacklist);
  const autoHidePanels = typeof source.autoHidePanels === "boolean" ? source.autoHidePanels : DEFAULT_GLOBAL_SETTINGS.autoHidePanels;
  const autoHideActiveZoneHeight = clampAutoHideZoneHeight(Number(source.autoHideActiveZoneHeight));
  const alwaysOnTop = typeof source.alwaysOnTop === "boolean" ? source.alwaysOnTop : DEFAULT_GLOBAL_SETTINGS.alwaysOnTop;
  let panelOpacity = Number(source.panelOpacity);
  if (!Number.isFinite(panelOpacity)) {
    panelOpacity = DEFAULT_GLOBAL_SETTINGS.panelOpacity;
  }
  panelOpacity = Math.min(100, Math.max(0, Math.round(panelOpacity)));
  return {
    closeBehavior,
    autoLaunch,
    toggleWindowShortcut,
    gameProcessBlacklist,
    autoHidePanels,
    autoHideActiveZoneHeight,
    alwaysOnTop,
    panelOpacity
  };
}

function ensureUniqueId(preferredId: string | undefined, used: Set<string>, prefix: string): string {
  const base = preferredId && preferredId.trim().length ? preferredId.trim() : `${prefix}-${randomUUID()}`;
  let candidate = base;
  let counter = 1;
  while (used.has(candidate)) {
    candidate = `${base}-${counter++}`;
  }
  used.add(candidate);
  return candidate;
}

function sanitizeProfiles(input: unknown): ProfileDefinition[] {
  if (!Array.isArray(input) || !input.length) {
    return [createDefaultProfile()];
  }

  const used = new Set<string>();
  const profiles: ProfileDefinition[] = [];

  for (const raw of input) {
    if (!raw || typeof raw !== "object") {
      continue;
    }
    const source = raw as Partial<ProfileDefinition>;
    const id = ensureUniqueId(source.id, used, "profile");
    const name = typeof source.name === "string" && source.name.trim().length ? source.name.trim() : "Unnamed Profile";
    const description =
      typeof source.description === "string" && source.description.trim().length ? source.description.trim() : null;
    const settings = sanitizeProfileSettings(source.settings);
    profiles.push({ id, name, description, settings });
  }

  if (!profiles.length) {
    return [createDefaultProfile()];
  }

  return profiles;
}

function isMatchType(value: unknown): value is UrlMatchType {
  return typeof value === "string" && MATCH_TYPES.includes(value as UrlMatchType);
}

function sanitizeRules(raw: unknown, profiles: ProfileDefinition[], fallbackProfileId: string): ProfileRule[] {
  if (!Array.isArray(raw) || !profiles.length) {
    return [];
  }
  const profileIds = new Set(profiles.map((profile) => profile.id));
  const used = new Set<string>();
  const rules: ProfileRule[] = [];

  for (const candidate of raw) {
    if (!candidate || typeof candidate !== "object") {
      continue;
    }
    const source = candidate as Partial<ProfileRule>;
    const pattern = typeof source.pattern === "string" ? source.pattern.trim() : "";
    if (!pattern.length) {
      continue;
    }
    const id = ensureUniqueId(source.id, used, "rule");
    const matchType = isMatchType(source.matchType) ? source.matchType : "contains";
    const profileId =
      typeof source.profileId === "string" && profileIds.has(source.profileId) ? source.profileId : fallbackProfileId;
    const name = typeof source.name === "string" && source.name.trim().length ? source.name.trim() : pattern;
    const isEnabled = typeof source.isEnabled === "boolean" ? source.isEnabled : true;
    rules.push({
      id,
      name,
      pattern,
      matchType,
      profileId,
      isEnabled
    });
  }

  return rules;
}

function sanitizeJellyfinConfig(
  input: Partial<JellyfinConfig> | null | undefined,
  fallbackId?: string,
  fallbackEnabled?: boolean
): JellyfinConfig {
  const id = typeof input?.id === "string" && input.id.trim() ? input.id.trim() : (fallbackId || randomUUID());
  const name = typeof input?.name === "string" ? input.name.trim() : "Jellyfin Server";
  const serverUrl = typeof input?.serverUrl === "string" ? input.serverUrl.trim() : "";
  const apiKey = typeof input?.apiKey === "string" ? input.apiKey.trim() : "";
  let webSocketPath = typeof input?.webSocketPath === "string" ? input.webSocketPath.trim() : "/socket";
  
  if (!webSocketPath.length) {
    webSocketPath = "/socket";
  }
  if (!webSocketPath.startsWith("/")) {
    webSocketPath = `/${webSocketPath}`;
  }
  const enabled =
    typeof input?.enabled === "boolean"
      ? input.enabled
      : typeof fallbackEnabled === "boolean"
        ? fallbackEnabled
        : false;
  
  return {
    id,
    name,
    serverUrl,
    apiKey,
    webSocketPath,
    enabled
  };
}

function sanitizeJellyfinSettings(input: Partial<JellyfinSettings> | null | undefined): JellyfinSettings {
  const source = input ?? {};
  const enabled = typeof source.enabled === "boolean" ? source.enabled : DEFAULT_JELLYFIN_SETTINGS.enabled;
  
  let configs: JellyfinConfig[] = [];
  const hasExplicitEnabledFlags =
    Array.isArray(source.configs) &&
    source.configs.some((config) => typeof (config as Partial<JellyfinConfig> | undefined)?.enabled === "boolean");
  
  // Migration: check if old format exists (serverUrl, apiKey, webSocketPath directly in settings)
  const hasOldFormat = 'serverUrl' in source || 'apiKey' in source || 'webSocketPath' in source;
  
  if (hasOldFormat) {
    // Convert old single config to new format
    const oldServerUrl = typeof (source as any).serverUrl === "string" ? (source as any).serverUrl.trim() : "";
    const oldApiKey = typeof (source as any).apiKey === "string" ? (source as any).apiKey.trim() : "";
    const oldWebSocketPath = typeof (source as any).webSocketPath === "string" ? (source as any).webSocketPath.trim() : "/socket";
    
    if (oldServerUrl || oldApiKey) {
      configs.push(sanitizeJellyfinConfig({
        id: 'jellyfin-config-migrated',
        name: 'Jellyfin Server',
        serverUrl: oldServerUrl,
        apiKey: oldApiKey,
        webSocketPath: oldWebSocketPath,
        enabled: true
      }));
    }
  } else if (Array.isArray(source.configs)) {
    configs = source.configs.map((config, index) => 
      sanitizeJellyfinConfig(config, `jellyfin-config-${index}`)
    );
  }
  
  if (!hasExplicitEnabledFlags && configs.length > 0) {
    const legacyActiveConfigIdRaw = (source as { activeConfigId?: string }).activeConfigId;
    const legacyActiveConfigId =
      typeof legacyActiveConfigIdRaw === "string" && legacyActiveConfigIdRaw.trim() ? legacyActiveConfigIdRaw.trim() : null;
    const enabledConfigId = legacyActiveConfigId ?? configs[0].id;
    configs = configs.map((config) => ({
      ...config,
      enabled: config.id === enabledConfigId
    }));
  }
  
  return {
    enabled,
    configs
  };
}

function sanitizeCacheSettings(input: Partial<SubtitleCacheSettings> | null | undefined): SubtitleCacheSettings {
  const source = input ?? {};
  const enabled = typeof source.enabled === "boolean" ? source.enabled : DEFAULT_CACHE_SETTINGS.enabled;
  const path = typeof source.path === "string" && source.path.trim() ? source.path.trim() : DEFAULT_CACHE_SETTINGS.path;
  
  let retentionDays = Number(source.retentionDays);
  if (!Number.isFinite(retentionDays) || retentionDays < 1) {
    retentionDays = DEFAULT_CACHE_SETTINGS.retentionDays;
  }
  retentionDays = Math.min(365, Math.max(1, Math.round(retentionDays)));
  
  return {
    enabled,
    path,
    retentionDays
  };
}

type LegacySettingsShape = Partial<ProfileSettings> &
  Partial<GlobalSettings> & {
    closeBehavior?: CloseBehavior;
  };

function sanitizeSettings(input: Partial<AppSettings> | LegacySettingsShape | null | undefined): AppSettings {
  if (!input || typeof input !== "object") {
    return DEFAULT_SETTINGS_FACTORY();
  }

  const looksModern =
    "global" in input || "profiles" in input || "rules" in input || "defaultProfileId" in input || "jellyfin" in input || "cache" in input;

  if (looksModern) {
    const raw = input as Partial<AppSettings>;
    const global = sanitizeGlobalSettings(raw.global);
    const profiles = sanitizeProfiles(raw.profiles);
    const requestedDefaultId =
      typeof raw.defaultProfileId === "string" && raw.defaultProfileId.trim().length
        ? raw.defaultProfileId.trim()
        : profiles[0].id;
    const defaultProfileId = profiles.some((profile) => profile.id === requestedDefaultId)
      ? requestedDefaultId
      : profiles[0].id;
    const rules = sanitizeRules(raw.rules, profiles, defaultProfileId);
    const jellyfin = sanitizeJellyfinSettings(raw.jellyfin);
    const cache = sanitizeCacheSettings(raw.cache);
    return {
      global,
      profiles,
      defaultProfileId,
      rules,
      jellyfin,
      cache
    };
  }

  // Legacy single-profile format
  const legacy = input as LegacySettingsShape;
  const profile = createDefaultProfile();
  profile.settings = sanitizeProfileSettings(legacy);
  const global = sanitizeGlobalSettings(legacy);
  return {
    global,
    profiles: [profile],
    defaultProfileId: profile.id,
    rules: [],
    jellyfin: { ...DEFAULT_JELLYFIN_SETTINGS },
    cache: { ...DEFAULT_CACHE_SETTINGS }
  };
}

function mergeSettings(base: AppSettings, patch: Partial<AppSettings>): AppSettings {
  const next: AppSettings = {
    global: base.global,
    profiles: base.profiles,
    defaultProfileId: base.defaultProfileId,
    rules: base.rules,
    jellyfin: base.jellyfin,
    cache: base.cache
  };

  if (patch.global) {
    next.global = { ...base.global, ...patch.global };
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
  if (patch.jellyfin) {
    next.jellyfin = {
      ...next.jellyfin,
      ...patch.jellyfin
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

export class SettingsStore {
  private readonly filePath: string;
  private data: AppSettings = DEFAULT_SETTINGS_FACTORY();
  private readonly log = createLogger("settings");

  constructor() {
    this.filePath = path.join(app.getPath("userData"), "settings.json");
    this.data = DEFAULT_SETTINGS_FACTORY();
    this.load();
  }

  private load() {
    try {
      if (!fs.existsSync(this.filePath)) {
        this.data = DEFAULT_SETTINGS_FACTORY();
        return;
      }
      const raw = fs.readFileSync(this.filePath, "utf-8");
      const parsed = JSON.parse(raw);
      this.data = sanitizeSettings(parsed);
    } catch (error) {
      this.log.error("Failed to read settings:", error);
      this.data = DEFAULT_SETTINGS_FACTORY();
    }
  }

  private save() {
    try {
      fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
      fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), "utf-8");
    } catch (error) {
      this.log.error("Failed to persist settings:", error);
    }
  }

  get(): AppSettings {
    return this.data;
  }

  update(partial: Partial<AppSettings>): AppSettings {
    const merged = mergeSettings(this.data, partial);
    this.data = sanitizeSettings(merged);
    this.save();
    return this.data;
  }
}
