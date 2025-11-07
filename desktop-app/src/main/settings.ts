import { app } from "electron";
import fs from "fs";
import path from "path";
import { AppSettings, CloseBehavior } from "./types.js";
import { createLogger } from "./logger.js";

export const DEFAULT_YTDLP_ARGS = "--skip-download --write-subs --all-subs --cookies-from-browser firefox";

export const DEFAULT_SETTINGS: AppSettings = {
  closeBehavior: "tray",
  autoLaunch: false,
  subtitleFontFamily: "",
  subtitleFontSize: 14,
  ytDlpArgs: "",
  subtitleAutoScrollTimeout: 3, // Default 3 seconds before restoring auto-scroll
  primarySubtitlePriority: [],
  secondarySubtitlePriority: []
};

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

function sanitizeSettings(input: Partial<AppSettings> | null | undefined): AppSettings {
  const source = input ?? {};
  const closeBehavior = isCloseBehavior(source.closeBehavior) ? source.closeBehavior : DEFAULT_SETTINGS.closeBehavior;
  const autoLaunch = typeof source.autoLaunch === "boolean" ? source.autoLaunch : DEFAULT_SETTINGS.autoLaunch;
  const subtitleFontFamily = typeof source.subtitleFontFamily === "string" ? source.subtitleFontFamily.trim() : DEFAULT_SETTINGS.subtitleFontFamily;
  let subtitleFontSize = Number(source.subtitleFontSize);
  if (!Number.isFinite(subtitleFontSize)) {
    subtitleFontSize = DEFAULT_SETTINGS.subtitleFontSize;
  }
  subtitleFontSize = Math.min(48, Math.max(10, Math.round(subtitleFontSize)));
  const ytDlpArgs = typeof source.ytDlpArgs === "string" ? source.ytDlpArgs.trim() : DEFAULT_SETTINGS.ytDlpArgs;
  let subtitleAutoScrollTimeout = Number(source.subtitleAutoScrollTimeout);
  if (!Number.isFinite(subtitleAutoScrollTimeout)) {
    subtitleAutoScrollTimeout = DEFAULT_SETTINGS.subtitleAutoScrollTimeout;
  }
  subtitleAutoScrollTimeout = Math.max(1, Math.round(subtitleAutoScrollTimeout));
  const primarySubtitlePriority = sanitizePriorityList(source.primarySubtitlePriority);
  const secondarySubtitlePriority = sanitizePriorityList(source.secondarySubtitlePriority);

  return {
    closeBehavior,
    autoLaunch,
    subtitleFontFamily,
    subtitleFontSize,
    ytDlpArgs,
    subtitleAutoScrollTimeout,
    primarySubtitlePriority,
    secondarySubtitlePriority
  };
}

export class SettingsStore {
  private readonly filePath: string;
  private data: AppSettings = DEFAULT_SETTINGS;
  private readonly log = createLogger("settings");

  constructor() {
    this.filePath = path.join(app.getPath("userData"), "settings.json");
    this.data = DEFAULT_SETTINGS;
    this.load();
  }

  private load() {
    try {
      if (!fs.existsSync(this.filePath)) {
        this.data = DEFAULT_SETTINGS;
        return;
      }
      const raw = fs.readFileSync(this.filePath, "utf-8");
      const parsed = JSON.parse(raw);
      this.data = sanitizeSettings(parsed);
    } catch (error) {
      this.log.error("Failed to read settings:", error);
      this.data = DEFAULT_SETTINGS;
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
    this.data = sanitizeSettings({ ...this.data, ...partial });
    this.save();
    return this.data;
  }
}
