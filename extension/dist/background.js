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

// src/background/desktop/DesktopConnection.js
var RETRY_DELAY_MS = 2e3;
var logger = new Logger("desktop-conn");
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
        logger.debug("ws", `->${payload.type}`, { source: payload.source, endpoint: this.endpoint });
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
    logger.debug("ws", `->${payload.type}`, { tabId: payload.tabId, endpoint: this.endpoint });
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

// src/background/desktop/DesktopConnectionPool.js
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

// src/background/desktop/DesktopMessageHandler.js
function createDesktopMessageHandler({ tabRegistry: tabRegistry2, logger: logger3 = new Logger("desktop-handler") }) {
  return function handleDesktopMessage(message, endpoint) {
    if (!message || typeof message !== "object") return;
    if (message.source !== "usp-desktop") return;
    if (message.type === "control-command" && typeof message.tabId === "number") {
      const frameId = tabRegistry2.getPreferredFrameId(message.tabId);
      logger3.info("ctrl", `Desktop command: ${message.action}`, { tabId: message.tabId, frameId, endpoint });
      const port = tabRegistry2.getPort(message.tabId, frameId);
      if (!port) {
        logger3.warn("msg", `Tab${message.tabId} No port`, { preferredFrameId: frameId });
        return;
      }
      try {
        logger3.debug("msg", `Tab${message.tabId} ->control`, { frameId });
        port.postMessage({
          type: "control",
          action: message.action,
          payload: message.payload || {}
        });
      } catch (err) {
        logger3.error("msg", `Tab${message.tabId} Send failed`, err);
      }
    }
  };
}

// src/background/tabs/TabRegistry.js
var TabRegistry = class {
  constructor({ logger: logger3 }) {
    this.logger = logger3;
    this.tabMetadata = /* @__PURE__ */ new Map();
    this.tabPorts = /* @__PURE__ */ new Map();
  }
  ensureTabInfo(tabId) {
    if (!this.tabMetadata.has(tabId)) {
      this.tabMetadata.set(tabId, { lastVideoUrl: null, lastFrameId: null });
    } else {
      const existing = this.tabMetadata.get(tabId);
      if (!Object.prototype.hasOwnProperty.call(existing, "lastVideoUrl")) {
        existing.lastVideoUrl = null;
      }
      if (!Object.prototype.hasOwnProperty.call(existing, "lastFrameId")) {
        existing.lastFrameId = null;
      }
    }
    return this.tabMetadata.get(tabId);
  }
  rememberActiveFrame(tabId, frameId, pageUrl) {
    if (typeof tabId !== "number") return;
    const info = this.ensureTabInfo(tabId);
    if (typeof frameId === "number") {
      info.lastFrameId = frameId;
    }
    if (pageUrl) {
      info.lastVideoUrl = pageUrl;
    }
    this.tabMetadata.set(tabId, info);
  }
  registerPort(tabId, frameId, port) {
    this.ensureTabInfo(tabId);
    const framePorts = this.tabPorts.get(tabId) || /* @__PURE__ */ new Map();
    framePorts.set(frameId, port);
    this.tabPorts.set(tabId, framePorts);
  }
  getPort(tabId, preferredFrameId) {
    const framePorts = this.tabPorts.get(tabId);
    if (!framePorts) {
      return null;
    }
    if (typeof preferredFrameId === "number" && framePorts.has(preferredFrameId)) {
      return framePorts.get(preferredFrameId);
    }
    const iterator = framePorts.values().next();
    return iterator.done ? null : iterator.value;
  }
  getPreferredFrameId(tabId) {
    return this.tabMetadata.get(tabId)?.lastFrameId ?? null;
  }
  clearFrame(tabId, frameId) {
    const frames = this.tabPorts.get(tabId);
    const tabInfo = this.tabMetadata.get(tabId);
    let clearedPreferredFrame = false;
    if (!frames) {
      if (tabInfo && tabInfo.lastFrameId === frameId) {
        tabInfo.lastFrameId = null;
        this.tabMetadata.set(tabId, tabInfo);
        clearedPreferredFrame = true;
      }
      this.tabMetadata.delete(tabId);
      return { removedFrame: false, clearedPreferredFrame, tabRemoved: true };
    }
    const removedFrame = frames.delete(frameId);
    if (tabInfo && tabInfo.lastFrameId === frameId) {
      tabInfo.lastFrameId = null;
      this.tabMetadata.set(tabId, tabInfo);
      clearedPreferredFrame = true;
    }
    let tabRemoved = false;
    if (frames && frames.size === 0) {
      this.tabPorts.delete(tabId);
      tabRemoved = true;
    }
    if (tabRemoved) {
      this.tabMetadata.delete(tabId);
    }
    return { removedFrame, clearedPreferredFrame, tabRemoved };
  }
};

// src/background/tabs/MediaStateStore.js
var MINIMUM_DURATION = 1e4;
var MediaStateStore = class {
  constructor({ logger: logger3 = new Logger("media-state"), minDuration = MINIMUM_DURATION, onChange } = {}) {
    this.logger = logger3;
    this.minDuration = minDuration;
    this.onChange = onChange;
    this.mediaStates = /* @__PURE__ */ new Map();
  }
  isValidMedia(payload) {
    if (!payload) return false;
    if (!payload.readyState) {
      this.logger.debug("filter", "Filtered: no readyState");
      return false;
    }
    const duration = typeof payload.duration === "number" && Number.isFinite(payload.duration) ? payload.duration : 0;
    if (duration <= this.minDuration) {
      this.logger.debug("filter", `Filtered: duration=${duration}s`);
      return false;
    }
    return true;
  }
  setState(tabId, patch = {}, lastEventType) {
    if (typeof tabId !== "number" || !patch || typeof patch !== "object") return null;
    const prev = this.mediaStates.get(tabId) || { tabId };
    const next = {
      ...prev,
      ...patch,
      tabId,
      lastEventType: lastEventType || patch.type || prev?.lastEventType,
      updatedAt: Date.now()
    };
    this.mediaStates.set(tabId, next);
    this.onChange?.(this.mediaStates);
    return next;
  }
  removeState(tabId) {
    if (!this.mediaStates.has(tabId)) return false;
    this.mediaStates.delete(tabId);
    this.onChange?.(this.mediaStates);
    return true;
  }
  has(tabId) {
    return this.mediaStates.has(tabId);
  }
  get(tabId) {
    return this.mediaStates.get(tabId);
  }
  list() {
    return [...this.mediaStates.values()];
  }
};

// src/background/endpoints/EndpointManager.js
var EndpointManager = class {
  constructor({ logger: logger3 = new Logger("endpoints"), storageKey, defaultEndpoints = [], onChange } = {}) {
    this.logger = logger3;
    this.storageKey = storageKey;
    this.defaultEndpoints = defaultEndpoints;
    this.onChange = onChange;
    this.endpoints = [...defaultEndpoints];
  }
  getEndpoints() {
    return [...this.endpoints];
  }
  async load() {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.get([this.storageKey], (result) => {
          if (chrome.runtime?.lastError) {
            this.logger.error("storage", "Failed to load server endpoints", chrome.runtime.lastError);
            resolve([...this.defaultEndpoints]);
            return;
          }
          const stored = normalizeEndpointList(result?.[this.storageKey]);
          const hasKey = result && Object.prototype.hasOwnProperty.call(result, this.storageKey);
          resolve(hasKey ? stored : stored.length ? stored : [...this.defaultEndpoints]);
        });
      } catch (error) {
        this.logger.error("storage", "Failed to load server endpoints", error);
        resolve([...this.defaultEndpoints]);
      }
    });
  }
  persist(endpoints) {
    try {
      chrome.storage.local.set({ [this.storageKey]: endpoints }, () => {
        if (chrome.runtime?.lastError) {
          this.logger.error("storage", "Failed to persist server endpoints", chrome.runtime.lastError);
        }
      });
    } catch (error) {
      this.logger.error("storage", "Failed to persist server endpoints", error);
    }
  }
  set(endpoints, { persist = true, fallbackToDefault = false } = {}) {
    const normalized = normalizeEndpointList(endpoints);
    this.endpoints = normalized.length || !fallbackToDefault ? normalized : [...this.defaultEndpoints];
    if (persist) {
      this.persist(this.endpoints);
    }
    this.onChange?.(this.endpoints);
    return this.getEndpoints();
  }
  add(endpoint) {
    if (typeof endpoint !== "string") return this.getEndpoints();
    return this.set([...this.endpoints, endpoint]);
  }
  remove(endpoint) {
    if (typeof endpoint !== "string") return this.getEndpoints();
    return this.set(this.endpoints.filter((item) => item !== endpoint));
  }
};

// src/background/messaging/SnapshotBuilder.js
var SnapshotBuilder = class {
  constructor({ mediaStateStore: mediaStateStore2, connectionPool: connectionPool2, getEndpoints, logger: logger3 = new Logger("snapshot") }) {
    this.mediaStateStore = mediaStateStore2;
    this.connectionPool = connectionPool2;
    this.getEndpoints = getEndpoints;
    this.logger = logger3;
  }
  buildMediaInfo(state, now = Date.now()) {
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
  buildMediaSnapshot() {
    const now = Date.now();
    return this.mediaStateStore.list().map((state) => this.buildMediaInfo(state, now)).sort((a, b) => {
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
};

// src/background/messaging/ContentMessageRouter.js
var ContentMessageRouter = class {
  constructor({ logger: logger3 = new Logger("content-router"), tabRegistry: tabRegistry2, mediaStateStore: mediaStateStore2, connectionPool: connectionPool2, snapshotBuilder: snapshotBuilder2 }) {
    this.logger = logger3;
    this.tabRegistry = tabRegistry2;
    this.mediaStateStore = mediaStateStore2;
    this.connectionPool = connectionPool2;
    this.snapshotBuilder = snapshotBuilder2;
  }
  handlePort(port) {
    const tabId = port.sender?.tab?.id;
    if (tabId === void 0) {
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
        const patch = typeof frameId === "number" ? { ...payload || {}, frameId } : payload || {};
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
};

// src/background/dashboard/DashboardBridge.js
var DashboardBridge = class {
  constructor({ snapshotBuilder: snapshotBuilder2, endpointManager: endpointManager2, logger: logger3 = new Logger("dashboard") }) {
    this.snapshotBuilder = snapshotBuilder2;
    this.endpointManager = endpointManager2;
    this.logger = logger3;
    this.dashboardPorts = /* @__PURE__ */ new Set();
  }
  handlePort(port) {
    this.logger.info("conn", `Dashboard Connected (total: ${this.dashboardPorts.size + 1})`);
    this.dashboardPorts.add(port);
    this.sendSnapshotToPort(port);
    port.onMessage.addListener((message) => this.handleMessage(port, message));
    port.onDisconnect.addListener(() => this.handleDisconnect(port));
  }
  handleMessage(port, message) {
    if (!message || typeof message !== "object") return;
    if (message.type === "server-endpoints:get") {
      this.sendSnapshotToPort(port);
    } else if (message.type === "server-endpoints:add" && typeof message.endpoint === "string") {
      this.endpointManager.add(message.endpoint);
    } else if (message.type === "server-endpoints:remove" && typeof message.endpoint === "string") {
      this.endpointManager.remove(message.endpoint);
    } else if (message.type === "server-endpoints:set" && Array.isArray(message.endpoints)) {
      this.endpointManager.set(message.endpoints);
    }
  }
  handleDisconnect(port) {
    this.logger.info("conn", `Dashboard Disconnected (total: ${this.dashboardPorts.size - 1})`);
    this.dashboardPorts.delete(port);
  }
  sendSnapshotToPort(port) {
    try {
      port.postMessage({
        type: "media-state-snapshot",
        payload: this.snapshotBuilder.buildSnapshot()
      });
    } catch (err) {
      this.logger.error("dashboard", "Failed to send dashboard snapshot", err);
    }
  }
  broadcastSnapshot() {
    if (!this.dashboardPorts.size) return;
    const snapshot = {
      type: "media-state-snapshot",
      payload: this.snapshotBuilder.buildSnapshot()
    };
    this.dashboardPorts.forEach((port) => {
      try {
        port.postMessage(snapshot);
      } catch (err) {
        this.logger.warn("dashboard", "Failed to reach dashboard port", err);
        this.dashboardPorts.delete(port);
      }
    });
  }
};

// src/background.js
var DEFAULT_ENDPOINTS = ["ws://127.0.0.1:44501"];
var logger2 = new Logger("background");
var tabRegistry = new TabRegistry({ logger: logger2 });
var mediaStateStore = new MediaStateStore({
  logger: logger2,
  onChange: () => broadcastMediaSnapshot()
});
var dashboardBridge = null;
function broadcastMediaSnapshot() {
  dashboardBridge?.broadcastSnapshot();
}
var desktopMessageHandler = createDesktopMessageHandler({ tabRegistry, logger: logger2 });
var connectionPool = new DesktopConnectionPool(
  (message, sourceEndpoint) => desktopMessageHandler(message, sourceEndpoint),
  () => broadcastMediaSnapshot()
);
var endpointManager = new EndpointManager({
  logger: logger2,
  storageKey: ENDPOINTS_STORAGE_KEY,
  defaultEndpoints: DEFAULT_ENDPOINTS,
  onChange: (endpoints) => {
    connectionPool.setEndpoints(endpoints);
    broadcastMediaSnapshot();
  }
});
var snapshotBuilder = new SnapshotBuilder({
  mediaStateStore,
  connectionPool,
  getEndpoints: () => endpointManager.getEndpoints(),
  logger: logger2
});
dashboardBridge = new DashboardBridge({
  logger: logger2,
  snapshotBuilder,
  endpointManager
});
var contentMessageRouter = new ContentMessageRouter({
  logger: logger2,
  tabRegistry,
  mediaStateStore,
  connectionPool,
  snapshotBuilder
});
endpointManager.load().then((endpoints) => {
  endpointManager.set(endpoints, { persist: false, fallbackToDefault: true });
});
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === CONTENT_PORT) {
    contentMessageRouter.handlePort(port);
  } else if (port.name === DASHBOARD_PORT) {
    dashboardBridge.handlePort(port);
  }
});
//# sourceMappingURL=background.js.map
