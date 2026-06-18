import { createHash } from "node:crypto";
import { promises as fsp, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_YTDLP_ARGS } from "../common/ytdlpDefaults.js";
import {
  MAX_PROCESS_STDERR_BYTES,
  MAX_PROCESS_STDOUT_BYTES,
  MAX_SUBTITLE_TEXT_BYTES
} from "./resourceLimits.js";
import { SubtitleCacheManager } from "./subtitleCacheManager.js";
import { runCommand, SubtitleService } from "./subtitleService.js";
import type { SubtitleLoadResult } from "./types.js";
import { splitArgs } from "./ytDlpArgPolicy.js";

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

function expectedVariant(argLine: string): string {
  return createHash("sha256").update(JSON.stringify(splitArgs(argLine))).digest("hex");
}

async function createFakeYtDlpScript(): Promise<{ scriptPath: string; logPath: string }> {
  const scriptPath = path.join(tempDir, "fake-ytdlp.cjs");
  const logPath = path.join(tempDir, "fake-ytdlp.log");
  await fsp.writeFile(
    scriptPath,
    `#!/usr/bin/env node
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
const safeLang = lang.replace(/[^a-zA-Z0-9_-]/g, "_");
fs.appendFileSync(logPath, lang + "\\n", "utf-8");

setTimeout(() => {
  fs.writeFileSync(
    output + "." + safeLang + ".srt",
    "1\\n00:00:00,000 --> 00:00:01,000\\n" + lang + "\\n",
    "utf-8"
  );
}, 20);
`,
    "utf-8"
  );
  await fsp.chmod(scriptPath, 0o755);
  return { scriptPath, logPath };
}

async function createOversizedSubtitleYtDlpScript(): Promise<string> {
  const scriptPath = path.join(tempDir, "fake-ytdlp-oversized.cjs");
  await fsp.writeFile(
    scriptPath,
    `#!/usr/bin/env node
const fs = require("node:fs");
function argValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}
const output = argValue("-o");
const subtitlePath = output + ".en.srt";
fs.writeFileSync(subtitlePath, "1\\n00:00:00,000 --> 00:00:01,000\\nhello\\n", "utf-8");
fs.truncateSync(subtitlePath, ${MAX_SUBTITLE_TEXT_BYTES + 1});
`,
    "utf-8"
  );
  await fsp.chmod(scriptPath, 0o755);
  return scriptPath;
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
  it("keeps subtitle settings resolution free of duplicate fallback branches", () => {
    const source = readFileSync(path.join(__dirname, "subtitleService.ts"), "utf-8");

    expect(source).not.toContain("this.settingsProvider ?");
    expect(source).not.toContain("settings?.ytDlpArgs");
  });

  it("rejects local and private video URLs before invoking yt-dlp", async () => {
    const binaryResolver = vi.fn(async () => process.execPath);
    const service = new SubtitleService(binaryResolver);

    await expect(service.getSubtitles("http://127.0.0.1:8080/watch")).rejects.toThrow(
      "Subtitle video URL cannot target local or private network hosts"
    );
    await expect(service.getSubtitles("http://192.168.1.2/watch")).rejects.toThrow(
      "Subtitle video URL cannot target local or private network hosts"
    );
    expect(binaryResolver).not.toHaveBeenCalled();
  });

  it("includes DEFAULT_YTDLP_ARGS in the ytdlp cache variant when profile args are empty", async () => {
    const get = vi.fn(async (_url: string, _source: string, _variant?: string) => makeData("cached"));
    const cacheManager = { get, set: vi.fn() } as unknown as SubtitleCacheManager;
    const service = new SubtitleService(
      async () => process.execPath,
      () => ({ ytDlpArgs: "  " }),
      cacheManager
    );

    await service.getSubtitles("https://video.example.test/watch");

    expect(get).toHaveBeenCalledWith(
      "https://video.example.test/watch",
      "ytdlp",
      expectedVariant(DEFAULT_YTDLP_ARGS)
    );
  });

  it("rejects unsafe ytdlp args before resolving or invoking yt-dlp", async () => {
    const binaryResolver = vi.fn(async () => {
      throw new Error("binary resolver reached");
    });
    const service = new SubtitleService(binaryResolver, () => ({
      ytDlpArgs: '--skip-download --exec "sh -c whoami"'
    }));

    await expect(service.getSubtitles("https://video.example.test/watch")).rejects.toThrow(
      "Subtitle yt-dlp args cannot use yt-dlp option --exec"
    );
    expect(binaryResolver).not.toHaveBeenCalled();
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

    await service.getSubtitles("https://video.example.test/watch");
    ytDlpArgs = "--sub-lang en.* --sub-format srt/best";
    await service.getSubtitles("https://video.example.test/watch");

    const expected = expectedVariant("--sub-lang en.* --sub-format srt/best");
    expect(get.mock.calls[0]?.[2]).toBe(expected);
    expect(get.mock.calls[1]?.[2]).toBe(expected);
  });

  it("downloads again when the same URL uses different effective ytdlp args", async () => {
    const { scriptPath, logPath } = await createFakeYtDlpScript();
    let ytDlpArgs = "--sub-lang en";
    manager = new SubtitleCacheManager(() => makeSettings());
    const service = new SubtitleService(
      async () => scriptPath,
      () => ({ ytDlpArgs }),
      manager
    );

    const first = await service.getSubtitles("https://video.example.test/watch");
    ytDlpArgs = "--sub-lang zh";
    const second = await service.getSubtitles("https://video.example.test/watch");

    expect(first.tracks[0]?.cues[0]?.text).toBe("en");
    expect(second.tracks[0]?.cues[0]?.text).toBe("zh");
    expect(await readLogLines(logPath)).toEqual(["en", "zh"]);
  });

  it("does not share an in-flight job when the same URL uses different ytdlp variants", async () => {
    const { scriptPath, logPath } = await createFakeYtDlpScript();
    const argLines = [
      "--sub-lang en",
      "--sub-lang zh"
    ];
    let nextArgLineIndex = 0;
    manager = new SubtitleCacheManager(() => makeSettings(false));
    const service = new SubtitleService(
      async () => scriptPath,
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
      service.getSubtitles("https://video.example.test/watch"),
      service.getSubtitles("https://video.example.test/watch")
    ]);

    expect(first.tracks[0]?.cues[0]?.text).toBe("en");
    expect(second.tracks[0]?.cues[0]?.text).toBe("zh");
    expect((await readLogLines(logPath)).sort()).toEqual(["en", "zh"]);
  });

  it("rejects subtitle files larger than 100 MiB before reading them", async () => {
    const scriptPath = await createOversizedSubtitleYtDlpScript();
    const service = new SubtitleService(
      async () => scriptPath,
      () => ({ ytDlpArgs: "--sub-lang en" })
    );

    await expect(service.getSubtitles("https://video.example.test/watch")).rejects.toThrow(
      `Subtitle file exceeds ${MAX_SUBTITLE_TEXT_BYTES} bytes`
    );
  });

  it("terminates commands when stdout exceeds the process output cap", async () => {
    await expect(
      runCommand(
        process.execPath,
        ["-e", `process.stdout.write("x".repeat(${MAX_PROCESS_STDOUT_BYTES + 1}))`],
        tempDir,
        "node"
      )
    ).rejects.toThrow(`stdout exceeded ${MAX_PROCESS_STDOUT_BYTES} bytes`);
  });

  it("terminates commands when stderr exceeds the process output cap", async () => {
    await expect(
      runCommand(
        process.execPath,
        ["-e", `process.stderr.write("x".repeat(${MAX_PROCESS_STDERR_BYTES + 1}))`],
        tempDir,
        "node"
      )
    ).rejects.toThrow(`stderr exceeded ${MAX_PROCESS_STDERR_BYTES} bytes`);
  });
});
