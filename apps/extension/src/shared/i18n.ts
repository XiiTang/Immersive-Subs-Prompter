import enMessages from "../../_locales/en/messages.json";
import zhMessages from "../../_locales/zh/messages.json";

type ReplacementValue = string | number | boolean | null | undefined;
export type LanguagePreference = "system" | "en" | "zh";
type MessageCatalog = Record<string, { message?: string }>;

export const LANGUAGE_STORAGE_KEY = "uspLanguage";

const MESSAGE_CATALOGS: Record<Exclude<LanguagePreference, "system">, MessageCatalog> = {
  en: enMessages as MessageCatalog,
  zh: zhMessages as MessageCatalog
};

let languagePreference: LanguagePreference = "system";

function getI18nApi(): typeof chrome.i18n | null {
  return typeof chrome !== "undefined" && chrome.i18n ? chrome.i18n : null;
}

function normalizeUiLanguage(value: string | null | undefined): "en" | "zh" {
  const normalized = (value ?? "").trim().toLowerCase().replace("_", "-");
  return normalized.startsWith("zh") ? "zh" : "en";
}

export function normalizeLanguagePreference(value: unknown): LanguagePreference {
  return value === "en" || value === "zh" || value === "system" ? value : "system";
}

function replaceNamedPlaceholders(text: string, replacements: Record<string, ReplacementValue>) {
  let next = text;
  for (const [name, value] of Object.entries(replacements)) {
    next = next.split(`{${name}}`).join(String(value ?? ""));
  }
  return next;
}

export function getUiLanguage(): "en" | "zh" {
  return normalizeUiLanguage(getI18nApi()?.getUILanguage?.());
}

export function getLanguagePreference(): LanguagePreference {
  return languagePreference;
}

export function setLanguagePreference(value: unknown): LanguagePreference {
  languagePreference = normalizeLanguagePreference(value);
  return languagePreference;
}

export function getEffectiveLanguage(): "en" | "zh" {
  return languagePreference === "system" ? getUiLanguage() : languagePreference;
}

function formatSubstitutions(message: string, substitutions?: string | string[]): string {
  const values = Array.isArray(substitutions)
    ? substitutions
    : typeof substitutions === "string"
      ? [substitutions]
      : [];
  return values.reduce((text, value, index) => text.split(`$${index + 1}`).join(value), message);
}

export function t(key: string, substitutions?: string | string[]): string {
  if (languagePreference === "system") {
    const message = getI18nApi()?.getMessage?.(key, substitutions);
    if (message && message.trim()) {
      return message;
    }
  }

  const message = MESSAGE_CATALOGS[getEffectiveLanguage()][key]?.message;
  return message && message.trim() ? formatSubstitutions(message, substitutions) : `missing:${key}`;
}

export function formatMessage(
  key: string,
  replacements: Record<string, ReplacementValue> = {}
): string {
  const substitutions = Object.values(replacements).map((value) => String(value ?? ""));
  const text = t(key, substitutions.length ? substitutions : undefined);
  return replaceNamedPlaceholders(text, replacements);
}

export function applyDocumentI18n(root: Document = document): void {
  root.documentElement.lang = getEffectiveLanguage();

  root.querySelectorAll<HTMLElement>("[data-i18n]").forEach((element) => {
    const key = element.dataset.i18n;
    if (!key) return;
    element.textContent = t(key);
  });

  const attributeMap: Array<[string, string]> = [
    ["data-i18n-title", "title"],
    ["data-i18n-aria-label", "aria-label"],
    ["data-i18n-placeholder", "placeholder"]
  ];
  for (const [dataAttribute, targetAttribute] of attributeMap) {
    root.querySelectorAll<HTMLElement>(`[${dataAttribute}]`).forEach((element) => {
      const key = element.getAttribute(dataAttribute);
      if (!key) return;
      element.setAttribute(targetAttribute, t(key));
    });
  }
}
