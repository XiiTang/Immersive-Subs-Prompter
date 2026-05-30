import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fsp } from "node:fs";
import os from "node:os";
import path from "node:path";
import { SubtitleCacheManager } from "./subtitleCacheManager.js";
import type { SubtitleCacheSettings, SubtitleLoadResult } from "./types.js";

let cacheDir: string;
let manager: SubtitleCacheManager;

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

  it("redacts secret query values before persisting cache entries", async () => {
    manager = new SubtitleCacheManager(() => makeSettings());
    const url = "http://server.local/stream?api_key=secret-123&deviceId=dev";
    await manager.set(url, "mediaserver", makeData("private"));

    const files = await fsp.readdir(cacheDir);
    const cacheFile = files.find((file) => file.endsWith(".json"));
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
    // Negative retention forces every entry to be considered expired.
    manager = new SubtitleCacheManager(() => makeSettings({ retentionDays: -1 }));
    await manager.set("http://x", "ytdlp", makeData("stale"));
    expect(await manager.get("http://x", "ytdlp")).toBeNull();
  });

  it("clears both disk and memory", async () => {
    manager = new SubtitleCacheManager(() => makeSettings());
    await manager.set("http://x", "ytdlp", makeData("live"));
    await manager.clear();
    expect(await manager.get("http://x", "ytdlp")).toBeNull();
    const files = await fsp.readdir(cacheDir).catch(() => []);
    const jsonFiles = files.filter((f) => f.endsWith(".json"));
    expect(jsonFiles).toHaveLength(0);
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

  it("cleanup removes expired entries", async () => {
    manager = new SubtitleCacheManager(() => makeSettings({ retentionDays: -1 }));
    await manager.set("http://x", "ytdlp", makeData("stale"));
    const removed = await manager.cleanup();
    expect(removed).toBeGreaterThanOrEqual(1);
  });
});
