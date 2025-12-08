import { app } from "electron";
import { promises as fs, createWriteStream } from "fs";
import path from "path";
import { Readable } from "stream";
import { createLogger } from "./logger.js";
import decompress from "decompress";
import { exec } from "child_process";
import { promisify } from "util";

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

const MODEL_FILE_WHITELIST = [".bin", ".json", ".txt", ".model", ".yaml"];

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
    const repoId = `Systran/faster-whisper-${normalized}`;
    const targetDir = path.join(this.modelsDir, `faster-whisper-${normalized}`);
    await fs.mkdir(targetDir, { recursive: true });

    const files = await this.listModelFiles(repoId);
    if (!files.length) {
      throw new Error(`Unable to list model files for ${repoId}`);
    }

    const totalBytes = files.reduce((acc, file) => acc + (file.size ?? 0), 0);
    let downloadedBytes = 0;

    for (const file of files) {
      const url = `https://huggingface.co/${repoId}/resolve/main/${file.name}`;
      const outPath = path.join(targetDir, file.name);
      await fs.mkdir(path.dirname(outPath), { recursive: true });
      const fileLabel = file.name;
      await this.downloadFile(url, outPath, (p, currentBytes) => {
        if (file.size && currentBytes !== undefined) {
          downloadedBytes = downloadedBytes + currentBytes;
          if (totalBytes > 0) {
            const percent = Math.min(
              99,
              Math.max(1, Math.round((downloadedBytes / totalBytes) * 100))
            );
            progress?.(percent, `Downloading model (${fileLabel})`);
          }
        } else {
          progress?.(p, `Downloading model (${fileLabel})`);
        }
      });
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

  private async listModelFiles(repoId: string): Promise<ModelFile[]> {
    const res = await fetch(`https://huggingface.co/api/models/${repoId}`);
    if (!res.ok) {
      throw new Error(`Failed to fetch model metadata: ${res.status} ${res.statusText}`);
    }
    const data = await res.json();
    const siblings = Array.isArray(data?.siblings) ? data.siblings : [];
    const files: ModelFile[] = [];
    for (const sibling of siblings) {
      const name = sibling?.rfilename;
      if (typeof name !== "string") continue;
      if (!MODEL_FILE_WHITELIST.some((ext) => name.toLowerCase().endsWith(ext))) {
        continue;
      }
      files.push({ name, size: typeof sibling?.size === "number" ? sibling.size : null });
    }
    return files;
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

    if (total > 0) {
      progress?.(100, 0);
    }
  }

  private async ensurePermissions(targetPath: string) {
    if (process.platform !== "win32") {
      await fs.chmod(targetPath, 0o755);
    }
  }

  private async extractArchive(archivePath: string, extractDir: string) {
    try {
      // Ensure extraction directory exists
      await fs.mkdir(extractDir, { recursive: true });
      
      if (process.platform === "win32") {
        // Try multiple extraction methods in order of preference
        // 1. Try using 7-Zip command line tool (if installed)
        try {
          await execAsync(`7z x "${archivePath}" -o"${extractDir}" -y`);
          return;
        } catch (e) {
          this.log.info("7-Zip not found, trying Windows tar...");
        }
        
        // 2. Try using tar (Windows 10+ has built-in tar with 7z support)
        try {
          await execAsync(`tar -xf "${archivePath}" -C "${extractDir}"`);
          return;
        } catch (tarError) {
          this.log.info("Windows tar failed, trying PowerShell...");
        }
        
        // 3. Last resort: PowerShell with Expand-Archive (only works for zip files)
        try {
          await execAsync(`powershell -Command "Expand-Archive -Path '${archivePath}' -DestinationPath '${extractDir}' -Force"`);
          return;
        } catch (psError) {
          throw new Error(
            `Failed to extract archive. Please install 7-Zip from https://www.7-zip.org/ or ensure you have Windows 10+ with tar support.`
          );
        }
      } else {
        // On non-Windows platforms, use decompress library
        await decompress(archivePath, extractDir);
      }
    } catch (error) {
      const message =
        error && typeof error === "object" && "message" in error ? (error as Error).message : String(error);
      throw new Error(`Failed to extract GPU package: ${message}`);
    }
  }
}
