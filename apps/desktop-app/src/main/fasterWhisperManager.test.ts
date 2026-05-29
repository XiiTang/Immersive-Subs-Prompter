import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { exec } from "child_process";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { FasterWhisperManager } from "./fasterWhisperManager.js";

vi.mock("child_process", () => ({
  exec: vi.fn()
}));

const originalFetch = globalThis.fetch;
const originalPlatform = process.platform;
const fasterWhisperTestDir = path.join(os.tmpdir(), "usp-test-userdata", "faster-whisper");

function setPlatform(platform: NodeJS.Platform) {
  Object.defineProperty(process, "platform", {
    value: platform,
    configurable: true
  });
}

function createArchiveResponse(): Response {
  return new Response(Uint8Array.from([1, 2, 3]), {
    headers: { "content-length": "3" }
  });
}

describe("FasterWhisperManager", () => {
  beforeEach(async () => {
    setPlatform("win32");
    await fs.rm(fasterWhisperTestDir, { recursive: true, force: true });
    globalThis.fetch = vi.fn(async () => createArchiveResponse()) as typeof fetch;
  });

  afterEach(async () => {
    Object.defineProperty(process, "platform", {
      value: originalPlatform,
      configurable: true
    });
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
    await fs.rm(fasterWhisperTestDir, { recursive: true, force: true });
  });

  it("requires 7-Zip for GPU package extraction instead of trying unrelated archive tools", async () => {
    const execMock = vi.mocked(exec);
    execMock.mockImplementation(((command: string, callback: (error: Error | null) => void) => {
      callback(new Error("7z unavailable"));
      return {} as ReturnType<typeof exec>;
    }) as typeof exec);

    await expect(new FasterWhisperManager().downloadBinary("gpu")).rejects.toThrow(
      "7-Zip command line tool is required"
    );

    expect(execMock).toHaveBeenCalledTimes(1);
    expect(execMock.mock.calls[0]?.[0]).toContain("7z x");
  });
});
