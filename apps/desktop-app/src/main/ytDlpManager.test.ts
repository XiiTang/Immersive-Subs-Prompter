import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { YtDlpManager } from "./ytDlpManager.js";

const originalPlatform = process.platform;
const originalFetch = globalThis.fetch;
const ytDlpTestDir = path.join(os.tmpdir(), "usp-test-userdata", "yt-dlp");
const binaryBytes = Uint8Array.from([1, 2, 3]);
const binarySha256 = createHash("sha256").update(binaryBytes).digest("hex");

function setPlatform(platform: NodeJS.Platform) {
  Object.defineProperty(process, "platform", {
    value: platform,
    configurable: true
  });
}

function createReleaseResponse(assetName: string, downloadUrl: string, checksumUrl = "https://github.com/yt-dlp/yt-dlp/releases/download/2026.01.01/SHA2-256SUMS"): Response {
  return new Response(
    JSON.stringify({
      tag_name: "2026.01.01",
      assets: [
        {
          name: assetName,
          browser_download_url: downloadUrl
        },
        {
          name: "SHA2-256SUMS",
          browser_download_url: checksumUrl
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
  return new Response(binaryBytes);
}

function createChecksumResponse(checksum = binarySha256): Response {
  return new Response(`${checksum}  yt-dlp\n`);
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
      .mockResolvedValueOnce(createReleaseResponse("yt-dlp", "https://github.com/yt-dlp/yt-dlp/releases/download/2026.01.01/yt-dlp"))
      .mockResolvedValueOnce(createChecksumResponse())
      .mockResolvedValueOnce(createBinaryResponse());
    globalThis.fetch = fetchMock as typeof fetch;

    const manager = new YtDlpManager();

    await expect(manager.getBinaryPath()).rejects.toThrow("release unavailable");
    await expect(manager.getBinaryPath()).resolves.toBe(path.join(ytDlpTestDir, "yt-dlp"));

    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://api.github.com/repos/yt-dlp/yt-dlp/releases/latest",
      expect.any(Object)
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "https://github.com/yt-dlp/yt-dlp/releases/download/2026.01.01/SHA2-256SUMS"
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      "https://github.com/yt-dlp/yt-dlp/releases/download/2026.01.01/yt-dlp"
    );
  });

  it("rejects downloaded binaries whose checksum does not match the release checksums", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(createReleaseResponse("yt-dlp", "https://github.com/yt-dlp/yt-dlp/releases/download/2026.01.01/yt-dlp"))
      .mockResolvedValueOnce(createChecksumResponse("0".repeat(64)))
      .mockResolvedValueOnce(createBinaryResponse());
    globalThis.fetch = fetchMock as typeof fetch;

    await expect(new YtDlpManager().getBinaryPath()).rejects.toThrow("yt-dlp yt-dlp checksum mismatch");
    await expect(fs.access(path.join(ytDlpTestDir, "yt-dlp"))).rejects.toThrow();
  });
});
