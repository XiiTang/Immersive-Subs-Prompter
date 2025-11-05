import { app } from "electron";
import { promises as fs } from "fs";
import path from "path";
import { YtDlpConfig } from "./types.js";

const DEFAULT_YT_DLP_CONFIG: YtDlpConfig = {
  cookiesFile: "",
  subtitleLanguages: []
};

export class ConfigStore {
  private readonly filePath: string;
  private config: YtDlpConfig = { ...DEFAULT_YT_DLP_CONFIG };

  constructor(fileName = "settings.json") {
    this.filePath = path.join(app.getPath("userData"), fileName);
  }

  async load(): Promise<YtDlpConfig> {
    try {
      const content = await fs.readFile(this.filePath, "utf-8");
      const parsed = JSON.parse(content);
      this.config = this.normalize(parsed);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        console.warn("[USP] Failed to load settings, falling back to defaults:", error);
      }
      this.config = { ...DEFAULT_YT_DLP_CONFIG };
      await this.persist().catch(() => {
        /* ignore fs errors during fallback */
      });
    }
    return this.config;
  }

  get(): YtDlpConfig {
    return this.config;
  }

  async update(partial: Partial<YtDlpConfig>): Promise<YtDlpConfig> {
    this.config = this.normalize({ ...this.config, ...partial });
    await this.persist();
    return this.config;
  }

  private async persist() {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    await fs.writeFile(this.filePath, JSON.stringify(this.config, null, 2), "utf-8");
  }

  private normalize(candidate: unknown): YtDlpConfig {
    const input = (candidate && typeof candidate === "object" ? candidate : {}) as Partial<YtDlpConfig>;

    const cookiesFile =
      typeof input.cookiesFile === "string" ? input.cookiesFile.trim() : DEFAULT_YT_DLP_CONFIG.cookiesFile;

    const subtitleLanguages = Array.isArray(input.subtitleLanguages)
      ? input.subtitleLanguages
          .map((lang) => (typeof lang === "string" ? lang.trim() : ""))
          .filter((lang) => !!lang)
      : DEFAULT_YT_DLP_CONFIG.subtitleLanguages;

    return {
      cookiesFile,
      subtitleLanguages: Array.from(new Set(subtitleLanguages))
    };
  }
}

export function getDefaultYtDlpConfig(): YtDlpConfig {
  return { ...DEFAULT_YT_DLP_CONFIG };
}
