import { describe, expect, it, vi } from "vitest";
import { extractSevenZipArchive } from "./sevenZipExtractor.js";

describe("extractSevenZipArchive", () => {
  it("runs bundled 7za with extract, archive, output directory, and overwrite arguments", async () => {
    const runProcess = vi.fn().mockResolvedValue(undefined);

    await extractSevenZipArchive({
      archivePath: "/tmp/Faster-Whisper-XXL.7z",
      destinationDir: "/tmp/staging",
      sevenZipPath: "/tools/7za",
      runProcess
    });

    expect(runProcess).toHaveBeenCalledWith("/tools/7za", [
      "x",
      "/tmp/Faster-Whisper-XXL.7z",
      "-o/tmp/staging",
      "-y"
    ]);
  });

  it("rejects when the 7za process exits with a non-zero code", async () => {
    const runProcess = vi.fn(async () => {
      throw new Error("7z extraction failed with exit code 2: archive corrupt");
    });

    await expect(
      extractSevenZipArchive({
        archivePath: "/tmp/bad.7z",
        destinationDir: "/tmp/staging",
        sevenZipPath: "/tools/7za",
        runProcess
      })
    ).rejects.toThrow("7z extraction failed with exit code 2: archive corrupt");
  });
});
