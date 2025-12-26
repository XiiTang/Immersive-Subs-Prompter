import { Logger } from "../../shared/Logger.js";

export class ContentMessageRouter {
  constructor({ logger = new Logger("content-router"), tabRegistry, mediaStateStore, connectionPool, snapshotBuilder }) {
    this.logger = logger;
    this.tabRegistry = tabRegistry;
    this.mediaStateStore = mediaStateStore;
    this.connectionPool = connectionPool;
    this.snapshotBuilder = snapshotBuilder;
  }

  handlePort(port) {
    const tabId = port.sender?.tab?.id;
    if (tabId === undefined) {
      this.logger.warn("conn", "Ignored: no tabId");
      return;
    }
    const frameId = typeof port.sender?.frameId === "number" ? port.sender.frameId : 0;

    this.logger.info("conn", `Tab${tabId} Connected`, { url: port.sender?.tab?.url, frameId });

    this.tabRegistry.registerPort(tabId, frameId, port);

    port.onMessage.addListener((message) => {
      this.handleMessage(tabId, frameId, message);
    });

    port.onDisconnect.addListener(() => {
      this.handleDisconnect(tabId, frameId);
    });
  }

  handleMessage(tabId, frameId, message) {
    this.ingestMediaMessage(tabId, frameId, message);

    if (!message || typeof message !== "object") return;

    if (message.type === "video-ended") {
      this.connectionPool.broadcast({
        tabId,
        type: "video-ended",
        payload: {}
      });
    } else if (message.type === "page-url-changed") {
      this.connectionPool.broadcast({
        tabId,
        type: "page-url-changed",
        payload: message.payload
      });
    } else if (this.mediaStateStore.has(tabId)) {
      const mediaInfo = this.snapshotBuilder.buildMediaInfo(this.mediaStateStore.get(tabId));
      this.logger.debug("fwd", `->Desktop Tab${tabId}:${message.type}`, {
        dur: mediaInfo.duration?.toFixed(1),
        time: mediaInfo.currentTime?.toFixed(1)
      });
      this.connectionPool.broadcast({
        tabId,
        type: message.type,
        payload: mediaInfo
      });
    }
  }

  handleDisconnect(tabId, frameId) {
    this.logger.info("conn", `Tab${tabId} Frame${frameId} Disconnected`);
    const { clearedPreferredFrame, tabRemoved } = this.tabRegistry.clearFrame(tabId, frameId);
    let stateRemoved = false;

    if (clearedPreferredFrame) {
      stateRemoved = this.mediaStateStore.removeState(tabId) || stateRemoved;
    }
    if (tabRemoved) {
      stateRemoved = this.mediaStateStore.removeState(tabId) || stateRemoved;
    }

    if (stateRemoved) {
      this.connectionPool.broadcast({
        tabId,
        type: "video-ended",
        payload: {}
      });
    }
  }

  ingestMediaMessage(tabId, frameId, message) {
    if (!message || typeof message !== "object") return;
    const { type, payload } = message;
    if (!type) return;

    this.logger.debug("msg", `Tab${tabId} ->${type}`);

    if (type === "video-context") {
      this.tabRegistry.rememberActiveFrame(tabId, frameId, payload?.pageUrl);
    }

    if (type === "video-context" || type === "time-update" || type === "playback-rate") {
      const isValid = this.mediaStateStore.isValidMedia(payload);
      if (isValid) {
        this.logger.info("media", `Tab${tabId} Update: ${type}`, { duration: payload.duration?.toFixed(1) });
        const patch = typeof frameId === "number" ? { ...(payload || {}), frameId } : payload || {};
        this.mediaStateStore.setState(tabId, patch, type);
      }
    } else if (type === "loop-started") {
      this.logger.info("loop", `Tab${tabId} Loop started`);
      this.connectionPool.broadcast({
        source: "usp-extension",
        type: "loop-started",
        tabId,
        payload: payload || {}
      });
    } else if (type === "loop-cleared") {
      this.logger.info("loop", `Tab${tabId} Loop cleared by user interaction`);
      this.connectionPool.broadcast({
        source: "usp-extension",
        type: "loop-cleared",
        tabId,
        payload: payload || {}
      });
    } else if (type === "page-url-changed" && this.mediaStateStore.has(tabId)) {
      this.logger.info("page", `Tab${tabId} URL changed`, { url: payload.pageUrl });
      this.mediaStateStore.setState(tabId, payload || {}, type);
    } else if (type === "video-ended") {
      this.logger.info("media", `Tab${tabId} Playback ended`);
      this.mediaStateStore.removeState(tabId);
    }
  }
}
