import { app } from "electron";
import { createWriteStream } from "node:fs";
import { promises as fs } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { createLogger } from "./logger.js";

export type FasterWhisperBinaryVariant = "cpu" | "gpu";

type ProgressCallback = (percent: number, status: string) => void;

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
const WINDOWS_BINARY_ASSETS: Record<FasterWhisperBinaryVariant, { url: string; archiveName: string }> = {
  cpu: {
    url: "https://modelscope.cn/models/bkfengg/whisper-cpp/resolve/master/whisper-faster.exe",
    archiveName: "faster-whisper.exe.download"
  },
  gpu: {
    url: "https://modelscope.cn/models/bkfengg/whisper-cpp/resolve/master/Faster-Whisper-XXL_r245.2_windows.7z",
    archiveName: "faster-whisper-gpu.7z"
  }
};

export class FasterWhisperManager {
  private readonly log = createLogger("faster-whisper");
  private readonly baseDir: string;
  private readonly binDir: string;
  private readonly modelsDir: string;
  private readonly platform: NodeJS.Platform;

  constructor(options: { baseDir?: string; platform?: NodeJS.Platform } = {}) {
    this.baseDir = options.baseDir ?? path.join(app.getPath("userData"), "faster-whisper");
    this.binDir = path.join(this.baseDir, "bin");
    this.modelsDir = path.join(this.baseDir, "models");
    this.platform = options.platform ?? process.platform;
  }

  async getPaths() {
    await this.ensureDirs();
    return {
      binaryDir: this.binDir,
      modelsDir: this.modelsDir,
      cpuBinaryPath: this.getTargetPath("cpu"),
      gpuBinaryPath: this.getTargetPath("gpu")
    };
  }

  async getStatus(modelDirOverride?: string) {
    const paths = await this.getPaths();
    const targetModelDir = modelDirOverride?.trim() || paths.modelsDir;
    const [cpuExists, gpuExists, modelList] = await Promise.all([
      this.fileExists(paths.cpuBinaryPath),
      this.fileExists(paths.gpuBinaryPath),
      this.listDownloadedModels(targetModelDir)
    ]);
    return {
      paths,
      binaries: {
        cpu: this.buildBinaryStatus("cpu", cpuExists, paths.cpuBinaryPath),
        gpu: this.buildBinaryStatus("gpu", gpuExists, paths.gpuBinaryPath)
      },
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

  async downloadBinary(variant: FasterWhisperBinaryVariant, progress?: ProgressCallback): Promise<string> {
    await this.ensureDirs();
    const targetPath = this.getTargetPath(variant);
    if (await this.fileExists(targetPath)) {
      return targetPath;
    }

    const unavailableReason = this.getDownloadUnavailableReason(variant);
    if (unavailableReason) {
      throw new Error(unavailableReason);
    }

    const asset = WINDOWS_BINARY_ASSETS[variant];
    const tempPath = path.join(this.binDir, asset.archiveName);
    progress?.(1, `Downloading ${variant.toUpperCase()} binary...`);
    await this.downloadFile(asset.url, tempPath, (percent) =>
      progress?.(Math.max(1, Math.min(99, percent)), `Downloading ${variant.toUpperCase()} binary...`)
    );

    await fs.rename(tempPath, targetPath);
    await this.ensurePermissions(targetPath);
    progress?.(100, "Binary ready");
    return targetPath;
  }

  private buildBinaryStatus(variant: FasterWhisperBinaryVariant, exists: boolean, targetPath: string) {
    const unavailableReason = this.getDownloadUnavailableReason(variant);
    return {
      exists,
      path: targetPath,
      downloadSupported: unavailableReason === null,
      downloadUnavailableReason: unavailableReason
    };
  }

  private getTargetPath(variant: FasterWhisperBinaryVariant): string {
    if (variant === "gpu") {
      const executable = this.platform === "win32" ? "faster-whisper-xxl.exe" : "faster-whisper-xxl";
      return path.join(this.binDir, "Faster-Whisper-XXL", executable);
    }
    return path.join(this.binDir, this.platform === "win32" ? "faster-whisper.exe" : "faster-whisper");
  }

  private getDownloadUnavailableReason(variant: FasterWhisperBinaryVariant): string | null {
    if (variant === "gpu") {
      return "GPU binary installation is manual. Set the Faster-Whisper executable path in settings.";
    }
    if (this.platform !== "win32") {
      return "App-managed Faster-Whisper binary download is only available on Windows.";
    }
    return null;
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

  private async downloadFile(url: string, targetPath: string, progress?: (percent: number) => void): Promise<void> {
    const response = await fetch(url);
    if (!response.ok || !response.body) {
      throw new Error(`Download failed: ${response.status} ${response.statusText}`);
    }

    const total = Number(response.headers.get("content-length") ?? 0);
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
    progress?.(100);
    this.log.info(`Downloaded ${url} to ${targetPath}`);
  }

  private async ensurePermissions(targetPath: string): Promise<void> {
    if (process.platform !== "win32") {
      await fs.chmod(targetPath, 0o755);
    }
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
