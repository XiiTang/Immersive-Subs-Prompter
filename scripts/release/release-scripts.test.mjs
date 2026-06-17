import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { compareVersions, normalizeVersion } from "./utils.mjs";

test("normalizeVersion accepts X.Y.Z and vX.Y.Z", () => {
  assert.equal(normalizeVersion("1.2.0"), "1.2.0");
  assert.equal(normalizeVersion("v1.2.0"), "1.2.0");
});

test("compareVersions compares product versions", () => {
  assert.equal(compareVersions("1.2.0", "1.2.0"), 0);
  assert.equal(compareVersions("1.2.1", "1.2.0"), 1);
  assert.equal(compareVersions("1.2.0", "1.3.0"), -1);
});

test("release scripts validate builder updater metadata", () => {
  const packageJson = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8"));
  const artifactCheckSource = readFileSync(new URL("./check-builder-artifacts.mjs", import.meta.url), "utf8");

    assert.equal(packageJson.scripts["release:check-builder-artifacts"], "node ./scripts/release/check-builder-artifacts.mjs");
    assert.equal(artifactCheckSource.includes("latest.yml"), true);
    assert.equal(artifactCheckSource.includes("latest-mac.yml"), true);
    assert.equal(artifactCheckSource.includes("latest-linux.yml"), true);
  assert.equal(artifactCheckSource.includes("requireUpdaterReferences"), true);
});

test("release workflow requires macOS signing and notarization secrets", () => {
  const workflow = readFileSync(new URL("../../.github/workflows/release.yml", import.meta.url), "utf8");

  for (const name of ["CSC_LINK", "CSC_KEY_PASSWORD", "APPLE_API_KEY", "APPLE_API_KEY_ID", "APPLE_API_ISSUER"]) {
    assert.match(workflow, new RegExp(`${name}: \\$\\{\\{ secrets\\.${name} \\}\\}`));
  }
  assert.match(workflow, /Missing macOS signing or notarization secrets/);
});

test("builder artifact check rejects updater metadata that references missing files", () => {
  const root = mkdtempSync(path.join(tmpdir(), "usp-release-check-"));
  const desktop = path.join(root, "desktop");
  const extension = path.join(root, "extension");
  mkdirSync(desktop);
  mkdirSync(extension);

  try {
    touch(path.join(desktop, "Immersive-Subs-Prompter-1.0.0-darwin-arm64.zip"));
    touch(path.join(desktop, "Immersive-Subs-Prompter-1.0.0-win32-x64-setup.exe"));
    touch(path.join(desktop, "Immersive-Subs-Prompter-1.0.0-linux-x64.AppImage"));
    touch(path.join(extension, "immersive-subs-prompter-chrome-v1.0.0.zip"));
    touch(path.join(extension, "immersive-subs-prompter-firefox-v1.0.0.zip"));
    writeUpdaterMetadata(path.join(desktop, "latest.yml"), "Immersive-Subs-Prompter-1.0.0-win32-x64-setup.exe");
    writeFileSync(
      path.join(desktop, "latest-mac.yml"),
      "version: 1.0.0\nfiles:\n  - url: Missing-Immersive-Subs-Prompter-1.0.0-darwin-arm64.zip\npath: Missing-Immersive-Subs-Prompter-1.0.0-darwin-arm64.zip\n",
      "utf8"
    );
    writeUpdaterMetadata(path.join(desktop, "latest-linux.yml"), "Immersive-Subs-Prompter-1.0.0-linux-x64.AppImage");

    const result = spawnSync(
      process.execPath,
      [
        new URL("./check-builder-artifacts.mjs", import.meta.url).pathname,
        "--version",
        "1.0.0",
        "--desktop",
        desktop,
        "--extension",
        extension
      ],
      { encoding: "utf8" }
    );

    assert.notEqual(result.status, 0);
    assert.match(`${result.stdout}\n${result.stderr}`, /missing updater asset/i);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("builder artifact check validates updater file list URLs", () => {
  const root = mkdtempSync(path.join(tmpdir(), "usp-release-check-"));
  const desktop = path.join(root, "desktop");
  const extension = path.join(root, "extension");
  mkdirSync(desktop);
  mkdirSync(extension);

  try {
    touch(path.join(desktop, "Immersive-Subs-Prompter-1.0.0-darwin-arm64.zip"));
    touch(path.join(desktop, "Immersive-Subs-Prompter-1.0.0-win32-x64-setup.exe"));
    touch(path.join(desktop, "Immersive-Subs-Prompter-1.0.0-linux-x64.AppImage"));
    touch(path.join(extension, "immersive-subs-prompter-chrome-v1.0.0.zip"));
    touch(path.join(extension, "immersive-subs-prompter-firefox-v1.0.0.zip"));
    writeUpdaterMetadata(path.join(desktop, "latest.yml"), "Immersive-Subs-Prompter-1.0.0-win32-x64-setup.exe");
    writeFileSync(
      path.join(desktop, "latest-mac.yml"),
      "version: 1.0.0\nfiles:\n  - url: Missing-Immersive-Subs-Prompter-1.0.0-darwin-arm64.dmg\npath: Immersive-Subs-Prompter-1.0.0-darwin-arm64.zip\n",
      "utf8"
    );
    writeUpdaterMetadata(path.join(desktop, "latest-linux.yml"), "Immersive-Subs-Prompter-1.0.0-linux-x64.AppImage");

    const result = spawnSync(
      process.execPath,
      [
        new URL("./check-builder-artifacts.mjs", import.meta.url).pathname,
        "--version",
        "1.0.0",
        "--desktop",
        desktop,
        "--extension",
        extension
      ],
      { encoding: "utf8" }
    );

    assert.notEqual(result.status, 0);
    assert.match(`${result.stdout}\n${result.stderr}`, /missing updater asset/i);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

function touch(filePath) {
  writeFileSync(filePath, "");
}

function writeUpdaterMetadata(filePath, assetName) {
  writeFileSync(filePath, `version: 1.0.0\nfiles:\n  - url: ${assetName}\npath: ${assetName}\n`, "utf8");
}
