import { Logger } from "../../shared/Logger";
import type { DashboardSnapshot, MediaInfo, MediaStateRecord } from "../../shared/types";
import type { DesktopConnectionPool } from "../desktop/DesktopConnectionPool";
import type { MediaStateStore } from "../tabs/MediaStateStore";
import { isMediaStatePlaying, projectMediaStateRecord, sortMediaStatesByPriority } from "../tabs/MediaStateSelectors";

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
    const projected = projectMediaStateRecord(state, now);
    const duration =
      typeof projected.duration === "number" && Number.isFinite(projected.duration) ? projected.duration : null;
    const currentTime =
      typeof projected.currentTime === "number" && Number.isFinite(projected.currentTime) ? projected.currentTime : 0;
    const progress =
      duration && duration > 0 ? Math.min(Math.max(currentTime / duration, 0), 1) : null;
    return {
      ...projected,
      duration,
      currentTime,
      progress,
      isPlaying: isMediaStatePlaying(projected),
      updatedAgo: now - (state.updatedAt || now)
    };
  }

  buildMediaSnapshot(): MediaInfo[] {
    const now = Date.now();
    return sortMediaStatesByPriority(this.mediaStateStore.list())
      .map((state) => this.buildMediaInfo(state, now));
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
