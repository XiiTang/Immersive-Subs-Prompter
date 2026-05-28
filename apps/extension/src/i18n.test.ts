import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

const requiredMessageKeys = [
  "extensionName",
  "extensionDescription",
  "popupTitle",
  "popupStatusConnecting",
  "popupSettings",
  "popupNoMediaTitle",
  "popupNoMediaDescription",
  "settingsBack",
  "settingsTitle",
  "settingsAppearance",
  "settingsLanguage",
  "settingsLanguageSystem",
  "settingsLanguageEnglish",
  "settingsLanguageChinese",
  "settingsTheme",
  "settingsThemeSystem",
  "settingsThemeLight",
  "settingsThemeDark",
  "settingsConnections",
  "settingsServerSummaryEmpty",
  "settingsBlacklist",
  "actionRemove",
  "statusConnected",
  "statusDisconnected",
  "statusError",
  "mediaStatusPlaying",
  "mediaStatusPaused",
  "mediaMetaSpeed",
  "mediaMetaVolume",
  "mediaTotalLive",
  "mediaOpenTab",
  "relativeJustNow",
  "relativeSecondsAgo",
  "dashboardNoServers",
  "dashboardUpdated",
  "validationInvalidRegex"
];

function readJson(path: string) {
  return JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
}

describe("extension i18n coverage", () => {
  it("localizes browser manifest metadata through _locales", () => {
    for (const manifestName of ["manifest.json", "manifest.firefox.json"]) {
      const manifest = readJson(join(root, manifestName));
      expect(manifest.default_locale).toBe("en");
      expect(manifest.name).toBe("__MSG_extensionName__");
      expect(manifest.description).toBe("__MSG_extensionDescription__");
      expect((manifest.action as Record<string, unknown>).default_title).toBe("__MSG_extensionName__");
    }
  });

  it("ships matching English and Chinese message catalogs", () => {
    const enPath = join(root, "_locales/en/messages.json");
    const zhPath = join(root, "_locales/zh/messages.json");

    expect(existsSync(enPath)).toBe(true);
    expect(existsSync(zhPath)).toBe(true);

    const en = readJson(enPath);
    const zh = readJson(zhPath);

    expect(Object.keys(en).sort()).toEqual(Object.keys(zh).sort());
    for (const key of requiredMessageKeys) {
      expect(en).toHaveProperty(key);
      expect(zh).toHaveProperty(key);
      expect((en[key] as { message?: string }).message?.trim()).toBeTruthy();
      expect((zh[key] as { message?: string }).message?.trim()).toBeTruthy();
    }
  });

  it("marks popup static text for runtime localization", () => {
    const html = readFileSync(join(root, "popup.html"), "utf8");

    for (const key of [
      "popupStatusConnecting",
      "popupSettings",
      "popupNoMediaTitle",
      "popupNoMediaDescription",
      "settingsBack",
      "settingsTitle",
      "settingsAppearance",
      "settingsLanguage",
      "settingsLanguageSystem",
      "settingsLanguageEnglish",
      "settingsLanguageChinese",
      "settingsConnections",
      "settingsBlacklist"
    ]) {
      expect(html).toContain(key);
    }
    expect(html).toContain('data-language-option="system"');
    expect(html).toContain('data-language-option="en"');
    expect(html).toContain('data-language-option="zh"');
  });

  it("copies _locales into built browser extension artifacts", () => {
    const config = readFileSync(join(root, "esbuild.config.ts"), "utf8");

    expect(config).toContain('"_locales"');
  });
});
