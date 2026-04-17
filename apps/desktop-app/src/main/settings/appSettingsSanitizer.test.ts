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

    it("initializes empty plugin settings when missing", () => {
      const result = sanitizeSettings({});
      expect(result.plugins).toEqual({});
    });

    it("returns a fresh object on each factory invocation", () => {
      const a = DEFAULT_SETTINGS_FACTORY();
      const b = DEFAULT_SETTINGS_FACTORY();
      expect(a).not.toBe(b);
      expect(a.profiles).not.toBe(b.profiles);
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

    it("merges mediaServer shallowly", () => {
      const base = DEFAULT_SETTINGS_FACTORY();
      const merged = mergeSettings(base, {
        mediaServer: { enabled: false } as typeof base.mediaServer
      });
      expect(merged.mediaServer.enabled).toBe(false);
      expect(merged.mediaServer.configs).toEqual(base.mediaServer.configs);
    });
  });
});
