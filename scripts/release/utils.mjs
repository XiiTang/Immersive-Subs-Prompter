import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";

export const RELEASE_MANIFEST_SCHEMA_VERSION = 1;
export const REPOSITORY_RELEASE_BASE_URL =
  "https://github.com/XiiTang/Immersive-Subs-Prompter/releases";

const PACKAGE_FILES = [
  "package.json",
  "apps/desktop-app/package.json",
  "apps/extension/package.json"
];
const PLATFORM_KEYS = [
  "darwin-arm64",
  "darwin-x64",
  "win32-arm64",
  "win32-x64",
  "linux-arm64",
  "linux-x64"
];
const REQUIRED_DESKTOP_PLATFORM_FAMILIES = ["darwin", "win32", "linux"];
const STORE_STATUSES = ["not-submitted", "manual-review", "published", "rejected"];
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const HTTPS_PATTERN = /^https:\/\//;

export function normalizeVersion(input) {
  if (typeof input !== "string") {
    throw new Error("Release version must be a string");
  }
  const match = input.trim().match(/^v?(\d+\.\d+\.\d+)$/);
  if (!match) {
    throw new Error(`Invalid release version "${input}"`);
  }
  return match[1];
}

export function compareVersions(left, right) {
  const a = normalizeVersion(left).split(".").map(Number);
  const b = normalizeVersion(right).split(".").map(Number);
  for (let index = 0; index < a.length; index += 1) {
    if (a[index] !== b[index]) {
      return a[index] > b[index] ? 1 : -1;
    }
  }
  return 0;
}

export function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf-8"));
}

export function writeJson(filePath, value) {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf-8");
}

export function readPackageVersions(workspaceRoot) {
  return Object.fromEntries(
    PACKAGE_FILES.map((relativePath) => {
      const filePath = path.join(workspaceRoot, relativePath);
      const pkg = readJson(filePath);
      if (typeof pkg.version !== "string" || !pkg.version.trim()) {
        throw new Error(`${relativePath} must define a release version`);
      }
      return [relativePath, normalizeVersion(pkg.version)];
    })
  );
}

export function assertUnifiedPackageVersions(workspaceRoot, expectedVersion) {
  const versions = readPackageVersions(workspaceRoot);
  const normalizedExpected = expectedVersion ? normalizeVersion(expectedVersion) : null;
  const uniqueVersions = [...new Set(Object.values(versions))];
  if (uniqueVersions.length !== 1) {
    throw new Error(`Package versions must match: ${JSON.stringify(versions)}`);
  }
  if (normalizedExpected && uniqueVersions[0] !== normalizedExpected) {
    throw new Error(`Package version ${uniqueVersions[0]} does not match tag version ${normalizedExpected}`);
  }
  return uniqueVersions[0];
}

export function updatePackageVersions(workspaceRoot, version) {
  const normalized = normalizeVersion(version);
  for (const relativePath of PACKAGE_FILES) {
    const filePath = path.join(workspaceRoot, relativePath);
    const pkg = readJson(filePath);
    pkg.version = normalized;
    writeJson(filePath, pkg);
  }
}

export function sha256File(filePath) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

export function platformKeyFromArtifactName(fileName) {
  const matches = PLATFORM_KEYS.filter((platformKey) => fileName.includes(platformKey));
  if (matches.length > 1) {
    throw new Error(`Desktop artifact name contains multiple platform keys: ${fileName}`);
  }
  return matches[0] ?? null;
}

export function buildReleaseManifest(options) {
  const version = normalizeVersion(options.version);
  const releaseUrl = requireHttpsUrl(options.releaseUrl, "releaseUrl");
  const notes = requireNotes(options.notes);
  const extension = requireExtensionArtifacts(options.extensionArtifacts);
  if (extension.chrome.version !== version || extension.firefox.version !== version) {
    throw new Error(`Extension artifact versions must match product version ${version}`);
  }
  const desktop = {};
  for (const artifact of options.desktopArtifacts ?? []) {
    const fileName = requireString(artifact.fileName, "desktop artifact fileName");
    const platformKey = platformKeyFromArtifactName(fileName);
    if (!platformKey) {
      throw new Error(`Unsupported desktop artifact name: ${fileName}`);
    }
    if (!fileName.includes(version)) {
      throw new Error(`Desktop artifact name must include version ${version}: ${fileName}`);
    }
    if (desktop[platformKey]) {
      throw new Error(`Duplicate desktop artifact for ${platformKey}`);
    }
    desktop[platformKey] = {
      fileName,
      url: requireHttpsUrl(artifact.url, `${fileName} url`),
      sha256: requireSha256(artifact.sha256, `${fileName} sha256`),
      signed: requireBoolean(artifact.signed, `${fileName} signed`)
    };
  }
  requireDesktopPlatformFamilies(desktop);

  return {
    schemaVersion: RELEASE_MANIFEST_SCHEMA_VERSION,
    version,
    releasedAt: requireIsoDate(options.releasedAt, "releasedAt"),
    releaseUrl,
    minimumSupportedVersion: normalizeVersion(options.minimumSupportedVersion ?? "1.0.0"),
    notes,
    desktop,
    extension
  };
}

function requireDesktopPlatformFamilies(desktop) {
  const platformFamilies = new Set(Object.keys(desktop).map((platformKey) => platformKey.split("-")[0]));
  for (const family of REQUIRED_DESKTOP_PLATFORM_FAMILIES) {
    if (!platformFamilies.has(family)) {
      throw new Error(`Missing desktop release artifact for ${family}`);
    }
  }
}

export function validateReleaseManifest(manifest) {
  const source = requireObject(manifest, "Release manifest");
  assertObjectKeys(source, [
    "schemaVersion",
    "version",
    "releasedAt",
    "releaseUrl",
    "minimumSupportedVersion",
    "notes",
    "desktop",
    "extension"
  ], "Release manifest");
  if (manifest.schemaVersion !== RELEASE_MANIFEST_SCHEMA_VERSION) {
    throw new Error("Unsupported release manifest schema");
  }
  const desktop = requireObject(manifest.desktop, "Release manifest desktop");
  for (const platformKey of Object.keys(desktop)) {
    if (!PLATFORM_KEYS.includes(platformKey)) {
      throw new Error(`Unsupported desktop platform key: ${platformKey}`);
    }
  }
  return buildReleaseManifest({
    version: manifest.version,
    releasedAt: manifest.releasedAt,
    releaseUrl: manifest.releaseUrl,
    minimumSupportedVersion: manifest.minimumSupportedVersion,
    notes: manifest.notes,
    desktopArtifacts: Object.values(desktop).map((artifact) => ({
      ...requireObject(artifact, "Desktop artifact")
    })),
    extensionArtifacts: manifest.extension
  });
}

export async function ensureParentDir(filePath) {
  await mkdir(path.dirname(filePath), { recursive: true });
}

export function fileExists(filePath) {
  return existsSync(filePath);
}

function requireString(value, context) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${context} must be a non-empty string`);
  }
  return value.trim();
}

function requireHttpsUrl(value, context) {
  const url = requireString(value, context);
  if (!HTTPS_PATTERN.test(url)) {
    throw new Error(`${context} must be an HTTPS URL`);
  }
  return url;
}

function requireSha256(value, context) {
  const sha256 = requireString(value, context);
  if (!SHA256_PATTERN.test(sha256)) {
    throw new Error(`${context} must be a lowercase SHA-256 hash`);
  }
  return sha256;
}

function requireBoolean(value, context) {
  if (typeof value !== "boolean") {
    throw new Error(`${context} must be a boolean`);
  }
  return value;
}

function requireIsoDate(value, context) {
  const date = requireString(value, context);
  if (Number.isNaN(Date.parse(date))) {
    throw new Error(`${context} must be an ISO date string`);
  }
  return date;
}

function requireNotes(notes) {
  const source = requireObject(notes, "Release notes");
  assertObjectKeys(source, ["en", "zh"], "Release notes");
  return {
    en: requireString(source.en, "notes.en"),
    zh: requireString(source.zh, "notes.zh")
  };
}

function requireExtensionArtifacts(artifacts) {
  const source = requireObject(artifacts, "Extension artifacts");
  assertObjectKeys(source, ["chrome", "firefox"], "Extension artifacts");
  return {
    chrome: requireExtensionArtifact(source.chrome, "chrome"),
    firefox: requireExtensionArtifact(source.firefox, "firefox")
  };
}

function requireExtensionArtifact(artifact, target) {
  const source = requireObject(artifact, `${target} extension artifact`);
  assertObjectKeys(source, ["version", "artifactUrl", "sha256", "storeStatus"], `${target} extension artifact`);
  const storeStatus = requireString(source.storeStatus, `${target} storeStatus`);
  if (!STORE_STATUSES.includes(storeStatus)) {
    throw new Error(`${target} storeStatus must use a current store status`);
  }
  return {
    version: normalizeVersion(source.version),
    artifactUrl: requireHttpsUrl(source.artifactUrl, `${target} artifactUrl`),
    sha256: requireSha256(source.sha256, `${target} sha256`),
    storeStatus
  };
}

function requireObject(value, context) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${context} must be an object`);
  }
  return value;
}

function assertObjectKeys(source, allowedKeys, context) {
  const allowed = new Set(allowedKeys);
  for (const key of Object.keys(source)) {
    if (!allowed.has(key)) {
      throw new Error(`${context} contains unknown key: ${key}`);
    }
  }
}
