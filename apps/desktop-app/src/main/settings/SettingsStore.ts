import { app } from "electron";
import fs from "fs";
import path from "path";
import { reportError } from "../errors.js";
import { AppSettings } from "../types.js";
import { DEFAULT_SETTINGS_FACTORY, mergeSettings, sanitizeSettings } from "./appSettingsSanitizer.js";
import { validateNetworkSettingsForUpdate } from "./sanitizers/networkSanitizer.js";

export class SettingsStore {
  private readonly filePath: string;
  private data: AppSettings = DEFAULT_SETTINGS_FACTORY();

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
      reportError(error, "settings.load", {
        scope: "settings",
        extra: { filePath: this.filePath }
      });
      this.data = DEFAULT_SETTINGS_FACTORY();
    }
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
    const merged = mergeSettings(this.data, partial);
    if (partial.network) {
      merged.network = validateNetworkSettingsForUpdate(merged.network);
    }
    const next = sanitizeSettings(merged);
    this.save(next);
    this.data = next;
    return this.data;
  }
}
