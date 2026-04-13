import { Logger } from "../../shared/Logger";
import type { DashboardSnapshot, MediaInfo, MediaStateRecord } from "../../shared/types";
import type { DesktopConnectionPool } from "../desktop/DesktopConnectionPool";
import type { MediaStateStore } from "../tabs/MediaStateStore";

export class SnapshotBuilder {
  mediaStateStore: MediaStateStore;
  connectionPool: DesktopConnectionPool;
  getEndpoints: () => string[];
  logger: Logger;

  constructor({
    mediaStateStore,
    connectionPool,
    getEndpoints,
    logger = new Logger("snapshot")
  }: {
    mediaStateStore: MediaStateStore;
    connectionPool: DesktopConnectionPool;
    getEndpoints: () => string[];
    logger?: Logger;
  }) {
    this.mediaStateStore = mediaStateStore;
    this.connectionPool = connectionPool;
    this.getEndpoints = getEndpoints;
    this.logger = logger;
  }

  buildMediaInfo(state: MediaStateRecord, now = Date.now()): MediaInfo {
    const duration = typeof state.duration === "number" && Number.isFinite(state.duration) ? state.duration : null;
    const currentTime =
      typeof state.currentTime === "number" && Number.isFinite(state.currentTime) ? state.currentTime : 0;
    const progress =
      duration && duration > 0 ? Math.min(Math.max(currentTime / duration, 0), 1) : null;
    const isPlaying = !state.paused && (state.readyState || 0) >= 2;
    return {
      ...state,
      duration,
      currentTime,
      progress,
      isPlaying,
      updatedAgo: now - (state.updatedAt || now)
    };
  }

  buildMediaSnapshot(): MediaInfo[] {
    const now = Date.now();
    return this.mediaStateStore
      .list()
      .map((state) => this.buildMediaInfo(state, now))
      .sort((a, b) => {
        if (a.isPlaying !== b.isPlaying) {
          return a.isPlaying ? -1 : 1;
        }
        return (b.updatedAt || 0) - (a.updatedAt || 0);
      });
  }

  buildConnectionSnapshot() {
    return this.connectionPool.describe();
  }

  buildSnapshot(): DashboardSnapshot {
    return {
      generatedAt: Date.now(),
      items: this.buildMediaSnapshot(),
      connections: this.buildConnectionSnapshot(),
      endpoints: this.getEndpoints()
    };
  }
}
