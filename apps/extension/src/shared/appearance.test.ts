import { describe, expect, it } from "vitest";
import {
  APPEARANCE_STORAGE_KEY,
  getStoredAppearanceTheme,
  normalizeAppearanceTheme,
  resolveAppearanceTheme,
  type AppearanceTheme
} from "./appearance";

describe("extension appearance helpers", () => {
  it.each([
    ["system", "system"],
    ["light", "light"],
    ["dark", "dark"],
    ["blue", "system"],
    [null, "system"]
  ] satisfies Array<[unknown, AppearanceTheme]>)("normalizes %s", (input, expected) => {
    expect(normalizeAppearanceTheme(input)).toBe(expected);
  });

  it.each([
    ["light", true, "light"],
    ["dark", false, "dark"],
    ["system", true, "dark"],
    ["system", false, "light"]
  ] satisfies Array<[AppearanceTheme, boolean, "light" | "dark"]>)(
    "resolves %s with system dark=%s",
    (theme, systemDark, expected) => {
      expect(resolveAppearanceTheme(theme, systemDark)).toBe(expected);
    }
  );

  it("reads stored theme from a storage payload", () => {
    expect(getStoredAppearanceTheme({ [APPEARANCE_STORAGE_KEY]: "dark" })).toBe("dark");
    expect(getStoredAppearanceTheme({ [APPEARANCE_STORAGE_KEY]: "invalid" })).toBe("system");
  });
});
