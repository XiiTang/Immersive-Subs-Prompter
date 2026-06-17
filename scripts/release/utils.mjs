import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const PACKAGE_FILES = [
  "package.json",
  "apps/desktop-app/package.json",
  "apps/extension/package.json"
];

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

export function assertReleaseTag(input) {
  if (typeof input !== "string" || !/^v\d+\.\d+\.\d+$/.test(input.trim())) {
    throw new Error("Release tag must use vX.Y.Z");
  }
  return input.trim();
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
