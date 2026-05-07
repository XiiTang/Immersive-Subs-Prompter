const LEADING_TRAILING_PUNCTUATION = /^[\s"'“”‘’`.,!?;:()[\]{}<>，。！？；：（）【】《》]+|[\s"'“”‘’`.,!?;:()[\]{}<>，。！？；：（）【】《》]+$/gu;
const CURLY_APOSTROPHES = /[’‘`´]/gu;
const FOLDING_PUNCTUATION = /[\s._\-‐‑‒–—―/\\]+/gu;

export function normalizeCase(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase();
}

export function normalizeTokenSurface(value: string): string {
  return value
    .normalize("NFKC")
    .replace(CURLY_APOSTROPHES, "'")
    .replace(LEADING_TRAILING_PUNCTUATION, "")
    .trim();
}

export function normalizeLookupKey(value: string): string {
  return normalizeCase(normalizeTokenSurface(value)).replace(FOLDING_PUNCTUATION, "");
}
