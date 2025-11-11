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

const CONTENT_PORT = "usp-video-channel";
const DASHBOARD_PORT = "usp-dashboard";
const OFFSCREEN_PORT = "usp-offscreen-bridge";
const OFFSCREEN_URL = chrome.runtime.getURL("offscreen.html");
// Minimum duration to consider a video as valid media (in milliseconds, was 10 seconds)
const MINIMUM_DURATION = 10000;
const KEEPALIVE_ALARM_NAME = "usp-keepalive";
const KEEPALIVE_INTERVAL_SECONDS = 25;
const KEEPALIVE_PERIOD_MINUTES = KEEPALIVE_INTERVAL_SECONDS / 60;

let offscreenPort = null;
const pendingDesktopMessages = [];
let creatingOffscreenDocument = false;

async function ensureOffscreenDocument() {
  if (creatingOffscreenDocument) {
    return;
  }
  if (!chrome.offscreen?.createDocument) {
    log.warn("offscreen", "API unavailable, cannot stabilize desktop bridge");
    return;
  }
  creatingOffscreenDocument = true;
  try {
    let existing = [];
    if (chrome.runtime?.getContexts) {
      try {
        existing = await chrome.runtime.getContexts({
          contextTypes: ["OFFSCREEN_DOCUMENT"],
          documentUrls: [OFFSCREEN_URL]
        });
      } catch {
        existing = [];
      }
    }
    if (existing?.length) {
      return;
    }
    await chrome.offscreen.createDocument({
      url: "offscreen.html",
      reasons: [chrome.offscreen?.Reason?.IFRAME_SCRIPTING ?? "IFRAME_SCRIPTING"],
      justification: "Keep desktop bridge WebSocket alive when no video tabs are active"
    });
    log.info("offscreen", "Created offscreen bridge document");
  } catch (error) {
    log.error("offscreen", "Failed to create offscreen document", error);
  } finally {
    creatingOffscreenDocument = false;
  }
}

function flushPendingDesktopMessages() {
  if (!offscreenPort || !pendingDesktopMessages.length) {
    return;
  }
  while (pendingDesktopMessages.length) {
    const payload = pendingDesktopMessages.shift();
    try {
      offscreenPort.postMessage({ type: "to-desktop", payload });
    } catch (error) {
      log.error("bridge", "Failed to flush pending payload, re-queueing", error);
      pendingDesktopMessages.unshift(payload);
      offscreenPort = null;
      ensureOffscreenDocument();
      return;
    }
  }
}

function sendToDesktop(payload) {
  if (!payload || typeof payload !== "object") {
    return;
  }
  if (!offscreenPort) {
    pendingDesktopMessages.push(payload);
    ensureOffscreenDocument();
    return;
  }
  try {
    offscreenPort.postMessage({ type: "to-desktop", payload });
  } catch (error) {
    log.error("bridge", "Failed to reach offscreen bridge, queueing payload", error);
    pendingDesktopMessages.push(payload);
    offscreenPort = null;
    ensureOffscreenDocument();
  }
}

function requestBridgeConnect() {
  if (!offscreenPort) {
    ensureOffscreenDocument();
    return;
  }
  try {
    offscreenPort.postMessage({ type: "bridge-connect" });
  } catch (error) {
    log.error("bridge", "Failed to send connect command", error);
    offscreenPort = null;
    ensureOffscreenDocument();
  }
}

function attachOffscreenPort(port) {
  log.info("bridge", "Offscreen bridge connected");
  offscreenPort = port;
  port.onMessage.addListener((message) => {
    if (!message || typeof message !== "object") {
      return;
    }
    if (message.type === "from-desktop" && message.payload) {
      handleDesktopMessage(message.payload);
    } else if (message.type === "bridge-ready") {
      log.debug("bridge", "Offscreen bridge ready");
      flushPendingDesktopMessages();
    } else if (message.type === "offscreen-keepalive") {
      log.debug("bridge", "Keepalive pulse", message);
    }
  });
  port.onDisconnect.addListener(() => {
    log.warn("bridge", "Offscreen bridge disconnected");
    offscreenPort = null;
    ensureOffscreenDocument();
  });
  flushPendingDesktopMessages();
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
  } else if (type === "loop-started") {
    // Forward loop-started message to desktop-app
    log.info('loop', `Tab${tabId} Loop started`);
    sendToDesktop({
      source: "usp-extension",
      type: "loop-started",
      tabId,
      payload: payload || {}
    });
  } else if (type === "loop-cleared") {
    // Forward loop-cleared message to desktop-app
    log.info('loop', `Tab${tabId} Loop cleared by user interaction`);
    sendToDesktop({
      source: "usp-extension",
      type: "loop-cleared",
      tabId,
      payload: payload || {}
    });
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

chrome.runtime.onConnect.addListener((port) => {
  if (port.name === OFFSCREEN_PORT) {
    attachOffscreenPort(port);
  } else if (port.name === CONTENT_PORT) {
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
      sendToDesktop({
        tabId,
        type: "video-ended",
        payload: {}
      });
    } else if (message.type === "page-url-changed") {
      sendToDesktop({
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
      sendToDesktop({
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
      sendToDesktop({
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
  requestBridgeConnect();
});

ensureKeepAliveAlarm();
ensureOffscreenDocument();
chrome.runtime.onInstalled.addListener(() => {
  ensureKeepAliveAlarm();
  ensureOffscreenDocument();
});
chrome.runtime.onStartup.addListener(() => {
  ensureKeepAliveAlarm();
  ensureOffscreenDocument();
});
