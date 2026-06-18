import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fsp } from "node:fs";
import os from "node:os";
import path from "node:path";
import { SubtitleCacheManager } from "./subtitleCacheManager.js";
import type { SubtitleCacheSettings, SubtitleLoadResult } from "./types.js";

let cacheDir: string;
let manager: SubtitleCacheManager;
const CACHE_FILE_PATTERN = /^usp-cache-[a-f0-9]{64}\.json$/;

function makeSettings(partial: Partial<SubtitleCacheSettings> = {}): SubtitleCacheSettings {
  return {
    enabled: true,
    path: cacheDir,
    retentionDays: 7,
    ...partial
  };
}

function makeData(text: string): SubtitleLoadResult {
  return {
    tracks: [
      {
        id: "t1",
        sourceFile: "demo.srt",
        cues: [{ start: 0, end: 1000, text }]
      }
    ]
  };
}

async function ageOnlyCacheFile(ageMs: number) {
  const files = await fsp.readdir(cacheDir);
  const cacheFile = files.find((file) => CACHE_FILE_PATTERN.test(file));
  expect(cacheFile).toBeDefined();
  const filePath = path.join(cacheDir, cacheFile!);
  const entry = JSON.parse(await fsp.readFile(filePath, "utf-8")) as { timestamp: number };
  entry.timestamp = Date.now() - ageMs;
  await fsp.writeFile(filePath, JSON.stringify(entry, null, 2), "utf-8");
}

beforeEach(async () => {
  cacheDir = await fsp.mkdtemp(path.join(os.tmpdir(), "usp-cache-"));
});

afterEach(async () => {
  manager?.stop();
  await fsp.rm(cacheDir, { recursive: true, force: true });
});

describe("SubtitleCacheManager", () => {
  it("returns null when caching is disabled", async () => {
    manager = new SubtitleCacheManager(() => makeSettings({ enabled: false }));
    await manager.set("http://x", "ytdlp", makeData("a"));
    expect(await manager.get("http://x", "ytdlp")).toBeNull();
  });

  it("stores and retrieves entries from memory and disk", async () => {
    manager = new SubtitleCacheManager(() => makeSettings());
    const data = makeData("hello");
    await manager.set("http://x", "ytdlp", data);

    const hit = await manager.get("http://x", "ytdlp");
    expect(hit?.tracks[0].cues[0].text).toBe("hello");

    // Fresh manager (no memory) should still read from disk
    manager.stop();
    const reborn = new SubtitleCacheManager(() => makeSettings());
    const diskHit = await reborn.get("http://x", "ytdlp");
    expect(diskHit?.tracks[0].cues[0].text).toBe("hello");
    reborn.stop();
  });

  it("writes cache files with the app-owned prefix", async () => {
    manager = new SubtitleCacheManager(() => makeSettings());

    await manager.set("http://x", "ytdlp", makeData("prefixed"));

    const files = await fsp.readdir(cacheDir);
    expect(files).toHaveLength(1);
    expect(files[0]).toMatch(CACHE_FILE_PATTERN);
  });

  it("normalizes custom cache paths before use", async () => {
    manager = new SubtitleCacheManager(() => makeSettings({ path: path.join(cacheDir, "nested", "..", "custom") }));

    expect(manager.getCachePath()).toBe(path.join(cacheDir, "custom"));
  });

  it("redacts secret query values before persisting cache entries", async () => {
    manager = new SubtitleCacheManager(() => makeSettings());
    const url = "http://server.local/stream?api_key=secret-123&deviceId=dev";
    await manager.set(url, "mediaserver", makeData("private"));

    const files = await fsp.readdir(cacheDir);
    const cacheFile = files.find((file) => CACHE_FILE_PATTERN.test(file));
    expect(cacheFile).toBeDefined();
    const content = await fsp.readFile(path.join(cacheDir, cacheFile!), "utf-8");
    expect(content).not.toContain("secret-123");
    expect(JSON.parse(content).url).toBe(
      "http://server.local/stream?api_key=REDACTED&deviceId=dev"
    );

    const hit = await manager.get(url, "mediaserver");
    expect(hit?.tracks[0].cues[0].text).toBe("private");
  });

  it("segregates entries by source", async () => {
    manager = new SubtitleCacheManager(() => makeSettings());
    await manager.set("http://x", "ytdlp", makeData("from-ytdlp"));
    await manager.set("http://x", "mediaserver", makeData("from-media"));

    const a = await manager.get("http://x", "ytdlp");
    const b = await manager.get("http://x", "mediaserver");
    expect(a?.tracks[0].cues[0].text).toBe("from-ytdlp");
    expect(b?.tracks[0].cues[0].text).toBe("from-media");
  });

  it("segregates entries by variant", async () => {
    manager = new SubtitleCacheManager(() => makeSettings());
    await manager.set("http://x", "ytdlp", makeData("from-en"), "args-en");
    await manager.set("http://x", "ytdlp", makeData("from-zh"), "args-zh");

    const en = await manager.get("http://x", "ytdlp", "args-en");
    const zh = await manager.get("http://x", "ytdlp", "args-zh");

    expect(en?.tracks[0].cues[0].text).toBe("from-en");
    expect(zh?.tracks[0].cues[0].text).toBe("from-zh");
  });

  it("treats expired entries as misses", async () => {
    manager = new SubtitleCacheManager(() => makeSettings({ retentionDays: 1 }));
    await manager.set("http://x", "ytdlp", makeData("stale"));
    await ageOnlyCacheFile(2 * 24 * 60 * 60 * 1000);
    manager.stop();
    manager = new SubtitleCacheManager(() => makeSettings({ retentionDays: 1 }));

    expect(await manager.get("http://x", "ytdlp")).toBeNull();
  });

  it("reports stats for written entries", async () => {
    manager = new SubtitleCacheManager(() => makeSettings());
    await manager.set("http://a", "ytdlp", makeData("a"));
    await manager.set("http://b", "mediaserver", makeData("b"));

    const stats = await manager.getStats();
    expect(stats.totalEntries).toBe(2);
    expect(stats.totalSize).toBeGreaterThan(0);
    expect(stats.oldestEntry).not.toBeNull();
    expect(stats.newestEntry).not.toBeNull();
  });

  it("reports stats only for matching cache-owned files with valid cache shape", async () => {
    manager = new SubtitleCacheManager(() => makeSettings());
    await manager.set("http://a", "ytdlp", makeData("a"));
    await fsp.writeFile(path.join(cacheDir, "notes.json"), JSON.stringify({ timestamp: 1 }), "utf-8");
    await fsp.writeFile(path.join(cacheDir, "usp-cache-invalid.json"), JSON.stringify({ timestamp: 1 }), "utf-8");
    await fsp.writeFile(
      path.join(cacheDir, `usp-cache-${"a".repeat(64)}.json`),
      JSON.stringify({ timestamp: 1, data: null }),
      "utf-8"
    );

    const stats = await manager.getStats();

    expect(stats.totalEntries).toBe(1);
  });

  it("cleanup removes expired entries", async () => {
    manager = new SubtitleCacheManager(() => makeSettings({ retentionDays: 1 }));
    await manager.set("http://x", "ytdlp", makeData("stale"));
    await ageOnlyCacheFile(2 * 24 * 60 * 60 * 1000);
    manager.stop();
    manager = new SubtitleCacheManager(() => makeSettings({ retentionDays: 1 }));

    const removed = await manager.cleanup();
    expect(removed).toBeGreaterThanOrEqual(1);
  });

  it("cleanup skips unrelated json and invalid cache-shaped filenames", async () => {
    manager = new SubtitleCacheManager(() => makeSettings({ retentionDays: 1 }));
    await manager.set("http://x", "ytdlp", makeData("stale"));
    await ageOnlyCacheFile(2 * 24 * 60 * 60 * 1000);
    await fsp.writeFile(path.join(cacheDir, "notes.json"), "not cache", "utf-8");
    await fsp.writeFile(path.join(cacheDir, `usp-cache-${"b".repeat(64)}.json`), "not json", "utf-8");

    const removed = await manager.cleanup();
    const files = await fsp.readdir(cacheDir);

    expect(removed).toBe(1);
    expect(files).toContain("notes.json");
    expect(files).toContain(`usp-cache-${"b".repeat(64)}.json`);
  });
});
