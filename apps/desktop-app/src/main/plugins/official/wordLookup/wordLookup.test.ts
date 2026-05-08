import { mkdtempSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseWordListJsonl } from "./wordListParser.js";
import { normalizeWordListToJsonl, validateWordListJsonl } from "./wordListValidator.js";
import { normalizeLookupKey } from "./wordLookupNormalizer.js";
import { WordLookupService } from "./WordLookupService.js";

function tempWordList(contents: string): string {
  const dir = mkdtempSync(join(tmpdir(), "usp-word-lookup-"));
  const filePath = join(dir, "words.jsonl");
  writeFileSync(filePath, contents, "utf8");
  return filePath;
}

function waitForClockTick(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 2));
}

describe("word lookup JSONL parser", () => {
  it("accepts word/content rows and optional aliases while preserving file order", () => {
    const entries = parseWordListJsonl([
      JSON.stringify({ word: "run", content: "## run", aliases: ["runs", "ran"] }),
      "",
      JSON.stringify({ word: "walk", content: "walk content", aliases: ["walks", 1, ""] })
    ].join("\n"));

    expect(entries).toEqual([
      { word: "run", content: "## run", aliases: ["runs", "ran"], fileOrder: 0 },
      { word: "walk", content: "walk content", aliases: ["walks"], fileOrder: 1 }
    ]);
  });

  it("reports the first invalid line with a concrete line number", () => {
    expect(() => parseWordListJsonl("{\"word\":\"ok\",\"content\":\"ok\"}\n{\"word\":\"bad\"}")).toThrow(
      "Invalid word list row at line 2"
    );
  });
});

describe("word lookup normalization", () => {
  it("case folds and trims punctuation without guessing morphology", () => {
    expect(normalizeLookupKey("“Running,”")).toBe("running");
    expect(normalizeLookupKey("can't")).toBe("can't");
    expect(normalizeLookupKey("can’t")).toBe("can't");
    expect(normalizeLookupKey("look-up")).toBe("lookup");
    expect(normalizeLookupKey("runs")).not.toBe(normalizeLookupKey("run"));
  });
});

describe("word list validation and conversion", () => {
  it("converts JSON arrays to canonical JSONL and revalidates the output", () => {
    const result = normalizeWordListToJsonl(JSON.stringify([
      { word: "run", content: "run content", aliases: ["runs", "", "runs"] },
      { word: "walk", content: "walk content" }
    ]));

    expect(result.entryCount).toBe(2);
    expect(result.jsonl).toBe([
      JSON.stringify({ word: "run", content: "run content", aliases: ["runs"] }),
      JSON.stringify({ word: "walk", content: "walk content" })
    ].join("\n") + "\n");
    expect(validateWordListJsonl(result.jsonl)).toEqual({ ok: true, entryCount: 2, errors: [] });
  });

  it("converts wrapped entry objects to canonical JSONL", () => {
    const result = normalizeWordListToJsonl(JSON.stringify({
      entries: [
        { word: "A.M.", content: "morning" }
      ]
    }));

    expect(result.jsonl).toBe(`${JSON.stringify({ word: "A.M.", content: "morning" })}\n`);
  });

  it("returns validation errors without throwing for invalid JSONL", () => {
    expect(validateWordListJsonl("{\"word\":\"ok\",\"content\":\"ok\"}\n{\"word\":\"bad\"}")).toEqual({
      ok: false,
      entryCount: 0,
      errors: ["Invalid word list row at line 2: word and content must be non-empty strings"]
    });
  });

  it("can skip invalid JSONL rows while producing a parseable output", () => {
    const result = normalizeWordListToJsonl([
      JSON.stringify({ word: "ok", content: "ok content" }),
      JSON.stringify({ word: "bad", content: "" })
    ].join("\n"), { skipInvalid: true });

    expect(result.entryCount).toBe(1);
    expect(result.skippedRows).toEqual([
      {
        label: "line 2",
        error: "line 2: content must be a non-empty string"
      }
    ]);
    expect(validateWordListJsonl(result.jsonl)).toEqual({ ok: true, entryCount: 1, errors: [] });
  });
});

describe("WordLookupService", () => {
  it("sorts duplicate hits by match quality before falling back to file order", async () => {
    const filePath = tempWordList([
      JSON.stringify({ word: "normalized", aliases: ["HELLO"], content: "alias folded" }),
      JSON.stringify({ word: "hello", content: "word folded" }),
      JSON.stringify({ word: "other", aliases: ["Hello"], content: "alias exact" }),
      JSON.stringify({ word: "Hello", content: "word exact" }),
      JSON.stringify({ word: "he-llo", content: "word normalized" }),
      JSON.stringify({ word: "other2", aliases: ["he-llo"], content: "alias normalized" })
    ].join("\n"));
    const service = new WordLookupService(() => ({ wordListPath: filePath, modifierKey: "alt", panelSize: { width: 360, height: 300 } }));

    await service.refresh();
    const result = await service.lookup("Hello");

    expect(result.matches.map((match) => match.content)).toEqual([
      "word exact",
      "word folded",
      "alias exact",
      "alias folded",
      "word normalized",
      "alias normalized"
    ]);
  });

  it("keeps the previous loaded index when a later refresh fails", async () => {
    const validPath = tempWordList(JSON.stringify({ word: "stable", content: "cached" }));
    let path = validPath;
    const service = new WordLookupService(() => ({ wordListPath: path, modifierKey: "alt", panelSize: { width: 360, height: 300 } }));

    await service.refresh();
    path = join(tmpdir(), "missing-word-list.jsonl");
    const status = await service.refresh();
    const result = await service.lookup("stable");

    expect(status.ok).toBe(false);
    expect(result.matches.map((match) => match.content)).toEqual(["cached"]);
  });

  it("deduplicates same-entry alias hits while keeping the best match quality", async () => {
    const filePath = tempWordList(JSON.stringify({
      word: "canonical",
      aliases: ["HELLO", "Hello", "he-llo"],
      content: "same entry"
    }));
    const service = new WordLookupService(() => ({ wordListPath: filePath, modifierKey: "alt", panelSize: { width: 360, height: 300 } }));

    await service.refresh();
    const result = await service.lookup("Hello");

    expect(result.matches).toHaveLength(1);
    expect(result.matches[0]).toMatchObject({
      content: "same entry",
      matchQuality: 3
    });
  });

  it("deduplicates word and alias hits for one entry with word quality winning", async () => {
    const filePath = tempWordList(JSON.stringify({
      word: "Hello",
      aliases: ["Hello", "HELLO"],
      content: "word wins"
    }));
    const service = new WordLookupService(() => ({ wordListPath: filePath, modifierKey: "alt", panelSize: { width: 360, height: 300 } }));

    await service.refresh();
    const result = await service.lookup("Hello");

    expect(result.matches).toHaveLength(1);
    expect(result.matches[0]).toMatchObject({
      content: "word wins",
      matchQuality: 1
    });
  });

  it("keeps duplicate alias hits across different entries", async () => {
    const filePath = tempWordList([
      JSON.stringify({ word: "first", aliases: ["Hello"], content: "first entry" }),
      JSON.stringify({ word: "second", aliases: ["Hello"], content: "second entry" })
    ].join("\n"));
    const service = new WordLookupService(() => ({ wordListPath: filePath, modifierKey: "alt", panelSize: { width: 360, height: 300 } }));

    await service.refresh();
    const result = await service.lookup("Hello");

    expect(result.matches.map((match) => match.content)).toEqual(["first entry", "second entry"]);
    expect(result.matches.map((match) => match.matchQuality)).toEqual([3, 3]);
  });

  it("skips refresh work when path and mtime are unchanged", async () => {
    const filePath = tempWordList(JSON.stringify({ word: "stable", content: "first content" }));
    const fileTime = new Date("2026-01-01T00:00:00.000Z");
    utimesSync(filePath, fileTime, fileTime);
    const service = new WordLookupService(() => ({ wordListPath: filePath, modifierKey: "alt", panelSize: { width: 360, height: 300 } }));

    const firstStatus = await service.refresh();
    writeFileSync(filePath, JSON.stringify({ word: "stable", content: "changed content" }), "utf8");
    utimesSync(filePath, fileTime, fileTime);
    const secondStatus = await service.refresh();
    const result = await service.lookup("stable");

    expect(secondStatus.loadedAt).toBe(firstStatus.loadedAt);
    expect(result.matches.map((match) => match.content)).toEqual(["first content"]);
  });

  it("reloads when the configured file mtime changes", async () => {
    const filePath = tempWordList(JSON.stringify({ word: "stable", content: "first content" }));
    const firstFileTime = new Date("2026-01-01T00:00:00.000Z");
    const secondFileTime = new Date("2026-01-01T00:00:02.000Z");
    utimesSync(filePath, firstFileTime, firstFileTime);
    const service = new WordLookupService(() => ({ wordListPath: filePath, modifierKey: "alt", panelSize: { width: 360, height: 300 } }));

    const firstStatus = await service.refresh();
    writeFileSync(filePath, JSON.stringify({ word: "stable", content: "changed content" }), "utf8");
    utimesSync(filePath, secondFileTime, secondFileTime);
    await waitForClockTick();
    const secondStatus = await service.refresh();
    const result = await service.lookup("stable");

    expect(secondStatus.loadedAt).not.toBe(firstStatus.loadedAt);
    expect(result.matches.map((match) => match.content)).toEqual(["changed content"]);
  });
});
