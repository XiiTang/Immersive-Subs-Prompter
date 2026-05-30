/**
 * Internationalization support for main process (tray, native menus, etc.)
 */

export const SUPPORTED_LANGUAGES = ["en", "zh"] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];
export const DEFAULT_LANGUAGE: SupportedLanguage = "en";

const ENGLISH_TRANSLATIONS: Record<string, string> = {
    "tray-show-window": "Show Window",
    "tray-quick-show": "Quick Show",
    "tray-quit": "Quit"
};

const CHINESE_TRANSLATIONS: Record<string, string> = {
    "tray-show-window": "显示窗口",
    "tray-quick-show": "快速显示",
    "tray-quit": "退出"
};

const TRANSLATIONS: Record<SupportedLanguage, Record<string, string>> = {
    en: ENGLISH_TRANSLATIONS,
    zh: CHINESE_TRANSLATIONS
};

export function normalizeLanguage(value: string | null | undefined): SupportedLanguage {
    const code = (value ?? "").trim().toLowerCase();
    return (SUPPORTED_LANGUAGES as readonly string[]).includes(code) ? (code as SupportedLanguage) : DEFAULT_LANGUAGE;
}

export function translate(key: string, fallback: string, language: SupportedLanguage): string {
    const dictionary = TRANSLATIONS[language] ?? TRANSLATIONS[DEFAULT_LANGUAGE];
    return dictionary[key] ?? fallback;
}
