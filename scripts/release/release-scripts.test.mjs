import assert from "node:assert/strict";
import test from "node:test";
import {
  buildReleaseManifest,
  compareVersions,
  normalizeVersion,
  platformKeyFromArtifactName
} from "./utils.mjs";

const checksum = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

test("normalizeVersion accepts X.Y.Z and vX.Y.Z", () => {
  assert.equal(normalizeVersion("1.2.0"), "1.2.0");
  assert.equal(normalizeVersion("v1.2.0"), "1.2.0");
});

test("compareVersions compares product versions", () => {
  assert.equal(compareVersions("1.2.0", "1.2.0"), 0);
  assert.equal(compareVersions("1.2.1", "1.2.0"), 1);
  assert.equal(compareVersions("1.2.0", "1.3.0"), -1);
});

test("platformKeyFromArtifactName maps supported desktop artifact names", () => {
  assert.equal(platformKeyFromArtifactName("Immersive-Subs-Prompter-1.2.0-darwin-arm64.dmg"), "darwin-arm64");
  assert.equal(platformKeyFromArtifactName("Immersive-Subs-Prompter-1.2.0-win32-x64.exe"), "win32-x64");
  assert.equal(platformKeyFromArtifactName("Immersive-Subs-Prompter-1.2.0-linux-x64.AppImage"), "linux-x64");
  assert.equal(platformKeyFromArtifactName("readme.txt"), null);
});

test("buildReleaseManifest creates current schema", () => {
  const manifest = buildReleaseManifest({
    version: "1.2.0",
    releasedAt: "2026-06-10T12:00:00Z",
    releaseUrl: "https://github.com/XiiTang/Immersive-Subs-Prompter/releases/tag/v1.2.0",
    notes: { en: "English notes", zh: "中文说明" },
    desktopArtifacts: [
      {
        fileName: "Immersive-Subs-Prompter-1.2.0-darwin-arm64.dmg",
        url: "https://github.com/XiiTang/Immersive-Subs-Prompter/releases/download/v1.2.0/mac.dmg",
        sha256: checksum,
        signed: false
      }
    ],
    extensionArtifacts: {
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
  });

  assert.equal(manifest.schemaVersion, 1);
  assert.equal(manifest.desktop["darwin-arm64"].sha256, checksum);
  assert.equal(manifest.extension.chrome.version, "1.2.0");
});
