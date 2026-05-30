import { createHash } from "node:crypto";
import { promises as fsp } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_YTDLP_ARGS } from "../common/ytdlpDefaults.js";
import { SubtitleCacheManager } from "./subtitleCacheManager.js";
import { SubtitleService, splitArgs } from "./subtitleService.js";
import type { SubtitleLoadResult } from "./types.js";

let tempDir: string;
let manager: SubtitleCacheManager | null = null;

function makeData(text: string): SubtitleLoadResult {
  return {
    tracks: [
      {
        id: text,
        sourceFile: `${text}.srt`,
        cues: [{ start: 0, end: 1000, text }]
      }
    ]
  };
}

function makeSettings(enabled = true) {
  return {
    enabled,
    path: path.join(tempDir, "cache"),
    retentionDays: 7
  };
}

function quoteArg(value: string): string {
  return `"${value.replace(/(["\\])/g, "\\$1")}"`;
}

function expectedVariant(argLine: string): string {
  return createHash("sha256").update(JSON.stringify(splitArgs(argLine))).digest("hex");
}

async function createFakeYtDlpScript(): Promise<{ scriptPath: string; logPath: string }> {
  const scriptPath = path.join(tempDir, "fake-ytdlp.cjs");
  const logPath = path.join(tempDir, "fake-ytdlp.log");
  await fsp.writeFile(
    scriptPath,
    `
const fs = require("node:fs");
const logPath = ${JSON.stringify(logPath)};

function argValue(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

const output = argValue("-o", null);
if (!output) {
  throw new Error("missing output path");
}

const lang = argValue("--sub-lang", "default");
const delayMs = Number(argValue("--delay-ms", "0"));
const safeLang = lang.replace(/[^a-zA-Z0-9_-]/g, "_");
fs.appendFileSync(logPath, lang + "\\n", "utf-8");

setTimeout(() => {
  fs.writeFileSync(
    output + "." + safeLang + ".srt",
    "1\\n00:00:00,000 --> 00:00:01,000\\n" + lang + "\\n",
    "utf-8"
  );
}, delayMs);
`,
    "utf-8"
  );
  return { scriptPath, logPath };
}

async function readLogLines(logPath: string): Promise<string[]> {
  const content = await fsp.readFile(logPath, "utf-8");
  return content.trim().split(/\r?\n/).filter(Boolean);
}

beforeEach(async () => {
  tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), "usp-subtitle-service-"));
});

afterEach(async () => {
  manager?.stop();
  manager = null;
  await fsp.rm(tempDir, { recursive: true, force: true });
});

describe("SubtitleService ytdlp cache identity", () => {
  it("includes DEFAULT_YTDLP_ARGS in the ytdlp cache variant when profile args are empty", async () => {
    const get = vi.fn(async (_url: string, _source: string, _variant?: string) => makeData("cached"));
    const cacheManager = { get, set: vi.fn() } as unknown as SubtitleCacheManager;
    const service = new SubtitleService(
      async () => process.execPath,
      () => ({ ytDlpArgs: "  " }),
      cacheManager
    );

    await service.getSubtitles("http://video.local/watch");

    expect(get).toHaveBeenCalledWith(
      "http://video.local/watch",
      "ytdlp",
      expectedVariant(DEFAULT_YTDLP_ARGS)
    );
  });

  it("normalizes ytdlp args before building the cache variant", async () => {
    let ytDlpArgs = '--sub-lang "en.*" --sub-format "srt/best"';
    const get = vi.fn(async (_url: string, _source: string, _variant?: string) => makeData("cached"));
    const cacheManager = { get, set: vi.fn() } as unknown as SubtitleCacheManager;
    const service = new SubtitleService(
      async () => process.execPath,
      () => ({ ytDlpArgs }),
      cacheManager
    );

    await service.getSubtitles("http://video.local/watch");
    ytDlpArgs = "--sub-lang en.* --sub-format srt/best";
    await service.getSubtitles("http://video.local/watch");

    const expected = expectedVariant("--sub-lang en.* --sub-format srt/best");
    expect(get.mock.calls[0]?.[2]).toBe(expected);
    expect(get.mock.calls[1]?.[2]).toBe(expected);
  });

  it("downloads again when the same URL uses different effective ytdlp args", async () => {
    const { scriptPath, logPath } = await createFakeYtDlpScript();
    let ytDlpArgs = `${quoteArg(scriptPath)} --sub-lang en`;
    manager = new SubtitleCacheManager(() => makeSettings());
    const service = new SubtitleService(
      async () => process.execPath,
      () => ({ ytDlpArgs }),
      manager
    );

    const first = await service.getSubtitles("http://video.local/watch");
    ytDlpArgs = `${quoteArg(scriptPath)} --sub-lang zh`;
    const second = await service.getSubtitles("http://video.local/watch");

    expect(first.tracks[0]?.cues[0]?.text).toBe("en");
    expect(second.tracks[0]?.cues[0]?.text).toBe("zh");
    expect(await readLogLines(logPath)).toEqual(["en", "zh"]);
  });

  it("does not share an in-flight job when the same URL uses different ytdlp variants", async () => {
    const { scriptPath, logPath } = await createFakeYtDlpScript();
    const argLines = [
      `${quoteArg(scriptPath)} --sub-lang en --delay-ms 50`,
      `${quoteArg(scriptPath)} --sub-lang zh --delay-ms 50`
    ];
    let nextArgLineIndex = 0;
    manager = new SubtitleCacheManager(() => makeSettings(false));
    const service = new SubtitleService(
      async () => process.execPath,
      () => {
        if (nextArgLineIndex >= argLines.length) {
          throw new Error("Unexpected extra profile settings read");
        }
        const ytDlpArgs = argLines[nextArgLineIndex]!;
        nextArgLineIndex += 1;
        return { ytDlpArgs };
      },
      manager
    );

    const [first, second] = await Promise.all([
      service.getSubtitles("http://video.local/watch"),
      service.getSubtitles("http://video.local/watch")
    ]);

    expect(first.tracks[0]?.cues[0]?.text).toBe("en");
    expect(second.tracks[0]?.cues[0]?.text).toBe("zh");
    expect((await readLogLines(logPath)).sort()).toEqual(["en", "zh"]);
  });
});
