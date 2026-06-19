import { Logger } from "../../shared/Logger";
import type { ContentToBackgroundMessage } from "../../shared/types";
import type { DesktopConnectionPool } from "../desktop/DesktopConnectionPool";
import type { MediaStateStore } from "../tabs/MediaStateStore";
import type { TabRegistry } from "../tabs/TabRegistry";

type ContentMessageType = ContentToBackgroundMessage["type"];

const CONTENT_MESSAGE_TYPES = new Set<ContentMessageType>([
  "video-context",
  "time-update",
  "playback-rate",
  "page-url-changed",
  "video-ended",
  "loop-started",
  "loop-cleared"
]);

function isTopFrame(frameId: number): boolean {
  return frameId === 0;
}

function isContentToBackgroundMessage(message: unknown): message is ContentToBackgroundMessage {
  return (
    !!message &&
    typeof message === "object" &&
    CONTENT_MESSAGE_TYPES.has((message as { type?: unknown }).type as ContentMessageType)
  );
}

function isPlaybackSampleMessage(
  message: ContentToBackgroundMessage
): message is Extract<ContentToBackgroundMessage, { type: "video-context" | "time-update" | "playback-rate" }> {
  return message.type === "video-context" || message.type === "time-update" || message.type === "playback-rate";
}

export class ContentMessageRouter {
  logger: Logger;
  tabRegistry: TabRegistry;
  mediaStateStore: MediaStateStore;
  connectionPool: DesktopConnectionPool;

  constructor({
    logger = new Logger("content-router"),
    tabRegistry,
    mediaStateStore,
    connectionPool
  }: {
    logger?: Logger;
    tabRegistry: TabRegistry;
    mediaStateStore: MediaStateStore;
    connectionPool: DesktopConnectionPool;
  }) {
    this.logger = logger;
    this.tabRegistry = tabRegistry;
    this.mediaStateStore = mediaStateStore;
    this.connectionPool = connectionPool;
  }

  handlePort(port: chrome.runtime.Port) {
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

  handleMessage(tabId: number, frameId: number, message: unknown) {
    if (!isContentToBackgroundMessage(message)) {
      this.logger.warn("msg", `Ignored unknown content message type`, {
        type: message && typeof message === "object" ? (message as { type?: unknown }).type : undefined
      });
      return;
    }
    if (!isTopFrame(frameId)) {
      this.logger.debug("msg", `Ignored subframe content message`, { tabId, frameId, type: message.type });
      return;
    }

    const acceptedMediaSample = this.ingestMediaMessage(tabId, frameId, message);

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
    } else if (message.type === "loop-started" || message.type === "loop-cleared") {
      return;
    } else if (acceptedMediaSample && isPlaybackSampleMessage(message)) {
      this.logger.debug("fwd", `->Desktop Tab${tabId}:${message.type}`, {
        dur: message.payload.duration?.toFixed(1),
        time: message.payload.currentTime?.toFixed(1)
      });
      this.connectionPool.broadcast({
        tabId,
        type: message.type,
        payload: message.payload
      });
    }
  }

  handleDisconnect(tabId: number, frameId: number) {
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

  ingestMediaMessage(tabId: number, frameId: number, message: ContentToBackgroundMessage): boolean {
    const { type, payload } = message;

    this.logger.debug("msg", `Tab${tabId} ->${type}`);

    if (type === "video-context") {
      this.tabRegistry.rememberActiveFrame(tabId, frameId, payload?.pageUrl);
    }

    if (type === "video-context" || type === "time-update" || type === "playback-rate") {
      const isValid = this.mediaStateStore.isValidMedia(payload);
      if (isValid) {
        this.logger.info("media", `Tab${tabId} Update: ${type}`, { duration: payload.duration?.toFixed(1) });
        const patch = { ...payload, frameId };
        this.mediaStateStore.setState(tabId, patch, type);
        return true;
      }
    } else if (type === "loop-started") {
      this.logger.info("loop", `Tab${tabId} Loop started`);
      this.connectionPool.broadcast({
        type: "loop-started",
        tabId,
        payload
      });
    } else if (type === "loop-cleared") {
      this.logger.info("loop", `Tab${tabId} Loop cleared by user interaction`);
      this.connectionPool.broadcast({
        type: "loop-cleared",
        tabId,
        payload
      });
    } else if (type === "page-url-changed" && this.mediaStateStore.has(tabId)) {
      this.logger.info("page", `Tab${tabId} URL changed`, { url: payload.pageUrl });
      this.mediaStateStore.setState(tabId, payload, type);
    } else if (type === "video-ended") {
      this.logger.info("media", `Tab${tabId} Playback ended`);
      this.mediaStateStore.removeState(tabId);
    }
    return false;
  }
}
