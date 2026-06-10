import { promises as fs } from "node:fs";
import path from "node:path";
import { normalizeVersion } from "./utils.mjs";

const args = parseArgs(process.argv.slice(2).filter((arg) => arg !== "--"));
const platform = requireArg(args.platform, "platform");
const arch = requireArg(args.arch, "arch");
const version = normalizeVersion(requireArg(args.version, "version"));
const extension = requireArg(args.extension, "extension");
const sourceRoot = path.resolve(args.source ?? "apps/desktop-app/out/make");
const outputRoot = path.resolve(args.out ?? "release-artifacts/desktop");

const files = await listFiles(sourceRoot);
const candidates = files.filter((filePath) => path.extname(filePath).toLowerCase() === extension);
if (candidates.length !== 1) {
  throw new Error(`Expected one ${extension} desktop artifact for ${platform}-${arch}, found ${candidates.length}`);
}

await fs.mkdir(outputRoot, { recursive: true });
const fileName = `Immersive-Subs-Prompter-${version}-${platform}-${arch}${extension}`;
await fs.copyFile(candidates[0], path.join(outputRoot, fileName));
console.log(fileName);

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

function requireArg(value, name) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Missing --${name}`);
  }
  return value.trim();
}
