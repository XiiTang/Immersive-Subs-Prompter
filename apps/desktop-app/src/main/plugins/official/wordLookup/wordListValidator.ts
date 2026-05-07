import { parseWordListJsonl } from "./wordListParser.js";

export interface CanonicalWordListRow {
  word: string;
  content: string;
  aliases?: string[];
}

export interface WordListNormalizeResult {
  entryCount: number;
  jsonl: string;
  skippedRows: WordListSkippedRow[];
}

export interface WordListValidationResult {
  ok: boolean;
  entryCount: number;
  errors: string[];
}

export interface WordListNormalizeOptions {
  skipInvalid?: boolean;
}

export interface WordListSkippedRow {
  label: string;
  error: string;
}

function parseAliases(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const aliases: string[] = [];
  for (const alias of value) {
    if (typeof alias !== "string") continue;
    const trimmed = alias.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    aliases.push(trimmed);
  }
  return aliases;
}

function normalizeRow(row: unknown, label: string): CanonicalWordListRow {
  if (!row || typeof row !== "object") {
    throw new Error(`${label}: expected an object`);
  }

  const candidate = row as Record<string, unknown>;
  if (typeof candidate.word !== "string" || !candidate.word.trim()) {
    throw new Error(`${label}: word must be a non-empty string`);
  }
  if (typeof candidate.content !== "string" || !candidate.content.trim()) {
    throw new Error(`${label}: content must be a non-empty string`);
  }

  const aliases = parseAliases(candidate.aliases);
  return {
    word: candidate.word.trim(),
    content: candidate.content,
    ...(aliases.length ? { aliases } : {})
  };
}

function rowsFromParsedJson(parsed: unknown): unknown[] {
  if (Array.isArray(parsed)) {
    return parsed;
  }
  if (!parsed || typeof parsed !== "object") {
    throw new Error("Expected a JSON array, a JSONL file, or an object with an entries array");
  }

  const candidate = parsed as Record<string, unknown>;
  if (Array.isArray(candidate.entries)) {
    return candidate.entries;
  }
  if (Array.isArray(candidate.words)) {
    return candidate.words;
  }
  if ("word" in candidate || "content" in candidate) {
    return [candidate];
  }

  throw new Error("Expected a JSON array, a JSONL file, or an object with an entries array");
}

function normalizeRows(rows: unknown[]): CanonicalWordListRow[] {
  return rows.map((row, index) => normalizeRow(row, `entry ${index + 1}`));
}

function normalizeRowsWithSkips(rows: unknown[], labelForIndex: (index: number) => string, skippedRows: WordListSkippedRow[]): CanonicalWordListRow[] {
  const normalized: CanonicalWordListRow[] = [];
  rows.forEach((row, index) => {
    const label = labelForIndex(index);
    try {
      normalized.push(normalizeRow(row, label));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      skippedRows.push({
        label,
        error: message
      });
    }
  });
  return normalized;
}

function parseJsonlRowsWithSkips(raw: string, skippedRows: WordListSkippedRow[]): CanonicalWordListRow[] {
  const normalized: CanonicalWordListRow[] = [];
  const lines = raw.split(/\r?\n/);
  lines.forEach((line, lineIndex) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    const label = `line ${lineIndex + 1}`;
    try {
      normalized.push(normalizeRow(JSON.parse(trimmed), label));
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      skippedRows.push({
        label,
        error: reason
      });
    }
  });
  return normalized;
}

export function normalizeWordListToJsonl(raw: string, options: WordListNormalizeOptions = {}): WordListNormalizeResult {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error("Word list is empty");
  }

  let rows: CanonicalWordListRow[];
  const skippedRows: WordListSkippedRow[] = [];
  try {
    const parsedRows = rowsFromParsedJson(JSON.parse(trimmed));
    rows = options.skipInvalid
      ? normalizeRowsWithSkips(parsedRows, (index) => `entry ${index + 1}`, skippedRows)
      : normalizeRows(parsedRows);
  } catch (error) {
    if (trimmed.startsWith("[") || (trimmed.startsWith("{") && !trimmed.includes("\n"))) {
      throw error;
    }
    rows = options.skipInvalid
      ? parseJsonlRowsWithSkips(raw, skippedRows)
      : parseWordListJsonl(raw).map((entry) => ({
        word: entry.word,
        content: entry.content,
        ...(entry.aliases.length ? { aliases: entry.aliases } : {})
      }));
  }

  const jsonl = `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`;
  const validation = validateWordListJsonl(jsonl);
  if (!validation.ok) {
    throw new Error(validation.errors[0] ?? "Generated JSONL failed validation");
  }

  return {
    entryCount: rows.length,
    jsonl,
    skippedRows
  };
}

export function validateWordListJsonl(raw: string): WordListValidationResult {
  try {
    const entries = parseWordListJsonl(raw);
    return {
      ok: true,
      entryCount: entries.length,
      errors: []
    };
  } catch (error) {
    return {
      ok: false,
      entryCount: 0,
      errors: [error instanceof Error ? error.message : String(error)]
    };
  }
}
