// src/shared/Logger.js
var LOG_PREFIX = "[USP]";
var LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3
};
var Logger = class {
  constructor(context, minLevel = LOG_LEVELS.DEBUG) {
    this.context = context;
    this.minLevel = minLevel;
    this.enabledCategories = /* @__PURE__ */ new Set([
      "ws",
      // WebSocket communication
      "msg",
      // Message passing
      "conn",
      // Connection management
      "ctrl",
      // Control commands
      "video",
      // Video detection/state
      "media",
      // Media state updates
      "loop",
      // Loop control
      "page",
      // Page navigation
      "fwd",
      // Message forwarding
      "blacklist",
      // Blacklist filtering
      "site",
      // Site detection
      "event",
      // DOM events
      "shadow",
      // Shadow DOM
      "drift",
      // Playback drift
      "filter",
      // Media filtering
      "dashboard"
      // Dashboard port
    ]);
  }
  _shouldLog(level, category) {
    if (level < this.minLevel) return false;
    if (category && !this.enabledCategories.has(category)) return false;
    return true;
  }
  _formatMessage(level, category, message, data) {
    const timestamp = (/* @__PURE__ */ new Date()).toISOString().split("T")[1].slice(0, -1);
    const levelStr = Object.keys(LOG_LEVELS).find((k) => LOG_LEVELS[k] === level) || "LOG";
    const categoryStr = category ? `[${category}]` : "";
    const contextStr = `[${this.context}]`;
    return {
      prefix: `${LOG_PREFIX} ${timestamp} ${contextStr}${categoryStr} ${levelStr}:`,
      message,
      data
    };
  }
  _log(level, category, message, data) {
    if (!this._shouldLog(level, category)) return;
    const formatted = this._formatMessage(level, category, message, data);
    const consoleMethod = level === LOG_LEVELS.ERROR ? "error" : level === LOG_LEVELS.WARN ? "warn" : level === LOG_LEVELS.INFO ? "info" : "log";
    if (data !== void 0) {
      console[consoleMethod](formatted.prefix, formatted.message, data);
    } else {
      console[consoleMethod](formatted.prefix, formatted.message);
    }
  }
  debug(category, message, data) {
    this._log(LOG_LEVELS.DEBUG, category, message, data);
  }
  info(category, message, data) {
    this._log(LOG_LEVELS.INFO, category, message, data);
  }
  warn(category, message, data) {
    this._log(LOG_LEVELS.WARN, category, message, data);
  }
  error(category, message, data) {
    this._log(LOG_LEVELS.ERROR, category, message, data);
  }
  videoDetected(video, details) {
    this.info("video-detection", "Video element detected", {
      src: video.currentSrc || video.src || "(no src)",
      readyState: video.readyState,
      duration: video.duration,
      paused: video.paused,
      ...details
    });
  }
  videoActivated(video, reason) {
    this.info("video-detection", `Video activated: ${reason}`, {
      src: video.currentSrc || video.src,
      currentTime: video.currentTime,
      duration: video.duration
    });
  }
  videoStateChange(eventType, state) {
    this.debug("media-state", `Video state changed: ${eventType}`, state);
  }
  messageSent(type, payload, target) {
    this.debug("message-transmission", `Message sent: ${type} -> ${target}`, payload);
  }
  messageReceived(type, payload, source) {
    this.debug("message-transmission", `Message received: ${type} <- ${source}`, payload);
  }
  messageDeliveryFailed(type, error, target) {
    this.error("message-transmission", `Message delivery failed: ${type} -> ${target}`, error);
  }
  desktopConnected() {
    this.info("desktop-communication", "Connected to desktop-app");
  }
  desktopDisconnected() {
    this.warn("desktop-communication", "desktop-app connection closed");
  }
  desktopMessageSent(data) {
    this.debug("desktop-communication", "Sending data to desktop-app", {
      type: data.type,
      tabId: data.tabId,
      payloadKeys: data.payload ? Object.keys(data.payload) : []
    });
  }
  desktopMessageReceived(data) {
    this.debug("desktop-communication", "Receiving data from desktop-app", {
      type: data.type,
      source: data.source
    });
  }
  portConnected(portName, details) {
    this.info("connection", `Port connected: ${portName}`, details);
  }
  portDisconnected(portName, details) {
    this.info("connection", `Port disconnected: ${portName}`, details);
  }
  reconnecting(target, delay) {
    this.info("connection", `Reconnecting: ${target}`, { delayMs: delay });
  }
  controlCommandReceived(action, payload) {
    this.info("control", `Control command received: ${action}`, payload);
  }
  controlCommandExecuted(action, success, details) {
    if (success) {
      this.info("control", `Control command executed successfully: ${action}`, details);
    } else {
      this.warn("control", `Control command execution failed: ${action}`, details);
    }
  }
  mediaFiltered(reason, payload) {
    this.debug("media-state", `Media filtered: ${reason}`, {
      duration: payload?.duration,
      readyState: payload?.readyState
    });
  }
  mediaStateUpdated(tabId, eventType, isValid) {
    this.debug("media-state", `Media state updated: Tab ${tabId}, Event: ${eventType}, Valid: ${isValid}`);
  }
  logError(category, message, error) {
    this.error(category, message, {
      error: error.message || error,
      stack: error.stack
    });
  }
  enableCategory(category) {
    this.enabledCategories.add(category);
  }
  disableCategory(category) {
    this.enabledCategories.delete(category);
  }
  setLevel(level) {
    if (typeof level === "string") {
      this.minLevel = LOG_LEVELS[level.toUpperCase()] || LOG_LEVELS.DEBUG;
    } else {
      this.minLevel = level;
    }
  }
};

// src/shared/constants.js
var ENDPOINTS_STORAGE_KEY = "uspServerEndpoints";
var CONTENT_PORT = "usp-video-channel";
var DASHBOARD_PORT = "usp-dashboard";

// src/shared/endpoint-utils.js
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
  const seen = /* @__PURE__ */ new Set();
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

// src/background.js
var logger = new Logger("background");
var DEFAULT_ENDPOINTS = ["ws://127.0.0.1:44501"];
var RETRY_DELAY_MS = 2e3;
var MINIMUM_DURATION = 1e4;
var DesktopConnection = class {
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
        const raw = typeof event.data === "string" ? event.data : event.data ? new TextDecoder().decode(event.data) : "";
        if (!raw) return;
        const payload = JSON.parse(raw);
        if (payload.type === "heartbeat") {
          this.send({ type: "heartbeat-ack" });
          logger.debug("ws", "Received heartbeat, sent ACK", { endpoint: this.endpoint });
          return;
        }
        logger.debug("ws", `\u2190 ${payload.type}`, { source: payload.source, endpoint: this.endpoint });
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
    logger.debug("ws", `\u2192 ${payload.type}`, { tabId: payload.tabId, endpoint: this.endpoint });
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
};
var DesktopConnectionPool = class {
  constructor(onDesktopMessage, onStatusChange) {
    this.onDesktopMessage = onDesktopMessage;
    this.onStatusChange = onStatusChange;
    this.connections = /* @__PURE__ */ new Map();
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
};
var serverEndpoints = [...DEFAULT_ENDPOINTS];
var connectionPool = new DesktopConnectionPool(handleDesktopMessage, handleConnectionStatusChange);
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
var tabMetadata = /* @__PURE__ */ new Map();
var tabPorts = /* @__PURE__ */ new Map();
var mediaStates = /* @__PURE__ */ new Map();
var dashboardPorts = /* @__PURE__ */ new Set();
loadServerEndpoints().then((endpoints) => setServerEndpoints(endpoints, { persist: false, fallbackToDefault: true }));
function buildMediaSnapshot() {
  const now = Date.now();
  return [...mediaStates.values()].map((state) => buildMediaInfo(state, now)).sort((a, b) => {
    if (a.isPlaying !== b.isPlaying) {
      return a.isPlaying ? -1 : 1;
    }
    return (b.updatedAt || 0) - (a.updatedAt || 0);
  });
}
function buildConnectionSnapshot() {
  return connectionPool.describe();
}
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
      logger.warn("dashboard", "Failed to reach dashboard port", err);
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
    logger.error("dashboard", "Failed to send dashboard snapshot", err);
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
function isValidMedia(payload) {
  if (!payload) return false;
  if (!payload.readyState) {
    logger.debug("filter", "Filtered: no readyState");
    return false;
  }
  const duration = typeof payload.duration === "number" && Number.isFinite(payload.duration) ? payload.duration : 0;
  if (duration <= MINIMUM_DURATION) {
    logger.debug("filter", `Filtered: duration=${duration}s`);
    return false;
  }
  return true;
}
function ingestMediaMessage(tabId, frameId, message) {
  if (!message || typeof message !== "object") return;
  const { type, payload } = message;
  if (!type) return;
  logger.debug("msg", `Tab${tabId} \u2190 ${type}`);
  if (type === "video-context") {
    rememberActiveFrame(tabId, frameId, payload?.pageUrl);
  }
  if (type === "video-context" || type === "time-update" || type === "playback-rate") {
    const isValid = isValidMedia(payload);
    if (isValid) {
      logger.info("media", `Tab${tabId} Update: ${type}`, { duration: payload.duration?.toFixed(1) });
      const patch = typeof frameId === "number" ? { ...payload || {}, frameId } : payload || {};
      setMediaState(tabId, patch, type);
    }
  } else if (type === "loop-started") {
    logger.info("loop", `Tab${tabId} Loop started`);
    connectionPool.broadcast({
      source: "usp-extension",
      type: "loop-started",
      tabId,
      payload: payload || {}
    });
  } else if (type === "loop-cleared") {
    logger.info("loop", `Tab${tabId} Loop cleared by user interaction`);
    connectionPool.broadcast({
      source: "usp-extension",
      type: "loop-cleared",
      tabId,
      payload: payload || {}
    });
  } else if (type === "page-url-changed" && mediaStates.has(tabId)) {
    logger.info("page", `Tab${tabId} URL changed`, { url: payload.pageUrl });
    setMediaState(tabId, payload || {}, type);
  } else if (type === "video-ended") {
    logger.info("media", `Tab${tabId} Playback ended`);
    removeMediaState(tabId);
  }
}
function sendToContentScript(tabId, message) {
  const preferredFrameId = tabMetadata.get(tabId)?.lastFrameId;
  const port = getPortForTab(tabId, preferredFrameId);
  if (!port) {
    logger.warn("msg", `Tab${tabId} No port`, { preferredFrameId });
    return;
  }
  try {
    logger.debug("msg", `Tab${tabId} \u2192 ${message.type}`, { frameId: preferredFrameId });
    port.postMessage(message);
  } catch (err) {
    logger.error("msg", `Tab${tabId} Send failed`, err);
  }
}
function handleDesktopMessage(message, endpoint) {
  if (!message || typeof message !== "object") return;
  if (message.source !== "usp-desktop") return;
  if (message.type === "control-command" && typeof message.tabId === "number") {
    const frameId = tabMetadata.get(message.tabId)?.lastFrameId ?? null;
    logger.info("ctrl", `Desktop command: ${message.action}`, { tabId: message.tabId, frameId, endpoint });
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
  if (tabId === void 0) {
    logger.warn("conn", "Ignored: no tabId");
    return;
  }
  const frameId = typeof port.sender?.frameId === "number" ? port.sender.frameId : 0;
  logger.info("conn", `Tab${tabId} Connected`, { url: port.sender?.tab?.url, frameId });
  ensureTabInfo(tabId);
  const framePorts = tabPorts.get(tabId) || /* @__PURE__ */ new Map();
  framePorts.set(frameId, port);
  tabPorts.set(tabId, framePorts);
  port.onMessage.addListener((message) => {
    ingestMediaMessage(tabId, frameId, message);
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
      const mediaInfo = buildMediaInfo(mediaStates.get(tabId));
      logger.debug("fwd", `\u2192Desktop Tab${tabId}:${message.type}`, {
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
    logger.info("conn", `Tab${tabId} Frame${frameId} Disconnected`);
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
  logger.info("conn", `Dashboard Connected (total: ${dashboardPorts.size + 1})`);
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
    logger.info("conn", `Dashboard Disconnected (total: ${dashboardPorts.size - 1})`);
    dashboardPorts.delete(port);
  });
}
//# sourceMappingURL=background.js.map
