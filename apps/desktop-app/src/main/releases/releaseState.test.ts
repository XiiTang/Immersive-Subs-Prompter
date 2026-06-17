import { describe, expect, it } from "vitest";
import type { UpdateInfo } from "builder-util-runtime";
import { createInitialReleaseState, normalizeProgress, normalizeUpdateInfo } from "./releaseState.js";

describe("release state domain", () => {
  it("creates renderer-safe idle state", () => {
    expect(createInitialReleaseState("1.0.0")).toEqual({
      status: "idle",
      currentVersion: "1.0.0",
      latestVersion: null,
      checkedAt: null,
      updateInfo: null,
      progress: null,
      error: null
    });
  });

  it("normalizes string release notes", () => {
    const info = normalizeUpdateInfo({
      version: "1.2.0",
      releaseName: "Version 1.2.0",
      releaseDate: "2026-06-17T12:00:00Z",
      releaseNotes: "Fixed updates"
    } as UpdateInfo);

    expect(info).toEqual({
      version: "1.2.0",
      releaseName: "Version 1.2.0",
      releaseDate: "2026-06-17T12:00:00Z",
      releaseNotes: "Fixed updates"
    });
  });

  it("normalizes array release notes", () => {
    const info = normalizeUpdateInfo({
      version: "1.2.0",
      releaseNotes: [
        { version: "1.2.0", note: "Line one" },
        { version: "1.2.0", note: "Line two" },
        { version: "1.2.0", note: "" }
      ]
    } as UpdateInfo);

    expect(info.releaseNotes).toBe("Line one\n\nLine two");
  });

  it("normalizes progress for renderer display", () => {
    expect(
      normalizeProgress({
        percent: 125,
        bytesPerSecond: 1024.6,
        transferred: 500.4,
        total: 1000.2
      })
    ).toEqual({
      percent: 100,
      bytesPerSecond: 1025,
      transferred: 500,
      total: 1000
    });
  });
});
