import { promises as fs } from "node:fs";
import path from "node:path";
import { normalizeVersion } from "./utils.mjs";

const args = parseArgs(process.argv.slice(2).filter((arg) => arg !== "--"));
const version = normalizeVersion(requireArg(args.version, "version"));
const desktopDir = path.resolve(args.desktop ?? "apps/desktop-app/out");
const extensionDir = path.resolve(args.extension ?? "release-artifacts/extension");

const desktopFiles = await listFiles(desktopDir);
const extensionFiles = await listFiles(extensionDir);
const desktopNames = desktopFiles.map((filePath) => path.basename(filePath));
const extensionNames = extensionFiles.map((filePath) => path.basename(filePath));

requireAny(desktopNames, ["latest.yml"], "Windows updater metadata latest.yml");
requireAny(desktopNames, ["latest-mac.yml"], "macOS updater metadata latest-mac.yml");
requireAny(desktopNames, ["latest-linux.yml"], "Linux updater metadata latest-linux.yml");
requireMatch(desktopNames, new RegExp(`Immersive-Subs-Prompter-${escapeRegExp(version)}-darwin-.*\\.zip$`), "macOS updater ZIP");
requireMatch(desktopNames, new RegExp(`Immersive-Subs-Prompter-${escapeRegExp(version)}-win32-.*-setup\\.exe$`), "Windows NSIS installer");
requireMatch(desktopNames, new RegExp(`Immersive-Subs-Prompter-${escapeRegExp(version)}-linux-.*\\.AppImage$`), "Linux AppImage");
requireAny(extensionNames, [`immersive-subs-prompter-chrome-v${version}.zip`], "Chrome extension ZIP");
requireAny(extensionNames, [`immersive-subs-prompter-firefox-v${version}.zip`], "Firefox extension ZIP");
await requireUpdaterReferences(desktopDir, desktopNames, ["latest.yml", "latest-mac.yml", "latest-linux.yml"]);

console.log(`Builder release artifacts passed for ${version}`);

async function listFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFiles(fullPath)));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }
  return files.sort();
}

function requireAny(names, expected, label) {
  if (!expected.some((name) => names.includes(name))) {
    throw new Error(`Missing ${label}`);
  }
}

function requireMatch(names, pattern, label) {
  if (!names.some((name) => pattern.test(name))) {
    throw new Error(`Missing ${label}`);
  }
}

async function requireUpdaterReferences(dir, names, metadataNames) {
  for (const metadataName of metadataNames) {
    const source = await fs.readFile(path.join(dir, metadataName), "utf8");
    const references = extractUpdaterReferences(source);
    if (references.length === 0) {
      throw new Error(`${metadataName} does not reference updater assets`);
    }
    for (const reference of references) {
      const assetName = updaterAssetName(metadataName, reference);
      if (!names.includes(assetName)) {
        throw new Error(`${metadataName} references missing updater asset ${assetName}`);
      }
    }
  }
}

function extractUpdaterReferences(source) {
  return [...source.matchAll(/^\s*(?:-\s*)?(?:url|path):\s*(.+?)\s*$/gm)].map((match) => stripYamlScalar(match[1]));
}

function stripYamlScalar(value) {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function updaterAssetName(metadataName, reference) {
  if (/^[a-z][a-z0-9+.-]*:/i.test(reference) || reference.includes("/") || reference.includes("\\")) {
    throw new Error(`${metadataName} reference ${reference} must be a release asset filename`);
  }
  return reference;
}

function requireArg(value, name) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Missing --${name}`);
  }
  return value.trim();
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (!key?.startsWith("--")) {
      throw new Error(`Unexpected argument: ${key}`);
    }
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for ${key}`);
    }
    parsed[key.slice(2)] = value;
    index += 1;
  }
  return parsed;
}
