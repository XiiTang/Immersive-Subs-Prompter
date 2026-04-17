import { ref, type ComputedRef } from "vue";

const SUPPORTED_LANGUAGES = ["en", "zh"] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];
export const DEFAULT_LANGUAGE: SupportedLanguage = "en";

type Dictionary = Record<string, string>;

// Each locale is emitted as a separate chunk by Vite thanks to the dynamic
// import; only the active locale is fetched at runtime.
const LOCALE_LOADERS: Record<SupportedLanguage, () => Promise<Dictionary>> = {
  en: () => import("./locales/en.json").then((m) => m.default as Dictionary),
  zh: () => import("./locales/zh.json").then((m) => m.default as Dictionary)
};

const dictionaries: Partial<Record<SupportedLanguage, Dictionary>> = {};
const inflight: Partial<Record<SupportedLanguage, Promise<Dictionary>>> = {};

// Reactive counter read inside every translate() call. Bumping it forces any
// Vue template/computed that called translate() to re-render after a locale
// dictionary arrives asynchronously.
const localeRevision = ref(0);

export function normalizeLanguage(value: string | null | undefined): SupportedLanguage {
  const code = (value ?? "").trim().toLowerCase();
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(code)
    ? (code as SupportedLanguage)
    : DEFAULT_LANGUAGE;
}

export function loadLocale(lang: SupportedLanguage): Promise<Dictionary> {
  const cached = dictionaries[lang];
  if (cached) {
    return Promise.resolve(cached);
  }
  const pending = inflight[lang];
  if (pending) {
    return pending;
  }
  const promise = LOCALE_LOADERS[lang]()
    .then((dict) => {
      dictionaries[lang] = dict;
      localeRevision.value += 1;
      return dict;
    })
    .finally(() => {
      delete inflight[lang];
    });
  inflight[lang] = promise;
  return promise;
}

export function translate(key: string, fallback = "", language: SupportedLanguage): string {
  // Subscribe to locale revision so callers inside Vue reactivity re-run when
  // a newly loaded dictionary becomes available.
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  localeRevision.value;

  const dict = dictionaries[language];
  if (dict) {
    return dict[key] ?? fallback;
  }
  // Kick off load lazily; return fallback until dictionary is ready.
  void loadLocale(language);
  const base = dictionaries[DEFAULT_LANGUAGE];
  return base?.[key] ?? fallback;
}

export function formatTranslation(
  key: string,
  fallback = "",
  language: SupportedLanguage,
  replacements: Record<string, string> = {}
): string {
  let text = translate(key, fallback, language);
  for (const [placeholder, replacement] of Object.entries(replacements)) {
    text = text.split(`{${placeholder}}`).join(replacement);
  }
  return text;
}

export function useI18n(language: ComputedRef<string>) {
  const t = (key: string, fallback = "", replacements: Record<string, string> = {}) =>
    formatTranslation(key, fallback, normalizeLanguage(language.value), replacements);
  return { t };
}

// Eagerly preload the default language so the first render has real strings
// rather than fallbacks from the call site.
void loadLocale(DEFAULT_LANGUAGE);
