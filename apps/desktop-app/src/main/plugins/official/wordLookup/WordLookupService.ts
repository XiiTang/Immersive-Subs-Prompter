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
import { sanitizeWordLookupPluginConfig } from "../../../settings/sanitizers/wordLookupSanitizer.js";

interface IndexedCandidate {
  entry: WordListEntry;
  source: "word" | "alias";
  value: string;
  exactKey: string;
  caseKey: string;
  normalizedKey: string;
}

interface LoadedIndex {
  wordListPath: string;
  fileMtimeMs: number;
  loadedAt: number;
  entryCount: number;
  candidates: IndexedCandidate[];
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

  constructor(private readonly getConfig: () => unknown) {}

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

    const exactToken = token;
    const caseToken = normalizeCase(token);
    const matches: WordLookupMatch[] = [];
    const seen = new Set<string>();

    for (const candidate of this.index.candidates) {
      const matchQuality = resolveMatchQuality(candidate, exactToken, caseToken, normalizedToken);
      if (matchQuality === null) continue;
      const key = `${candidate.entry.fileOrder}:${candidate.source}`;
      if (seen.has(key)) continue;
      seen.add(key);
      matches.push({
        word: candidate.entry.word,
        content: candidate.entry.content,
        aliases: candidate.entry.aliases,
        fileOrder: candidate.entry.fileOrder,
        matchQuality
      });
    }

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
    return sanitizeWordLookupPluginConfig(this.getConfig() as Partial<WordLookupPluginConfig> | null | undefined);
  }
}

function buildIndex(entries: WordListEntry[], wordListPath: string, fileMtimeMs: number): LoadedIndex {
  const candidates: IndexedCandidate[] = [];
  for (const entry of entries) {
    candidates.push(createCandidate(entry, "word", entry.word));
    for (const alias of entry.aliases) {
      candidates.push(createCandidate(entry, "alias", alias));
    }
  }

  return {
    wordListPath,
    fileMtimeMs,
    loadedAt: Date.now(),
    entryCount: entries.length,
    candidates
  };
}

function createCandidate(entry: WordListEntry, source: "word" | "alias", value: string): IndexedCandidate {
  const surface = normalizeTokenSurface(value);
  return {
    entry,
    source,
    value: surface,
    exactKey: surface,
    caseKey: normalizeCase(surface),
    normalizedKey: normalizeLookupKey(surface)
  };
}

function resolveMatchQuality(
  candidate: IndexedCandidate,
  exactToken: string,
  caseToken: string,
  normalizedToken: string
): number | null {
  if (candidate.source === "word" && candidate.exactKey === exactToken) return 1;
  if (candidate.source === "word" && candidate.caseKey === caseToken) return 2;
  if (candidate.source === "alias" && candidate.exactKey === exactToken) return 3;
  if (candidate.source === "alias" && candidate.caseKey === caseToken) return 4;
  if (candidate.source === "word" && candidate.normalizedKey === normalizedToken) return 5;
  if (candidate.source === "alias" && candidate.normalizedKey === normalizedToken) return 6;
  return null;
}
