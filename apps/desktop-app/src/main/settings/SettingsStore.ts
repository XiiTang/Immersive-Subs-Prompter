import { app } from "electron";
import fs from "fs";
import path from "path";
import { createLogger } from "../logger.js";
import { AppSettings } from "../types.js";
import { DEFAULT_SETTINGS_FACTORY, mergeSettings, sanitizeSettings } from "./appSettingsSanitizer.js";

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
