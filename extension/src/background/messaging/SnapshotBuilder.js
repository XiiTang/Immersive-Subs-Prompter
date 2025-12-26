import { Logger } from "../../shared/Logger.js";

export class SnapshotBuilder {
  constructor({ mediaStateStore, connectionPool, getEndpoints, logger = new Logger("snapshot") }) {
    this.mediaStateStore = mediaStateStore;
    this.connectionPool = connectionPool;
    this.getEndpoints = getEndpoints;
    this.logger = logger;
  }

  buildMediaInfo(state, now = Date.now()) {
    const duration = typeof state.duration === "number" && Number.isFinite(state.duration) ? state.duration : null;
    const currentTime =
      typeof state.currentTime === "number" && Number.isFinite(state.currentTime) ? state.currentTime : null;
    const progress =
      duration && currentTime != null && duration > 0 ? Math.min(Math.max(currentTime / duration, 0), 1) : null;
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

  buildMediaSnapshot() {
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

  buildSnapshot() {
    return {
      generatedAt: Date.now(),
      items: this.buildMediaSnapshot(),
      connections: this.buildConnectionSnapshot(),
      endpoints: this.getEndpoints()
    };
  }
}
