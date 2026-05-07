import type { WordListEntry } from "./wordLookupTypes.js";

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function parseAliases(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const aliases: string[] = [];
  for (const alias of value) {
    if (!isNonEmptyString(alias)) continue;
    const trimmed = alias.trim();
    if (seen.has(trimmed)) continue;
    seen.add(trimmed);
    aliases.push(trimmed);
  }
  return aliases;
}

export function parseWordListJsonl(raw: string): WordListEntry[] {
  const entries: WordListEntry[] = [];
  const lines = raw.split(/\r?\n/);

  lines.forEach((line, lineIndex) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Invalid word list row at line ${lineIndex + 1}: ${message}`);
    }

    if (!parsed || typeof parsed !== "object") {
      throw new Error(`Invalid word list row at line ${lineIndex + 1}: expected an object`);
    }

    const row = parsed as Record<string, unknown>;
    if (!isNonEmptyString(row.word) || !isNonEmptyString(row.content)) {
      throw new Error(`Invalid word list row at line ${lineIndex + 1}: word and content must be non-empty strings`);
    }

    entries.push({
      word: row.word.trim(),
      content: row.content,
      aliases: parseAliases(row.aliases),
      fileOrder: entries.length
    });
  });

  return entries;
}
