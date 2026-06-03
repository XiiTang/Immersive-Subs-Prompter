import { describe, expect, it } from "vitest";
import {
  DEFAULT_SETTINGS_FACTORY,
  sanitizeSettings
} from "./appSettingsSanitizer.js";
import type { AppSettings } from "../types.js";
import { DEFAULT_SUBTITLE_FONT_FAMILY } from "../../common/subtitleFonts.js";
import {
  DEFAULT_GLOBAL_SETTINGS,
  DEFAULT_PROFILE_ID,
  DEFAULT_PROFILE_SETTINGS
} from "../../common/defaultSettings.js";
import { DEFAULT_YTDLP_ARGS } from "../../common/ytdlpDefaults.js";

describe("appSettingsSanitizer", () => {
  describe("sanitizeSettings", () => {
    it("accepts the current complete settings shape", () => {
      const settings = DEFAULT_SETTINGS_FACTORY();

      expect(sanitizeSettings(settings)).toEqual(settings);
    });

    it("rejects missing saved settings snapshots", () => {
      expect(() => sanitizeSettings(null)).toThrow(
        "saved settings must use the current object setting"
      );
    });

    it("rejects saved settings snapshots that do not match the current shape", () => {
      const settings = DEFAULT_SETTINGS_FACTORY();

      expect(() => sanitizeSettings({ ...settings, defaultProfileId: "profile-default" })).toThrow(
        "settings.defaultProfileId must use the fixed current fallback profile"
      );
    });

    it("keeps saved plugin records without pruning unknown plugin ids", () => {
      const settings = DEFAULT_SETTINGS_FACTORY() as AppSettings & {
        plugins: AppSettings["plugins"] & Record<string, { config: Record<string, unknown> }>;
      };
      settings.plugins["custom.lookup"] = { config: { enabled: true } };

      expect(sanitizeSettings(settings).plugins["custom.lookup"]).toEqual({
        config: { enabled: true }
      });
    });

    it("uses explicit product defaults from the factory", () => {
      const result = DEFAULT_SETTINGS_FACTORY();
      const settings = result.profiles.find((profile) => profile.id === DEFAULT_PROFILE_ID)!.settings;

      expect(DEFAULT_GLOBAL_SETTINGS).toEqual({
        autoLaunch: true,
        toggleWindowShortcut: "CommandOrControl+Shift+S",
        gameProcessBlacklist: ["r5apex_dx12.exe"],
        autoHidePanels: true,
        alwaysOnTop: "screen-saver",
        panelOpacity: 0,
        language: "zh",
        appearance: {
          theme: "system"
        }
      });
      expect(result.global).toEqual(DEFAULT_GLOBAL_SETTINGS);
      expect(DEFAULT_PROFILE_SETTINGS.primarySubtitleFontFamily).toBe(DEFAULT_SUBTITLE_FONT_FAMILY);
      expect(DEFAULT_PROFILE_SETTINGS.secondarySubtitleFontFamily).toBe(DEFAULT_SUBTITLE_FONT_FAMILY);
      expect(DEFAULT_PROFILE_SETTINGS.primarySubtitleFontSize).toBe(26);
      expect(DEFAULT_PROFILE_SETTINGS.secondarySubtitleFontSize).toBe(25);
      expect(DEFAULT_PROFILE_SETTINGS.subtitleTimestampFontSize).toBe(11);
      expect(DEFAULT_YTDLP_ARGS.split(/\s+/)).toContain("--write-auto-subs");
      expect(DEFAULT_PROFILE_SETTINGS.ytDlpArgs).toBe(DEFAULT_YTDLP_ARGS);
      expect(settings.primarySubtitleFontFamily).toBe(DEFAULT_SUBTITLE_FONT_FAMILY);
      expect(settings.secondarySubtitleFontFamily).toBe(DEFAULT_SUBTITLE_FONT_FAMILY);
      expect(settings.primarySubtitleFontSize).toBe(26);
      expect(settings.secondarySubtitleFontSize).toBe(25);
      expect(settings.subtitleTimestampFontSize).toBe(11);
      expect(settings.ytDlpArgs).toBe(DEFAULT_YTDLP_ARGS);
      expect(result.cache.enabled).toBe(true);
      expect(result.cache.retentionDays).toBe(7);
    });

    it("returns a fresh object on each factory invocation", () => {
      const a = DEFAULT_SETTINGS_FACTORY();
      const b = DEFAULT_SETTINGS_FACTORY();
      expect(a).not.toBe(b);
      expect(a.profiles).not.toBe(b.profiles);
      expect(a.plugins["official.jellyfinemby"]?.config).not.toBe(
        b.plugins["official.jellyfinemby"]?.config
      );
    });
  });
});
