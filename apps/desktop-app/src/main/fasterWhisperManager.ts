import { app } from "electron";
import { createWriteStream } from "node:fs";
import { promises as fs } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { createLogger } from "./logger.js";
import { extractSevenZipArchive } from "./sevenZipExtractor.js";

type ProgressCallback = (percent: number, status: string) => void;
type BinaryVariant = "xxl";
type ExtractArchive = typeof extractSevenZipArchive;

type BinaryAsset = {
  platform: NodeJS.Platform;
  arch: NodeJS.Architecture;
  name: string;
  version: "r245.4";
  url: string;
  sizeBytes: number;
  executableRelativePath: string;
};

const REQUIRED_MODEL_FILES = ["config.json", "model.bin", "tokenizer.json"] as const;
const MODEL_FILE_DOWNLOAD_ORDER = ["config.json", "model.bin", "preprocessor_config.json", "tokenizer.json"] as const;
const VOCABULARY_MODEL_FILE_PATTERN = /^vocabulary\.[^/]+$/;
const MODEL_BASE_URL = "https://huggingface.co";
const MODEL_NAME_PATTERN = /^[a-z0-9][a-z0-9._-]*$/i;
const MODEL_REPO_ID_PATTERN = /^[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*$/i;
const OFFICIAL_MODEL_REPOS = new Map<string, string>([
  ["tiny.en", "Systran/faster-whisper-tiny.en"],
  ["tiny", "Systran/faster-whisper-tiny"],
  ["base.en", "Systran/faster-whisper-base.en"],
  ["base", "Systran/faster-whisper-base"],
  ["small.en", "Systran/faster-whisper-small.en"],
  ["small", "Systran/faster-whisper-small"],
  ["medium.en", "Systran/faster-whisper-medium.en"],
  ["medium", "Systran/faster-whisper-medium"],
  ["large-v1", "Systran/faster-whisper-large-v1"],
  ["large-v2", "Systran/faster-whisper-large-v2"],
  ["large-v3", "Systran/faster-whisper-large-v3"],
  ["large", "Systran/faster-whisper-large-v3"],
  ["distil-large-v2", "Systran/faster-distil-whisper-large-v2"],
  ["distil-medium.en", "Systran/faster-distil-whisper-medium.en"],
  ["distil-small.en", "Systran/faster-distil-whisper-small.en"],
  ["distil-large-v3", "Systran/faster-distil-whisper-large-v3"],
  ["distil-large-v3.5", "distil-whisper/distil-large-v3.5-ct2"],
  ["large-v3-turbo", "mobiuslabsgmbh/faster-whisper-large-v3-turbo"],
  ["turbo", "mobiuslabsgmbh/faster-whisper-large-v3-turbo"]
]);
const OFFICIAL_MODEL_NAME_BY_REPO_NAME = buildOfficialModelNameByRepoName();
const FASTER_WHISPER_XXL_UNSUPPORTED =
  "Faster-Whisper-XXL binary download is not available on this platform.";
const RELEASE_ASSET_ALLOWED_HOSTS = new Set([
  "github.com",
  "objects.githubusercontent.com",
  "release-assets.githubusercontent.com"
]);
const FASTER_WHISPER_XXL_ASSETS: BinaryAsset[] = [
  {
    platform: "win32",
    arch: "x64",
    name: "Faster-Whisper-XXL_r245.4_windows.7z",
    version: "r245.4",
    url: "https://github.com/Purfview/whisper-standalone-win/releases/download/Faster-Whisper-XXL/Faster-Whisper-XXL_r245.4_windows.7z",
    sizeBytes: 1424256246,
    executableRelativePath: path.join("Faster-Whisper-XXL", "faster-whisper-xxl.exe")
  },
  {
    platform: "linux",
    arch: "x64",
    name: "Faster-Whisper-XXL_r245.4_linux.7z",
    version: "r245.4",
    url: "https://github.com/Purfview/whisper-standalone-win/releases/download/Faster-Whisper-XXL/Faster-Whisper-XXL_r245.4_linux.7z",
    sizeBytes: 1657690937,
    executableRelativePath: path.join("Faster-Whisper-XXL", "faster-whisper-xxl")
  }
];

export class FasterWhisperManager {
  private readonly log = createLogger("faster-whisper");
  private readonly baseDir: string;
  private readonly binDir: string;
  private readonly modelsDir: string;
  private readonly platform: NodeJS.Platform;
  private readonly arch: NodeJS.Architecture;
  private readonly extractArchive: ExtractArchive;
  private readonly binaryAssets: readonly BinaryAsset[];

  constructor(
    options: {
      baseDir?: string;
      platform?: NodeJS.Platform;
      arch?: NodeJS.Architecture;
      extractArchive?: ExtractArchive;
      binaryAssets?: readonly BinaryAsset[];
    } = {}
  ) {
    this.baseDir = options.baseDir ?? path.join(app.getPath("userData"), "faster-whisper");
    this.binDir = path.join(this.baseDir, "bin");
    this.modelsDir = path.join(this.baseDir, "models");
    this.platform = options.platform ?? process.platform;
    this.arch = options.arch ?? process.arch;
    this.extractArchive = options.extractArchive ?? extractSevenZipArchive;
    this.binaryAssets = options.binaryAssets ?? FASTER_WHISPER_XXL_ASSETS;
  }

  async getPaths() {
    await this.ensureDirs();
    return {
      binaryDir: this.binDir,
      modelsDir: this.modelsDir,
      xxlBinaryPath: this.getXxlTargetPath()
    };
  }

  async getStatus(modelDirOverride?: string) {
    const paths = await this.getPaths();
    const targetModelDir = modelDirOverride?.trim() || paths.modelsDir;
    const [binaryStatus, modelList] = await Promise.all([
      this.buildBinaryStatus(paths.xxlBinaryPath),
      this.listDownloadedModels(targetModelDir)
    ]);
    return {
      paths,
      binary: binaryStatus,
      models: modelList.models,
      modelsBaseDir: modelList.baseDir
    };
  }

  async listDownloadedModels(modelDirOverride?: string) {
    const targetDir = modelDirOverride?.trim() || this.modelsDir;
    await fs.mkdir(targetDir, { recursive: true });
    const entries = await fs.readdir(targetDir, { withFileTypes: true });
    const models: Array<{ name: string; path: string; folder: string }> = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }
      const folder = entry.name;
      const modelPath = path.join(targetDir, folder);
      if (!(await this.hasRequiredModelFiles(modelPath))) {
        continue;
      }
      const modelName = normalizeModelFolderName(folder);
      if (!modelName) {
        continue;
      }
      models.push({
        name: modelName,
        path: modelPath,
        folder
      });
    }
    return { models, baseDir: targetDir };
  }

  private async buildBinaryStatus(targetPath: string) {
    const exists = await this.fileExists(targetPath);
    const asset = this.getCurrentPlatformAsset();
    return {
      variant: "xxl" as const,
      exists,
      path: targetPath,
      downloadable: Boolean(asset),
      ...(asset
        ? { asset: { name: asset.name, version: asset.version, sizeBytes: asset.sizeBytes } }
        : { reason: FASTER_WHISPER_XXL_UNSUPPORTED })
    };
  }

  private getXxlTargetPath(): string {
    const executable = this.platform === "win32" ? "faster-whisper-xxl.exe" : "faster-whisper-xxl";
    return path.join(this.binDir, "Faster-Whisper-XXL", executable);
  }

  async downloadBinary(
    variant: BinaryVariant,
    progress?: ProgressCallback
  ): Promise<{ path: string; asset: string; version: string }> {
    if (variant !== "xxl") {
      throw new Error("Invalid Faster-Whisper binary variant.");
    }
    await this.ensureDirs();
    const asset = this.getCurrentPlatformAsset();
    if (!asset) {
      throw new Error(FASTER_WHISPER_XXL_UNSUPPORTED);
    }

    const downloadsDir = path.join(this.binDir, ".downloads");
    const archivePath = path.join(downloadsDir, `${asset.name}.download`);
    const stagingDir = path.join(downloadsDir, `${asset.name}.staging`);
    await fs.rm(stagingDir, { recursive: true, force: true });
    await fs.mkdir(downloadsDir, { recursive: true });

    try {
      await this.downloadFile(
        asset.url,
        archivePath,
        (percent) => {
          progress?.(Math.min(80, Math.round(percent * 0.8)), "Downloading Faster-Whisper-XXL");
        },
        {
          expectedSizeBytes: asset.sizeBytes,
          allowedHosts: RELEASE_ASSET_ALLOWED_HOSTS,
          label: "Faster-Whisper-XXL"
        }
      );
      progress?.(85, "Extracting Faster-Whisper-XXL");
      await this.extractArchive({ archivePath, destinationDir: stagingDir });

      const extractedRoot = path.join(stagingDir, "Faster-Whisper-XXL");
      const extractedBinary = path.join(stagingDir, asset.executableRelativePath);
      if (!(await this.fileExists(extractedBinary))) {
        throw new Error(`Faster-Whisper-XXL archive did not contain ${path.basename(asset.executableRelativePath)}.`);
      }

      const targetRoot = path.join(this.binDir, "Faster-Whisper-XXL");
      await fs.rm(targetRoot, { recursive: true, force: true });
      await fs.rename(extractedRoot, targetRoot);
      const targetPath = path.join(this.binDir, asset.executableRelativePath);
      await this.ensureExecutable(targetPath);
      progress?.(100, "Faster-Whisper-XXL ready");
      return { path: targetPath, asset: asset.name, version: asset.version };
    } finally {
      await fs.rm(archivePath, { force: true });
      await fs.rm(stagingDir, { recursive: true, force: true });
    }
  }

  async downloadModel(
    model: string,
    modelDirOverride?: string,
    progress?: ProgressCallback
  ): Promise<{ path: string; baseDir: string; files: string[] }> {
    await this.ensureDirs();
    const source = resolveModelSource(model);
    const files = selectModelFiles(source.repoId, await this.fetchModelFileNames(source.repoId));
    const baseDir = modelDirOverride?.trim() || this.modelsDir;
    const targetDir = path.join(baseDir, source.folder);
    await fs.mkdir(targetDir, { recursive: true });
    for (const [index, file] of files.entries()) {
      const outputPath = path.join(targetDir, file);
      await this.downloadFile(buildModelFileUrl(source.repoId, file), outputPath, (percent) => {
        const base = (index / files.length) * 100;
        const span = 100 / files.length;
        progress?.(Math.min(99, Math.round(base + (percent / 100) * span)), `Downloading model (${file})`);
      });
    }
    progress?.(100, "Model ready");
    return { path: targetDir, baseDir, files };
  }

  private async ensureDirs(): Promise<void> {
    await fs.mkdir(this.binDir, { recursive: true });
    await fs.mkdir(this.modelsDir, { recursive: true });
  }

  private async fileExists(target: string): Promise<boolean> {
    try {
      await fs.access(target);
      return true;
    } catch {
      return false;
    }
  }

  private async hasRequiredModelFiles(modelPath: string): Promise<boolean> {
    try {
      const entries = await fs.readdir(modelPath, { withFileTypes: true });
      const files = new Set(entries.filter((entry) => entry.isFile()).map((entry) => entry.name));
      return (
        REQUIRED_MODEL_FILES.every((file) => files.has(file)) &&
        [...files].some((file) => VOCABULARY_MODEL_FILE_PATTERN.test(file))
      );
    } catch {
      return false;
    }
  }

  private async fetchModelFileNames(repoId: string): Promise<string[]> {
    const response = await fetch(buildModelTreeUrl(repoId));
    if (!response.ok) {
      throw new Error(`Model metadata fetch failed: ${response.status} ${response.statusText}`);
    }
    const payload = (await response.json()) as unknown;
    if (!Array.isArray(payload)) {
      throw new Error("Model metadata response is invalid.");
    }
    return payload
      .flatMap((entry) => {
        if (!entry || typeof entry !== "object") {
          return [];
        }
        const record = entry as Record<string, unknown>;
        return record.type === "file" && typeof record.path === "string" && !record.path.includes("/")
          ? [record.path]
          : [];
      })
      .sort((left, right) => left.localeCompare(right));
  }

  private getCurrentPlatformAsset(): BinaryAsset | null {
    return this.binaryAssets.find((asset) => asset.platform === this.platform && asset.arch === this.arch) ?? null;
  }

  private async ensureExecutable(targetPath: string): Promise<void> {
    if (this.platform !== "win32") {
      await fs.chmod(targetPath, 0o755);
    }
  }

  private async downloadFile(
    url: string,
    targetPath: string,
    progress?: (percent: number) => void,
    options?: {
      expectedSizeBytes?: number;
      allowedHosts?: ReadonlySet<string>;
      label?: string;
    }
  ): Promise<number> {
    if (options?.allowedHosts) {
      assertExpectedDownloadUrl(url, options.allowedHosts, options.label ?? "Download");
    }
    const response = await fetch(url);
    if (!response.ok || !response.body) {
      throw new Error(`Download failed: ${response.status} ${response.statusText}`);
    }
    if (options?.allowedHosts && response.url) {
      assertExpectedDownloadUrl(response.url, options.allowedHosts, options.label ?? "Download");
    }

    const total = options?.expectedSizeBytes ?? Number(response.headers.get("content-length") ?? 0);
    const readable = Readable.fromWeb(response.body as never);
    let downloaded = 0;
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await new Promise<void>((resolve, reject) => {
      const fileStream = createWriteStream(targetPath);
      fileStream.on("error", reject);
      fileStream.on("finish", resolve);
      readable.on("data", (chunk: Buffer) => {
        downloaded += chunk.length;
        if (progress && total > 0) {
          progress(Math.min(99, Math.round((downloaded / total) * 100)));
        }
      });
      readable.on("error", reject);
      readable.pipe(fileStream);
    });
    if (options?.expectedSizeBytes !== undefined && downloaded !== options.expectedSizeBytes) {
      throw new Error(`${options.label ?? "Download"} download size mismatch.`);
    }
    progress?.(100);
    this.log.info(`Downloaded ${url} to ${targetPath}`);
    return downloaded;
  }
}

function assertExpectedDownloadUrl(input: string, allowedHosts: ReadonlySet<string>, label: string): void {
  const parsed = new URL(input);
  if (parsed.protocol !== "https:") {
    throw new Error(`${label} release asset download must use https.`);
  }
  if (!allowedHosts.has(parsed.hostname.toLowerCase())) {
    throw new Error(`${label} release asset redirected to unsupported host: ${parsed.hostname}`);
  }
}

function buildOfficialModelNameByRepoName(): Map<string, string> {
  const aliases = new Map<string, string>();
  for (const [modelName, repoId] of OFFICIAL_MODEL_REPOS) {
    const repoName = repoId.split("/")[1];
    if (repoName && !aliases.has(repoName)) {
      aliases.set(repoName, modelName);
    }
  }
  return aliases;
}

function resolveModelSource(name: string): { repoId: string; folder: string } {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error("Invalid Faster-Whisper model name");
  }
  const officialRepoId = OFFICIAL_MODEL_REPOS.get(trimmed.toLowerCase());
  if (officialRepoId) {
    return {
      repoId: officialRepoId,
      folder: repoNameFromRepoId(officialRepoId)
    };
  }
  if (MODEL_REPO_ID_PATTERN.test(trimmed)) {
    const [owner, repoName] = trimmed.split("/") as [string, string];
    return {
      repoId: trimmed,
      folder: `${owner}--${repoName}`
    };
  }
  throw new Error("Invalid Faster-Whisper model name");
}

function repoNameFromRepoId(repoId: string): string {
  const repoName = repoId.split("/")[1];
  if (!repoName || !MODEL_NAME_PATTERN.test(repoName)) {
    throw new Error("Invalid Faster-Whisper model name");
  }
  return repoName;
}

function selectModelFiles(repoId: string, fileNames: string[]): string[] {
  const available = new Set(fileNames);
  const missing: string[] = REQUIRED_MODEL_FILES.filter((file) => !available.has(file));
  const vocabularyFiles = fileNames.filter((file) => VOCABULARY_MODEL_FILE_PATTERN.test(file)).sort();
  if (!vocabularyFiles.length) {
    missing.push("vocabulary.*");
  }
  if (missing.length) {
    throw new Error(`Faster-Whisper model ${repoId} is missing required files: ${missing.join(", ")}`);
  }
  return [
    ...MODEL_FILE_DOWNLOAD_ORDER.filter((file) => available.has(file)),
    ...vocabularyFiles
  ];
}

function normalizeModelFolderName(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) {
    return null;
  }
  if (trimmed.includes("--")) {
    const parts = trimmed.split("--");
    if (parts.length !== 2) {
      return null;
    }
    const repoId = `${parts[0]}/${parts[1]}`;
    return MODEL_REPO_ID_PATTERN.test(repoId) ? repoId : null;
  }
  const officialName = OFFICIAL_MODEL_NAME_BY_REPO_NAME.get(trimmed);
  if (officialName) {
    return officialName;
  }
  const normalized = trimmed.replace(/^faster-whisper-/i, "");
  return MODEL_NAME_PATTERN.test(normalized) ? normalized : null;
}

function encodeRepoId(repoId: string): string {
  return repoId.split("/").map(encodeURIComponent).join("/");
}

function buildModelTreeUrl(repoId: string): string {
  return `${MODEL_BASE_URL}/api/models/${encodeRepoId(repoId)}/tree/main`;
}

function buildModelFileUrl(repoId: string, fileName: string): string {
  return `${MODEL_BASE_URL}/${encodeRepoId(repoId)}/resolve/main/${encodeURIComponent(fileName)}`;
}
