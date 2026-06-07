const EDGE_PUNCTUATION =
  /^[\s"'“”‘’`.,!?;:()[\]{}<>，。！？；：（）【】《》]+|[\s"'“”‘’`.,!?;:()[\]{}<>，。！？；：（）【】《》]+$/gu;
const CURLY_APOSTROPHES = /[’‘`´]/gu;
const FOLDING_PUNCTUATION = /[\s._\-‐‑‒–—―/\\]+/gu;

const state = {
  wordListPath: "",
  loadedAt: null,
  entries: [],
  index: createEmptyIndex(),
  error: null
};

function normalizeSurface(value) {
  return String(value ?? "").trim();
}

function normalizeTokenSurface(value) {
  return normalizeSurface(value).replace(EDGE_PUNCTUATION, "");
}

function normalizeCase(value) {
  return normalizeSurface(value).replace(CURLY_APOSTROPHES, "'").toLocaleLowerCase();
}

function normalizeLookupKey(value) {
  return normalizeCase(value).replace(FOLDING_PUNCTUATION, "");
}

function parseJsonLine(line, lineNumber) {
  try {
    return JSON.parse(line);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid word list row at line ${lineNumber}: ${message}`);
  }
}

function parseAliases(value, lineNumber) {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new Error(`Invalid word list row at line ${lineNumber}: aliases must be an array`);
  }
  const aliases = [];
  const seen = new Set();
  for (const alias of value) {
    const normalized = normalizeSurface(alias);
    if (normalized && !seen.has(normalized)) {
      aliases.push(normalized);
      seen.add(normalized);
    }
  }
  return aliases;
}

function parseWordList(raw) {
  const entries = [];
  for (const [index, line] of raw.split(/\r?\n/).entries()) {
    const lineNumber = index + 1;
    const trimmed = line.trim();
    if (!trimmed) continue;
    const row = parseJsonLine(trimmed, lineNumber);
    if (!row || typeof row !== "object" || Array.isArray(row)) {
      throw new Error(`Invalid word list row at line ${lineNumber}: row must be an object`);
    }
    const word = normalizeSurface(row.word);
    const content = normalizeSurface(row.content);
    if (!word || !content) {
      throw new Error(`Invalid word list row at line ${lineNumber}: word and content are required`);
    }
    entries.push({
      word,
      content,
      aliases: parseAliases(row.aliases, lineNumber),
      fileOrder: entries.length
    });
  }
  return entries;
}

function createEmptyIndex() {
  return {
    exactWord: new Map(),
    caseWord: new Map(),
    normalizedWord: new Map(),
    exactAlias: new Map(),
    caseAlias: new Map(),
    normalizedAlias: new Map()
  };
}

function appendIndex(index, bucket, key, entry) {
  if (!key) {
    return;
  }
  const matches = index[bucket].get(key) ?? [];
  matches.push(entry);
  index[bucket].set(key, matches);
}

function buildIndex(entries) {
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

async function refresh() {
  const config = await usp.getConfig();
  state.wordListPath = normalizeSurface(config.wordListPath);
  state.entries = [];
  state.index = createEmptyIndex();
  state.loadedAt = null;
  state.error = null;
  if (!state.wordListPath) {
    state.loadedAt = Date.now();
    return;
  }
  const raw = await usp.readFile(state.wordListPath);
  state.entries = parseWordList(raw);
  state.index = buildIndex(state.entries);
  state.loadedAt = Date.now();
}

function collectMatches(index, bucket, key, matchQuality, matches, seen) {
  const entries = index[bucket].get(key) ?? [];
  for (const entry of entries) {
    if (seen.has(entry.fileOrder)) {
      continue;
    }
    matches.push({ ...entry, matchQuality });
    seen.add(entry.fileOrder);
  }
}

async function lookup(token) {
  const config = await usp.getConfig();
  if (normalizeSurface(config.wordListPath) !== state.wordListPath || !state.loadedAt) {
    try {
      await refresh();
    } catch (error) {
      state.error = error instanceof Error ? error.message : String(error);
      throw error;
    }
  }
  if (state.error) {
    throw new Error(state.error);
  }
  const surface = normalizeTokenSurface(token);
  const caseToken = normalizeCase(surface);
  const normalizedToken = normalizeLookupKey(surface);
  const matches = [];
  const seen = new Set();

  collectMatches(state.index, "exactWord", surface, 1, matches, seen);
  collectMatches(state.index, "caseWord", caseToken, 2, matches, seen);
  collectMatches(state.index, "exactAlias", surface, 3, matches, seen);
  collectMatches(state.index, "caseAlias", caseToken, 4, matches, seen);
  collectMatches(state.index, "normalizedWord", normalizedToken, 5, matches, seen);
  collectMatches(state.index, "normalizedAlias", normalizedToken, 6, matches, seen);

  matches.sort((left, right) => left.matchQuality - right.matchQuality || left.fileOrder - right.fileOrder);
  return { token: surface, normalizedToken, matches };
}

usp.registerWordLookupProvider({ lookup });
