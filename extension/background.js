const WS_ENDPOINT = "ws://127.0.0.1:44501";
const RETRY_DELAY_MS = 2000;
const CONTENT_PORT = "usp-video-channel";
const DASHBOARD_PORT = "usp-dashboard";

class DesktopBridge {
  constructor(onDesktopMessage) {
    this.socket = null;
    this.retryTimer = null;
    this.pending = [];
    this.onDesktopMessage = onDesktopMessage;
    this.connect();
  }

  connect() {
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return;
    }
    clearTimeout(this.retryTimer);

    try {
      this.socket = new WebSocket(WS_ENDPOINT);
    } catch (err) {
      console.error("[USP] Failed to create WebSocket", err);
      this.scheduleReconnect();
      return;
    }

    this.socket.addEventListener("open", () => {
      console.info("[USP] Connected to desktop app");
      this.flushPending();
    });

    this.socket.addEventListener("close", () => {
      console.warn("[USP] Desktop app disconnected");
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
        this.onDesktopMessage?.(payload);
      } catch (err) {
        console.error("[USP] Failed to parse desktop message", err);
      }
    });

    this.socket.addEventListener("error", (err) => {
      console.error("[USP] WebSocket error", err);
      this.socket.close();
    });
  }

  scheduleReconnect() {
    clearTimeout(this.retryTimer);
    this.retryTimer = setTimeout(() => this.connect(), RETRY_DELAY_MS);
  }

  flushPending() {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
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

    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(data);
    } else {
      this.pending.push(data);
      this.connect();
    }
  }
}

const tabMetadata = new Map();
const tabPorts = new Map();
const mediaStates = new Map();
const dashboardPorts = new Set();

function buildMediaSnapshot() {
  const now = Date.now();
  return [...mediaStates.values()]
    .map((state) => {
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
    })
    .sort((a, b) => {
      if (a.isPlaying !== b.isPlaying) {
        return a.isPlaying ? -1 : 1;
      }
      return (b.updatedAt || 0) - (a.updatedAt || 0);
    });
}

function broadcastMediaSnapshot() {
  if (!dashboardPorts.size) return;
  const snapshot = {
    type: "media-state-snapshot",
    payload: {
      generatedAt: Date.now(),
      items: buildMediaSnapshot()
    }
  };
  dashboardPorts.forEach((port) => {
    try {
      port.postMessage(snapshot);
    } catch (err) {
      console.warn("[USP] Failed to reach dashboard port", err);
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
        items: buildMediaSnapshot()
      }
    });
  } catch (err) {
    console.error("[USP] Failed to send dashboard snapshot", err);
  }
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
  if (!mediaStates.has(tabId)) return;
  mediaStates.delete(tabId);
  broadcastMediaSnapshot();
}

function ingestMediaMessage(tabId, message) {
  if (!message || typeof message !== "object") return;
  const { type, payload } = message;
  if (!type) return;

  if (type === "video-context" || type === "time-update" || type === "playback-rate") {
    setMediaState(tabId, payload || {}, type);
  } else if (type === "page-url-changed" && mediaStates.has(tabId)) {
    setMediaState(tabId, payload || {}, type);
  } else if (type === "video-ended") {
    removeMediaState(tabId);
  }
}

function sendToContentScript(tabId, message) {
  const port = tabPorts.get(tabId);
  if (!port) {
    console.warn("[USP] No content script port for tab", tabId);
    return;
  }
  try {
    port.postMessage(message);
  } catch (err) {
    console.error("[USP] Failed to deliver message to tab", tabId, err);
  }
}

function handleDesktopMessage(message) {
  if (!message || typeof message !== "object") return;
  if (message.source !== "usp-desktop") return;

  if (message.type === "control-command" && typeof message.tabId === "number") {
    sendToContentScript(message.tabId, {
      type: "control",
      action: message.action,
      payload: message.payload || {}
    });
  }
}

const bridge = new DesktopBridge(handleDesktopMessage);

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
    console.warn("[USP] Ignoring port without tab id");
    return;
  }

  tabMetadata.set(tabId, { lastVideoUrl: null });
  tabPorts.set(tabId, port);

  port.onMessage.addListener((message) => {
    bridge.send({
      tabId,
      type: message.type,
      payload: message.payload
    });

    if (message.type === "video-context") {
      const tabInfo = tabMetadata.get(tabId) || {};
      tabInfo.lastVideoUrl = message.payload.pageUrl;
      tabMetadata.set(tabId, tabInfo);
    }

    ingestMediaMessage(tabId, message);
  });

  port.onDisconnect.addListener(() => {
    tabMetadata.delete(tabId);
    tabPorts.delete(tabId);
    removeMediaState(tabId);
    bridge.send({
      tabId,
      type: "video-ended",
      payload: {}
    });
  });
}

function handleDashboardPort(port) {
  dashboardPorts.add(port);
  sendSnapshotToPort(port);
  port.onDisconnect.addListener(() => {
    dashboardPorts.delete(port);
  });
}
