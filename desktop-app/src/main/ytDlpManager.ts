import { app } from "electron";
import { promises as fs } from "fs";
import path from "path";

const PLATFORM_BINARIES: Record<
  NodeJS.Platform,
  { fileName: string; url: string }
> = {
  win32: {
    fileName: "yt-dlp.exe",
    url: "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe"
  },
  darwin: {
    fileName: "yt-dlp_macos",
    url: "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos"
  },
  linux: {
    fileName: "yt-dlp",
    url: "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp"
  },
  aix: {
    fileName: "yt-dlp",
    url: "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp"
  },
  android: {
    fileName: "yt-dlp",
    url: "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp"
  },
  freebsd: {
    fileName: "yt-dlp",
    url: "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp"
  },
  openbsd: {
    fileName: "yt-dlp",
    url: "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp"
  },
  netbsd: {
    fileName: "yt-dlp",
    url: "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp"
  },
  sunos: {
    fileName: "yt-dlp",
    url: "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp"
  },
  cygwin: {
    fileName: "yt-dlp.exe",
    url: "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe"
  },
  haiku: {
    fileName: "yt-dlp",
    url: "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp"
  }
};

export class YtDlpManager {
  private binaryPath: string | null = null;
  private ensurePromise: Promise<string> | null = null;

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

    if (await this.fileExists(targetPath)) {
      await this.ensurePermissions(targetPath);
      this.binaryPath = targetPath;
      return targetPath;
    }

    await this.downloadBinary(config.url, targetPath);
    await this.ensurePermissions(targetPath);
    this.binaryPath = targetPath;
    return targetPath;
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
}
