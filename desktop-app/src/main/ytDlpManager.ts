import { app } from "electron";
import { promises as fs } from "fs";
import path from "path";

const RELEASE_API = "https://api.github.com/repos/yt-dlp/yt-dlp/releases/latest";
const LATEST_DOWNLOAD_BASE = "https://github.com/yt-dlp/yt-dlp/releases/latest/download/";
const METADATA_FILE = "yt-dlp.json";

type PlatformBinary = {
  fileName: string;
  assetName: string;
};

type ReleaseInfo = {
  version: string;
  assets: Map<string, string>;
};

type BinaryMetadata = {
  version: string;
  downloadedAt: string;
};

const PLATFORM_BINARIES: Record<NodeJS.Platform, PlatformBinary> = {
  win32: {
    fileName: "yt-dlp.exe",
    assetName: "yt-dlp.exe"
  },
  darwin: {
    fileName: "yt-dlp_macos",
    assetName: "yt-dlp_macos"
  },
  linux: {
    fileName: "yt-dlp",
    assetName: "yt-dlp"
  },
  aix: {
    fileName: "yt-dlp",
    assetName: "yt-dlp"
  },
  android: {
    fileName: "yt-dlp",
    assetName: "yt-dlp"
  },
  freebsd: {
    fileName: "yt-dlp",
    assetName: "yt-dlp"
  },
  openbsd: {
    fileName: "yt-dlp",
    assetName: "yt-dlp"
  },
  netbsd: {
    fileName: "yt-dlp",
    assetName: "yt-dlp"
  },
  sunos: {
    fileName: "yt-dlp",
    assetName: "yt-dlp"
  },
  cygwin: {
    fileName: "yt-dlp.exe",
    assetName: "yt-dlp.exe"
  },
  haiku: {
    fileName: "yt-dlp",
    assetName: "yt-dlp"
  }
};

export class YtDlpManager {
  private binaryPath: string | null = null;
  private ensurePromise: Promise<string> | null = null;
  private releaseInfoPromise: Promise<ReleaseInfo> | null = null;

  async getBinaryPath(): Promise<string> {
    if (this.binaryPath && (await this.fileExists(this.binaryPath))) {
      return this.binaryPath;
    }

    if (!this.ensurePromise) {
      this.ensurePromise = this.ensureBinary();
    }

    return this.ensurePromise;
  }

  private async ensureBinary(): Promise<string> {
    const config = PLATFORM_BINARIES[process.platform] ?? PLATFORM_BINARIES.linux;
    const storageDir = await this.ensureStorageDir();
    const targetPath = path.join(storageDir, config.fileName);
    const metadata = await this.readMetadata(storageDir);

    try {
      const releaseInfo = await this.fetchLatestReleaseInfo();
      const releaseVersion = releaseInfo.version;
      const downloadUrl =
        releaseInfo.assets.get(config.assetName) ??
        `${LATEST_DOWNLOAD_BASE}${config.assetName}`;

      const needsDownload =
        !(await this.fileExists(targetPath)) || metadata?.version !== releaseVersion;

      if (needsDownload) {
        await this.downloadBinary(downloadUrl, targetPath);
        await this.ensurePermissions(targetPath);
        await this.writeMetadata(storageDir, {
          version: releaseVersion,
          downloadedAt: new Date().toISOString()
        });
      } else {
        await this.ensurePermissions(targetPath);
      }

      this.binaryPath = targetPath;
      return targetPath;
    } catch (error) {
      if (await this.fileExists(targetPath)) {
        console.warn("[USP] Failed to refresh yt-dlp, falling back to cached binary:", error);
        await this.ensurePermissions(targetPath);
        this.binaryPath = targetPath;
        return targetPath;
      }

      try {
        const fallbackUrl = `${LATEST_DOWNLOAD_BASE}${config.assetName}`;
        await this.downloadBinary(fallbackUrl, targetPath);
        await this.ensurePermissions(targetPath);
        await this.writeMetadata(storageDir, {
          version: "latest",
          downloadedAt: new Date().toISOString()
        });
        this.binaryPath = targetPath;
        return targetPath;
      } catch (fallbackError) {
        throw fallbackError;
      }
    }
  }

  private async ensureStorageDir(): Promise<string> {
    if (!app.isReady()) {
      await app.whenReady();
    }
    const dir = path.join(app.getPath("userData"), "yt-dlp");
    await fs.mkdir(dir, { recursive: true });
    return dir;
  }

  private async downloadBinary(url: string, targetPath: string) {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`下载 yt-dlp 失败：${response.status} ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const tempPath = `${targetPath}.download`;
    await fs.writeFile(tempPath, buffer);
    await fs.rename(tempPath, targetPath);
  }

  private async ensurePermissions(targetPath: string) {
    if (process.platform !== "win32") {
      await fs.chmod(targetPath, 0o755);
    }
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  private async fetchLatestReleaseInfo(): Promise<ReleaseInfo> {
    if (!this.releaseInfoPromise) {
      this.releaseInfoPromise = this.requestLatestReleaseInfo();
    }
    return this.releaseInfoPromise;
  }

  private async requestLatestReleaseInfo(): Promise<ReleaseInfo> {
    const response = await fetch(RELEASE_API, {
      headers: {
        "User-Agent": "UniversalSubtitle/0.1"
      }
    });

    if (!response.ok) {
      throw new Error(`获取 yt-dlp 版本信息失败：${response.status} ${response.statusText}`);
    }

    const payload = await response.json();
    const version: string | undefined = payload?.tag_name || payload?.name;
    if (!version) {
      throw new Error("无法解析 yt-dlp 最新版本号。");
    }

    const assets = new Map<string, string>();
    if (Array.isArray(payload?.assets)) {
      for (const asset of payload.assets) {
        if (asset?.name && asset?.browser_download_url) {
          assets.set(asset.name, asset.browser_download_url);
        }
      }
    }

    return { version, assets };
  }

  private async readMetadata(dir: string): Promise<BinaryMetadata | null> {
    try {
      const raw = await fs.readFile(path.join(dir, METADATA_FILE), "utf-8");
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.version === "string") {
        return {
          version: parsed.version,
          downloadedAt: parsed.downloadedAt ?? ""
        };
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException)?.code !== "ENOENT") {
        console.warn("[USP] Failed to read yt-dlp metadata:", error);
      }
    }
    return null;
  }

  private async writeMetadata(dir: string, metadata: BinaryMetadata) {
    try {
      await fs.writeFile(
        path.join(dir, METADATA_FILE),
        JSON.stringify(metadata, null, 2),
        "utf-8"
      );
    } catch (error) {
      console.warn("[USP] Failed to persist yt-dlp metadata:", error);
    }
  }
}
