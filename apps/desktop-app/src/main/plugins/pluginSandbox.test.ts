import { promises as fs, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { startPluginSandbox } from "./pluginSandbox.js";

const tempDirs: string[] = [];
const jellyfinembyPluginEntry = fileURLToPath(new URL("../../../../../plugins/jellyfinemby/main.js", import.meta.url));
const pluginSandboxSource = fileURLToPath(new URL("./pluginSandbox.ts", import.meta.url));
const wordLookupPluginEntry = fileURLToPath(new URL("../../../../../plugins/word-lookup/main.js", import.meta.url));

async function writePluginMain(source: string) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "plugin-runtime-host-"));
  tempDirs.push(dir);
  const entry = path.join(dir, "main.js");
  await fs.writeFile(entry, source, "utf-8");
  return entry;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
  vi.unstubAllGlobals();
});

describe("plugin sandbox", () => {
  it("uses a single serialized invoke bridge instead of exposing a host bridge object", () => {
    const source = readFileSync(pluginSandboxSource, "utf-8");

    expect(source).toContain("sandbox.__uspInvoke");
    expect(source).not.toContain("sandbox.__uspBridge");
    expect(source).not.toContain("globalThis.__uspBridge");
  });

  it("runs plugin code in a restricted VM and calls a word lookup provider", async () => {
    const entry = await writePluginMain(`
      usp.registerWordLookupProvider({
        lookup: async (token) => {
          const config = await usp.getConfig();
          return { token, marker: config.marker };
        }
      });
    `);
    const runtime = await startPluginSandbox({
      pluginKey: "xiitang/word-lookup",
      entryPath: entry,
      permissions: ["wordLookupProvider"],
      config: { marker: "loaded" }
    });

    await expect(runtime.getWordLookupProvider()?.lookup("字幕")).resolves.toEqual({ token: "字幕", marker: "loaded" });
    await runtime.updateConfig({
      config: { marker: "updated" },
      allowedNetworkHosts: [],
      readableFiles: []
    });
    await expect(runtime.getWordLookupProvider()?.lookup("字幕")).resolves.toEqual({ token: "字幕", marker: "updated" });
    await runtime.stop();
  });

  it("denies undeclared contribution permissions", async () => {
    const entry = await writePluginMain(`
      usp.registerWordLookupProvider({
        lookup: async () => ({ matches: [] })
      });
    `);

    await expect(
      startPluginSandbox({
        pluginKey: "xiitang/word-lookup",
        entryPath: entry,
        permissions: [],
        config: {}
      })
    ).rejects.toThrow("xiitang/word-lookup is missing permission: wordLookupProvider");
  });

  it("times out provider calls that do not return", async () => {
    const entry = await writePluginMain(`
      usp.registerWordLookupProvider({
        lookup: async () => new Promise(() => {})
      });
    `);
    const onRuntimeFault = vi.fn();
    const runtime = await startPluginSandbox({
      pluginKey: "xiitang/word-lookup",
      entryPath: entry,
      permissions: ["wordLookupProvider"],
      config: {},
      requestTimeoutMs: 10,
      onRuntimeFault
    });

    const result = await Promise.race([
      runtime.getWordLookupProvider()!.lookup("字幕").then(
        () => "resolved",
        (error) => (error instanceof Error ? error.message : String(error))
      ),
      delay(80).then(() => "pending")
    ]);

    expect(result).toContain("xiitang/word-lookup plugin call timed out");
    expect(onRuntimeFault).toHaveBeenCalledWith(expect.objectContaining({
      message: expect.stringContaining("xiitang/word-lookup plugin call timed out")
    }));
    await runtime.stop();
  });

  it("faults timer callbacks that run longer than the plugin timeout", async () => {
    const entry = await writePluginMain(`
      setTimeout(() => {
        const started = Date.now();
        while (Date.now() - started < 80) {}
      }, 0);
    `);
    const onRuntimeFault = vi.fn();
    const runtime = await startPluginSandbox({
      pluginKey: "xiitang/word-lookup",
      entryPath: entry,
      permissions: [],
      config: {},
      requestTimeoutMs: 10,
      onRuntimeFault
    });

    await delay(120);

    expect(onRuntimeFault).toHaveBeenCalledWith(expect.objectContaining({
      message: expect.stringContaining("Script execution timed out")
    }));
    await runtime.stop();
  });

  it("times out synchronous plugin startup code", async () => {
    const entry = await writePluginMain("while (true) {}");

    await expect(
      startPluginSandbox({
        pluginKey: "xiitang/word-lookup",
        entryPath: entry,
        permissions: ["wordLookupProvider"],
        config: {},
        requestTimeoutMs: 10
      })
    ).rejects.toThrow("Script execution timed out");
  });

  it("denies network calls outside allowed hosts", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ ok: true })));
    const entry = await writePluginMain(`
      usp.registerWordLookupProvider({
        lookup: async () => {
          const response = await usp.fetch("https://blocked.example.test/data.json");
          return response.json();
        }
      });
    `);
    const runtime = await startPluginSandbox({
      pluginKey: "xiitang/word-lookup",
      entryPath: entry,
      permissions: ["wordLookupProvider", "network"],
      config: {},
      allowedNetworkHosts: ["allowed.example.test"]
    });

    await expect(runtime.getWordLookupProvider()?.lookup("字幕")).rejects.toThrow(
      "xiitang/word-lookup cannot access network host: blocked.example.test"
    );
    expect(fetch).not.toHaveBeenCalled();
    await runtime.stop();
  });

  it("denies network redirects from allowed hosts", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, {
        status: 302,
        headers: { Location: "https://blocked.example.test/secret" }
      }))
    );
    const entry = await writePluginMain(`
      usp.registerWordLookupProvider({
        lookup: async () => {
          const response = await usp.fetch("https://allowed.example.test/redirect");
          return response.text();
        }
      });
    `);
    const runtime = await startPluginSandbox({
      pluginKey: "xiitang/word-lookup",
      entryPath: entry,
      permissions: ["wordLookupProvider", "network"],
      config: {},
      allowedNetworkHosts: ["allowed.example.test"]
    });

    await expect(runtime.getWordLookupProvider()?.lookup("字幕")).rejects.toThrow(
      "xiitang/word-lookup cannot follow network redirects from host: allowed.example.test"
    );
    expect(fetch).toHaveBeenCalledWith(
      "https://allowed.example.test/redirect",
      expect.objectContaining({ redirect: "manual" })
    );
    await runtime.stop();
  });

  it("does not pass plugin-supplied transcription config to the host runtime", async () => {
    const transcribe = vi.fn(async () => ({
      id: "track-1",
      sourceFile: "host.srt",
      cues: [{ start: 0, end: 1000, text: "host" }]
    }));
    const entry = await writePluginMain(`
      usp.registerTranscriptionProvider({
        transcribe: async () => usp.transcriptionRuntime.transcribe("https://video.example.test/watch", {
          ytDlpArgs: "--exec attack",
          fasterWhisperBinary: "/tmp/attack",
          baseUrl: "https://attacker.example.test/v1"
        })
      });
    `);
    const runtime = await startPluginSandbox({
      pluginKey: "xiitang/transcription",
      entryPath: entry,
      permissions: ["transcriptionProvider", "transcriptionRuntime"],
      config: {},
      transcriptionRuntime: { transcribe }
    });

    await expect(runtime.getTranscriptionProvider()?.transcribe({
      videoUrl: "https://video.example.test/watch",
      config: {}
    })).resolves.toEqual({
      id: "track-1",
      sourceFile: "host.srt",
      cues: [{ start: 0, end: 1000, text: "host" }]
    });
    expect(transcribe).toHaveBeenCalledWith("https://video.example.test/watch");
    await runtime.stop();
  });

  it("denies file reads outside selected files", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "plugin-runtime-host-file-"));
    tempDirs.push(dir);
    const secretPath = path.join(dir, "secret.jsonl");
    await fs.writeFile(secretPath, "secret", "utf-8");
    const entry = await writePluginMain(`
      usp.registerWordLookupProvider({
        lookup: async () => usp.readFile(${JSON.stringify(secretPath)})
      });
    `);
    const runtime = await startPluginSandbox({
      pluginKey: "xiitang/word-lookup",
      entryPath: entry,
      permissions: ["wordLookupProvider", "readSelectedFile"],
      config: {},
      readableFiles: []
    });

    await expect(runtime.getWordLookupProvider()?.lookup("字幕")).rejects.toThrow(
      "xiitang/word-lookup cannot read unselected file"
    );
    await runtime.stop();
  });

  it("does not expose host Node APIs through sandbox globals or plugin API results", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ ok: true }))
    );
    const entry = await writePluginMain(`
      function probe(label, operation) {
        try {
          return { label, value: operation() };
        } catch (error) {
          return { label, error: error instanceof Error ? error.name : String(error) };
        }
      }

      usp.registerWordLookupProvider({
        lookup: async () => {
          const parsed = new URL("https://allowed.example.test/path?x=1");
          parsed.searchParams.set("y", "2");
          const response = await usp.fetch(parsed.toString());
          await response.json();
          return {
            href: parsed.toString(),
            probes: [
              probe("global", () => globalThis.constructor.constructor("return typeof process")()),
              probe("console", () => console.log.constructor.constructor("return typeof process")()),
              probe("timer", () => setTimeout.constructor.constructor("return typeof process")()),
              probe("url", () => URL.constructor.constructor("return typeof process")()),
              probe("response", () => response.json.constructor.constructor("return typeof process")())
            ]
          };
        }
      });
    `);
    const runtime = await startPluginSandbox({
      pluginKey: "xiitang/word-lookup",
      entryPath: entry,
      permissions: ["wordLookupProvider", "network"],
      config: {},
      allowedNetworkHosts: ["allowed.example.test"]
    });

    const result = await runtime.getWordLookupProvider()?.lookup("字幕") as any;

    expect(result.href).toBe("https://allowed.example.test/path?x=1&y=2");
    expect(result.probes).toEqual([
      { label: "global", error: "EvalError" },
      { label: "console", error: "EvalError" },
      { label: "timer", error: "EvalError" },
      { label: "url", error: "EvalError" },
      { label: "response", error: "EvalError" }
    ]);
    await runtime.stop();
  });

  it("keeps word lookup normalization and match-quality ordering in the downloadable plugin", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "plugin-word-lookup-"));
    tempDirs.push(dir);
    const wordListPath = path.join(dir, "words.jsonl");
    await fs.writeFile(
      wordListPath,
      [
        JSON.stringify({ word: "normalized", aliases: ["HELLO"], content: "alias folded" }),
        JSON.stringify({ word: "hello", content: "word folded" }),
        JSON.stringify({ word: "other", aliases: ["Hello"], content: "alias exact" }),
        JSON.stringify({ word: "Hello", content: "word exact" }),
        JSON.stringify({ word: "he-llo", content: "word normalized" }),
        JSON.stringify({ word: "other2", aliases: ["he-llo"], content: "alias normalized" })
      ].join("\n"),
      "utf-8"
    );
    const runtime = await startPluginSandbox({
      pluginKey: "xiitang/word-lookup",
      entryPath: wordLookupPluginEntry,
      permissions: ["settingsSchema", "wordLookupProvider", "readSelectedFile"],
      readableFiles: [wordListPath],
      config: { wordListPath }
    });

    const result = await runtime.getWordLookupProvider()?.lookup("“Hello,”") as any;

    expect(result.normalizedToken).toBe("hello");
    expect(result.matches.map((match: any) => match.content)).toEqual([
      "word exact",
      "word folded",
      "alias exact",
      "alias folded",
      "word normalized",
      "alias normalized"
    ]);
    expect(result.matches.map((match: any) => match.matchQuality)).toEqual([1, 2, 3, 4, 5, 6]);
    await runtime.stop();
  });

  it("reports invalid word lookup rows instead of silently skipping them", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "plugin-word-lookup-invalid-"));
    tempDirs.push(dir);
    const wordListPath = path.join(dir, "words.jsonl");
    await fs.writeFile(
      wordListPath,
      [
        JSON.stringify({ word: "stable", content: "cached" }),
        JSON.stringify({ word: "bad" })
      ].join("\n"),
      "utf-8"
    );
    const runtime = await startPluginSandbox({
      pluginKey: "xiitang/word-lookup",
      entryPath: wordLookupPluginEntry,
      permissions: ["settingsSchema", "wordLookupProvider", "readSelectedFile"],
      readableFiles: [wordListPath],
      config: { wordListPath }
    });

    await expect(runtime.getWordLookupProvider()?.lookup("stable")).rejects.toThrow(
      "Invalid word list row at line 2"
    );
    await runtime.stop();
  });

  it("runs the Jellyfin / Emby plugin source and loads subtitle streams", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        const url = String(input);
        if (url.startsWith("https://media.example.test/Sessions")) {
          return Response.json([
            {
              Id: "session-1",
              DeviceName: "Living Room",
              Client: "Jellyfin Web",
              UserName: "Ada",
              NowPlayingItem: {
                Id: "item-1",
                Name: "Episode 1",
                RunTimeTicks: 60_000_000
              },
              PlayState: {
                MediaSourceId: "source-1",
                PositionTicks: 20_000_000,
                IsPaused: false,
                PlaybackRate: 1
              }
            }
          ]);
        }
        if (url.startsWith("https://media.example.test/Items/item-1")) {
          return Response.json({
            Name: "Episode 1",
            MediaSources: [
              {
                Id: "source-1",
                MediaStreams: [
                  {
                    Type: "Subtitle",
                    Index: 2,
                    Codec: "subrip",
                    Language: "eng",
                    DisplayTitle: "English"
                  }
                ]
              }
            ]
          });
        }
        if (url.startsWith("https://media.example.test/Videos/item-1/source-1/Subtitles/2/Stream.srt")) {
          return new Response("1\n00:00:01,000 --> 00:00:02,000\nHello from Jellyfin\n");
        }
        return new Response("not found", { status: 404 });
      })
    );

    const runtime = await startPluginSandbox({
      pluginKey: "xiitang/jellyfinemby",
      entryPath: jellyfinembyPluginEntry,
      permissions: ["network", "mediaSourceAdapter"],
      allowedNetworkHosts: ["media.example.test"],
      config: {
        servers: [
          {
            id: "server-1",
            name: "Jellyfin",
            serverUrl: "https://media.example.test",
            apiKey: "secret",
            enabled: true
          }
        ]
      }
    });
    const adapter = runtime.getMediaSourceAdapter();

    const result = await adapter?.handleConnectionMessage?.({
      type: "video-context",
      tabId: 5,
      payload: {
        pageUrl: "https://media.example.test/web/index.html#!/details?id=item-1",
        videoSrc: "https://media.example.test/Videos/item-1/stream",
        title: "Episode 1"
      }
    });

    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "sourceMatched", selectedSessionId: "server-1:session-1" }),
        expect.objectContaining({
          type: "subtitleTracksLoaded",
          sessionId: "server-1:session-1",
          tracks: [
            {
              id: "server-1:session-1:2",
              sourceFile: "English",
              cues: [{ start: 1000, end: 2000, text: "Hello from Jellyfin" }]
            }
          ]
        })
      ])
    );
    await runtime.stop();
  });
});
