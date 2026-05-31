import { describe, expect, it } from "vitest";
import {
  DEFAULT_SETTINGS_FACTORY,
  sanitizeSettings
} from "./appSettingsSanitizer.js";
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

    it("returns defaults for missing or obsolete saved settings", () => {
      const result = sanitizeSettings(null);
      const obsolete = sanitizeSettings({
        ...DEFAULT_SETTINGS_FACTORY(),
        defaultProfileId: "profile-youtube",
        mediaServer: {}
      } as never);

      expect(result.defaultProfileId).toBe(DEFAULT_PROFILE_ID);
      expect(result.profiles.at(-1)?.id).toBe(DEFAULT_PROFILE_ID);
      expect(obsolete.defaultProfileId).toBe(DEFAULT_PROFILE_ID);
      expect(obsolete.profiles.at(-1)?.id).toBe(DEFAULT_PROFILE_ID);
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
