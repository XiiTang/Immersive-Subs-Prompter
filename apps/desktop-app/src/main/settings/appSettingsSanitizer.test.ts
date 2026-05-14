import { describe, expect, it } from "vitest";
import {
  DEFAULT_SETTINGS,
  DEFAULT_SETTINGS_FACTORY,
  mergeSettings,
  sanitizeSettings
} from "./appSettingsSanitizer.js";

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

    it("falls back to first profile id when defaultProfileId is unknown", () => {
      const result = sanitizeSettings({ defaultProfileId: "does-not-exist" });
      expect(result.defaultProfileId).toBe(result.profiles[0].id);
    });

    it("preserves a defaultProfileId that matches an existing profile", () => {
      const first = DEFAULT_SETTINGS.profiles[0].id;
      const result = sanitizeSettings({ defaultProfileId: first });
      expect(result.defaultProfileId).toBe(first);
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

    it("updates defaultProfileId when provided", () => {
      const base = DEFAULT_SETTINGS_FACTORY();
      const merged = mergeSettings(base, { defaultProfileId: "some-new-id" });
      expect(merged.defaultProfileId).toBe("some-new-id");
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
