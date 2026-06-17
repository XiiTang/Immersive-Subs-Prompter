import { promises as fs } from "node:fs";
import type { WordLookupFeatureSettings } from "../types.js";
import type { WordLookupMatch, WordLookupResult, WordLookupStatus } from "../../common/wordLookupTypes.js";

type GetSettings = () => WordLookupFeatureSettings;

const EDGE_PUNCTUATION =
  /^[\s"'“”‘’`.,!?;:()[\]{}<>，。！？；：（）【】《》]+|[\s"'“”‘’`.,!?;:()[\]{}<>，。！？；：（）【】《》]+$/gu;
const CURLY_APOSTROPHES = /[’‘`´]/gu;
const FOLDING_PUNCTUATION = /[\s._\-‐‑‒–—―/\\]+/gu;

interface WordEntry {
  word: string;
  content: string;
  aliases: string[];
  fileOrder: number;
}

type IndexBucket = Map<string, WordEntry[]>;

interface WordIndex {
  exactWord: IndexBucket;
  caseWord: IndexBucket;
  normalizedWord: IndexBucket;
  exactAlias: IndexBucket;
  caseAlias: IndexBucket;
  normalizedAlias: IndexBucket;
}

interface LoadedWordList {
  wordListPath: string;
  entries: WordEntry[];
  index: WordIndex;
  loadedAt: number;
}

export class WordLookupService {
  private loaded: LoadedWordList | null = null;
  private status: WordLookupStatus = {
    ok: false,
    wordListPath: "",
    entryCount: 0,
    fileMtimeMs: null,
    loadedAt: null,
    error: null
  };

  constructor(private readonly getSettings: GetSettings) {}

  async lookup(token: string): Promise<WordLookupResult> {
    const settings = this.getSettings();
    if (!settings.enabled) {
      throw new Error("Word Lookup feature is disabled.");
    }
    await this.load(false);
    if (!this.loaded || !this.status.ok) {
      throw new Error(this.status.error ?? "Word Lookup word list is not loaded.");
    }
    const loaded = this.loaded;
    const surface = normalizeTokenSurface(token);
    const caseToken = normalizeCase(surface);
    const normalizedToken = normalizeLookupKey(surface);
    const matches: WordLookupMatch[] = [];
    const seen = new Set<number>();

    collectMatches(loaded.index, "exactWord", surface, 1, matches, seen);
    collectMatches(loaded.index, "caseWord", caseToken, 2, matches, seen);
    collectMatches(loaded.index, "exactAlias", surface, 3, matches, seen);
    collectMatches(loaded.index, "caseAlias", caseToken, 4, matches, seen);
    collectMatches(loaded.index, "normalizedWord", normalizedToken, 5, matches, seen);
    collectMatches(loaded.index, "normalizedAlias", normalizedToken, 6, matches, seen);

    matches.sort((left, right) => left.matchQuality - right.matchQuality || left.fileOrder - right.fileOrder);
    return { token: surface, normalizedToken, matches };
  }

  async refresh(): Promise<WordLookupStatus> {
    return this.load(true);
  }

  getStatus(): WordLookupStatus {
    const wordListPath = normalizeSurface(this.getSettings().config.wordListPath);
    if (wordListPath !== this.status.wordListPath) {
      return {
        ok: false,
        wordListPath,
        entryCount: 0,
        fileMtimeMs: null,
        loadedAt: null,
        error: wordListPath ? "Word list path changed. Refresh to load it." : null
      };
    }
    return this.status;
  }

  clear(): void {
    this.loaded = null;
    this.status = {
      ok: false,
      wordListPath: "",
      entryCount: 0,
      fileMtimeMs: null,
      loadedAt: null,
      error: null
    };
  }

  private async load(force: boolean): Promise<WordLookupStatus> {
    const wordListPath = normalizeSurface(this.getSettings().config.wordListPath);
    if (!wordListPath) {
      this.loaded = null;
      this.status = {
        ok: false,
        wordListPath: "",
        entryCount: 0,
        fileMtimeMs: null,
        loadedAt: null,
        error: "Word Lookup word list path is not configured."
      };
      return this.status;
    }
    if (!force && this.loaded?.wordListPath === wordListPath) {
      return this.status;
    }
    try {
      const stat = await fs.stat(wordListPath);
      if (!stat.isFile()) {
        throw new Error("Configured word list path is not a file.");
      }
      const raw = await fs.readFile(wordListPath, "utf-8");
      const entries = parseWordList(raw);
      this.loaded = {
        wordListPath,
        entries,
        index: buildIndex(entries),
        loadedAt: Date.now()
      };
      this.status = {
        ok: true,
        wordListPath,
        entryCount: entries.length,
        fileMtimeMs: stat.mtimeMs,
        loadedAt: this.loaded.loadedAt,
        error: null
      };
      return this.status;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.loaded = null;
      this.status = {
        ok: false,
        wordListPath,
        entryCount: 0,
        fileMtimeMs: null,
        loadedAt: null,
        error: message
      };
      return this.status;
    }
  }
}

function normalizeSurface(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeTokenSurface(value: unknown): string {
  return normalizeSurface(value).replace(EDGE_PUNCTUATION, "");
}

function normalizeCase(value: unknown): string {
  return normalizeSurface(value).replace(CURLY_APOSTROPHES, "'").toLocaleLowerCase();
}

function normalizeLookupKey(value: unknown): string {
  return normalizeCase(value).replace(FOLDING_PUNCTUATION, "");
}

function parseJsonLine(line: string, lineNumber: number): unknown {
  try {
    return JSON.parse(line) as unknown;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid word list row at line ${lineNumber}: ${message}`);
  }
}

function parseAliases(value: unknown, lineNumber: number): string[] {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new Error(`Invalid word list row at line ${lineNumber}: aliases must be an array`);
  }
  const aliases: string[] = [];
  const seen = new Set<string>();
  for (const alias of value) {
    const normalized = normalizeSurface(alias);
    if (normalized && !seen.has(normalized)) {
      aliases.push(normalized);
      seen.add(normalized);
    }
  }
  return aliases;
}

function parseWordList(raw: string): WordEntry[] {
  const entries: WordEntry[] = [];
  for (const [index, line] of raw.split(/\r?\n/).entries()) {
    const lineNumber = index + 1;
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    const row = parseJsonLine(trimmed, lineNumber);
    if (!row || typeof row !== "object" || Array.isArray(row)) {
      throw new Error(`Invalid word list row at line ${lineNumber}: row must be an object`);
    }
    const record = row as Record<string, unknown>;
    const word = normalizeSurface(record.word);
    const content = normalizeSurface(record.content);
    if (!word || !content) {
      throw new Error(`Invalid word list row at line ${lineNumber}: word and content are required`);
    }
    entries.push({
      word,
      content,
      aliases: parseAliases(record.aliases, lineNumber),
      fileOrder: entries.length
    });
  }
  return entries;
}

function createEmptyIndex(): WordIndex {
  return {
    exactWord: new Map(),
    caseWord: new Map(),
    normalizedWord: new Map(),
    exactAlias: new Map(),
    caseAlias: new Map(),
    normalizedAlias: new Map()
  };
}

function appendIndex(index: WordIndex, bucket: keyof WordIndex, key: string, entry: WordEntry): void {
  if (!key) {
    return;
  }
  const matches = index[bucket].get(key) ?? [];
  matches.push(entry);
  index[bucket].set(key, matches);
}

function buildIndex(entries: WordEntry[]): WordIndex {
  const index = createEmptyIndex();
  for (const entry of entries) {
    appendIndex(index, "exactWord", entry.word, entry);
    appendIndex(index, "caseWord", normalizeCase(entry.word), entry);
    appendIndex(index, "normalizedWord", normalizeLookupKey(entry.word), entry);
    for (const alias of entry.aliases) {
      appendIndex(index, "exactAlias", alias, entry);
      appendIndex(index, "caseAlias", normalizeCase(alias), entry);
      appendIndex(index, "normalizedAlias", normalizeLookupKey(alias), entry);
    }
  }
  return index;
}

function collectMatches(
  index: WordIndex,
  bucket: keyof WordIndex,
  key: string,
  matchQuality: number,
  matches: WordLookupMatch[],
  seen: Set<number>
): void {
  const entries = index[bucket].get(key) ?? [];
  for (const entry of entries) {
    if (seen.has(entry.fileOrder)) {
      continue;
    }
    matches.push({ ...entry, matchQuality });
    seen.add(entry.fileOrder);
  }
}
