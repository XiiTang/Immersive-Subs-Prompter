import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  buildReleaseManifest,
  compareVersions,
  normalizeVersion,
  platformKeyFromArtifactName
} from "./utils.mjs";

const checksum = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

function extensionArtifacts(version = "1.2.0") {
  return {
    chrome: {
      version,
      artifactUrl: `https://github.com/XiiTang/Immersive-Subs-Prompter/releases/download/v${version}/chrome.zip`,
      sha256: checksum,
      storeStatus: "manual-review"
    },
    firefox: {
      version,
      artifactUrl: `https://github.com/XiiTang/Immersive-Subs-Prompter/releases/download/v${version}/firefox.zip`,
      sha256: checksum,
      storeStatus: "manual-review"
    }
  };
}

function desktopArtifact(platformKey, extension, version = "1.2.0") {
  return {
    fileName: `Immersive-Subs-Prompter-${version}-${platformKey}${extension}`,
    url: `https://github.com/XiiTang/Immersive-Subs-Prompter/releases/download/v${version}/${platformKey}${extension}`,
    sha256: checksum,
    signed: false
  };
}

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
      desktopArtifact("darwin-arm64", ".dmg"),
      desktopArtifact("win32-x64", ".exe"),
      desktopArtifact("linux-x64", ".deb")
    ],
    extensionArtifacts: extensionArtifacts()
  });

  assert.equal(manifest.schemaVersion, 1);
  assert.equal(manifest.desktop["darwin-arm64"].sha256, checksum);
  assert.equal(manifest.extension.chrome.version, "1.2.0");
});

test("buildReleaseManifest rejects missing desktop platform families", () => {
  assert.throws(
    () =>
      buildReleaseManifest({
        version: "1.2.0",
        releasedAt: "2026-06-10T12:00:00Z",
        releaseUrl: "https://github.com/XiiTang/Immersive-Subs-Prompter/releases/tag/v1.2.0",
        notes: { en: "English notes", zh: "中文说明" },
        desktopArtifacts: [
          desktopArtifact("darwin-arm64", ".dmg"),
          desktopArtifact("linux-x64", ".deb")
        ],
        extensionArtifacts: extensionArtifacts()
      }),
    /Missing desktop release artifact for win32/
  );
});

test("release scripts do not reference removed plugin artifacts", () => {
  const packageJson = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8"));
  const releaseCheckSource = readFileSync(new URL("./check.mjs", import.meta.url), "utf8");

  assert.equal(packageJson.scripts["build:plugins"], undefined);
  assert.equal(packageJson.scripts.build.includes("build:plugins"), false);
  assert.equal(releaseCheckSource.includes("build:plugins"), false);
  assert.equal(releaseCheckSource.includes("plugin-repository"), false);
});
