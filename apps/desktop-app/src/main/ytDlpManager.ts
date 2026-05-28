import { app } from "electron";
import { promises as fs } from "fs";
import path from "path";
import { createLogger } from "./logger.js";

const RELEASE_API = "https://api.github.com/repos/yt-dlp/yt-dlp/releases/latest";
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

const PLATFORM_BINARIES = {
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
  }
} satisfies Partial<Record<NodeJS.Platform, PlatformBinary>>;

export class YtDlpManager {
  private binaryPath: string | null = null;
  private ensurePromise: Promise<string> | null = null;
  private releaseInfoPromise: Promise<ReleaseInfo> | null = null;
  private readonly log = createLogger("yt-dlp");

  async getBinaryPath(): Promise<string> {
    if (this.binaryPath && (await this.fileExists(this.binaryPath))) {
      return this.binaryPath;
    }

    if (!this.ensurePromise) {
      this.ensurePromise = this.ensureBinary().catch((error) => {
        this.ensurePromise = null;
        throw error;
      });
    }

    return this.ensurePromise;
  }

  private async ensureBinary(): Promise<string> {
    const config = this.getPlatformBinary();
    const storageDir = await this.ensureStorageDir();
    const targetPath = path.join(storageDir, config.fileName);
    const metadata = await this.readMetadata(storageDir);

    try {
      this.log.info("Checking yt-dlp binary status");

      const releaseInfo = await this.fetchLatestReleaseInfo();
      const releaseVersion = releaseInfo.version;
      const downloadUrl = releaseInfo.assets.get(config.assetName);
      if (!downloadUrl) {
        throw new Error(`yt-dlp release does not include asset ${config.assetName}.`);
      }

      const needsDownload =
        !(await this.fileExists(targetPath)) || metadata?.version !== releaseVersion;

      if (needsDownload) {
        this.log.info(`Downloading yt-dlp ${releaseVersion}...`);
        await this.downloadBinary(downloadUrl, targetPath);
        await this.ensurePermissions(targetPath);
        await this.writeMetadata(storageDir, {
          version: releaseVersion,
          downloadedAt: new Date().toISOString()
        });
        this.log.info(`yt-dlp ${releaseVersion} downloaded successfully`);
      } else {
        this.log.info(`Using cached yt-dlp ${metadata?.version || "unknown version"}`);
        await this.ensurePermissions(targetPath);
      }

      this.binaryPath = targetPath;
      return targetPath;
    } catch (error) {
      if (await this.fileExists(targetPath)) {
        this.log.warn("Failed to refresh yt-dlp, falling back to cached binary:", error);
        await this.ensurePermissions(targetPath);
        this.binaryPath = targetPath;
        return targetPath;
      }

      throw error;
    }
  }

  private getPlatformBinary(): PlatformBinary {
    const config = PLATFORM_BINARIES[process.platform as keyof typeof PLATFORM_BINARIES];
    if (!config) {
      throw new Error(`Unsupported platform for yt-dlp: ${process.platform}`);
    }
    return config;
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
      throw new Error(`Failed to download yt-dlp: ${response.status} ${response.statusText}`);
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
      this.releaseInfoPromise = this.requestLatestReleaseInfo().catch((error) => {
        this.releaseInfoPromise = null;
        throw error;
      });
    }
    return this.releaseInfoPromise;
  }

  private async requestLatestReleaseInfo(): Promise<ReleaseInfo> {
    const response = await fetch(RELEASE_API, {
      headers: {
        "User-Agent": "ImmersiveSubsPrompter/0.1"
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch yt-dlp version info: ${response.status} ${response.statusText}`);
    }

    const payload = await response.json();
    const version: string | undefined = payload?.tag_name || payload?.name;
    if (!version) {
      throw new Error("Unable to parse yt-dlp latest version.");
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
        this.log.warn("Failed to read yt-dlp metadata:", error);
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
      this.log.warn("Failed to persist yt-dlp metadata:", error);
    }
  }
}
