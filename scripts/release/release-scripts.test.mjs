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

test("release workflow requires macOS signing and notarization secrets", () => {
  const workflow = readFileSync(new URL("../../.github/workflows/release.yml", import.meta.url), "utf8");

  for (const name of ["CSC_LINK", "CSC_KEY_PASSWORD", "APPLE_API_KEY", "APPLE_API_KEY_ID", "APPLE_API_ISSUER"]) {
    assert.match(workflow, new RegExp(`${name}: \\$\\{\\{ secrets\\.${name} \\}\\}`));
  }
  assert.match(workflow, /Missing macOS signing or notarization secrets/);
  assert.doesNotMatch(workflow, /gh release create [^\n]*--draft/);
  assert.match(workflow, /gh release edit "\$TAG" --draft=false/);
});

test("release check requires v-prefixed release tags", () => {
  const result = spawnSync(
    process.execPath,
    [new URL("./check.mjs", import.meta.url).pathname, "--tag", "1.0.0"],
    { cwd: new URL("../..", import.meta.url).pathname, encoding: "utf8" }
  );

  assert.notEqual(result.status, 0);
  assert.match(`${result.stdout}\n${result.stderr}`, /Release tag must use vX\.Y\.Z/);
});

test("builder artifact check rejects updater metadata that references missing files", () => {
  const fixture = createArtifactFixture();

  try {
    writeUpdaterMetadata(path.join(fixture.desktop, "latest.yml"), fixture.winSetup);
    writeFileSync(
      path.join(fixture.desktop, "latest-mac.yml"),
      "version: 1.0.0\nfiles:\n  - url: Missing-Immersive-Subs-Prompter-1.0.0-darwin-arm64.zip\npath: Missing-Immersive-Subs-Prompter-1.0.0-darwin-arm64.zip\n",
      "utf8"
    );
    writeUpdaterMetadata(path.join(fixture.desktop, "latest-linux.yml"), fixture.linuxAppImage);

    const result = runArtifactCheck(fixture);
    assert.notEqual(result.status, 0);
    assert.match(`${result.stdout}\n${result.stderr}`, /missing updater asset/i);
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test("builder artifact check validates updater file list URLs", () => {
  const fixture = createArtifactFixture();

  try {
    writeUpdaterMetadata(path.join(fixture.desktop, "latest.yml"), fixture.winSetup);
    writeFileSync(
      path.join(fixture.desktop, "latest-mac.yml"),
      `version: 1.0.0\nfiles:\n  - url: Missing-Immersive-Subs-Prompter-1.0.0-darwin-arm64.dmg\npath: ${fixture.macZip}\n`,
      "utf8"
    );
    writeUpdaterMetadata(path.join(fixture.desktop, "latest-linux.yml"), fixture.linuxAppImage);

    const result = runArtifactCheck(fixture);
    assert.notEqual(result.status, 0);
    assert.match(`${result.stdout}\n${result.stderr}`, /missing updater asset/i);
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test("builder artifact check rejects absolute updater URLs outside release assets", () => {
  const fixture = createArtifactFixture();

  try {
    writeFileSync(
      path.join(fixture.desktop, "latest.yml"),
      `version: 1.0.0\nfiles:\n  - url: https://example.invalid/downloads/${fixture.winSetup}\npath: ${fixture.winSetup}\n`,
      "utf8"
    );
    writeUpdaterMetadata(path.join(fixture.desktop, "latest-mac.yml"), fixture.macZip);
    writeUpdaterMetadata(path.join(fixture.desktop, "latest-linux.yml"), fixture.linuxAppImage);

    const result = runArtifactCheck(fixture);
    assert.notEqual(result.status, 0);
    assert.match(`${result.stdout}\n${result.stderr}`, /must be a release asset filename/i);
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

function touch(filePath) {
  writeFileSync(filePath, "");
}

function writeUpdaterMetadata(filePath, assetName) {
  writeFileSync(filePath, `version: 1.0.0\nfiles:\n  - url: ${assetName}\npath: ${assetName}\n`, "utf8");
}

function createArtifactFixture() {
  const root = mkdtempSync(path.join(tmpdir(), "usp-release-check-"));
  const desktop = path.join(root, "desktop");
  const extension = path.join(root, "extension");
  const macZip = "Immersive-Subs-Prompter-1.0.0-darwin-arm64.zip";
  const winSetup = "Immersive-Subs-Prompter-1.0.0-win32-x64-setup.exe";
  const linuxAppImage = "Immersive-Subs-Prompter-1.0.0-linux-x64.AppImage";

  mkdirSync(desktop);
  mkdirSync(extension);
  for (const name of [macZip, winSetup, linuxAppImage]) {
    touch(path.join(desktop, name));
  }
  touch(path.join(extension, "immersive-subs-prompter-chrome-v1.0.0.zip"));
  touch(path.join(extension, "immersive-subs-prompter-firefox-v1.0.0.zip"));

  return { root, desktop, extension, macZip, winSetup, linuxAppImage };
}

function runArtifactCheck(fixture) {
  return spawnSync(
    process.execPath,
    [
      new URL("./check-builder-artifacts.mjs", import.meta.url).pathname,
      "--version",
      "1.0.0",
      "--desktop",
      fixture.desktop,
      "--extension",
      fixture.extension
    ],
    { encoding: "utf8" }
  );
}
