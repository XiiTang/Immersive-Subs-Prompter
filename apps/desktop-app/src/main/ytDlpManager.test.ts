import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { YtDlpManager } from "./ytDlpManager.js";

const originalPlatform = process.platform;
const originalFetch = globalThis.fetch;
const ytDlpTestDir = path.join(os.tmpdir(), "usp-test-userdata", "yt-dlp");

function setPlatform(platform: NodeJS.Platform) {
  Object.defineProperty(process, "platform", {
    value: platform,
    configurable: true
  });
}

function createReleaseResponse(assetName: string, downloadUrl: string): Response {
  return new Response(
    JSON.stringify({
      tag_name: "2026.01.01",
      assets: [
        {
          name: assetName,
          browser_download_url: downloadUrl
        }
      ]
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" }
    }
  );
}

function createBinaryResponse(): Response {
  return new Response(Uint8Array.from([1, 2, 3]));
}

describe("YtDlpManager", () => {
  beforeEach(async () => {
    setPlatform("linux");
    await fs.rm(ytDlpTestDir, { recursive: true, force: true });
  });

  afterEach(async () => {
    Object.defineProperty(process, "platform", {
      value: originalPlatform,
      configurable: true
    });
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
    await fs.rm(ytDlpTestDir, { recursive: true, force: true });
  });

  it("rejects unsupported platforms instead of mapping them to the Linux binary", async () => {
    setPlatform("freebsd");
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as typeof fetch;

    await expect(new YtDlpManager().getBinaryPath()).rejects.toThrow("Unsupported platform for yt-dlp: freebsd");

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("clears failed download promises so a later call can retry from release metadata", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("release unavailable"))
      .mockResolvedValueOnce(createReleaseResponse("yt-dlp", "https://download.example/yt-dlp"))
      .mockResolvedValueOnce(createBinaryResponse());
    globalThis.fetch = fetchMock as typeof fetch;

    const manager = new YtDlpManager();

    await expect(manager.getBinaryPath()).rejects.toThrow("release unavailable");
    await expect(manager.getBinaryPath()).resolves.toBe(path.join(ytDlpTestDir, "yt-dlp"));

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://api.github.com/repos/yt-dlp/yt-dlp/releases/latest",
      expect.any(Object)
    );
    expect(fetchMock).toHaveBeenNthCalledWith(3, "https://download.example/yt-dlp");
  });
});
