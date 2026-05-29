import { describe, expect, it } from "vitest";
import {
  DEFAULT_SETTINGS,
  DEFAULT_SETTINGS_FACTORY,
  mergeSettings,
  sanitizeSettings
} from "./appSettingsSanitizer.js";
import {
  DEFAULT_SUBTITLE_FONT_FAMILY,
  SUBTITLE_FONT_OPTIONS
} from "../../common/subtitleFonts.js";
import { DEFAULT_GLOBAL_SETTINGS, DEFAULT_PROFILE_ID, DEFAULT_PROFILE_SETTINGS } from "./constants.js";

describe("appSettingsSanitizer", () => {
  describe("sanitizeSettings", () => {
    it("returns defaults when input is null or undefined", () => {
      const result = sanitizeSettings(null);
      expect(result.defaultProfileId).toBe(DEFAULT_SETTINGS.defaultProfileId);
      expect(result.profiles.length).toBe(DEFAULT_SETTINGS.profiles.length);
      expect(sanitizeSettings(undefined).profiles).toHaveLength(
        DEFAULT_SETTINGS.profiles.length
      );
    });

    it("falls back to the fixed fallback profile id when defaultProfileId is unknown", () => {
      const result = sanitizeSettings({ defaultProfileId: "does-not-exist" });
      expect(result.defaultProfileId).toBe(DEFAULT_PROFILE_ID);
      expect(result.profiles.at(-1)?.id).toBe(DEFAULT_PROFILE_ID);
    });

    it("preserves an existing defaultProfileId as the fixed fallback profile", () => {
      const result = sanitizeSettings({
        profiles: [
          {
            id: "profile-default",
            name: "Default",
            description: null,
            settings: DEFAULT_SETTINGS.profiles[0].settings
          },
          {
            id: "profile-youtube",
            name: "YouTube",
            description: null,
            settings: DEFAULT_SETTINGS.profiles[0].settings
          }
        ],
        defaultProfileId: "profile-youtube"
      });

      expect(result.defaultProfileId).toBe("profile-youtube");
      expect(result.profiles.at(-1)?.id).toBe("profile-youtube");
    });

    it("keeps the fallback profile last while preserving non-fallback profile order", () => {
      const result = sanitizeSettings({
        profiles: [
          {
            id: "profile-default",
            name: "Default",
            description: null,
            settings: DEFAULT_SETTINGS.profiles[0].settings
          },
          {
            id: "profile-youtube",
            name: "YouTube",
            description: null,
            settings: DEFAULT_SETTINGS.profiles[0].settings
          },
          {
            id: "profile-bilibili",
            name: "Bilibili",
            description: null,
            settings: DEFAULT_SETTINGS.profiles[0].settings
          }
        ],
        defaultProfileId: "profile-default"
      });

      expect(result.profiles.map((profile) => profile.id)).toEqual([
        "profile-youtube",
        "profile-bilibili",
        "profile-default"
      ]);
    });

    it("creates the fixed fallback profile when saved profiles do not contain one", () => {
      const result = sanitizeSettings({
        profiles: [
          {
            id: "profile-youtube",
            name: "YouTube",
            description: null,
            settings: DEFAULT_SETTINGS.profiles[0].settings
          }
        ],
        defaultProfileId: "does-not-exist"
      });

      expect(result.defaultProfileId).toBe(DEFAULT_PROFILE_ID);
      expect(result.profiles.map((profile) => profile.id)).toEqual([
        "profile-youtube",
        DEFAULT_PROFILE_ID
      ]);
    });

    it("keeps URL rules only on non-default existing profiles", () => {
      const result = sanitizeSettings({
        profiles: [
          {
            id: "profile-default",
            name: "Default",
            description: null,
            settings: DEFAULT_SETTINGS.profiles[0].settings
          },
          {
            id: "profile-youtube",
            name: "YouTube",
            description: null,
            settings: DEFAULT_SETTINGS.profiles[0].settings
          }
        ],
        defaultProfileId: "profile-default",
        rules: [
          {
            id: "rule-youtube",
            name: "YouTube",
            pattern: "youtube.com",
            profileId: "profile-youtube"
          },
          {
            id: "rule-default",
            name: "Default",
            pattern: "example.com",
            profileId: "profile-default"
          },
          {
            id: "rule-missing",
            name: "Missing",
            pattern: "missing.example",
            profileId: "profile-missing"
          }
        ]
      });

      expect(result.rules.map((rule) => rule.id)).toEqual(["rule-youtube"]);
      expect(result.rules[0]).toEqual({
        id: "rule-youtube",
        name: "YouTube",
        pattern: "youtube.com",
        profileId: "profile-youtube"
      });
    });

    it("initializes Jellyfin / Emby plugin config when missing", () => {
      const result = sanitizeSettings({});
      expect(result.plugins["official.jellyfinemby"]?.config).toEqual({ servers: [] });
    });

    it("returns a fresh Jellyfin / Emby plugin config when plugin settings are missing", () => {
      const a = sanitizeSettings({});
      const b = sanitizeSettings({});
      expect(a.plugins["official.jellyfinemby"]?.config).not.toBe(
        b.plugins["official.jellyfinemby"]?.config
      );
    });

    it("does not expose persistent host mediaServer settings", () => {
      const result = sanitizeSettings({});
      expect(Object.prototype.hasOwnProperty.call(result, "mediaServer")).toBe(false);
    });

    it("uses endpoint-list network settings", () => {
      const result = sanitizeSettings({});
      expect(result.network.endpoints).toEqual([
        { id: "default", host: "127.0.0.1", port: 44501 }
      ]);
      expect(Object.prototype.hasOwnProperty.call(result.network, "host")).toBe(false);
      expect(Object.prototype.hasOwnProperty.call(result.network, "port")).toBe(false);
    });

    it("keeps supported appearance themes", () => {
      expect(sanitizeSettings({ global: { appearance: { theme: "light" } } } as never).global.appearance.theme).toBe("light");
      expect(sanitizeSettings({ global: { appearance: { theme: "dark" } } } as never).global.appearance.theme).toBe("dark");
      expect(sanitizeSettings({ global: { appearance: { theme: "system" } } } as never).global.appearance.theme).toBe("system");
    });

    it("preserves an empty global shortcut as disabled", () => {
      expect(sanitizeSettings({ global: { toggleWindowShortcut: "" } } as never).global.toggleWindowShortcut).toBe("");
      expect(sanitizeSettings({ global: { toggleWindowShortcut: "   " } } as never).global.toggleWindowShortcut).toBe("");
    });

    it("falls back to system appearance for unsupported themes", () => {
      const result = sanitizeSettings({
        global: { appearance: { theme: "blue" } }
      } as never);

      expect(result.global.appearance.theme).toBe("system");
    });

    it("sanitizes Jellyfin / Emby plugin server config", () => {
      const result = sanitizeSettings({
        plugins: {
          "official.jellyfinemby": {
            config: {
              servers: [
                {
                  id: " srv-1 ",
                  name: " Home ",
                  serverUrl: " http://server.local:8096/ ",
                  apiKey: " key ",
                  webSocketPath: "socket",
                  enabled: true
                },
                {
                  id: "",
                  name: "",
                  serverUrl: 42,
                  apiKey: null,
                  webSocketPath: "",
                  enabled: "yes"
                }
              ]
            }
          }
        }
      } as never);

      expect(result.plugins["official.jellyfinemby"]?.config).toEqual({
        servers: [
          {
            id: "srv-1",
            name: "Home",
            serverUrl: "http://server.local:8096/",
            apiKey: "key",
            webSocketPath: "/socket",
            enabled: true
          },
          {
            id: "jellyfinemby-server-1",
            name: "Server 2",
            serverUrl: "",
            apiKey: "",
            webSocketPath: "/socket",
            enabled: false
          }
        ]
      });
    });

    it("sanitizes independent primary and secondary subtitle typography", () => {
      const georgiaFont = SUBTITLE_FONT_OPTIONS.find((option) => option.label === "Georgia")!.value;
      const result = sanitizeSettings({
        profiles: [
          {
            id: "profile-typography",
            name: "Typography",
            description: null,
            settings: {
              ...DEFAULT_SETTINGS.profiles[0]!.settings,
              primarySubtitleFontFamily: "Papyrus",
              primarySubtitleFontSize: 2.2,
              secondarySubtitleFontFamily: georgiaFont,
              secondarySubtitleFontSize: 111.7,
              subtitleTimestampFontSize: 25.7
            }
          }
        ],
        defaultProfileId: "profile-typography"
      } as never);

      const settings = result.profiles[0]!.settings;

      expect(settings.primarySubtitleFontFamily).toBe(DEFAULT_SUBTITLE_FONT_FAMILY);
      expect(settings.primarySubtitleFontSize).toBe(3);
      expect(settings.secondarySubtitleFontFamily).toBe(georgiaFont);
      expect(settings.secondarySubtitleFontSize).toBe(96);
      expect(settings.subtitleTimestampFontSize).toBe(24);
    });

    it("uses explicit default primary and secondary subtitle typography", () => {
      const result = sanitizeSettings(null);
      const settings = result.profiles.find((profile) => profile.id === DEFAULT_PROFILE_ID)!.settings;

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
    });

    it("uses the product global defaults as the sanitizer defaults", () => {
      const result = sanitizeSettings(null);

      expect(DEFAULT_GLOBAL_SETTINGS).toEqual({
        closeBehavior: "quit",
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

  describe("mergeSettings", () => {
    it("shallow-merges the global section, preserving unspecified keys", () => {
      const base = DEFAULT_SETTINGS_FACTORY();
      const merged = mergeSettings(base, {
        global: { ...base.global, language: "en" }
      });
      expect(merged.global.language).toBe("en");
      expect(merged.global.toggleWindowShortcut).toBe(base.global.toggleWindowShortcut);
    });

    it("replaces profiles and rules wholesale when provided", () => {
      const base = DEFAULT_SETTINGS_FACTORY();
      const merged = mergeSettings(base, {
        profiles: [],
        rules: []
      });
      expect(merged.profiles).toEqual([]);
      expect(merged.rules).toEqual([]);
    });

    it("ignores defaultProfileId patches so the fallback profile cannot be changed", () => {
      const base = DEFAULT_SETTINGS_FACTORY();
      const merged = mergeSettings(base, { defaultProfileId: "some-new-id" });
      expect(merged.defaultProfileId).toBe(base.defaultProfileId);
    });

    it("does not mutate the base object", () => {
      const base = DEFAULT_SETTINGS_FACTORY();
      const snapshot = JSON.stringify(base);
      mergeSettings(base, { global: { ...base.global, language: "en" } });
      expect(JSON.stringify(base)).toBe(snapshot);
    });

    it("merges plugin settings shallowly", () => {
      const base = DEFAULT_SETTINGS_FACTORY();
      const merged = mergeSettings(base, {
        plugins: {
          "official.jellyfinemby": {
            config: {
              servers: [
                {
                  id: "server-1",
                  name: "Home",
                  serverUrl: "http://server.local:8096",
                  apiKey: "key",
                  webSocketPath: "/socket",
                  enabled: true
                }
              ]
            }
          }
        }
      });
      expect(merged.plugins["official.jellyfinemby"]?.config).toEqual({
        servers: [
          {
            id: "server-1",
            name: "Home",
            serverUrl: "http://server.local:8096",
            apiKey: "key",
            webSocketPath: "/socket",
            enabled: true
          }
        ]
      });
    });
  });
});
