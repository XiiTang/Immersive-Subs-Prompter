import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseWordListJsonl } from "./wordListParser.js";
import { normalizeLookupKey } from "./wordLookupNormalizer.js";
import { WordLookupService } from "./WordLookupService.js";

function tempWordList(contents: string): string {
  const dir = mkdtempSync(join(tmpdir(), "usp-word-lookup-"));
  const filePath = join(dir, "words.jsonl");
  writeFileSync(filePath, contents, "utf8");
  return filePath;
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
});
