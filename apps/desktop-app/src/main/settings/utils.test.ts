import { describe, expect, it } from "vitest";
import {
  clampPort,
  ensureUniqueId,
  normalizeColor,
  sanitizePriorityList,
  sanitizeProcessList
} from "./utils.js";

describe("settings/utils", () => {
  describe("clampPort", () => {
    it("returns fallback for non-finite input", () => {
      expect(clampPort(Number.NaN)).toBe(44501);
      expect(clampPort(Number.POSITIVE_INFINITY)).toBe(44501);
    });

    it("returns fallback for out-of-range ports", () => {
      expect(clampPort(0)).toBe(44501);
      expect(clampPort(-1)).toBe(44501);
      expect(clampPort(65536)).toBe(44501);
    });

    it("rounds fractional ports to the nearest integer", () => {
      expect(clampPort(8080.4)).toBe(8080);
      expect(clampPort(8080.6)).toBe(8081);
    });

    it("respects custom fallback", () => {
      expect(clampPort(Number.NaN, 3000)).toBe(3000);
    });
  });

  describe("normalizeColor", () => {
    it("returns fallback when value is not a string", () => {
      expect(normalizeColor(null, "#000")).toBe("#000");
      expect(normalizeColor(42, "#000")).toBe("#000");
    });

    it("trims whitespace and preserves value", () => {
      expect(normalizeColor("  #fff  ", "#000")).toBe("#fff");
    });

    it("falls back when trimmed value is empty", () => {
      expect(normalizeColor("   ", "#abc")).toBe("#abc");
    });
  });

  describe("sanitizePriorityList", () => {
    it("returns empty array for falsy input", () => {
      expect(sanitizePriorityList(null)).toEqual([]);
      expect(sanitizePriorityList(undefined)).toEqual([]);
    });

    it("wraps a single string into a list", () => {
      expect(sanitizePriorityList("en")).toEqual(["en"]);
    });

    it("filters non-strings and empty entries", () => {
      expect(sanitizePriorityList(["en", "", 42, "  ", "zh"])).toEqual(["en", "zh"]);
    });

    it("trims string entries", () => {
      expect(sanitizePriorityList([" en ", " zh-Hans "])).toEqual(["en", "zh-Hans"]);
    });
  });

  describe("sanitizeProcessList", () => {
    it("removes duplicates case-insensitively while preserving first casing", () => {
      expect(sanitizeProcessList(["Foo.exe", "FOO.EXE", "bar.exe"])).toEqual([
        "Foo.exe",
        "bar.exe"
      ]);
    });

    it("skips non-strings and empty entries", () => {
      expect(sanitizeProcessList(["a", "", "  ", 123, null])).toEqual(["a"]);
    });
  });

  describe("ensureUniqueId", () => {
    it("returns preferred id when not used", () => {
      const used = new Set<string>();
      expect(ensureUniqueId("profile-1", used, "profile")).toBe("profile-1");
      expect(used.has("profile-1")).toBe(true);
    });

    it("appends counter when id is already used", () => {
      const used = new Set(["profile-1"]);
      expect(ensureUniqueId("profile-1", used, "profile")).toBe("profile-1-1");
      expect(ensureUniqueId("profile-1", used, "profile")).toBe("profile-1-2");
    });

    it("generates prefix+uuid when preferred id is blank", () => {
      const used = new Set<string>();
      const id = ensureUniqueId("", used, "profile");
      expect(id.startsWith("profile-")).toBe(true);
      expect(used.has(id)).toBe(true);
    });
  });
});
