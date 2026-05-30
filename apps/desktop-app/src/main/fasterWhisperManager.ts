import { app } from "electron";
import { promises as fs, createWriteStream } from "fs";
import path from "path";
import { Readable } from "stream";
import { createLogger } from "./logger.js";
import { exec } from "child_process";
import { promisify } from "util";
import { normalizeFasterWhisperModelName } from "../common/fasterWhisperModels.js";

const execAsync = promisify(exec);

export type FasterWhisperBinaryVariant = "cpu" | "gpu";

type ProgressCb = (percent: number, status: string) => void;

type ModelFile = {
  name: string;
  size: number | null;
};

const BINARY_ASSETS: Record<
  FasterWhisperBinaryVariant,
  { url: string; archiveName: string; targetName: string; needsExtraction: boolean }
> = {
  cpu: {
    url: "https://modelscope.cn/models/bkfengg/whisper-cpp/resolve/master/whisper-faster.exe",
    archiveName: "faster-whisper.exe",
    targetName: "faster-whisper.exe",
    needsExtraction: false
  },
  gpu: {
    url: "https://modelscope.cn/models/bkfengg/whisper-cpp/resolve/master/Faster-Whisper-XXL_r245.2_windows.7z",
    archiveName: "faster-whisper-gpu.7z",
    targetName: path.join("Faster-Whisper-XXL", "faster-whisper-xxl.exe"),
    needsExtraction: true
  }
};

const SUPPORTED_MODEL_SUFFIXES = [
  "tiny",
  "base",
  "small",
  "medium",
  "large-v1",
  "large-v2",
  "large-v3",
  "large-v3-turbo"
] as const;

const REQUIRED_MODEL_FILES = ["config.json", "model.bin", "tokenizer.json", "vocabulary.txt"];
const MODEL_BASES = [
  "https://hf-mirror.com",
  "https://huggingface.co",
  "https://modelscope.cn/models"
];

const MANAGED_BINARY_DOWNLOAD_UNSUPPORTED_REASON =
  "Managed Faster-Whisper binary downloads are only supported on Windows. Set a Faster-Whisper binary path manually on this platform.";

function supportsManagedBinaryDownloads(): boolean {
  return process.platform === "win32";
}

export class FasterWhisperManager {
  private readonly log = createLogger("faster-whisper");
  private readonly baseDir = path.join(app.getPath("userData"), "faster-whisper");
  private readonly binDir = path.join(this.baseDir, "bin");
  private readonly modelsDir = path.join(this.baseDir, "models");
  async getPaths() {
    await this.ensureDirs();
    return {
      binaryDir: this.binDir,
      modelsDir: this.modelsDir,
      cpuBinaryPath: path.join(this.binDir, BINARY_ASSETS.cpu.targetName),
      gpuBinaryPath: path.join(this.binDir, BINARY_ASSETS.gpu.targetName)
    };
  }

  async downloadBinary(variant: FasterWhisperBinaryVariant, progress?: ProgressCb): Promise<string> {
    if (!supportsManagedBinaryDownloads()) {
      throw new Error(MANAGED_BINARY_DOWNLOAD_UNSUPPORTED_REASON);
    }
    await this.ensureDirs();
    const asset = BINARY_ASSETS[variant];
    const targetPath = path.join(this.binDir, asset.targetName);

    if (await this.fileExists(targetPath)) {
      this.log.info(`Faster-Whisper ${variant} binary already exists at ${targetPath}`);
      return targetPath;
    }

    const tempPath = path.join(this.binDir, asset.archiveName);
    progress?.(1, `Downloading ${variant.toUpperCase()} binary...`);
    await this.downloadFile(asset.url, tempPath, (p) => {
      progress?.(Math.max(1, Math.min(95, p)), `Downloading ${variant.toUpperCase()} binary...`);
    });

    if (asset.needsExtraction) {
      const extractDir = path.dirname(path.join(this.binDir, asset.targetName));
      await fs.mkdir(extractDir, { recursive: true });
      progress?.(96, "Extracting GPU package...");
      await this.extractArchive(tempPath, extractDir);
      await fs.rm(tempPath, { force: true });
    } else {
      await fs.rename(tempPath, targetPath);
      await this.ensurePermissions(targetPath);
    }

    await this.ensurePermissions(targetPath);
    this.log.info(`Faster-Whisper ${variant} binary downloaded to ${targetPath}`);
    progress?.(100, "Binary ready");
    return targetPath;
  }

  async downloadModel(model: string, progress?: ProgressCb): Promise<{ path: string; files: string[] }> {
    await this.ensureDirs();
    const normalized = this.normalizeModel(model);
    const repoName = `faster-whisper-${normalized}`;
    const targetDir = path.join(this.modelsDir, repoName);
    await fs.mkdir(targetDir, { recursive: true });

    const files = this.listModelFiles();
    const totalFiles = files.length;
    for (const [index, file] of files.entries()) {
      const outPath = path.join(targetDir, file.name);
      await fs.mkdir(path.dirname(outPath), { recursive: true });
      const fileLabel = file.name;
      const candidates = this.buildModelFileUrls(repoName, file.name);
      let lastError: unknown = null;
      for (const candidate of candidates) {
        try {
          await this.downloadFile(candidate, outPath, (p) => {
            const base = (index / totalFiles) * 100;
            const span = 100 / totalFiles;
            const percent = Math.min(99, Math.round(base + (p / 100) * span));
            progress?.(percent, `Downloading model (${fileLabel})`);
          });
          lastError = null;
          break;
        } catch (error) {
          lastError = error;
          this.log.warn(`Failed to download ${fileLabel} from ${candidate}`, error);
        }
      }
      if (lastError) {
        throw lastError;
      }
    }

    progress?.(100, "Model ready");
    this.log.info(`Faster-Whisper model ${model} downloaded to ${targetDir}`);
    return { path: targetDir, files: files.map((f) => f.name) };
  }

  private async ensureDirs() {
    await fs.mkdir(this.binDir, { recursive: true });
    await fs.mkdir(this.modelsDir, { recursive: true });
  }

  private async fileExists(target: string) {
    try {
      await fs.access(target);
      return true;
    } catch {
      return false;
    }
  }

  private normalizeModel(model: string): string {
    const lower = model.trim().toLowerCase();
    const match = SUPPORTED_MODEL_SUFFIXES.find((suffix) => suffix === lower);
    if (match) {
      return match;
    }
    return lower;
  }

  private listModelFiles(): ModelFile[] {
    return REQUIRED_MODEL_FILES.map((name) => ({ name, size: null }));
  }

  private buildModelFileUrls(repoName: string, fileName: string): string[] {
    const hfPath = `Systran/${repoName}/resolve/main/${fileName}`;
    const msPath = `pengzhendong/${repoName}/resolve/master/${fileName}`;
    return [
      `${MODEL_BASES[0]}/${hfPath}`,
      `${MODEL_BASES[1]}/${hfPath}`,
      `${MODEL_BASES[2]}/${msPath}`
    ];
  }

  private async downloadFile(url: string, targetPath: string, progress?: (percent: number, chunkBytes?: number) => void) {
    const response = await fetch(url);
    if (!response.ok || !response.body) {
      throw new Error(`Download failed: ${response.status} ${response.statusText}`);
    }

    const total = Number(response.headers.get("content-length") ?? 0);
    const readable = Readable.fromWeb(response.body as any);
    let downloaded = 0;

    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await new Promise<void>((resolve, reject) => {
      const fileStream = createWriteStream(targetPath);
      fileStream.on("error", reject);
      fileStream.on("finish", resolve);

      readable.on("data", (chunk) => {
        downloaded += chunk.length;
        if (progress && total > 0) {
          const percent = Math.min(99, Math.round((downloaded / total) * 100));
          progress(percent, chunk.length);
        }
      });
      readable.on("error", reject);
      readable.pipe(fileStream);
    });

    progress?.(100, 0);
  }

  private async ensurePermissions(targetPath: string) {
    if (process.platform !== "win32") {
      await fs.chmod(targetPath, 0o755);
    }
  }

  private async extractArchive(archivePath: string, extractDir: string) {
    await fs.mkdir(extractDir, { recursive: true });

    try {
      await execAsync(`7z x "${archivePath}" -o"${extractDir}" -y`);
    } catch (error) {
      const message =
        error && typeof error === "object" && "message" in error ? (error as Error).message : String(error);
      throw new Error(
        `Failed to extract GPU package with 7z. 7-Zip command line tool is required to extract .7z packages. Install 7-Zip from https://www.7-zip.org/ and ensure the 7z command is available in PATH. ${message}`
      );
    }
  }

  async listDownloadedModels(modelDirOverride?: string) {
    const targetDir = modelDirOverride?.trim() || this.modelsDir;
    await fs.mkdir(targetDir, { recursive: true });
    const entries = await fs.readdir(targetDir, { withFileTypes: true });
    const models: Array<{ name: string; path: string; folder: string }> = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const folder = entry.name;
      const modelPath = path.join(targetDir, folder);
      const hasAllFiles = await this.hasRequiredModelFiles(modelPath);
      if (!hasAllFiles) continue;
      models.push({
        name: normalizeFasterWhisperModelName(folder),
        path: modelPath,
        folder
      });
    }

    return { models, baseDir: targetDir };
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
      binaryDownloadsSupported: supportsManagedBinaryDownloads(),
      binaryDownloadUnsupportedReason: supportsManagedBinaryDownloads()
        ? null
        : MANAGED_BINARY_DOWNLOAD_UNSUPPORTED_REASON,
      binaries: {
        cpu: { exists: cpuExists, path: paths.cpuBinaryPath },
        gpu: { exists: gpuExists, path: paths.gpuBinaryPath }
      },
      models: modelList.models,
      modelsBaseDir: modelList.baseDir
    };
  }

  private async hasRequiredModelFiles(modelPath: string): Promise<boolean> {
    try {
      await Promise.all(REQUIRED_MODEL_FILES.map((file) => fs.access(path.join(modelPath, file))));
      return true;
    } catch {
      return false;
    }
  }
}
