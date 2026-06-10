import { describe, expect, it } from "vitest";
import {
  RELEASE_MANIFEST_SCHEMA_VERSION,
  compareReleaseVersions,
  getDesktopPlatformKey,
  selectDesktopArtifact,
  validateReleaseManifest
} from "./releaseManifest.js";

const checksum = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

function manifest() {
  return {
    schemaVersion: RELEASE_MANIFEST_SCHEMA_VERSION,
    version: "1.2.0",
    releasedAt: "2026-06-10T12:00:00Z",
    releaseUrl: "https://github.com/XiiTang/Immersive-Subs-Prompter/releases/tag/v1.2.0",
    minimumSupportedVersion: "1.0.0",
    notes: {
      en: "English notes",
      zh: "中文说明"
    },
    desktop: {
      "darwin-arm64": {
        fileName: "Immersive-Subs-Prompter-1.2.0-darwin-arm64.dmg",
        url: "https://github.com/XiiTang/Immersive-Subs-Prompter/releases/download/v1.2.0/mac.dmg",
        sha256: checksum,
        signed: false
      }
    },
    extension: {
      chrome: {
        version: "1.2.0",
        artifactUrl: "https://github.com/XiiTang/Immersive-Subs-Prompter/releases/download/v1.2.0/chrome.zip",
        sha256: checksum,
        storeStatus: "manual-review"
      },
      firefox: {
        version: "1.2.0",
        artifactUrl: "https://github.com/XiiTang/Immersive-Subs-Prompter/releases/download/v1.2.0/firefox.zip",
        sha256: checksum,
        storeStatus: "manual-review"
      }
    }
  };
}

describe("release manifest domain", () => {
  it("validates the current schema", () => {
    expect(validateReleaseManifest(manifest()).version).toBe("1.2.0");
  });

  it("rejects unknown schema versions", () => {
    expect(() => validateReleaseManifest({ ...manifest(), schemaVersion: 2 })).toThrow(
      "Unsupported release manifest schema"
    );
  });

  it("compares plain semantic versions", () => {
    expect(compareReleaseVersions("1.2.0", "1.1.9")).toBeGreaterThan(0);
    expect(compareReleaseVersions("1.2.0", "1.2.0")).toBe(0);
    expect(compareReleaseVersions("1.2.0", "1.3.0")).toBeLessThan(0);
  });

  it("maps Electron platform and architecture to manifest keys", () => {
    expect(getDesktopPlatformKey("darwin", "arm64")).toBe("darwin-arm64");
    expect(getDesktopPlatformKey("win32", "x64")).toBe("win32-x64");
    expect(getDesktopPlatformKey("linux", "x64")).toBe("linux-x64");
  });

  it("selects the platform artifact when it exists", () => {
    const parsed = validateReleaseManifest(manifest());
    expect(selectDesktopArtifact(parsed, "darwin-arm64")?.fileName).toContain("darwin-arm64");
    expect(selectDesktopArtifact(parsed, "linux-arm64")).toBeNull();
  });
});
