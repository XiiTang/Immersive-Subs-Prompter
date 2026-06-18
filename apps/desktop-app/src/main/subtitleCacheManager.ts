import { promises as fs } from "fs";
import { createHash } from "crypto";
import path from "path";
import { app } from "electron";
import { createLogger } from "./logger.js";
import { swallow } from "./errors.js";
import { SubtitleLoadResult, SubtitleCacheSettings } from "./types.js";
import { redactUrlSecrets } from "./urlRedaction.js";

const DEFAULT_CACHE_DIR = path.join(app.getPath("userData"), "subtitle-cache");
const CACHE_FILE_PREFIX = "usp-cache-";
const CACHE_FILE_PATTERN = /^usp-cache-[a-f0-9]{64}\.json$/;

type CacheSource = "ytdlp" | "mediaserver" | "transcription";
const CACHE_SOURCES = new Set<CacheSource>(["ytdlp", "mediaserver", "transcription"]);

interface CacheEntry {
  url: string;
  data: SubtitleLoadResult;
  timestamp: number;
  source: CacheSource;
}

export interface CacheStats {
  totalEntries: number;
  totalSize: number;
  oldestEntry: number | null;
  newestEntry: number | null;
}

type SettingsProvider = () => SubtitleCacheSettings;

export class SubtitleCacheManager {
  private readonly log = createLogger("cache-manager");
  private memoryCache = new Map<string, CacheEntry>();
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(private readonly settingsProvider: SettingsProvider) {
    this.startPeriodicCleanup();
  }

  /**
   * Get cached subtitles for a URL
   */
  async get(url: string, source: CacheSource, variant = ""): Promise<SubtitleLoadResult | null> {
    const settings = this.settingsProvider();
    if (!settings.enabled) {
      return null;
    }

    const key = this.getCacheKey(url, source, variant);
    const redactedUrl = redactUrlSecrets(url);
    const cacheFile = this.getCacheFilePath(key);

    const refreshTimestamp = async (entry: CacheEntry): Promise<SubtitleLoadResult> => {
      const refreshed: CacheEntry = { ...entry, url: redactUrlSecrets(entry.url), timestamp: Date.now() };
      this.memoryCache.set(key, refreshed);
      try {
        await fs.writeFile(cacheFile, JSON.stringify(refreshed, null, 2), "utf-8");
      } catch (error) {
        this.log.warn(`Failed to refresh cache timestamp for ${source}: ${redactedUrl}`, error);
      }
      return refreshed.data;
    };

    // Check memory cache first
    const memEntry = this.memoryCache.get(key);
    if (memEntry) {
      if (this.isExpired(memEntry.timestamp, settings.retentionDays)) {
        this.log.debug(`Cache expired for ${source}: ${redactedUrl}`);
        return null;
      }
      this.log.debug(`Memory cache hit for ${source}: ${redactedUrl}`);
      return refreshTimestamp(memEntry);
    }

    // Check disk cache
    try {
      const entry = await this.readCacheEntry(cacheFile);
      if (!entry) {
        this.log.debug(`Cache miss for ${source}: ${redactedUrl}`);
        return null;
      }

      if (this.isExpired(entry.timestamp, settings.retentionDays)) {
        this.log.debug(`Cache expired for ${source}: ${redactedUrl}`);
        return null;
      }

      this.log.debug(`Disk cache hit for ${source}: ${redactedUrl}`);
      return refreshTimestamp(entry);
    } catch (error) {
      // Cache miss or error reading cache
      this.log.debug(`Cache miss for ${source}: ${redactedUrl}`);
      return null;
    }
  }

  /**
   * Save subtitles to cache
   */
  async set(url: string, source: CacheSource, data: SubtitleLoadResult, variant = ""): Promise<void> {
    const settings = this.settingsProvider();
    if (!settings.enabled) {
      return;
    }

    const key = this.getCacheKey(url, source, variant);
    const redactedUrl = redactUrlSecrets(url);
    const entry: CacheEntry = {
      url: redactedUrl,
      data,
      timestamp: Date.now(),
      source
    };

    // Save to memory cache
    this.memoryCache.set(key, entry);

    // Save to disk cache
    try {
      const cacheDir = this.getCachePath();
      await fs.mkdir(cacheDir, { recursive: true });
      const cacheFile = this.getCacheFilePath(key);
      await fs.writeFile(cacheFile, JSON.stringify(entry, null, 2), "utf-8");
      this.log.debug(`Cached ${source} subtitles for: ${redactedUrl}`);
    } catch (error) {
      this.log.error(`Failed to save cache for ${source}: ${redactedUrl}`, error);
    }
  }

  /**
   * Clean up expired cache entries
   */
  async cleanup(): Promise<number> {
    const settings = this.settingsProvider();
    if (!settings.enabled) {
      return 0;
    }

    const cacheDir = this.getCachePath();
    let removedCount = 0;

    this.log.info("Running cache cleanup");

    // Clean memory cache
    for (const [key, entry] of this.memoryCache.entries()) {
      if (this.isExpired(entry.timestamp, settings.retentionDays)) {
        this.memoryCache.delete(key);
        removedCount++;
      }
    }

    // Clean disk cache
    try {
      const files = await fs.readdir(cacheDir);
      for (const file of files) {
        if (!this.isCacheFileName(file)) {
          continue;
        }

        const filePath = path.join(cacheDir, file);
        const entry = await this.readCacheEntry(filePath);
        if (!entry) {
          continue;
        }

        if (this.isExpired(entry.timestamp, settings.retentionDays)) {
          await fs.unlink(filePath);
          removedCount++;
        }
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        this.log.error("Failed to cleanup cache", error);
      }
    }

    this.log.info(`Cache cleanup completed, removed ${removedCount} entries`);
    return removedCount;
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<CacheStats> {
    const cacheDir = this.getCachePath();

    const stats: CacheStats = {
      totalEntries: 0,
      totalSize: 0,
      oldestEntry: null,
      newestEntry: null
    };

    try {
      const files = await fs.readdir(cacheDir);
      for (const file of files) {
        if (!this.isCacheFileName(file)) {
          continue;
        }

        try {
          const filePath = path.join(cacheDir, file);
          const entry = await this.readCacheEntry(filePath);
          if (!entry) {
            continue;
          }
          const fileStat = await fs.stat(filePath);

          stats.totalEntries++;
          stats.totalSize += fileStat.size;

          if (stats.oldestEntry === null || entry.timestamp < stats.oldestEntry) {
            stats.oldestEntry = entry.timestamp;
          }
          if (stats.newestEntry === null || entry.timestamp > stats.newestEntry) {
            stats.newestEntry = entry.timestamp;
          }
        } catch (error) {
          swallow(error, "cache.stats.parse", "skipping unreadable cache entry");
        }
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        this.log.error("Failed to get cache stats", error);
      }
    }

    return stats;
  }

  /**
   * Get the cache directory path
   */
  getCachePath(): string {
    const settings = this.settingsProvider();
    return path.resolve(settings.path.trim() || DEFAULT_CACHE_DIR);
  }

  /**
   * Start periodic cleanup task
   */
  private startPeriodicCleanup() {
    // Run cleanup shortly after startup (30 seconds)
    setTimeout(() => {
      this.cleanup().catch((error) => {
        this.log.error("Initial cleanup failed", error);
      });
    }, 30 * 1000);

    // Run cleanup every 12 hours
    this.cleanupTimer = setInterval(() => {
      this.cleanup().catch((error) => {
        this.log.error("Periodic cleanup failed", error);
      });
    }, 12 * 60 * 60 * 1000);
  }

  /**
   * Stop periodic cleanup task
   */
  stop() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  /**
   * Generate cache key from URL, source, and optional variant
   */
  private getCacheKey(url: string, source: CacheSource, variant: string): string {
    const hash = createHash("sha256");
    hash.update(JSON.stringify({ source, url, variant }));
    return hash.digest("hex");
  }

  private getCacheFilePath(key: string): string {
    return path.join(this.getCachePath(), `${CACHE_FILE_PREFIX}${key}.json`);
  }

  private isCacheFileName(fileName: string): boolean {
    return CACHE_FILE_PATTERN.test(fileName);
  }

  private isCacheEntry(value: unknown): value is CacheEntry {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return false;
    }
    const entry = value as Partial<CacheEntry>;
    return (
      typeof entry.url === "string" &&
      Boolean(entry.data) &&
      typeof entry.data === "object" &&
      Array.isArray(entry.data.tracks) &&
      typeof entry.timestamp === "number" &&
      Number.isFinite(entry.timestamp) &&
      typeof entry.source === "string" &&
      CACHE_SOURCES.has(entry.source as CacheSource)
    );
  }

  private async readCacheEntry(filePath: string): Promise<CacheEntry | null> {
    try {
      const content = await fs.readFile(filePath, "utf-8");
      const parsed = JSON.parse(content) as unknown;
      return this.isCacheEntry(parsed) ? parsed : null;
    } catch (error) {
      swallow(error, "cache.read", "skipping unreadable cache entry");
      return null;
    }
  }

  /**
   * Check if a cache entry is expired
   */
  private isExpired(timestamp: number, retentionDays: number): boolean {
    const now = Date.now();
    const maxAge = retentionDays * 24 * 60 * 60 * 1000;
    return now - timestamp > maxAge;
  }
}
