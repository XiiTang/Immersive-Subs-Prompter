import { app } from "electron";
import fs from "fs";
import path from "path";
import { reportError } from "../errors.js";
import { AppSettings } from "../types.js";
import {
  DEFAULT_SETTINGS_FACTORY,
  mergeSettings,
  sanitizeSettings,
  validateSettingsForUpdate
} from "./appSettingsSanitizer.js";

export class SettingsStore {
  private readonly filePath: string;
  private data: AppSettings;

  constructor() {
    this.filePath = path.join(app.getPath("userData"), "settings.json");
    this.data = this.load();
  }

  private load(): AppSettings {
    if (!fs.existsSync(this.filePath)) {
      return DEFAULT_SETTINGS_FACTORY();
    }
    const raw = fs.readFileSync(this.filePath, "utf-8");
    const parsed = JSON.parse(raw);
    return sanitizeSettings(parsed);
  }

  private save(data: AppSettings) {
    try {
      fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
      fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2), "utf-8");
    } catch (error) {
      reportError(error, "settings.save", {
        scope: "settings",
        extra: { filePath: this.filePath }
      });
      throw error;
    }
  }

  get(): AppSettings {
    return this.data;
  }

  update(partial: Partial<AppSettings>): AppSettings {
    validateSettingsForUpdate(partial, this.data);
    const merged = mergeSettings(this.data, partial);
    const next = merged;
    this.save(next);
    this.data = next;
    return this.data;
  }
}
