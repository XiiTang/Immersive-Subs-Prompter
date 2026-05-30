import fs from "node:fs/promises";
import type {
  WordListEntry,
  WordLookupMatch,
  WordLookupPluginConfig,
  WordLookupResult,
  WordLookupStatus
} from "./wordLookupTypes.js";
import { parseWordListJsonl } from "./wordListParser.js";
import { normalizeCase, normalizeLookupKey, normalizeTokenSurface } from "./wordLookupNormalizer.js";

interface WordLookupIndexes {
  exactWord: Map<string, number[]>;
  caseWord: Map<string, number[]>;
  normalizedWord: Map<string, number[]>;
  exactAlias: Map<string, number[]>;
  caseAlias: Map<string, number[]>;
  normalizedAlias: Map<string, number[]>;
}

interface LoadedIndex {
  wordListPath: string;
  fileMtimeMs: number;
  loadedAt: number;
  entryCount: number;
  entries: WordListEntry[];
  indexes: WordLookupIndexes;
}

export class WordLookupService {
  private index: LoadedIndex | null = null;
  private status: WordLookupStatus = {
    ok: false,
    wordListPath: "",
    entryCount: 0,
    fileMtimeMs: null,
    loadedAt: null,
    error: null
  };

  constructor(private readonly getConfig: () => WordLookupPluginConfig) {}

  async refresh(): Promise<WordLookupStatus> {
    return this.load(true);
  }

  getStatus(): WordLookupStatus {
    const config = this.readConfig();
    if (config.wordListPath !== this.status.wordListPath) {
      return {
        ...this.status,
        ok: false,
        wordListPath: config.wordListPath,
        error: config.wordListPath ? "Word list path changed. Refresh to load it." : null
      };
    }
    return this.status;
  }

  async lookup(rawToken: string): Promise<WordLookupResult> {
    const token = normalizeTokenSurface(rawToken);
    const normalizedToken = normalizeLookupKey(token);
    if (!token || !normalizedToken) {
      return { token, normalizedToken, matches: [] };
    }

    await this.load(false);
    if (!this.index) {
      return { token, normalizedToken, matches: [] };
    }

    const index = this.index;
    const caseToken = normalizeCase(token);
    const matchedEntries = collectMatchingEntryIndexes(index.indexes, token, caseToken, normalizedToken);
    const matches = Array.from(matchedEntries, ([entryIndex, matchQuality]) => {
      const entry = index.entries[entryIndex];
      if (!entry) return null;
      return {
        word: entry.word,
        content: entry.content,
        aliases: entry.aliases,
        fileOrder: entry.fileOrder,
        matchQuality
      };
    }).filter((match): match is WordLookupMatch => match !== null);

    matches.sort((left, right) => left.matchQuality - right.matchQuality || left.fileOrder - right.fileOrder);
    return { token, normalizedToken, matches };
  }

  private async load(force: boolean): Promise<WordLookupStatus> {
    const config = this.readConfig();
    if (!config.wordListPath) {
      this.status = {
        ok: false,
        wordListPath: "",
        entryCount: this.index?.entryCount ?? 0,
        fileMtimeMs: this.index?.fileMtimeMs ?? null,
        loadedAt: this.index?.loadedAt ?? null,
        error: "No word list path configured."
      };
      return this.status;
    }

    if (!force && this.index?.wordListPath === config.wordListPath) {
      return this.status;
    }

    try {
      const stat = await fs.stat(config.wordListPath);
      if (!stat.isFile()) {
        throw new Error("Configured word list path is not a file.");
      }
      if (
        this.status.ok
        && this.index?.wordListPath === config.wordListPath
        && this.index.fileMtimeMs === stat.mtimeMs
      ) {
        return this.status;
      }
      const raw = await fs.readFile(config.wordListPath, "utf8");
      const entries = parseWordListJsonl(raw);
      const index = buildIndex(entries, config.wordListPath, stat.mtimeMs);
      this.index = index;
      this.status = {
        ok: true,
        wordListPath: config.wordListPath,
        entryCount: index.entryCount,
        fileMtimeMs: index.fileMtimeMs,
        loadedAt: index.loadedAt,
        error: null
      };
      return this.status;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.status = {
        ok: false,
        wordListPath: config.wordListPath,
        entryCount: this.index?.entryCount ?? 0,
        fileMtimeMs: this.index?.fileMtimeMs ?? null,
        loadedAt: this.index?.loadedAt ?? null,
        error: message
      };
      return this.status;
    }
  }

  private readConfig(): WordLookupPluginConfig {
    return this.getConfig();
  }
}

function buildIndex(entries: WordListEntry[], wordListPath: string, fileMtimeMs: number): LoadedIndex {
  const indexes = createEmptyIndexes();
  entries.forEach((entry, entryIndex) => {
    addSurfaceToIndexes(indexes.exactWord, indexes.caseWord, indexes.normalizedWord, entry.word, entryIndex);
    for (const alias of entry.aliases) {
      addSurfaceToIndexes(indexes.exactAlias, indexes.caseAlias, indexes.normalizedAlias, alias, entryIndex);
    }
  });

  return {
    wordListPath,
    fileMtimeMs,
    loadedAt: Date.now(),
    entryCount: entries.length,
    entries,
    indexes
  };
}

function createEmptyIndexes(): WordLookupIndexes {
  return {
    exactWord: new Map(),
    caseWord: new Map(),
    normalizedWord: new Map(),
    exactAlias: new Map(),
    caseAlias: new Map(),
    normalizedAlias: new Map()
  };
}

function addSurfaceToIndexes(
  exactIndex: Map<string, number[]>,
  caseIndex: Map<string, number[]>,
  normalizedIndex: Map<string, number[]>,
  value: string,
  entryIndex: number
) {
  const surface = normalizeTokenSurface(value);
  addEntryIndex(exactIndex, surface, entryIndex);
  addEntryIndex(caseIndex, normalizeCase(surface), entryIndex);
  addEntryIndex(normalizedIndex, normalizeLookupKey(surface), entryIndex);
}

function addEntryIndex(index: Map<string, number[]>, key: string, entryIndex: number) {
  if (!key) return;
  const bucket = index.get(key);
  if (!bucket) {
    index.set(key, [entryIndex]);
    return;
  }

  if (bucket[bucket.length - 1] !== entryIndex) {
    bucket.push(entryIndex);
  }
}

function collectMatchingEntryIndexes(
  indexes: WordLookupIndexes,
  token: string,
  caseToken: string,
  normalizedToken: string
): Map<number, number> {
  const matches = new Map<number, number>();
  collectBucket(matches, indexes.exactWord.get(token), 1);
  collectBucket(matches, indexes.caseWord.get(caseToken), 2);
  collectBucket(matches, indexes.exactAlias.get(token), 3);
  collectBucket(matches, indexes.caseAlias.get(caseToken), 4);
  collectBucket(matches, indexes.normalizedWord.get(normalizedToken), 5);
  collectBucket(matches, indexes.normalizedAlias.get(normalizedToken), 6);
  return matches;
}

function collectBucket(matches: Map<number, number>, bucket: number[] | undefined, matchQuality: number) {
  if (!bucket) return;
  for (const entryIndex of bucket) {
    if (!matches.has(entryIndex)) {
      matches.set(entryIndex, matchQuality);
    }
  }
}
