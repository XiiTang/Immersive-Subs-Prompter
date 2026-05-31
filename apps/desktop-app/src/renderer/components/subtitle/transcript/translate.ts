export type SubtitleTranslateParams = Record<string, any>;

export type SubtitleTranslate = (key: string, params?: SubtitleTranslateParams) => string;

function formatTranslation(text: string, params: SubtitleTranslateParams = {}) {
  for (const [name, value] of Object.entries(params)) {
    text = text.split(`{${name}}`).join(String(value));
  }
  return text;
}

export function resolveSubtitleTranslate(translate?: SubtitleTranslate): SubtitleTranslate {
  return (key, params = {}) => translate?.(key, params) ?? formatTranslation(key, params);
}
