import { app } from "electron";
import fs from "fs";
import path from "path";
import { AppSettings, CloseBehavior } from "./types.js";

export const DEFAULT_SETTINGS: AppSettings = {
  closeBehavior: "tray",
  autoLaunch: false,
  subtitleFontFamily: "",
  subtitleFontSize: 14
};

function isCloseBehavior(value: unknown): value is CloseBehavior {
  return value === "quit" || value === "tray";
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

  return {
    closeBehavior,
    autoLaunch,
    subtitleFontFamily,
    subtitleFontSize
  };
}

export class SettingsStore {
  private readonly filePath: string;
  private data: AppSettings = DEFAULT_SETTINGS;

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
      console.error("[USP] Failed to read settings:", error);
      this.data = DEFAULT_SETTINGS;
    }
  }

  private save() {
    try {
      fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
      fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), "utf-8");
    } catch (error) {
      console.error("[USP] Failed to persist settings:", error);
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
