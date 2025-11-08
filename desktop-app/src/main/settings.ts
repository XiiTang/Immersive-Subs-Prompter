import { randomUUID } from "crypto";
import { app } from "electron";
import fs from "fs";
import path from "path";
import {
  AppSettings,
  CloseBehavior,
  GlobalSettings,
  ProfileDefinition,
  ProfileRule,
  ProfileSettings,
  UrlMatchType
} from "./types.js";
import { createLogger } from "./logger.js";

export const DEFAULT_YTDLP_ARGS = "--skip-download --write-subs --all-subs --cookies-from-browser firefox";
export const DEFAULT_PROFILE_ID = "default-profile";
const DEFAULT_PROFILE_NAME = "默认配置";

const MATCH_TYPES: UrlMatchType[] = ["contains", "exact", "regex"];

const DEFAULT_GLOBAL_SETTINGS: GlobalSettings = {
  closeBehavior: "tray",
  autoLaunch: false
};

export const DEFAULT_PROFILE_SETTINGS: ProfileSettings = {
  subtitleFontFamily: "",
  subtitleFontSize: 14,
  ytDlpArgs: "",
  subtitleAutoScrollTimeout: 3,
  subtitleScrollPosition: 33,
  primarySubtitlePriority: [],
  secondarySubtitlePriority: []
};

const DEFAULT_SETTINGS_FACTORY = (): AppSettings => ({
  global: { ...DEFAULT_GLOBAL_SETTINGS },
  profiles: [createDefaultProfile()],
  defaultProfileId: DEFAULT_PROFILE_ID,
  rules: []
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

function sanitizeProfileSettings(input: Partial<ProfileSettings> | null | undefined): ProfileSettings {
  const source = input ?? {};
  const subtitleFontFamily =
    typeof source.subtitleFontFamily === "string" ? source.subtitleFontFamily.trim() : DEFAULT_PROFILE_SETTINGS.subtitleFontFamily;

  let subtitleFontSize = Number(source.subtitleFontSize);
  if (!Number.isFinite(subtitleFontSize)) {
    subtitleFontSize = DEFAULT_PROFILE_SETTINGS.subtitleFontSize;
  }
  subtitleFontSize = Math.min(48, Math.max(10, Math.round(subtitleFontSize)));

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
  return {
    closeBehavior,
    autoLaunch
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
    const name = typeof source.name === "string" && source.name.trim().length ? source.name.trim() : "未命名配置";
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

type LegacySettingsShape = Partial<ProfileSettings> &
  Partial<GlobalSettings> & {
    closeBehavior?: CloseBehavior;
  };

function sanitizeSettings(input: Partial<AppSettings> | LegacySettingsShape | null | undefined): AppSettings {
  if (!input || typeof input !== "object") {
    return DEFAULT_SETTINGS_FACTORY();
  }

  const looksModern =
    "global" in input || "profiles" in input || "rules" in input || "defaultProfileId" in input;

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
    return {
      global,
      profiles,
      defaultProfileId,
      rules
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
    rules: []
  };
}

function mergeSettings(base: AppSettings, patch: Partial<AppSettings>): AppSettings {
  const next: AppSettings = {
    global: base.global,
    profiles: base.profiles,
    defaultProfileId: base.defaultProfileId,
    rules: base.rules
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
