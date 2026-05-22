import { afterEach, describe, expect, it, vi } from "vitest";
import {
  applyThemeToDocument,
  resolveTheme,
  watchSystemTheme,
  type AppearanceTheme
} from "./theme";

function installMatchMedia(matches: boolean) {
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  const mediaQuery = {
    matches,
    media: "(prefers-color-scheme: dark)",
    onchange: null,
    addEventListener: vi.fn((_type: string, listener: (event: MediaQueryListEvent) => void) => listeners.add(listener)),
    removeEventListener: vi.fn((_type: string, listener: (event: MediaQueryListEvent) => void) => listeners.delete(listener)),
    dispatch(nextMatches: boolean) {
      for (const listener of listeners) {
        listener({ matches: nextMatches } as MediaQueryListEvent);
      }
    }
  } as MediaQueryList & { dispatch(nextMatches: boolean): void };

  vi.stubGlobal("matchMedia", vi.fn(() => mediaQuery));
  return mediaQuery;
}

describe("theme runtime", () => {
  afterEach(() => {
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.removeAttribute("data-theme-mode");
    vi.unstubAllGlobals();
  });

  it.each([
    ["light", false, "light"],
    ["dark", false, "dark"],
    ["system", true, "dark"],
    ["system", false, "light"]
  ] satisfies Array<[AppearanceTheme, boolean, "light" | "dark"]>)(
    "resolves %s with system dark=%s",
    (theme, systemDark, expected) => {
      expect(resolveTheme(theme, systemDark)).toBe(expected);
    }
  );

  it("writes theme attributes to the document root", () => {
    applyThemeToDocument("dark", "system");

    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(document.documentElement.dataset.themeMode).toBe("system");
  });

  it("notifies when system theme changes", () => {
    const mediaQuery = installMatchMedia(false);
    const onChange = vi.fn();

    const stop = watchSystemTheme(onChange);
    mediaQuery.dispatch(true);
    stop();
    mediaQuery.dispatch(false);

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(true);
  });
});
