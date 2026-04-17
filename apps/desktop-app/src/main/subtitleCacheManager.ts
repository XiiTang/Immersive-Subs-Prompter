import { promises as fs } from "fs";
import { createHash } from "crypto";
import path from "path";
import { app } from "electron";
import { createLogger } from "./logger.js";
import { swallow } from "./errors.js";
import { SubtitleLoadResult, SubtitleCacheSettings } from "./types.js";

const DEFAULT_CACHE_DIR = path.join(app.getPath("userData"), "subtitle-cache");

type CacheSource = "ytdlp" | "mediaserver" | "transcription";

export interface CacheEntry {
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
  async get(url: string, source: CacheSource): Promise<SubtitleLoadResult | null> {
    const settings = this.settingsProvider();
    if (!settings.enabled) {
      return null;
    }

    const key = this.getCacheKey(url, source);
    const cacheDir = settings.path || DEFAULT_CACHE_DIR;
    const cacheFile = path.join(cacheDir, `${key}.json`);

    const refreshTimestamp = async (entry: CacheEntry): Promise<SubtitleLoadResult> => {
      const refreshed: CacheEntry = { ...entry, timestamp: Date.now() };
      this.memoryCache.set(key, refreshed);
      try {
        await fs.writeFile(cacheFile, JSON.stringify(refreshed, null, 2), "utf-8");
      } catch (error) {
        this.log.warn(`Failed to refresh cache timestamp for ${source}: ${url}`, error);
      }
      return refreshed.data;
    };

    // Check memory cache first
    const memEntry = this.memoryCache.get(key);
    if (memEntry) {
      if (this.isExpired(memEntry.timestamp, settings.retentionDays)) {
        this.log.debug(`Cache expired for ${source}: ${url}`);
        return null;
      }
      this.log.debug(`Memory cache hit for ${source}: ${url}`);
      return refreshTimestamp(memEntry);
    }

    // Check disk cache
    try {
      const content = await fs.readFile(cacheFile, "utf-8");
      const entry: CacheEntry = JSON.parse(content);

      if (this.isExpired(entry.timestamp, settings.retentionDays)) {
        this.log.debug(`Cache expired for ${source}: ${url}`);
        return null;
      }

      this.log.debug(`Disk cache hit for ${source}: ${url}`);
      return refreshTimestamp(entry);
    } catch (error) {
      // Cache miss or error reading cache
      this.log.debug(`Cache miss for ${source}: ${url}`);
      return null;
    }
  }

  /**
   * Save subtitles to cache
   */
  async set(url: string, source: CacheSource, data: SubtitleLoadResult): Promise<void> {
    const settings = this.settingsProvider();
    if (!settings.enabled) {
      return;
    }

    const key = this.getCacheKey(url, source);
    const entry: CacheEntry = {
      url,
      data,
      timestamp: Date.now(),
      source
    };

    // Save to memory cache
    this.memoryCache.set(key, entry);

    // Save to disk cache
    try {
      const cacheDir = settings.path || DEFAULT_CACHE_DIR;
      await fs.mkdir(cacheDir, { recursive: true });
      const cacheFile = path.join(cacheDir, `${key}.json`);
      await fs.writeFile(cacheFile, JSON.stringify(entry, null, 2), "utf-8");
      this.log.debug(`Cached ${source} subtitles for: ${url}`);
    } catch (error) {
      this.log.error(`Failed to save cache for ${source}: ${url}`, error);
    }
  }

  /**
   * Clear all cache entries
   */
  async clear(): Promise<void> {
    const settings = this.settingsProvider();
    const cacheDir = settings.path || DEFAULT_CACHE_DIR;

    this.log.info("Clearing all subtitle cache");
    this.memoryCache.clear();

    try {
      const files = await fs.readdir(cacheDir);
      for (const file of files) {
        if (file.endsWith(".json")) {
          await fs.unlink(path.join(cacheDir, file));
        }
      }
      this.log.info("Cache cleared successfully");
    } catch (error) {
      this.log.error("Failed to clear cache", error);
      throw error;
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

    const cacheDir = settings.path || DEFAULT_CACHE_DIR;
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
        if (!file.endsWith(".json")) {
          continue;
        }

        try {
          const filePath = path.join(cacheDir, file);
          const content = await fs.readFile(filePath, "utf-8");
          const entry: CacheEntry = JSON.parse(content);

          if (this.isExpired(entry.timestamp, settings.retentionDays)) {
            await fs.unlink(filePath);
            removedCount++;
          }
        } catch (error) {
          // Invalid or corrupted cache file, remove it
          await fs.unlink(path.join(cacheDir, file)).catch((unlinkError) => {
            swallow(unlinkError, "cache.cleanup.unlink", "corrupted cache file may have been removed concurrently");
          });
          removedCount++;
          swallow(error, "cache.cleanup.parse", "deleted unreadable cache entry");
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
    const settings = this.settingsProvider();
    const cacheDir = settings.path || DEFAULT_CACHE_DIR;

    const stats: CacheStats = {
      totalEntries: 0,
      totalSize: 0,
      oldestEntry: null,
      newestEntry: null
    };

    try {
      const files = await fs.readdir(cacheDir);
      for (const file of files) {
        if (!file.endsWith(".json")) {
          continue;
        }

        try {
          const filePath = path.join(cacheDir, file);
          const fileStat = await fs.stat(filePath);
          const content = await fs.readFile(filePath, "utf-8");
          const entry: CacheEntry = JSON.parse(content);

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
    return settings.path || DEFAULT_CACHE_DIR;
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
   * Generate cache key from URL and source
   */
  private getCacheKey(url: string, source: CacheSource): string {
    const hash = createHash("sha256");
    hash.update(`${source}:${url}`);
    return hash.digest("hex");
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
