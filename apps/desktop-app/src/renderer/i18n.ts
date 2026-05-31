import type { ComputedRef } from "vue";
import { DEFAULT_LANGUAGE, SUPPORTED_LANGUAGES, type SupportedLanguage } from "../common/languages";
import enMessages from "./locales/en.json";
import zhMessages from "./locales/zh.json";

export { DEFAULT_LANGUAGE, type SupportedLanguage };

type Dictionary = Record<string, string>;
type TranslationReplacements = Record<string, string | number | boolean | null | undefined>;

const dictionaries: Record<SupportedLanguage, Dictionary> = {
  en: enMessages as Dictionary,
  zh: zhMessages as Dictionary
};

export function normalizeLanguage(value: string | null | undefined): SupportedLanguage {
  const code = (value ?? "").trim().toLowerCase();
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(code)
    ? (code as SupportedLanguage)
    : DEFAULT_LANGUAGE;
}

export function translate(key: string, language: SupportedLanguage): string {
  return dictionaries[language][key] ?? `missing:${key}`;
}

function formatTranslation(
  key: string,
  language: SupportedLanguage,
  replacements: TranslationReplacements = {}
): string {
  let text = translate(key, language);
  for (const [placeholder, replacement] of Object.entries(replacements)) {
    text = text.split(`{${placeholder}}`).join(String(replacement ?? ""));
  }
  return text;
}

export function useI18n(language: ComputedRef<string>) {
  const t = (key: string, replacements: TranslationReplacements = {}) =>
    formatTranslation(key, normalizeLanguage(language.value), replacements);
  return { t };
}
