import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { strToU8, zipSync } from "fflate";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pluginRoot = path.join(repoRoot, "plugins");
const outputRoot = path.join(repoRoot, "plugin-repository");
const publicBaseUrl = (process.env.USP_PLUGIN_BASE_URL ?? "https://raw.githubusercontent.com/XiiTang/Immersive-Subs-Prompter/main/plugin-repository").replace(/\/+$/, "");
const ZIP_MTIME = new Date("1980-01-01T00:00:00.000Z");

async function main() {
  await fs.rm(outputRoot, { recursive: true, force: true });
  const pluginDirs = await fs.readdir(pluginRoot, { withFileTypes: true });
  for (const entry of pluginDirs) {
    if (!entry.isDirectory()) {
      continue;
    }
    await packagePlugin(entry.name);
  }
}

async function packagePlugin(folderName) {
  const sourceDir = path.join(pluginRoot, folderName);
  const manifestPath = path.join(sourceDir, "manifest.json");
  const packageManifest = JSON.parse(await fs.readFile(manifestPath, "utf-8"));
  if (Object.prototype.hasOwnProperty.call(packageManifest, "package")) {
    throw new Error(`${folderName} source manifest must not include the remote package descriptor`);
  }
  const version = requireString(packageManifest.version, `${folderName} version`);
  const archiveBytes = await createPluginArchive(sourceDir, packageManifest);
  const sha256 = createHash("sha256").update(archiveBytes).digest("hex");
  const outputDir = path.join(outputRoot, folderName);
  const packageFileName = `${version}.usp-plugin`;
  const remoteManifest = {
    ...packageManifest,
    package: {
      url: `${publicBaseUrl}/${folderName}/${packageFileName}`,
      sha256
    }
  };

  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(path.join(outputDir, packageFileName), archiveBytes);
  await fs.writeFile(path.join(outputDir, "manifest.json"), `${JSON.stringify(remoteManifest, null, 2)}\n`, "utf-8");
  console.log(`${folderName}: ${packageFileName}`);
}

async function createPluginArchive(sourceDir, packageManifest) {
  const entries = {};
  for (const filePath of await listFiles(sourceDir)) {
    const relativePath = path.relative(sourceDir, filePath).split(path.sep).join("/");
    entries[relativePath] =
      relativePath === "manifest.json"
        ? strToU8(`${JSON.stringify(packageManifest, null, 2)}\n`)
        : new Uint8Array(await fs.readFile(filePath));
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
      continue;
    }
    if (entry.isFile()) {
      files.push(fullPath);
    }
  }
  return files.sort();
}

function requireString(value, context) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${context} must be a non-empty string`);
  }
  return value;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
