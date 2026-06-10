import { promises as fs } from "node:fs";
import path from "node:path";
import {
  REPOSITORY_RELEASE_BASE_URL,
  buildReleaseManifest,
  ensureParentDir,
  normalizeVersion,
  platformKeyFromArtifactName,
  sha256File,
  writeJson
} from "./utils.mjs";

const args = parseArgs(process.argv.slice(2).filter((arg) => arg !== "--"));
const tag = args.tag;
const artifactsDir = args.artifacts;
const outPath = args.out;

if (!tag || !artifactsDir || !outPath) {
  throw new Error("Usage: node scripts/release/manifest.mjs --tag vX.Y.Z --artifacts <dir> --out releases/latest.json --notes-en <text> --notes-zh <text>");
}

const version = normalizeVersion(tag);
const normalizedTag = `v${version}`;
const releaseUrl = `${REPOSITORY_RELEASE_BASE_URL}/tag/${normalizedTag}`;
const files = await listFiles(path.resolve(artifactsDir));
const assets = files
  .filter((filePath) => !filePath.endsWith("SHA256SUMS.txt"))
  .map((filePath) => {
    const fileName = path.basename(filePath);
    return {
      filePath,
      fileName,
      url: `${REPOSITORY_RELEASE_BASE_URL}/download/${normalizedTag}/${fileName}`,
      sha256: sha256File(filePath)
    };
  });

const desktopArtifacts = assets
  .filter((asset) => platformKeyFromArtifactName(asset.fileName))
  .map((asset) => ({ ...asset, signed: false }));
const chrome = findExtensionAsset(assets, "chrome", version);
const firefox = findExtensionAsset(assets, "firefox", version);
const manifest = buildReleaseManifest({
  version,
  releasedAt: new Date().toISOString(),
  releaseUrl,
  notes: {
    en: args["notes-en"] ?? "See the GitHub Release for details.",
    zh: args["notes-zh"] ?? "请查看 GitHub Release 获取更新内容。"
  },
  desktopArtifacts,
  extensionArtifacts: {
    chrome: toExtensionArtifact(chrome, version),
    firefox: toExtensionArtifact(firefox, version)
  }
});

await ensureParentDir(path.resolve(outPath));
writeJson(path.resolve(outPath), manifest);
await writeChecksums(path.resolve(artifactsDir), version, assets);
console.log(`Wrote ${outPath}`);

function findExtensionAsset(assets, target, version) {
  const fileName = `immersive-subs-prompter-${target}-v${version}.zip`;
  const asset = assets.find((candidate) => candidate.fileName === fileName);
  if (!asset) {
    throw new Error(`Missing ${target} extension artifact: ${fileName}`);
  }
  return asset;
}

function toExtensionArtifact(asset, version) {
  return {
    version,
    artifactUrl: asset.url,
    sha256: asset.sha256,
    storeStatus: "manual-review"
  };
}

async function writeChecksums(artifactsDir, version, assets) {
  const lines = assets
    .map((asset) => `${asset.sha256}  ${asset.fileName}`)
    .sort()
    .join("\n");
  await fs.writeFile(
    path.join(artifactsDir, `immersive-subs-prompter-v${version}-SHA256SUMS.txt`),
    `${lines}\n`,
    "utf-8"
  );
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
