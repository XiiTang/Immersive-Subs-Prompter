import { promises as fs } from "node:fs";
import path from "node:path";
import { zipSync } from "fflate";
import { assertUnifiedPackageVersions, readJson } from "./utils.mjs";

const ZIP_MTIME = new Date("1980-01-01T00:00:00.000Z");
const TARGETS = ["chrome", "firefox"];

const workspaceRoot = process.cwd();
const version = assertUnifiedPackageVersions(workspaceRoot);
const outputDir = path.join(workspaceRoot, "release-artifacts", "extension");

await fs.rm(outputDir, { recursive: true, force: true });
await fs.mkdir(outputDir, { recursive: true });

for (const target of TARGETS) {
  const sourceDir = path.join(workspaceRoot, "apps", "extension", "dist", target);
  const manifest = readJson(path.join(sourceDir, "manifest.json"));
  if (manifest.version !== version) {
    throw new Error(`${target} manifest version ${manifest.version} does not match package version ${version}`);
  }
  const bytes = await createZip(sourceDir);
  const fileName = `immersive-subs-prompter-${target}-v${version}.zip`;
  await fs.writeFile(path.join(outputDir, fileName), bytes);
  console.log(`${target}: ${fileName}`);
}

async function createZip(sourceDir) {
  const entries = {};
  for (const filePath of await listFiles(sourceDir)) {
    const relativePath = path.relative(sourceDir, filePath).split(path.sep).join("/");
    entries[relativePath] = new Uint8Array(await fs.readFile(filePath));
  }
  return zipSync(entries, { mtime: ZIP_MTIME });
}

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
