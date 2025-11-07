// Simplified logging function
const log = (() => {
  const PREFIX = "[USP][bg]";
  const fmt = (cat, msg) => {
    const time = new Date().toISOString().split('T')[1].slice(0, -1);
    return `${PREFIX}[${cat}] ${time} ${msg}`;
  };
  return {
    debug: (cat, msg, data) => console.log(fmt(cat, msg), data),
    info: (cat, msg, data) => console.info(fmt(cat, msg), data),
    warn: (cat, msg, data) => console.warn(fmt(cat, msg), data),
    error: (cat, msg, err) => console.error(fmt(cat, msg), err)
  };
})();

const WS_ENDPOINT = "ws://127.0.0.1:44501";
const RETRY_DELAY_MS = 2000;
const CONTENT_PORT = "usp-video-channel";
const DASHBOARD_PORT = "usp-dashboard";
// Minimum duration to consider a video as valid media (mirrors GlobalSpeed's MINIMUM_DURATION)
const MINIMUM_DURATION = 10;
const KEEPALIVE_ALARM_NAME = "usp-keepalive";
const KEEPALIVE_INTERVAL_SECONDS = 25;
const KEEPALIVE_PERIOD_MINUTES = KEEPALIVE_INTERVAL_SECONDS / 60;

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
      log.info('ws', 'Connecting...', { endpoint: WS_ENDPOINT });
      this.socket = new WebSocket(WS_ENDPOINT);
    } catch (err) {
      log.error('ws', 'Failed to create connection', err);
      this.scheduleReconnect();
      return;
    }

    this.socket.addEventListener("open", () => {
      log.info('ws', 'Connected');
      this.flushPending();
    });

    this.socket.addEventListener("close", () => {
      log.warn('ws', 'Disconnected');
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
        log.debug('ws', `← ${payload.type}`, { source: payload.source });
        this.onDesktopMessage?.(payload);
      } catch (err) {
        log.error('ws', 'Failed to parse message', err);
      }
    });

    this.socket.addEventListener("error", (err) => {
      log.error('ws', 'WebSocket error', err);
      this.socket.close();
    });
  }

  scheduleReconnect() {
    clearTimeout(this.retryTimer);
    log.info('ws', `Reconnecting... ${RETRY_DELAY_MS}ms`);
    this.retryTimer = setTimeout(() => this.connect(), RETRY_DELAY_MS);
  }

  flushPending() {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
    if (this.pending.length > 0) {
      log.info('ws', `Sending queue: ${this.pending.length} messages`);
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

    log.debug('ws', `→ ${payload.type}`, { tabId: payload.tabId });

    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(data);
    } else {
      log.debug('ws', `Queue +1 (${this.pending.length + 1})`);
      this.pending.push(data);
      this.connect();
    }
  }
}

const tabMetadata = new Map();
// tabId -> Map<frameId, chrome.runtime.Port>
const tabPorts = new Map();
const mediaStates = new Map();
const dashboardPorts = new Set();

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
    log.debug('filter', 'Filtered: no readyState');
    return false;
  }
  const duration = typeof payload.duration === "number" && Number.isFinite(payload.duration) ? payload.duration : 0;
  if (duration <= MINIMUM_DURATION) {
    log.debug('filter', `Filtered: duration=${duration}s`);
    return false;
  }
  
  return true;
}

function ingestMediaMessage(tabId, frameId, message) {
  if (!message || typeof message !== "object") return;
  const { type, payload } = message;
  if (!type) return;

  log.debug('msg', `Tab${tabId} ← ${type}`);

  if (type === "video-context") {
    rememberActiveFrame(tabId, frameId, payload?.pageUrl);
  }

  if (type === "video-context" || type === "time-update" || type === "playback-rate") {
    // Only store valid media in mediaStates (duration > MINIMUM_DURATION)
    const isValid = isValidMedia(payload);
    if (isValid) {
      log.info('media', `Tab${tabId} Update: ${type}`, { duration: payload.duration?.toFixed(1) });
      const patch =
        typeof frameId === "number" ? { ...(payload || {}), frameId } : payload || {};
      setMediaState(tabId, patch, type);
    }
  } else if (type === "page-url-changed" && mediaStates.has(tabId)) {
    log.info('page', `Tab${tabId} URL changed`, { url: payload.pageUrl });
    setMediaState(tabId, payload || {}, type);
  } else if (type === "video-ended") {
    log.info('media', `Tab${tabId} Playback ended`);
    removeMediaState(tabId);
  }
}

function sendToContentScript(tabId, message) {
  const preferredFrameId = tabMetadata.get(tabId)?.lastFrameId;
  const port = getPortForTab(tabId, preferredFrameId);
  if (!port) {
    log.warn('msg', `Tab${tabId} No port`, { preferredFrameId });
    return;
  }
  try {
    log.debug('msg', `Tab${tabId} → ${message.type}`, { frameId: preferredFrameId });
    port.postMessage(message);
  } catch (err) {
    log.error('msg', `Tab${tabId} Send failed`, err);
  }
}

function handleDesktopMessage(message) {
  if (!message || typeof message !== "object") return;
  if (message.source !== "usp-desktop") return;

  if (message.type === "control-command" && typeof message.tabId === "number") {
    const frameId = tabMetadata.get(message.tabId)?.lastFrameId ?? null;
    log.info('ctrl', `Desktop command: ${message.action}`, { tabId: message.tabId, frameId });
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
    log.warn('conn', 'Ignored: no tabId');
    return;
  }
  const frameId = typeof port.sender?.frameId === "number" ? port.sender.frameId : 0;

  log.info('conn', `Tab${tabId} Connected`, { url: port.sender?.tab?.url, frameId });

  ensureTabInfo(tabId);
  const framePorts = tabPorts.get(tabId) || new Map();
  framePorts.set(frameId, port);
  tabPorts.set(tabId, framePorts);

  port.onMessage.addListener((message) => {
    // Store and filter media state
    ingestMediaMessage(tabId, frameId, message);
    
    // Forward to desktop-app with consistent data format
    if (message.type === "video-ended") {
      bridge.send({
        tabId,
        type: "video-ended",
        payload: {}
      });
    } else if (message.type === "page-url-changed") {
      bridge.send({
        tabId,
        type: "page-url-changed",
        payload: message.payload
      });
    } else if (mediaStates.has(tabId)) {
      // Use buildMediaInfo to ensure consistent data format
      const mediaInfo = buildMediaInfo(mediaStates.get(tabId));
      log.debug('fwd', `→Desktop Tab${tabId}:${message.type}`, { 
        dur: mediaInfo.duration?.toFixed(1),
        time: mediaInfo.currentTime?.toFixed(1)
      });
      bridge.send({
        tabId,
        type: message.type,
        payload: mediaInfo
      });
    }
  });

  port.onDisconnect.addListener(() => {
    log.info('conn', `Tab${tabId} Frame${frameId} Disconnected`);
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
      bridge.send({
        tabId,
        type: "video-ended",
        payload: {}
      });
    }
  });
}

function handleDashboardPort(port) {
  log.info('conn', `Dashboard Connected (total: ${dashboardPorts.size + 1})`);
  dashboardPorts.add(port);
  sendSnapshotToPort(port);
  port.onDisconnect.addListener(() => {
    log.info('conn', `Dashboard Disconnected (total: ${dashboardPorts.size - 1})`);
    dashboardPorts.delete(port);
  });
}

function ensureKeepAliveAlarm() {
  chrome.alarms.get(KEEPALIVE_ALARM_NAME, (existing) => {
    if (chrome.runtime?.lastError) {
      log.warn('alarm', 'Failed to query alarm', chrome.runtime.lastError);
    }
    const desired = KEEPALIVE_PERIOD_MINUTES;
    if (!existing || Math.abs((existing.periodInMinutes || 0) - desired) > 0.001) {
      chrome.alarms.create(KEEPALIVE_ALARM_NAME, {
        periodInMinutes: desired,
        delayInMinutes: desired
      });
      log.info('alarm', `${existing ? 'Update' : 'Create'} keepalive alarm`, { intervalSeconds: KEEPALIVE_INTERVAL_SECONDS });
    }
  });
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm?.name !== KEEPALIVE_ALARM_NAME) {
    return;
  }
  log.debug('alarm', 'keepalive tick', { scheduledTime: alarm.scheduledTime });
  bridge.connect();
});

ensureKeepAliveAlarm();
chrome.runtime.onInstalled.addListener(ensureKeepAliveAlarm);
chrome.runtime.onStartup.addListener(ensureKeepAliveAlarm);
