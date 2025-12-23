var USPContentScript = (() => {
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
    videoStateChange(eventType, state2) {
      this.debug("media-state", `Video state changed: ${eventType}`, state2);
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

  // src/content/state.js
  var log = new Logger("content-script");
  var state = {
    port: null,
    reconnectTimer: null,
    keepAliveTimer: null,
    activeVideo: null,
    driftMonitorTimer: null,
    lastPageUrl: location.href,
    blacklistRules: [],
    isPageBlacklisted: false,
    monitoringActive: false,
    prototypesHooked: false,
    urlMonitorTimer: null,
    regexCache: /* @__PURE__ */ new Map(),
    lastReportedPlayback: null,
    loop: {
      startMs: null,
      endMs: null,
      isLooping: false,
      programmaticSeek: false,
      checkTimer: null
    },
    domObserver: null,
    hooked: /* @__PURE__ */ new WeakSet(),
    observedDocs: /* @__PURE__ */ new WeakSet()
  };

  // src/shared/constants.js
  var BLACKLIST_STORAGE_KEY = "uspBlacklistRules";
  var CONTENT_PORT = "usp-video-channel";

  // src/content/constants.js
  var DRIFT_CHECK_INTERVAL_MS = 250;
  var DRIFT_THRESHOLD_MS = 200;
  var KEEPALIVE_INTERVAL_MS = 15e3;
  var RECONNECT_DELAY_MS = 1e3;
  var MEDIA_EVENTS = [
    "play",
    "playing",
    "pause",
    "seeking",
    "seeked",
    "loadedmetadata",
    "loadeddata",
    "ratechange",
    "durationchange",
    "volumechange",
    "enterpictureinpicture",
    "leavepictureinpicture",
    "ended"
  ];

  // src/connection/PortManager.js
  var handleMessage = null;
  var handleReconnect = null;
  function setPortHandlers({ onMessage, onReconnect } = {}) {
    handleMessage = typeof onMessage === "function" ? onMessage : null;
    handleReconnect = typeof onReconnect === "function" ? onReconnect : null;
  }
  function schedulePortReconnect() {
    if (!state.monitoringActive) {
      return;
    }
    if (state.reconnectTimer) return;
    log.info("conn", `Reconnecting... ${RECONNECT_DELAY_MS}ms`);
    state.reconnectTimer = setTimeout(() => {
      state.reconnectTimer = null;
      connectPort();
    }, RECONNECT_DELAY_MS);
  }
  function connectPort() {
    if (!state.monitoringActive) {
      return null;
    }
    if (state.port) return state.port;
    let nextPort = null;
    try {
      nextPort = chrome.runtime.connect({ name: CONTENT_PORT });
      log.info("conn", "Connected", { url: location.href });
    } catch (err) {
      log.error("conn", "Connection failed", err);
      schedulePortReconnect();
      return null;
    }
    nextPort.onMessage.addListener((message) => {
      if (state.monitoringActive && handleMessage) {
        handleMessage(message);
      }
    });
    nextPort.onDisconnect.addListener(() => {
      if (state.port === nextPort) {
        state.port = null;
        log.info("conn", "Disconnected");
      }
      if (state.monitoringActive) {
        schedulePortReconnect();
      }
    });
    state.port = nextPort;
    if (state.reconnectTimer) {
      clearTimeout(state.reconnectTimer);
      state.reconnectTimer = null;
    }
    if (handleReconnect) {
      handleReconnect();
    }
    return nextPort;
  }
  function disconnectPort() {
    if (state.reconnectTimer) {
      clearTimeout(state.reconnectTimer);
      state.reconnectTimer = null;
    }
    if (state.port) {
      try {
        state.port.disconnect();
      } catch (err) {
        log.warn("conn", "Failed to disconnect port", err);
      }
      state.port = null;
    }
  }

  // src/connection/MessageSender.js
  function send(type, payload = {}) {
    if (!state.monitoringActive) {
      return;
    }
    const channel = state.port || connectPort();
    if (!channel) {
      log.warn("msg", `Send failed: ${type} (no connection)`);
      return;
    }
    try {
      log.debug("msg", `->${type}`, payload);
      channel.postMessage({ type, payload });
    } catch (err) {
      log.error("msg", `Send failed: ${type}`, err);
      if (state.port === channel) {
        state.port = null;
      }
      schedulePortReconnect();
    }
  }
  function startKeepAlive() {
    if (state.keepAliveTimer !== null || !state.monitoringActive) {
      return;
    }
    const tick = () => {
      if (!state.monitoringActive) {
        stopKeepAlive();
        return;
      }
      send("keepalive", {
        pageUrl: location.href,
        title: document.title,
        timestamp: Date.now()
      });
      state.keepAliveTimer = window.setTimeout(tick, KEEPALIVE_INTERVAL_MS);
    };
    state.keepAliveTimer = window.setTimeout(tick, KEEPALIVE_INTERVAL_MS);
  }
  function stopKeepAlive() {
    if (state.keepAliveTimer !== null) {
      clearTimeout(state.keepAliveTimer);
      state.keepAliveTimer = null;
    }
  }

  // src/monitoring/URLWatcher.js
  function ensureUrlWatcher(onUrlChanged) {
    if (state.urlMonitorTimer !== null) {
      return;
    }
    const tick = () => {
      if (state.lastPageUrl !== location.href) {
        state.lastPageUrl = location.href;
        log.info("page", "URL changed", { url: state.lastPageUrl, title: document.title });
        if (onUrlChanged) {
          onUrlChanged(state.lastPageUrl, document.title);
        }
      }
      state.urlMonitorTimer = window.setTimeout(tick, 1e3);
    };
    state.urlMonitorTimer = window.setTimeout(tick, 1e3);
  }

  // src/monitoring/DOMObserver.js
  var mediaEventHandler = null;
  var videoRemovedHandler = null;
  function setDomCallbacks({ onMediaEvent, onVideoRemoved } = {}) {
    mediaEventHandler = typeof onMediaEvent === "function" ? onMediaEvent : null;
    videoRemovedHandler = typeof onVideoRemoved === "function" ? onVideoRemoved : null;
  }
  function ensureDocListeners(target) {
    if (!target || typeof target.addEventListener !== "function" || state.observedDocs.has(target)) return;
    if (!mediaEventHandler) return;
    state.observedDocs.add(target);
    MEDIA_EVENTS.forEach((eventName) => {
      target.addEventListener(eventName, mediaEventHandler, { capture: true, passive: true });
    });
  }
  function getShadowRoot(element) {
    if (!element) return null;
    if (typeof chrome !== "undefined" && chrome.dom && chrome.dom.openOrClosedShadowRoot) {
      try {
        return chrome.dom.openOrClosedShadowRoot(element);
      } catch (err) {
      }
    }
    return element.shadowRoot;
  }
  function scanForShadowRoots(root = document.body) {
    if (!root || typeof root.querySelectorAll !== "function") return;
    const elements = root.querySelectorAll("*");
    elements.forEach((element) => {
      const shadowRoot = getShadowRoot(element);
      if (shadowRoot && !state.observedDocs.has(shadowRoot)) {
        log.info("shadow", "Found Shadow DOM", { host: element.tagName });
        ensureDocListeners(shadowRoot);
        scanForShadowRoots(shadowRoot);
      }
    });
  }
  function findVideosInNode(node) {
    const videos = [];
    if (!node) return videos;
    if (node instanceof HTMLVideoElement) {
      videos.push(node);
    }
    if (typeof node.querySelectorAll === "function") {
      node.querySelectorAll("video").forEach((video) => videos.push(video));
    }
    if (node instanceof Element) {
      const shadowRoot = getShadowRoot(node);
      if (shadowRoot && typeof shadowRoot.querySelectorAll === "function") {
        shadowRoot.querySelectorAll("video").forEach((video) => videos.push(video));
      }
    }
    return videos;
  }
  function handleRemovedNode(node) {
    if (!(node instanceof Element) && !(node instanceof DocumentFragment)) {
      return;
    }
    const videos = findVideosInNode(node);
    videos.forEach((video) => {
      const schedule = typeof requestAnimationFrame === "function" ? (fn) => requestAnimationFrame(fn) : (fn) => setTimeout(fn, 0);
      schedule(() => {
        if (videoRemovedHandler && video === state.activeVideo && !video.isConnected) {
          videoRemovedHandler();
        }
      });
    });
  }
  function startDOMObserver() {
    if (state.domObserver) {
      return state.domObserver;
    }
    const observer = new MutationObserver((mutations) => {
      if (!state.monitoringActive) return;
      mutations.forEach((mutation) => {
        mutation.removedNodes.forEach((node) => handleRemovedNode(node));
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const shadowRoot = getShadowRoot(node);
            if (shadowRoot && !state.observedDocs.has(shadowRoot)) {
              log.info("shadow", "New Shadow DOM detected via mutation", { host: node.tagName });
              ensureDocListeners(shadowRoot);
              scanForShadowRoots(shadowRoot);
            }
            if (node.querySelectorAll) {
              scanForShadowRoots(node);
            }
          }
        });
      });
    });
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
    state.domObserver = observer;
    return observer;
  }
  function stopDOMObserver() {
    if (state.domObserver) {
      state.domObserver.disconnect();
      state.domObserver = null;
    }
  }
  function prepareDomMonitoring() {
    ensureDocListeners(document);
    log.info("shadow", "Scanning for existing Shadow DOMs...");
    scanForShadowRoots();
  }

  // src/video/VideoStateGatherer.js
  function detectSite() {
    const host = location.hostname;
    const site = host.includes("youtube.com") ? "youtube" : host.includes("bilibili.com") ? "bilibili" : host.includes("douyin.com") ? "douyin" : "unknown";
    log.debug("site", `Detected: ${site}`, { hostname: host });
    return site;
  }
  function gatherVideoState(video) {
    if (!video) return null;
    return {
      pageUrl: location.href,
      site: detectSite(),
      videoSrc: video.currentSrc || video.src || null,
      videoWidth: Number.isFinite(video.videoWidth) ? video.videoWidth : null,
      videoHeight: Number.isFinite(video.videoHeight) ? video.videoHeight : null,
      pictureInPicture: document.pictureInPictureElement === video,
      playbackRate: video.playbackRate,
      currentTime: video.currentTime * 1e3,
      duration: Number.isFinite(video.duration) ? video.duration * 1e3 : null,
      paused: video.paused,
      muted: video.muted,
      volume: video.volume,
      readyState: video.readyState,
      title: document.title,
      updatedAt: Date.now()
    };
  }
  function recordPlaybackSample(snapshot) {
    if (!snapshot) {
      return;
    }
    const playbackRate = Number.isFinite(snapshot.playbackRate) ? snapshot.playbackRate : 1;
    const effectiveRate = snapshot.paused ? 0 : playbackRate;
    state.lastReportedPlayback = {
      currentTime: snapshot.currentTime,
      playbackRate: effectiveRate,
      reportedAt: snapshot.updatedAt
    };
  }
  function resetPlaybackPrediction() {
    state.lastReportedPlayback = null;
  }
  function predictPlaybackTime(now = Date.now()) {
    if (!state.lastReportedPlayback) {
      return null;
    }
    const elapsed = now - state.lastReportedPlayback.reportedAt;
    return state.lastReportedPlayback.currentTime + elapsed * state.lastReportedPlayback.playbackRate;
  }
  function handleTimeUpdate(video) {
    if (!state.monitoringActive) {
      return;
    }
    const snapshot = gatherVideoState(video);
    if (!snapshot) {
      return;
    }
    send("time-update", snapshot);
    recordPlaybackSample(snapshot);
  }

  // src/video/LoopController.js
  function startLoopCheck() {
    if (state.loop.checkTimer) {
      clearInterval(state.loop.checkTimer);
    }
    state.loop.checkTimer = setInterval(() => {
      const video = state.activeVideo;
      if (!state.loop.isLooping || !video || state.loop.startMs === null || state.loop.endMs === null) {
        if (state.loop.checkTimer) {
          clearInterval(state.loop.checkTimer);
          state.loop.checkTimer = null;
        }
        return;
      }
      const currentTimeMs = video.currentTime * 1e3;
      if (currentTimeMs >= state.loop.endMs) {
        state.loop.programmaticSeek = true;
        video.currentTime = state.loop.startMs / 1e3;
      }
    }, 100);
  }
  function clearLoopState() {
    if (state.loop.checkTimer) {
      clearInterval(state.loop.checkTimer);
      state.loop.checkTimer = null;
    }
    if (!state.loop.isLooping) {
      log.debug("loop", "clearLoopState called but not looping");
      state.loop.programmaticSeek = false;
      return;
    }
    state.loop.isLooping = false;
    state.loop.startMs = null;
    state.loop.endMs = null;
    state.loop.programmaticSeek = false;
    send("loop-cleared", {});
  }
  function startLoop(target, startMs, endMs) {
    state.loop.startMs = startMs;
    state.loop.endMs = endMs;
    state.loop.isLooping = true;
    state.loop.programmaticSeek = true;
    const wasPaused = target.paused;
    target.currentTime = startMs / 1e3;
    if (wasPaused) {
      target.play().catch((err) => {
        log.error("ctrl", "Auto-play after loop enabled failed", err);
      });
    }
    startLoopCheck();
    send("loop-started", {});
  }
  function clearProgrammaticSeekFlag() {
    state.loop.programmaticSeek = false;
  }
  function isProgrammaticSeek() {
    return state.loop.programmaticSeek;
  }

  // src/video/VideoDetector.js
  function setActiveVideo(video) {
    if (!state.monitoringActive) {
      return;
    }
    const nextVideo = video ?? null;
    const switchedVideo = state.activeVideo !== nextVideo;
    state.activeVideo = nextVideo;
    if (nextVideo) {
      log.info("video", "Video activated", { src: nextVideo.currentSrc || nextVideo.src, duration: nextVideo.duration });
      send("video-context", gatherVideoState(nextVideo));
      if (switchedVideo) {
        resetPlaybackPrediction();
      }
      ensureDriftMonitor();
    } else {
      log.info("video", "Video cleared");
      stopDriftMonitor();
      resetPlaybackPrediction();
    }
  }
  function endActiveVideoSession(reason = "ended") {
    if (!state.activeVideo) {
      return;
    }
    const src = state.activeVideo.currentSrc || state.activeVideo.src || "(no src)";
    clearLoopState();
    log.info("video", `Video ${reason}`, { src });
    send("video-ended", { pageUrl: location.href });
    setActiveVideo(null);
  }
  function watchVideo(video) {
    if (!state.monitoringActive || !video || !(video instanceof HTMLVideoElement)) return;
    if (state.hooked.has(video)) return;
    state.hooked.add(video);
    log.info("video", "Video detected", {
      src: video.currentSrc || video.src || "(no src)",
      duration: video.duration,
      readyState: video.readyState
    });
    handleTimeUpdate(video);
  }
  function handleDocumentMediaEvent(event) {
    if (!state.monitoringActive) {
      return;
    }
    const target = event?.target;
    if (!(target instanceof HTMLVideoElement)) return;
    log.debug("event", event.type, {
      time: target.currentTime?.toFixed(1),
      paused: target.paused,
      active: target === state.activeVideo
    });
    watchVideo(target);
    switch (event.type) {
      case "play":
      case "playing":
        setActiveVideo(target);
        handleTimeUpdate(target);
        break;
      case "loadedmetadata":
        if (!state.activeVideo) {
          setActiveVideo(target);
        } else {
          send("video-context", gatherVideoState(target));
        }
        break;
      case "loadeddata":
        if (!state.activeVideo) {
          setActiveVideo(target);
        }
        handleTimeUpdate(target);
        break;
      case "pause":
        if (target === state.activeVideo) {
          clearLoopState();
          handleTimeUpdate(target);
        }
        break;
      case "seeking":
        if (target === state.activeVideo && !isProgrammaticSeek()) {
          clearLoopState();
        }
        clearProgrammaticSeekFlag();
        break;
      case "seeked":
        clearProgrammaticSeekFlag();
        if (target === state.activeVideo) {
          handleTimeUpdate(target);
        }
        break;
      case "durationchange":
      case "volumechange":
      case "enterpictureinpicture":
      case "leavepictureinpicture":
      case "ratechange":
        if (state.activeVideo === target) {
          handleTimeUpdate(target);
        }
        break;
      case "ended":
        if (state.activeVideo === target) {
          endActiveVideoSession("playback-ended");
        }
        break;
      default:
        break;
    }
  }
  function ensurePrototypeHooks() {
    if (state.prototypesHooked) {
      return;
    }
    state.prototypesHooked = true;
    ["play", "pause", "load"].forEach((methodName) => {
      const original = HTMLMediaElement.prototype[methodName];
      if (typeof original !== "function") return;
      HTMLMediaElement.prototype[methodName] = function(...args) {
        const result = original.apply(this, args);
        if (this instanceof HTMLVideoElement) {
          watchVideo(this);
        }
        return result;
      };
      HTMLMediaElement.prototype[methodName].toString = () => original.toString();
    });
    const originalAttachShadow = Element.prototype.attachShadow;
    if (typeof originalAttachShadow === "function") {
      Element.prototype.attachShadow = function(...args) {
        const shadowRoot = originalAttachShadow.apply(this, args);
        log.info("shadow", "attachShadow called", { host: this.tagName, mode: args[0]?.mode });
        ensureDocListeners(shadowRoot);
        scanForShadowRoots(shadowRoot);
        return shadowRoot;
      };
      Element.prototype.attachShadow.toString = () => originalAttachShadow.toString();
    }
  }

  // src/monitoring/DriftMonitor.js
  function ensureDriftMonitor() {
    if (state.driftMonitorTimer || !state.monitoringActive) {
      return;
    }
    const tick = () => {
      if (!state.monitoringActive || !state.activeVideo) {
        state.driftMonitorTimer = null;
        return;
      }
      if (!state.activeVideo.isConnected) {
        endActiveVideoSession("removed-from-dom");
        state.driftMonitorTimer = null;
        return;
      }
      const predicted = predictPlaybackTime();
      if (predicted !== null) {
        const actual = state.activeVideo.currentTime * 1e3;
        if (Math.abs(predicted - actual) > DRIFT_THRESHOLD_MS) {
          log.debug("drift", "Playback drift detected", {
            predicted: Math.round(predicted),
            actual: Math.round(actual)
          });
          handleTimeUpdate(state.activeVideo);
        }
      }
      state.driftMonitorTimer = window.setTimeout(tick, DRIFT_CHECK_INTERVAL_MS);
    };
    state.driftMonitorTimer = window.setTimeout(tick, DRIFT_CHECK_INTERVAL_MS);
  }
  function stopDriftMonitor() {
    if (state.driftMonitorTimer) {
      clearTimeout(state.driftMonitorTimer);
      state.driftMonitorTimer = null;
    }
  }

  // src/video/ControlHandler.js
  function applyControl(action, payload) {
    if (!state.monitoringActive) {
      return;
    }
    const target = state.activeVideo || document.querySelector("video");
    if (!target) {
      log.warn("ctrl", `Failed to execute: ${action} (no video)`);
      return;
    }
    switch (action) {
      case "seek":
        clearLoopState();
        if (typeof payload.time === "number" && Number.isFinite(payload.time)) {
          log.debug("ctrl", "seek requested", { ms: payload.time, before: Math.round(target.currentTime * 1e3) });
          const timeInSeconds = payload.time / 1e3;
          const clamped = Math.max(0, Math.min(timeInSeconds, target.duration || timeInSeconds));
          const wasPaused = target.paused;
          target.currentTime = clamped;
          log.debug("ctrl", "seek applied", { after: Math.round(target.currentTime * 1e3) });
          if (wasPaused) {
            target.play().catch((err) => {
              log.error("ctrl", "Auto-play after seek failed", err);
            });
          }
          handleTimeUpdate(target);
        } else {
          log.warn("ctrl", "seek failed: invalid time", payload);
        }
        break;
      case "loop":
        if (typeof payload.start === "number" && typeof payload.end === "number" && Number.isFinite(payload.start) && Number.isFinite(payload.end)) {
          log.debug("ctrl", "loop requested", { start: payload.start, end: payload.end, before: Math.round(target.currentTime * 1e3) });
          startLoop(target, payload.start, payload.end);
          log.debug("ctrl", "loop applied", { after: Math.round(target.currentTime * 1e3) });
        } else {
          log.warn("ctrl", "loop failed: invalid times", payload);
          send("loop-cleared", {});
        }
        break;
      case "stopLoop":
        log.debug("ctrl", "stopLoop requested");
        clearLoopState();
        break;
      case "pause":
        log.debug("ctrl", "pause requested", { time: Math.round(target.currentTime * 1e3) });
        clearLoopState();
        target.pause();
        log.debug("ctrl", "pause applied");
        break;
      case "play":
        log.debug("ctrl", "play requested", { time: Math.round(target.currentTime * 1e3) });
        clearLoopState();
        target.play().catch((err) => {
          log.error("ctrl", "play failed", err);
        });
        log.debug("ctrl", "play applied");
        break;
      default:
        log.warn("ctrl", `Unknown command: ${action}`);
        break;
    }
  }

  // src/shared/blacklist-utils.js
  var BLACKLIST_MODES = Object.freeze(["contains", "exact", "regex"]);
  var BLACKLIST_MODE_SET = new Set(BLACKLIST_MODES);
  function normalizeBlacklistRules(input) {
    if (!Array.isArray(input)) {
      return [];
    }
    return input.map((entry, index) => {
      if (!entry || typeof entry !== "object") {
        return null;
      }
      const id = typeof entry.id === "string" && entry.id.length ? entry.id : `rule-${Date.now()}-${index}`;
      const mode = typeof entry.mode === "string" && BLACKLIST_MODE_SET.has(entry.mode) ? entry.mode : "contains";
      const value = typeof entry.value === "string" ? entry.value.trim() : "";
      return { id, mode, value };
    }).filter(Boolean);
  }

  // src/blacklist/URLMatcher.js
  function compileRegex(pattern) {
    if (!pattern) {
      return null;
    }
    if (state.regexCache.has(pattern)) {
      return state.regexCache.get(pattern);
    }
    try {
      const regex = new RegExp(pattern);
      state.regexCache.set(pattern, regex);
      return regex;
    } catch (error) {
      log.warn("blacklist", "Invalid regex", { pattern });
      state.regexCache.set(pattern, null);
      return null;
    }
  }
  function matchesBlacklistRule(rule, url) {
    if (!rule || typeof rule.value !== "string" || !rule.value.length) {
      return false;
    }
    switch (rule.mode) {
      case "exact":
        return url === rule.value;
      case "regex": {
        const regex = compileRegex(rule.value);
        return regex ? regex.test(url) : false;
      }
      case "contains":
      default:
        return url.includes(rule.value);
    }
  }
  function isUrlBlacklisted(url, rules = state.blacklistRules) {
    const target = typeof url === "string" ? url : "";
    if (!target) {
      return false;
    }
    return rules.some((rule) => matchesBlacklistRule(rule, target));
  }

  // src/blacklist/BlacklistManager.js
  function setBlacklistRules(rawRules) {
    const normalized = normalizeBlacklistRules(rawRules ?? []);
    state.blacklistRules = normalized;
    state.regexCache.clear();
    return normalized;
  }
  async function loadBlacklistRules() {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.get([BLACKLIST_STORAGE_KEY], (result) => {
          if (chrome.runtime?.lastError) {
            log.logError("blacklist", "Failed to read blacklist", chrome.runtime.lastError);
            resolve([]);
            return;
          }
          resolve(result?.[BLACKLIST_STORAGE_KEY] ?? []);
        });
      } catch (error) {
        log.logError("blacklist", "Failed to read blacklist", error);
        resolve([]);
      }
    });
  }
  function evaluateCurrentUrl() {
    const blocked = isUrlBlacklisted(location.href, state.blacklistRules);
    const changed = blocked !== state.isPageBlacklisted;
    state.isPageBlacklisted = blocked;
    return { blocked, changed };
  }
  function handleStorageChange(changes, areaName) {
    if (areaName !== "local") {
      return null;
    }
    if (!Object.prototype.hasOwnProperty.call(changes, BLACKLIST_STORAGE_KEY)) {
      return null;
    }
    setBlacklistRules(changes[BLACKLIST_STORAGE_KEY].newValue ?? []);
    return evaluateCurrentUrl();
  }

  // src/content/index.js
  function handlePortMessage(message) {
    if (!state.monitoringActive || !message || typeof message !== "object") return;
    log.debug("msg", `<-${message.type}`, message);
    if (message.type === "control") {
      applyControl(message.action, message.payload || {});
    }
  }
  function handlePortReconnect() {
    if (state.activeVideo) {
      log.info("conn", "Reconnected successfully, syncing video state");
      send("video-context", gatherVideoState(state.activeVideo));
      handleTimeUpdate(state.activeVideo);
    }
  }
  function startMonitoring() {
    if (state.monitoringActive || state.isPageBlacklisted) {
      return;
    }
    state.monitoringActive = true;
    ensurePrototypeHooks();
    connectPort();
    prepareDomMonitoring();
    startDOMObserver();
    startKeepAlive();
  }
  function stopMonitoring() {
    if (!state.monitoringActive) {
      return;
    }
    state.monitoringActive = false;
    clearLoopState();
    stopDriftMonitor();
    resetPlaybackPrediction();
    state.activeVideo = null;
    stopKeepAlive();
    stopDOMObserver();
    disconnectPort();
  }
  function handleUrlChanged(url, title) {
    if (state.monitoringActive) {
      send("page-url-changed", { pageUrl: url, title });
    }
    const result = evaluateCurrentUrl();
    if (!result.changed) {
      return;
    }
    if (result.blocked) {
      log.info("blacklist", "Current page is blacklisted, stopping detection", { url: location.href });
      stopMonitoring();
    } else {
      log.info("blacklist", "Current page removed from blacklist, resuming detection", { url: location.href });
      startMonitoring();
    }
  }
  async function bootstrap() {
    setPortHandlers({ onMessage: handlePortMessage, onReconnect: handlePortReconnect });
    setDomCallbacks({
      onMediaEvent: handleDocumentMediaEvent,
      onVideoRemoved: () => endActiveVideoSession("removed-from-dom")
    });
    try {
      const raw = await loadBlacklistRules();
      setBlacklistRules(raw);
    } catch (error) {
      log.logError("blacklist", "Failed to init blacklist", error);
      setBlacklistRules([]);
    }
    const status = evaluateCurrentUrl();
    if (status.blocked) {
      log.info("blacklist", "Current page is blacklisted, skipping detection", { url: location.href });
    } else {
      startMonitoring();
    }
    ensureUrlWatcher(handleUrlChanged);
  }
  chrome.storage.onChanged.addListener((changes, areaName) => {
    const result = handleStorageChange(changes, areaName);
    if (!result) {
      return;
    }
    if (!result.changed) {
      return;
    }
    if (result.blocked) {
      log.info("blacklist", "Current page is blacklisted, stopping detection", { url: location.href });
      stopMonitoring();
    } else {
      log.info("blacklist", "Current page removed from blacklist, resuming detection", { url: location.href });
      startMonitoring();
    }
  });
  ["beforeunload", "unload"].forEach((eventName) => {
    window.addEventListener(eventName, () => {
      stopDriftMonitor();
    });
  });
  bootstrap();
})();
//# sourceMappingURL=content-script.js.map
