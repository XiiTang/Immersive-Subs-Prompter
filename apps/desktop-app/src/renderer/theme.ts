import { computed, onBeforeUnmount, ref, watch, type ComputedRef } from "vue";
import type { AppearanceTheme } from "../main/types";

export type { AppearanceTheme };
export type ResolvedTheme = "light" | "dark";

const darkQuery = "(prefers-color-scheme: dark)";

function getSystemPrefersDark(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia(darkQuery).matches
    : false;
}

function resolveTheme(theme: AppearanceTheme, systemPrefersDark = getSystemPrefersDark()): ResolvedTheme {
  if (theme === "dark") return "dark";
  if (theme === "light") return "light";
  return systemPrefersDark ? "dark" : "light";
}

function applyThemeToDocument(resolvedTheme: ResolvedTheme, mode: AppearanceTheme) {
  document.documentElement.dataset.theme = resolvedTheme;
  document.documentElement.dataset.themeMode = mode;
}

function watchSystemTheme(onChange: (prefersDark: boolean) => void): () => void {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return () => undefined;
  }

  const mediaQuery = window.matchMedia(darkQuery);
  const listener = (event: MediaQueryListEvent) => onChange(event.matches);
  mediaQuery.addEventListener("change", listener);
  return () => mediaQuery.removeEventListener("change", listener);
}

export function useDocumentTheme(theme: ComputedRef<AppearanceTheme | undefined>) {
  const systemPrefersDark = ref(getSystemPrefersDark());
  const mode = computed<AppearanceTheme>(() => theme.value ?? "system");
  const resolvedTheme = computed(() => resolveTheme(mode.value, systemPrefersDark.value));

  const stopWatch = watch(
    [mode, resolvedTheme],
    () => applyThemeToDocument(resolvedTheme.value, mode.value),
    { immediate: true }
  );

  const stopSystemWatch = watchSystemTheme((prefersDark) => {
    systemPrefersDark.value = prefersDark;
  });

  onBeforeUnmount(() => {
    stopWatch();
    stopSystemWatch();
  });

  return { mode, resolvedTheme };
}
