import { describe, expect, it } from "vitest";
import {
  DEFAULT_SETTINGS,
  DEFAULT_SETTINGS_FACTORY,
  mergeSettings,
  sanitizeSettings
} from "./appSettingsSanitizer.js";
import { DEFAULT_PROFILE_ID } from "./constants.js";

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
            matchType: "contains",
            profileId: "profile-youtube",
            isEnabled: true
          },
          {
            id: "rule-default",
            name: "Default",
            pattern: "example.com",
            matchType: "contains",
            profileId: "profile-default",
            isEnabled: true
          },
          {
            id: "rule-missing",
            name: "Missing",
            pattern: "missing.example",
            matchType: "contains",
            profileId: "profile-missing",
            isEnabled: true
          }
        ]
      });

      expect(result.rules.map((rule) => rule.id)).toEqual(["rule-youtube"]);
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

    it("keeps supported appearance themes", () => {
      expect(sanitizeSettings({ global: { appearance: { theme: "light" } } } as never).global.appearance.theme).toBe("light");
      expect(sanitizeSettings({ global: { appearance: { theme: "dark" } } } as never).global.appearance.theme).toBe("dark");
      expect(sanitizeSettings({ global: { appearance: { theme: "system" } } } as never).global.appearance.theme).toBe("system");
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
