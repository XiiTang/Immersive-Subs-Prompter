# Word Lookup Indexed Runtime Design

Date: 2026-05-08

## Scope

Optimize the runtime lookup index for the official word lookup plugin, `official.word-lookup`.

The user-facing JSONL format remains:

```jsonl
{"word":"run","aliases":["runs","running","ran"],"content":"### Meaning\nMove quickly on foot."}
```

Each entry is one dictionary article. `word` and `aliases` are lookup surfaces for that entry. `content` is stored once per entry and is not duplicated for aliases.

The project has not shipped, so the implementation should target the final structure directly. There is no compatibility layer, data migration, or support for older runtime shapes.

## Goals

- Keep hover lookup responsive for large word lists with tens or hundreds of thousands of lookup surfaces.
- Preserve the existing six-level match quality order.
- Treat aliases as first-class lookup inputs for their owning entry.
- Store entry content once and index entries by numeric id.
- Avoid repeated parsing and index construction when the configured file path and modification time are unchanged.
- Keep external behavior stable: JSONL schema, IPC response shape, settings status fields, and renderer behavior stay the same.

## Non-Goals

- Do not add stemming, lemmatization, fuzzy matching, or phrase expansion.
- Do not add file watching.
- Do not add new word-list fields.
- Do not change Markdown rendering or lookup window behavior.
- Do not change plugin enablement, settings UI, or preload APIs.

## Runtime Data Model

The loaded word list is represented as entries plus lookup indexes:

```ts
interface LoadedWordLookupIndex {
  wordListPath: string;
  fileMtimeMs: number;
  loadedAt: number;
  entries: WordListEntry[];
  indexes: WordLookupIndexes;
}

interface WordLookupIndexes {
  exactWord: Map<string, number[]>;
  caseWord: Map<string, number[]>;
  normalizedWord: Map<string, number[]>;
  exactAlias: Map<string, number[]>;
  caseAlias: Map<string, number[]>;
  normalizedAlias: Map<string, number[]>;
}
```

Each `number[]` contains indexes into `entries`. The maps never store full entry objects, entry content, or repeated key metadata. The map key already represents the lookup key for that bucket.

`entries` preserve parser file order. `fileOrder` remains the stable tie-breaker for returned matches.

## Index Construction

The parser continues to produce:

```ts
Array<{ word: string; content: string; aliases: string[]; fileOrder: number }>
```

Index construction walks `entries` once. For each entry:

- `word` is added to `exactWord`, `caseWord`, and `normalizedWord`.
- each alias is added to `exactAlias`, `caseAlias`, and `normalizedAlias`.
- map buckets store only the entry index.

Within one entry, each bucket should contain that entry index at most once for a given key. This avoids duplicate hits from repeated or equivalent aliases. The parser already removes exact duplicate alias strings; index construction also prevents duplicated entry ids inside case-folded and normalized buckets.

Across different entries, duplicate words and aliases remain valid. No entry overwrites another entry. If two entries share a word, alias, case-folded key, or normalized key, both entry indexes are stored and both entries can be returned.

## Lookup Semantics

Lookup normalizes the hovered token once:

```ts
const token = normalizeTokenSurface(rawToken);
const caseToken = normalizeCase(token);
const normalizedToken = normalizeLookupKey(token);
```

If `token` or `normalizedToken` is empty, lookup returns no matches.

The service queries indexes in this order:

1. `exactWord.get(token)`
2. `caseWord.get(caseToken)`
3. `exactAlias.get(token)`
4. `caseAlias.get(caseToken)`
5. `normalizedWord.get(normalizedToken)`
6. `normalizedAlias.get(normalizedToken)`

Those buckets map directly to the existing match quality values:

1. exact word
2. case-folded word
3. exact alias
4. case-folded alias
5. normalized word
6. normalized alias

The lookup result is deduplicated by entry id. If an entry appears in multiple buckets, the first bucket wins, so the entry keeps its best match quality. This follows the GoldenDict-ng style of merging repeated hits and keeping the best rank, adapted to this project where an entry is the article unit and aliases are lookup surfaces for that unit.

After collecting matches, the service returns `WordLookupMatch[]` sorted by:

1. `matchQuality`
2. `fileOrder`

The returned shape remains:

```ts
{
  token: string;
  normalizedToken: string;
  matches: Array<{
    word: string;
    content: string;
    aliases: string[];
    fileOrder: number;
    matchQuality: number;
  }>;
}
```

## Loading And Refresh

The service owns one active loaded index and one status object.

When loading a configured file:

- stat the configured `wordListPath`
- reject non-file paths
- if an active index has the same `wordListPath` and the same `mtimeMs`, return the current status without reading or parsing the file
- otherwise read, parse, build a new index, and replace the active index after construction succeeds

When a refresh succeeds, status reports:

- `ok: true`
- `wordListPath`
- `entryCount: entries.length`
- `fileMtimeMs`
- `loadedAt`
- `error: null`

When no path is configured, status reports the existing unconfigured error and lookup returns no matches.

When a load fails, status reports the error and the failed path. If a previous successful index exists, it remains active for lookup. This keeps hover lookup usable after a bad manual refresh.

If the path and modification time are unchanged, `loadedAt` remains unchanged. A no-op refresh should not imply that the word list was parsed again.

## Error Handling

Parsing and validation errors continue to come from the existing parser. Invalid JSONL fails the whole load and includes the first invalid line number.

Lookup misses are not errors. They return an empty `matches` array and do not show an error in the subtitle view.

The settings UI continues to display load status, entry count, file modification time, loaded time, and error summary through the existing status shape.

## Performance Characteristics

Index construction is linear in the number of entries plus aliases.

Lookup does not scan all entries or all alias surfaces. It performs:

- one token surface normalization
- one case key computation
- one normalized key computation
- up to six map lookups
- iteration over only the matching buckets

Memory usage is proportional to entries plus indexed keys. Entry content is stored once. Indexed buckets store numeric entry ids rather than full candidate objects or repeated copies of normalized key metadata.

## Tests

Main-process tests should cover:

- exact word, case-folded word, exact alias, case-folded alias, normalized word, and normalized alias matches
- match sorting by quality before file order
- duplicate words across entries all return
- duplicate aliases across entries all return
- the same entry matching through multiple aliases returns once with the best match quality
- the same entry matching through both word and alias returns once with word quality winning when applicable
- same-path and same-`mtimeMs` refresh returns the current status without changing `loadedAt`
- changed `mtimeMs` refresh loads new file contents
- failed refresh preserves the previous successful index

Expected verification:

```sh
pnpm --dir apps/desktop-app exec vitest run --project main src/main/plugins/official/wordLookup/wordLookup.test.ts
pnpm --filter @immersive-subs/desktop-app typecheck
```

## Acceptance Criteria

- Large word lists use bucketed map lookup rather than full candidate scans.
- One entry stores one copy of `content` regardless of alias count.
- Aliases resolve to their owning entry and are not duplicated as article entries.
- Existing match quality order is preserved.
- Same-entry duplicate hits collapse to one returned match with the best quality.
- Cross-entry duplicate words and aliases still return all matching entries.
- Repeated refresh with unchanged path and `mtimeMs` avoids file read, parse, and index rebuild work.
- Existing JSONL files and renderer behavior require no changes.
