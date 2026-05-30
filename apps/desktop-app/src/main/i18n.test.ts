import { describe, expect, it } from "vitest";
import {
  DEFAULT_LANGUAGE,
  SUPPORTED_LANGUAGES,
  normalizeLanguage,
  translate
} from "./i18n.js";

describe("main i18n", () => {
  describe("normalizeLanguage", () => {
    it("returns default when value is null or undefined", () => {
      expect(normalizeLanguage(null)).toBe(DEFAULT_LANGUAGE);
      expect(normalizeLanguage(undefined)).toBe(DEFAULT_LANGUAGE);
    });

    it("returns default when value is empty or unsupported", () => {
      expect(normalizeLanguage("")).toBe(DEFAULT_LANGUAGE);
      expect(normalizeLanguage("fr")).toBe(DEFAULT_LANGUAGE);
    });

    it("trims and lowercases supported values", () => {
      expect(normalizeLanguage(" EN ")).toBe("en");
      expect(normalizeLanguage("ZH")).toBe("zh");
    });

    it("lists en and zh as supported", () => {
      expect(SUPPORTED_LANGUAGES).toContain("en");
      expect(SUPPORTED_LANGUAGES).toContain("zh");
    });
  });

  describe("translate", () => {
    it("returns dictionary value for known key", () => {
      expect(translate("tray-quit", "Quit", "en")).toBe("Quit");
      expect(translate("tray-quit", "Quit", "zh")).toBe("退出");
    });

    it("falls back to provided default when key is missing", () => {
      expect(translate("nonexistent-key", "fallback", "en")).toBe("fallback");
      expect(translate("nonexistent-key", "fallback", "zh")).toBe("fallback");
    });
  });

});
