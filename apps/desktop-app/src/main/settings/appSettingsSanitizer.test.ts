import { describe, expect, it } from "vitest";
import {
  DEFAULT_SETTINGS_FACTORY,
  sanitizeSettings
} from "./appSettingsSanitizer.js";
import { DEFAULT_SUBTITLE_FONT_FAMILY } from "../../common/subtitleFonts.js";
import { DEFAULT_GLOBAL_SETTINGS, DEFAULT_PROFILE_ID, DEFAULT_PROFILE_SETTINGS } from "./constants.js";

describe("appSettingsSanitizer", () => {
  describe("sanitizeSettings", () => {
    it("accepts the current complete settings shape", () => {
      const settings = DEFAULT_SETTINGS_FACTORY();

      expect(sanitizeSettings(settings)).toBe(settings);
    });

    it("rejects missing settings instead of creating defaults", () => {
      expect(() => sanitizeSettings(null)).toThrow("settings file must use the current object setting");
      expect(() => sanitizeSettings(undefined)).toThrow("settings file must use the current object setting");
    });

    it("rejects unknown top-level fields", () => {
      const settings = {
        ...DEFAULT_SETTINGS_FACTORY(),
        mediaServer: {}
      };

      expect(() => sanitizeSettings(settings as never)).toThrow("settings contains unknown setting: mediaServer");
    });

    it("rejects saved defaultProfileId values that are not the fixed fallback profile", () => {
      const settings = {
        ...DEFAULT_SETTINGS_FACTORY(),
        defaultProfileId: "profile-youtube"
      };

      expect(() => sanitizeSettings(settings)).toThrow(
        "settings.defaultProfileId must use the fixed current fallback profile"
      );
    });

    it("rejects missing or reordered fallback profiles", () => {
      const withoutFallback = {
        ...DEFAULT_SETTINGS_FACTORY(),
        profiles: DEFAULT_SETTINGS_FACTORY().profiles.filter((profile) => profile.id !== DEFAULT_PROFILE_ID)
      };
      const reordered = {
        ...DEFAULT_SETTINGS_FACTORY(),
        profiles: [...DEFAULT_SETTINGS_FACTORY().profiles].reverse()
      };

      expect(() => sanitizeSettings(withoutFallback)).toThrow("profiles must include the current fallback profile");
      expect(() => sanitizeSettings(reordered)).toThrow("profiles must keep the current fallback profile last");
    });

    it("rejects values that only old disk-load sanitizers normalized", () => {
      const unsupportedAppearance = DEFAULT_SETTINGS_FACTORY();
      unsupportedAppearance.global = {
        ...unsupportedAppearance.global,
        appearance: { theme: "blue" as never }
      };

      const unsupportedFont = DEFAULT_SETTINGS_FACTORY();
      unsupportedFont.profiles = unsupportedFont.profiles.map((profile) =>
        profile.id === DEFAULT_PROFILE_ID
          ? {
            ...profile,
            settings: {
              ...profile.settings,
              primarySubtitleFontFamily: "Papyrus"
            }
          }
          : profile
      );

      const websocketPathWithoutSlash = DEFAULT_SETTINGS_FACTORY();
      websocketPathWithoutSlash.plugins["official.jellyfinemby"] = {
        config: {
          servers: [
            {
              id: "srv-1",
              name: "Home",
              serverUrl: "http://server.local:8096",
              apiKey: "key",
              webSocketPath: "socket",
              enabled: true
            }
          ]
        }
      };

      expect(() => sanitizeSettings(unsupportedAppearance)).toThrow(
        "global.appearance.theme must use the current string setting"
      );
      expect(() => sanitizeSettings(unsupportedFont)).toThrow(
        "profile.primarySubtitleFontFamily must use a supported current font setting"
      );
      expect(() => sanitizeSettings(websocketPathWithoutSlash)).toThrow(
        "jellyfinemby.server.webSocketPath must start with /"
      );
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
      expect(settings.primarySubtitleFontFamily).toBe(DEFAULT_SUBTITLE_FONT_FAMILY);
      expect(settings.secondarySubtitleFontFamily).toBe(DEFAULT_SUBTITLE_FONT_FAMILY);
      expect(settings.primarySubtitleFontSize).toBe(26);
      expect(settings.secondarySubtitleFontSize).toBe(25);
      expect(settings.subtitleTimestampFontSize).toBe(11);
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
