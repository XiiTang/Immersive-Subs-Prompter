// 简化的日志函数
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
      log.info('ws', '连接中...', { endpoint: WS_ENDPOINT });
      this.socket = new WebSocket(WS_ENDPOINT);
    } catch (err) {
      log.error('ws', '创建连接失败', err);
      this.scheduleReconnect();
      return;
    }

    this.socket.addEventListener("open", () => {
      log.info('ws', '已连接');
      this.flushPending();
    });

    this.socket.addEventListener("close", () => {
      log.warn('ws', '已断开');
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
        log.error('ws', '解析消息失败', err);
      }
    });

    this.socket.addEventListener("error", (err) => {
      log.error('ws', 'WebSocket错误', err);
      this.socket.close();
    });
  }

  scheduleReconnect() {
    clearTimeout(this.retryTimer);
    log.info('ws', `重连中... ${RETRY_DELAY_MS}ms`);
    this.retryTimer = setTimeout(() => this.connect(), RETRY_DELAY_MS);
  }

  flushPending() {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
    if (this.pending.length > 0) {
      log.info('ws', `发送队列: ${this.pending.length} 条消息`);
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
      log.debug('ws', `队列 +1 (${this.pending.length + 1})`);
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

// Check if media is valid (mirrors GlobalSpeed's filtering logic)
// Used for both desktop-app forwarding and mediaStates storage
function isValidMedia(payload) {
  if (!payload) return false;
  
  // Must have readyState and duration > MINIMUM_DURATION
  if (!payload.readyState) {
    log.debug('filter', '过滤: 无 readyState');
    return false;
  }
  const duration = typeof payload.duration === "number" && Number.isFinite(payload.duration) ? payload.duration : 0;
  if (duration <= MINIMUM_DURATION) {
    log.debug('filter', `过滤: duration=${duration}s`);
    return false;
  }
  
  return true;
}

function ingestMediaMessage(tabId, message) {
  if (!message || typeof message !== "object") return;
  const { type, payload } = message;
  if (!type) return;

  log.debug('msg', `Tab${tabId} ← ${type}`);

  if (type === "video-context" || type === "time-update" || type === "playback-rate") {
    // Only store valid media in mediaStates (duration > MINIMUM_DURATION)
    const isValid = isValidMedia(payload);
    if (isValid) {
      log.info('media', `Tab${tabId} 更新: ${type}`, { duration: payload.duration?.toFixed(1) });
      setMediaState(tabId, payload || {}, type);
    }
  } else if (type === "page-url-changed" && mediaStates.has(tabId)) {
    log.info('page', `Tab${tabId} URL变化`, { url: payload.pageUrl });
    setMediaState(tabId, payload || {}, type);
  } else if (type === "video-ended") {
    log.info('media', `Tab${tabId} 播放结束`);
    removeMediaState(tabId);
  }
}

function sendToContentScript(tabId, message) {
  const port = tabPorts.get(tabId);
  if (!port) {
    log.warn('msg', `Tab${tabId} 无端口`);
    return;
  }
  try {
    log.debug('msg', `Tab${tabId} → ${message.type}`);
    port.postMessage(message);
  } catch (err) {
    log.error('msg', `Tab${tabId} 发送失败`, err);
  }
}

function handleDesktopMessage(message) {
  if (!message || typeof message !== "object") return;
  if (message.source !== "usp-desktop") return;

  log.info('ctrl', `Desktop命令: ${message.action}`, { tabId: message.tabId });

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
    log.warn('conn', '忽略: 无tabId');
    return;
  }

  log.info('conn', `Tab${tabId} 已连接`, { url: port.sender?.tab?.url });

  tabMetadata.set(tabId, { lastVideoUrl: null });
  tabPorts.set(tabId, port);

  port.onMessage.addListener((message) => {
    // Store and filter media state
    ingestMediaMessage(tabId, message);
    
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

    if (message.type === "video-context") {
      const tabInfo = tabMetadata.get(tabId) || {};
      tabInfo.lastVideoUrl = message.payload.pageUrl;
      tabMetadata.set(tabId, tabInfo);
    }
  });

  port.onDisconnect.addListener(() => {
    log.info('conn', `Tab${tabId} 已断开`);
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
  log.info('conn', `Dashboard 已连接 (总数: ${dashboardPorts.size + 1})`);
  dashboardPorts.add(port);
  sendSnapshotToPort(port);
  port.onDisconnect.addListener(() => {
    log.info('conn', `Dashboard 已断开 (总数: ${dashboardPorts.size - 1})`);
    dashboardPorts.delete(port);
  });
}

function ensureKeepAliveAlarm() {
  chrome.alarms.get(KEEPALIVE_ALARM_NAME, (existing) => {
    if (chrome.runtime?.lastError) {
      log.warn('alarm', '查询闹钟失败', chrome.runtime.lastError);
    }
    const desired = KEEPALIVE_PERIOD_MINUTES;
    if (!existing || Math.abs((existing.periodInMinutes || 0) - desired) > 0.001) {
      chrome.alarms.create(KEEPALIVE_ALARM_NAME, {
        periodInMinutes: desired,
        delayInMinutes: desired
      });
      log.info('alarm', `${existing ? '更新' : '创建'}保活闹钟`, { intervalSeconds: KEEPALIVE_INTERVAL_SECONDS });
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
