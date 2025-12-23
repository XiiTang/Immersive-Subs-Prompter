import { Logger } from "./shared/Logger.js";
const logger = new Logger("background");

const DEFAULT_ENDPOINTS = ["ws://127.0.0.1:44501"];
const ENDPOINTS_STORAGE_KEY = "uspServerEndpoints";
const RETRY_DELAY_MS = 2000;
const CONTENT_PORT = "usp-video-channel";
const DASHBOARD_PORT = "usp-dashboard";
// Minimum duration to consider a video as valid media (in milliseconds, was 10 seconds)
const MINIMUM_DURATION = 10000;

class DesktopConnection {
  constructor(endpoint, onDesktopMessage, onStatusChange) {
    this.endpoint = endpoint;
    this.onDesktopMessage = onDesktopMessage;
    this.onStatusChange = onStatusChange;
    this.socket = null;
    this.retryTimer = null;
    this.pending = [];
    this.stopped = false;
    this.state = "idle";
    this.lastError = null;
    this.lastChangeAt = Date.now();
  }

  getSnapshot() {
    return {
      endpoint: this.endpoint,
      state: this.state,
      lastError: this.lastError,
      lastChangeAt: this.lastChangeAt,
      pendingMessages: this.pending.length
    };
  }

  updateState(nextState, error = null) {
    if (this.state === nextState && this.lastError === error) {
      return;
    }
    this.state = nextState;
    this.lastError = error;
    this.lastChangeAt = Date.now();
    this.onStatusChange?.(this.getSnapshot());
  }

  connect() {
    if (this.stopped) return;
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return;
    }
    clearTimeout(this.retryTimer);
    this.updateState("connecting");

    try {
      logger.info("ws", "Connecting...", { endpoint: this.endpoint });
      this.socket = new WebSocket(this.endpoint);
    } catch (err) {
      logger.error("ws", "Failed to create connection", { endpoint: this.endpoint, err });
      this.updateState("disconnected", err?.message || String(err));
      this.scheduleReconnect();
      return;
    }

    this.socket.addEventListener("open", () => {
      this.updateState("connected");
      this.flushPending();
    });

    this.socket.addEventListener("close", () => {
      logger.warn("ws", "Disconnected", { endpoint: this.endpoint });
      this.updateState("disconnected");
      this.scheduleReconnect();
    });

    this.socket.addEventListener("message", (event) => {
      try {
        const raw =
          typeof event.data === "string"
            ? event.data
            : event.data
            ? new TextDecoder().decode(event.data)
            : "";
        if (!raw) return;
        const payload = JSON.parse(raw);

        if (payload.type === "heartbeat") {
          this.send({ type: "heartbeat-ack" });
          logger.debug("ws", "Received heartbeat, sent ACK", { endpoint: this.endpoint });
          return;
        }

        logger.debug("ws", `← ${payload.type}`, { source: payload.source, endpoint: this.endpoint });
        this.onDesktopMessage?.(payload, this.endpoint);
      } catch (err) {
        logger.error("ws", "Failed to parse message", err);
      }
    });

    this.socket.addEventListener("error", (err) => {
      logger.error("ws", "WebSocket error", err);
      this.updateState("disconnected", err?.message || String(err));
      this.socket?.close();
    });
  }

  scheduleReconnect() {
    if (this.stopped) return;
    clearTimeout(this.retryTimer);
    logger.info("ws", `Reconnecting... ${RETRY_DELAY_MS}ms`, { endpoint: this.endpoint });
    this.retryTimer = setTimeout(() => this.connect(), RETRY_DELAY_MS);
  }

  flushPending() {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
    if (this.pending.length > 0) {
      logger.info("ws", `Sending queue: ${this.pending.length} messages`, { endpoint: this.endpoint });
    }
    while (this.pending.length) {
      this.socket.send(this.pending.shift());
    }
  }

  send(payload) {
    const data = JSON.stringify({
      source: "usp-extension",
      ...payload,
      sentAt: Date.now()
    });

    logger.debug("ws", `→ ${payload.type}`, { tabId: payload.tabId, endpoint: this.endpoint });

    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(data);
    } else {
      this.pending.push(data);
      this.connect();
    }
  }

  destroy() {
    this.stopped = true;
    clearTimeout(this.retryTimer);
    if (this.socket) {
      try {
        this.socket.close();
      } catch (err) {
        logger.warn("ws", "Failed to close socket cleanly", { endpoint: this.endpoint, err });
      }
    }
    this.socket = null;
    this.pending = [];
    this.updateState("idle");
  }
}

class DesktopConnectionPool {
  constructor(onDesktopMessage, onStatusChange) {
    this.onDesktopMessage = onDesktopMessage;
    this.onStatusChange = onStatusChange;
    this.connections = new Map();
  }

  setEndpoints(endpoints) {
    const normalized = normalizeEndpointList(endpoints);
    const nextSet = new Set(normalized);

    for (const [endpoint, conn] of this.connections.entries()) {
      if (!nextSet.has(endpoint)) {
        conn.destroy();
        this.connections.delete(endpoint);
      }
    }

    normalized.forEach((endpoint) => {
      if (this.connections.has(endpoint)) {
        return;
      }
      const conn = new DesktopConnection(
        endpoint,
        (message, sourceEndpoint) => this.onDesktopMessage?.(message, sourceEndpoint),
        () => this.onStatusChange?.(this.describe())
      );
      this.connections.set(endpoint, conn);
      conn.connect();
    });

    this.onStatusChange?.(this.describe());
  }

  broadcast(payload) {
    for (const connection of this.connections.values()) {
      connection.send(payload);
    }
  }

  describe() {
    return Array.from(this.connections.values()).map((conn) => conn.getSnapshot());
  }
}

function normalizeEndpoint(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!/^wss?:\/\//i.test(trimmed)) {
    if (/^[a-z0-9.-]+(:\d+)?$/i.test(trimmed)) {
      return `ws://${trimmed}`;
    }
    return null;
  }
  return trimmed;
}

function normalizeEndpointList(list) {
  const endpoints = [];
  const seen = new Set();
  (Array.isArray(list) ? list : []).forEach((entry) => {
    const normalized = normalizeEndpoint(entry);
    if (!normalized || seen.has(normalized)) {
      return;
    }
    seen.add(normalized);
    endpoints.push(normalized);
  });
  return endpoints;
}

let serverEndpoints = [...DEFAULT_ENDPOINTS];
const connectionPool = new DesktopConnectionPool(handleDesktopMessage, handleConnectionStatusChange);

function handleConnectionStatusChange() {
  broadcastMediaSnapshot();
}

function loadServerEndpoints() {
  return new Promise((resolve) => {
    try {
      chrome.storage.local.get([ENDPOINTS_STORAGE_KEY], (result) => {
        if (chrome.runtime?.lastError) {
          logger.error("storage", "Failed to load server endpoints", chrome.runtime.lastError);
          resolve([...DEFAULT_ENDPOINTS]);
          return;
        }
        const stored = normalizeEndpointList(result?.[ENDPOINTS_STORAGE_KEY]);
        const hasKey = result && Object.prototype.hasOwnProperty.call(result, ENDPOINTS_STORAGE_KEY);
        resolve(hasKey ? stored : stored.length ? stored : [...DEFAULT_ENDPOINTS]);
      });
    } catch (error) {
      logger.error("storage", "Failed to load server endpoints", error);
      resolve([...DEFAULT_ENDPOINTS]);
    }
  });
}

function persistServerEndpoints(endpoints) {
  try {
    chrome.storage.local.set({ [ENDPOINTS_STORAGE_KEY]: endpoints }, () => {
      if (chrome.runtime?.lastError) {
        logger.error("storage", "Failed to persist server endpoints", chrome.runtime.lastError);
      }
    });
  } catch (error) {
    logger.error("storage", "Failed to persist server endpoints", error);
  }
}

function setServerEndpoints(endpoints, { persist = true, fallbackToDefault = false } = {}) {
  serverEndpoints = normalizeEndpointList(endpoints);
  if (!serverEndpoints.length && fallbackToDefault) {
    serverEndpoints = [...DEFAULT_ENDPOINTS];
  }
  connectionPool.setEndpoints(serverEndpoints);
  if (persist) {
    persistServerEndpoints(serverEndpoints);
  }
  broadcastMediaSnapshot();
}

const tabMetadata = new Map();
// tabId -> Map<frameId, chrome.runtime.Port>
const tabPorts = new Map();
const mediaStates = new Map();
const dashboardPorts = new Set();

loadServerEndpoints().then((endpoints) => setServerEndpoints(endpoints, { persist: false, fallbackToDefault: true }));

function buildMediaSnapshot() {
  const now = Date.now();
  // mediaStates now only contains valid media (duration > MINIMUM_DURATION)
  // so we don't need to filter again here
  return [...mediaStates.values()]
    .map((state) => buildMediaInfo(state, now))
    .sort((a, b) => {
      if (a.isPlaying !== b.isPlaying) {
        return a.isPlaying ? -1 : 1;
      }
      return (b.updatedAt || 0) - (a.updatedAt || 0);
    });
}

function buildConnectionSnapshot() {
  return connectionPool.describe();
}

// Build consistent media info for both desktop-app and dashboard
function buildMediaInfo(state, now = Date.now()) {
  const duration = typeof state.duration === "number" && Number.isFinite(state.duration) ? state.duration : null;
  const currentTime = typeof state.currentTime === "number" && Number.isFinite(state.currentTime) ? state.currentTime : null;
  const progress = duration && currentTime != null && duration > 0 ? Math.min(Math.max(currentTime / duration, 0), 1) : null;
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

function broadcastMediaSnapshot() {
  if (!dashboardPorts.size) return;
  const snapshot = {
    type: "media-state-snapshot",
    payload: {
      generatedAt: Date.now(),
      items: buildMediaSnapshot(),
      connections: buildConnectionSnapshot(),
      endpoints: serverEndpoints
    }
  };
  dashboardPorts.forEach((port) => {
    try {
      port.postMessage(snapshot);
    } catch (err) {
    logger.warn('dashboard', 'Failed to reach dashboard port', err);
      dashboardPorts.delete(port);
    }
  });
}

function sendSnapshotToPort(port) {
  try {
    port.postMessage({
      type: "media-state-snapshot",
      payload: {
        generatedAt: Date.now(),
        items: buildMediaSnapshot(),
        connections: buildConnectionSnapshot(),
        endpoints: serverEndpoints
      }
    });
  } catch (err) {
    logger.error('dashboard', 'Failed to send dashboard snapshot', err);
  }
}

function ensureTabInfo(tabId) {
  if (!tabMetadata.has(tabId)) {
    tabMetadata.set(tabId, { lastVideoUrl: null, lastFrameId: null });
  } else {
    const existing = tabMetadata.get(tabId);
    if (!Object.prototype.hasOwnProperty.call(existing, "lastVideoUrl")) {
      existing.lastVideoUrl = null;
    }
    if (!Object.prototype.hasOwnProperty.call(existing, "lastFrameId")) {
      existing.lastFrameId = null;
    }
  }
  return tabMetadata.get(tabId);
}

function rememberActiveFrame(tabId, frameId, pageUrl) {
  if (typeof tabId !== "number") return;
  const info = ensureTabInfo(tabId);
  if (typeof frameId === "number") {
    info.lastFrameId = frameId;
  }
  if (pageUrl) {
    info.lastVideoUrl = pageUrl;
  }
  tabMetadata.set(tabId, info);
}

function getPortForTab(tabId, preferredFrameId) {
  const framePorts = tabPorts.get(tabId);
  if (!framePorts) {
    return null;
  }
  if (typeof preferredFrameId === "number" && framePorts.has(preferredFrameId)) {
    return framePorts.get(preferredFrameId);
  }
  const iterator = framePorts.values().next();
  return iterator.done ? null : iterator.value;
}

function setMediaState(tabId, patch = {}, lastEventType) {
  if (typeof tabId !== "number" || !patch || typeof patch !== "object") return;
  const prev = mediaStates.get(tabId) || { tabId };
  const next = {
    ...prev,
    ...patch,
    tabId,
    lastEventType: lastEventType || patch.type || prev.lastEventType,
    updatedAt: Date.now()
  };
  mediaStates.set(tabId, next);
  broadcastMediaSnapshot();
}

function removeMediaState(tabId) {
  if (!mediaStates.has(tabId)) return false;
  mediaStates.delete(tabId);
  broadcastMediaSnapshot();
  return true;
}

// Check if media is valid (mirrors GlobalSpeed's filtering logic)
// Used for both desktop-app forwarding and mediaStates storage
function isValidMedia(payload) {
  if (!payload) return false;
  
  // Must have readyState and duration > MINIMUM_DURATION
  if (!payload.readyState) {
    logger.debug('filter', 'Filtered: no readyState');
    return false;
  }
  const duration = typeof payload.duration === "number" && Number.isFinite(payload.duration) ? payload.duration : 0;
  if (duration <= MINIMUM_DURATION) {
    logger.debug('filter', `Filtered: duration=${duration}s`);
    return false;
  }
  
  return true;
}

function ingestMediaMessage(tabId, frameId, message) {
  if (!message || typeof message !== "object") return;
  const { type, payload } = message;
  if (!type) return;

  logger.debug('msg', `Tab${tabId} ← ${type}`);

  if (type === "video-context") {
    rememberActiveFrame(tabId, frameId, payload?.pageUrl);
  }

  if (type === "video-context" || type === "time-update" || type === "playback-rate") {
    // Only store valid media in mediaStates (duration > MINIMUM_DURATION)
    const isValid = isValidMedia(payload);
    if (isValid) {
      logger.info('media', `Tab${tabId} Update: ${type}`, { duration: payload.duration?.toFixed(1) });
      const patch =
        typeof frameId === "number" ? { ...(payload || {}), frameId } : payload || {};
      setMediaState(tabId, patch, type);
    }
  } else if (type === "loop-started") {
    // Forward loop-started message to desktop-app
    logger.info('loop', `Tab${tabId} Loop started`);
    connectionPool.broadcast({
      source: "usp-extension",
      type: "loop-started",
      tabId,
      payload: payload || {}
    });
  } else if (type === "loop-cleared") {
    // Forward loop-cleared message to desktop-app
    logger.info('loop', `Tab${tabId} Loop cleared by user interaction`);
    connectionPool.broadcast({
      source: "usp-extension",
      type: "loop-cleared",
      tabId,
      payload: payload || {}
    });
  } else if (type === "page-url-changed" && mediaStates.has(tabId)) {
    logger.info('page', `Tab${tabId} URL changed`, { url: payload.pageUrl });
    setMediaState(tabId, payload || {}, type);
  } else if (type === "video-ended") {
    logger.info('media', `Tab${tabId} Playback ended`);
    removeMediaState(tabId);
  }
}

function sendToContentScript(tabId, message) {
  const preferredFrameId = tabMetadata.get(tabId)?.lastFrameId;
  const port = getPortForTab(tabId, preferredFrameId);
  if (!port) {
    logger.warn('msg', `Tab${tabId} No port`, { preferredFrameId });
    return;
  }
  try {
    logger.debug('msg', `Tab${tabId} → ${message.type}`, { frameId: preferredFrameId });
    port.postMessage(message);
  } catch (err) {
    logger.error('msg', `Tab${tabId} Send failed`, err);
  }
}

function handleDesktopMessage(message, endpoint) {
  if (!message || typeof message !== "object") return;
  if (message.source !== "usp-desktop") return;

  if (message.type === "control-command" && typeof message.tabId === "number") {
    const frameId = tabMetadata.get(message.tabId)?.lastFrameId ?? null;
    logger.info('ctrl', `Desktop command: ${message.action}`, { tabId: message.tabId, frameId, endpoint });
    sendToContentScript(message.tabId, {
      type: "control",
      action: message.action,
      payload: message.payload || {}
    });
  }
}

chrome.runtime.onConnect.addListener((port) => {
  if (port.name === CONTENT_PORT) {
    handleContentPort(port);
  } else if (port.name === DASHBOARD_PORT) {
    handleDashboardPort(port);
  }
});

function handleContentPort(port) {
  const tabId = port.sender?.tab?.id;
  if (tabId === undefined) {
    logger.warn('conn', 'Ignored: no tabId');
    return;
  }
  const frameId = typeof port.sender?.frameId === "number" ? port.sender.frameId : 0;

  logger.info('conn', `Tab${tabId} Connected`, { url: port.sender?.tab?.url, frameId });

  ensureTabInfo(tabId);
  const framePorts = tabPorts.get(tabId) || new Map();
  framePorts.set(frameId, port);
  tabPorts.set(tabId, framePorts);

  port.onMessage.addListener((message) => {
    // Store and filter media state
    ingestMediaMessage(tabId, frameId, message);
    
    // Forward to desktop-app with consistent data format
    if (message.type === "video-ended") {
      connectionPool.broadcast({
        tabId,
        type: "video-ended",
        payload: {}
      });
    } else if (message.type === "page-url-changed") {
      connectionPool.broadcast({
        tabId,
        type: "page-url-changed",
        payload: message.payload
      });
    } else if (mediaStates.has(tabId)) {
      // Use buildMediaInfo to ensure consistent data format
      const mediaInfo = buildMediaInfo(mediaStates.get(tabId));
      logger.debug('fwd', `→Desktop Tab${tabId}:${message.type}`, { 
        dur: mediaInfo.duration?.toFixed(1),
        time: mediaInfo.currentTime?.toFixed(1)
      });
      connectionPool.broadcast({
        tabId,
        type: message.type,
        payload: mediaInfo
      });
    }
  });

  port.onDisconnect.addListener(() => {
    logger.info('conn', `Tab${tabId} Frame${frameId} Disconnected`);
    const frames = tabPorts.get(tabId);
    if (frames) {
      frames.delete(frameId);
      if (!frames.size) {
        tabPorts.delete(tabId);
      }
    }

    let stateRemoved = false;
    const tabInfo = tabMetadata.get(tabId);
    if (tabInfo && tabInfo.lastFrameId === frameId) {
      tabInfo.lastFrameId = null;
      tabMetadata.set(tabId, tabInfo);
      stateRemoved = removeMediaState(tabId) || stateRemoved;
    }
    if (!tabPorts.has(tabId)) {
      tabMetadata.delete(tabId);
      stateRemoved = removeMediaState(tabId) || stateRemoved;
    }

    if (stateRemoved) {
      connectionPool.broadcast({
        tabId,
        type: "video-ended",
        payload: {}
      });
    }
  });
}

function handleDashboardPort(port) {
  logger.info('conn', `Dashboard Connected (total: ${dashboardPorts.size + 1})`);
  dashboardPorts.add(port);
  sendSnapshotToPort(port);
  port.onMessage.addListener((message) => {
    if (!message || typeof message !== "object") return;
    if (message.type === "server-endpoints:get") {
      sendSnapshotToPort(port);
    } else if (message.type === "server-endpoints:add" && typeof message.endpoint === "string") {
      setServerEndpoints([...serverEndpoints, message.endpoint]);
    } else if (message.type === "server-endpoints:remove" && typeof message.endpoint === "string") {
      setServerEndpoints(serverEndpoints.filter((endpoint) => endpoint !== message.endpoint));
    } else if (message.type === "server-endpoints:set" && Array.isArray(message.endpoints)) {
      setServerEndpoints(message.endpoints);
    }
  });
  port.onDisconnect.addListener(() => {
    logger.info('conn', `Dashboard Disconnected (total: ${dashboardPorts.size - 1})`);
    dashboardPorts.delete(port);
  });
}
