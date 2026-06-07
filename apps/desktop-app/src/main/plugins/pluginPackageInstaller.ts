import { createHash, randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { unzipSync } from "fflate";
import {
  validatePluginManifest,
  validatePluginPackageManifest,
  type PluginManifest
} from "./pluginManifest.js";
import { derivePluginKey } from "./pluginIdentity.js";
import { getPluginInstallPath, getPluginTmpPath } from "./pluginPaths.js";

type FetchBytes = (url: string) => Promise<Uint8Array>;

export interface PluginPackageInstallerOptions {
  rootDir: string;
  fetchBytes?: FetchBytes;
  appVersion?: string;
}

export interface PluginInstallResult {
  manifest: PluginManifest;
  installDir: string;
}

export class PluginPackageInstaller {
  private readonly fetchBytes: FetchBytes;

  constructor(private readonly options: PluginPackageInstallerOptions) {
    this.fetchBytes = options.fetchBytes ?? defaultFetchBytes;
  }

  async preview(sourceUrl: string): Promise<PluginManifest> {
    return validatePluginManifest(
      JSON.parse(Buffer.from(await this.fetchBytes(sourceUrl)).toString("utf-8")),
      { appVersion: this.options.appVersion }
    );
  }

  async install(sourceUrl: string, confirmedManifest: PluginManifest): Promise<PluginInstallResult> {
    if (!confirmedManifest) {
      throw new Error("Plugin install requires a confirmed manifest");
    }
    const remoteManifest = await this.preview(sourceUrl);
    const expectedManifest = validatePluginManifest(confirmedManifest, { appVersion: this.options.appVersion });
    if (JSON.stringify(remoteManifest) !== JSON.stringify(expectedManifest)) {
      throw new Error("Plugin install manifest changed after confirmation");
    }
    const archiveBytes = await this.fetchBytes(remoteManifest.package.url);
    const actualHash = createHash("sha256").update(archiveBytes).digest("hex");
    if (actualHash.toLowerCase() !== remoteManifest.package.sha256.toLowerCase()) {
      throw new Error(`${remoteManifest.id} package sha256 mismatch`);
    }

    const jobDir = path.join(getPluginTmpPath(this.options.rootDir), `${Date.now()}-${randomUUID()}`);
    const extractDir = path.join(jobDir, "package");
    await fs.mkdir(extractDir, { recursive: true });
    try {
      await extractZip(archiveBytes, extractDir);
      const packageManifestPath = path.join(extractDir, "manifest.json");
      const packageManifest = JSON.parse(await fs.readFile(packageManifestPath, "utf-8"));
      validatePluginPackageManifest(packageManifest, remoteManifest);
      await assertEntryExists(extractDir, remoteManifest);

      const installDir = getPluginInstallPath(this.options.rootDir, derivePluginKey(remoteManifest), remoteManifest.version);
      await fs.mkdir(path.dirname(installDir), { recursive: true });
      await fs.writeFile(path.join(extractDir, "manifest.json"), JSON.stringify(remoteManifest, null, 2), "utf-8");
      await replaceInstallDir(extractDir, installDir, path.join(jobDir, "previous"));
      return { manifest: remoteManifest, installDir };
    } finally {
      await fs.rm(jobDir, { recursive: true, force: true });
    }
  }
}

async function defaultFetchBytes(url: string): Promise<Uint8Array> {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:") {
    throw new Error("Plugin download URLs must use https");
  }
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Plugin download failed: ${response.status} ${response.statusText}`);
  }
  return new Uint8Array(await response.arrayBuffer());
}

async function extractZip(archiveBytes: Uint8Array, targetDir: string): Promise<void> {
  const entries = unzipSync(archiveBytes);
  for (const [entryName, content] of Object.entries(entries)) {
    const normalized = path.normalize(entryName);
    if (path.isAbsolute(normalized) || normalized.startsWith("..") || normalized.includes(`..${path.sep}`)) {
      throw new Error(`Plugin package contains unsafe path: ${entryName}`);
    }
    const targetPath = path.join(targetDir, normalized);
    if (entryName.endsWith("/")) {
      await fs.mkdir(targetPath, { recursive: true });
      continue;
    }
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.writeFile(targetPath, content);
  }
}

async function assertEntryExists(installDir: string, manifest: PluginManifest): Promise<void> {
  const entryPath = path.join(installDir, manifest.entry.main);
  const stats = await fs.stat(entryPath);
  if (!stats.isFile()) {
    throw new Error(`${manifest.id} entry main is not a file`);
  }
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

async function replaceInstallDir(extractDir: string, installDir: string, backupDir: string): Promise<void> {
  const hadPreviousInstall = await pathExists(installDir);
  if (hadPreviousInstall) {
    await fs.rename(installDir, backupDir);
  }
  try {
    await fs.rename(extractDir, installDir);
  } catch (error) {
    await fs.rm(installDir, { recursive: true, force: true });
    if (hadPreviousInstall) {
      await fs.rename(backupDir, installDir);
    }
    throw error;
  }
  if (hadPreviousInstall) {
    await fs.rm(backupDir, { recursive: true, force: true });
  }
}
