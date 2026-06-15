import type { WordLookupFeatureConfig, WordLookupModifierKey } from "../main/types.js";

export type { WordLookupFeatureConfig, WordLookupModifierKey };

export interface WordLookupPanelSize {
  width: number;
  height: number;
}

export interface WordLookupMatch {
  word: string;
  content: string;
  aliases: string[];
  fileOrder: number;
  matchQuality: number;
}

export interface WordLookupResult {
  token: string;
  normalizedToken: string;
  matches: WordLookupMatch[];
}

export interface WordLookupStatus {
  ok: boolean;
  wordListPath: string;
  entryCount: number;
  fileMtimeMs: number | null;
  loadedAt: number | null;
  error: string | null;
}
