import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { WordLookupService } from "./wordLookupService.js";

let tempDir = "";

beforeEach(async () => {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "usp-word-lookup-"));
});

afterEach(async () => {
  await fs.rm(tempDir, { recursive: true, force: true });
});

async function writeWords(content: string): Promise<string> {
  const filePath = path.join(tempDir, "words.jsonl");
  await fs.writeFile(filePath, content, "utf-8");
  return filePath;
}

describe("WordLookupService", () => {
  it("rejects lookup while the feature is disabled", async () => {
    const service = new WordLookupService(() => ({
      enabled: false,
      config: { wordListPath: "", modifierKey: "alt", panelWidth: 360, panelHeight: 300 }
    }));

    await expect(service.lookup("hello")).rejects.toThrow("Word Lookup feature is disabled.");
  });

  it("reports a missing word list path while enabled", async () => {
    const service = new WordLookupService(() => ({
      enabled: true,
      config: { wordListPath: "", modifierKey: "alt", panelWidth: 360, panelHeight: 300 }
    }));

    await expect(service.lookup("hello")).rejects.toThrow("Word Lookup word list path is not configured.");
  });

  it("loads JSONL words and ranks exact, alias, and normalized matches", async () => {
    const filePath = await writeWords([
      JSON.stringify({ word: "hello", content: "你好", aliases: ["hi"] }),
      JSON.stringify({ word: "co-operate", content: "合作", aliases: ["cooperate"] })
    ].join("\n"));
    const service = new WordLookupService(() => ({
      enabled: true,
      config: { wordListPath: filePath, modifierKey: "alt", panelWidth: 360, panelHeight: 300 }
    }));

    await expect(service.lookup("hello")).resolves.toMatchObject({
      token: "hello",
      matches: [{ word: "hello", content: "你好", matchQuality: 1 }]
    });
    await expect(service.lookup("HI")).resolves.toMatchObject({
      matches: [{ word: "hello", matchQuality: 4 }]
    });
    await expect(service.lookup("cooperate")).resolves.toMatchObject({
      matches: [{ word: "co-operate" }]
    });
  });

  it("reports invalid JSONL rows", async () => {
    const filePath = await writeWords("{not-json}");
    const service = new WordLookupService(() => ({
      enabled: true,
      config: { wordListPath: filePath, modifierKey: "alt", panelWidth: 360, panelHeight: 300 }
    }));

    await expect(service.lookup("hello")).rejects.toThrow("Invalid word list row at line 1");
  });

  it("reloads when the configured word list path changes", async () => {
    const first = await writeWords(JSON.stringify({ word: "alpha", content: "A" }));
    const second = path.join(tempDir, "second.jsonl");
    await fs.writeFile(second, JSON.stringify({ word: "beta", content: "B" }), "utf-8");
    let wordListPath = first;
    const service = new WordLookupService(() => ({
      enabled: true,
      config: { wordListPath, modifierKey: "alt", panelWidth: 360, panelHeight: 300 }
    }));

    await expect(service.lookup("alpha")).resolves.toMatchObject({ matches: [{ word: "alpha" }] });
    wordListPath = second;
    await expect(service.lookup("beta")).resolves.toMatchObject({ matches: [{ word: "beta" }] });
  });
});
