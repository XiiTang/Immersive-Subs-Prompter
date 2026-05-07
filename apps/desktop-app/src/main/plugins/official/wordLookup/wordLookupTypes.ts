export type WordLookupModifierKey = "alt" | "ctrl" | "shift";

export interface WordLookupPanelSize {
  width: number;
  height: number;
}

export interface WordLookupPluginConfig {
  wordListPath: string;
  modifierKey: WordLookupModifierKey;
  panelSize: WordLookupPanelSize;
}

export interface WordListEntry {
  word: string;
  content: string;
  aliases: string[];
  fileOrder: number;
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
