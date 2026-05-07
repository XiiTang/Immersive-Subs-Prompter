export interface WordLookupTextPart {
  key: string;
  text: string;
  token: boolean;
}

const WORD_TOKEN_PATTERN = /[A-Za-z0-9]+(?:['’][A-Za-z0-9]+)?(?:[-‐‑‒–—][A-Za-z0-9]+)*/gu;

export function tokenizeWordLookupText(text: string): WordLookupTextPart[] {
  const parts: WordLookupTextPart[] = [];
  let cursor = 0;
  let index = 0;

  for (const match of text.matchAll(WORD_TOKEN_PATTERN)) {
    const start = match.index ?? 0;
    const token = match[0];
    if (start > cursor) {
      parts.push({ key: `text-${index++}`, text: text.slice(cursor, start), token: false });
    }
    parts.push({ key: `token-${index++}`, text: token, token: true });
    cursor = start + token.length;
  }

  if (cursor < text.length) {
    parts.push({ key: `text-${index++}`, text: text.slice(cursor), token: false });
  }
  return parts.length ? parts : [{ key: "text-0", text, token: false }];
}
