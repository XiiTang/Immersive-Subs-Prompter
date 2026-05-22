import { APPEARANCE_STORAGE_KEY } from "./constants";

export { APPEARANCE_STORAGE_KEY };

export type AppearanceTheme = "system" | "light" | "dark";
export type ResolvedAppearanceTheme = "light" | "dark";

export function normalizeAppearanceTheme(value: unknown): AppearanceTheme {
  return value === "light" || value === "dark" || value === "system" ? value : "system";
}

export function resolveAppearanceTheme(theme: AppearanceTheme, systemPrefersDark: boolean): ResolvedAppearanceTheme {
  if (theme === "light") return "light";
  if (theme === "dark") return "dark";
  return systemPrefersDark ? "dark" : "light";
}

export function getStoredAppearanceTheme(payload: Record<string, unknown>): AppearanceTheme {
  return normalizeAppearanceTheme(payload[APPEARANCE_STORAGE_KEY]);
}
