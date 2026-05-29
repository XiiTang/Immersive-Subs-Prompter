export type SubtitleTranslateParams = Record<string, any>;

export type SubtitleTranslate = (key: string, fallback?: string, params?: SubtitleTranslateParams) => string;

export function fallbackSubtitleTranslate(_key: string, fallback = "", params: SubtitleTranslateParams = {}) {
  let text = fallback;
  for (const [name, value] of Object.entries(params)) {
    text = text.split(`{${name}}`).join(String(value));
  }
  return text;
}

export function resolveSubtitleTranslate(translate?: SubtitleTranslate): SubtitleTranslate {
  return (key, fallback = "", params = {}) =>
    translate?.(key, fallback, params) ?? fallbackSubtitleTranslate(key, fallback, params);
}
