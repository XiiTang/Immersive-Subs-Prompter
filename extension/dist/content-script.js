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
  var BLACKLIST_STORAGE_KEY = "uspBlacklistRules";
  var CONTENT_PORT = "usp-video-channel";

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

  // src/content-script.js
  var log = new Logger("content-script");
  (function() {
    const DRIFT_CHECK_INTERVAL_MS = 250;
    const DRIFT_THRESHOLD_MS = 200;
    const PORT_NAME = CONTENT_PORT;
    const KEEPALIVE_INTERVAL_MS = 15e3;
    const RECONNECT_DELAY_MS = 1e3;
    let port = null;
    let reconnectTimer = null;
    let keepAliveTimer = null;
    let activeVideo = null;
    let driftMonitorTimer = null;
    const hooked = /* @__PURE__ */ new WeakSet();
    const observedDocs = /* @__PURE__ */ new WeakSet();
    const MEDIA_EVENTS = [
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
    let lastPageUrl = location.href;
    let blacklistRules = [];
    let isPageBlacklisted = false;
    let monitoringActive = false;
    let prototypesHooked = false;
    let urlMonitorTimer = null;
    const regexCache = /* @__PURE__ */ new Map();
    let lastReportedPlayback = null;
    let loopStartMs = null;
    let loopEndMs = null;
    let isLooping = false;
    let programmaticSeek = false;
    let loopCheckTimer = null;
    function clearLoopState() {
      if (isLooping) {
        isLooping = false;
        loopStartMs = null;
        loopEndMs = null;
        if (loopCheckTimer) {
          clearInterval(loopCheckTimer);
          loopCheckTimer = null;
        }
        send("loop-cleared", {});
      } else {
        log.debug("loop", "clearLoopState called but not looping");
      }
    }
    function startLoopCheck() {
      if (loopCheckTimer) {
        clearInterval(loopCheckTimer);
      }
      loopCheckTimer = setInterval(() => {
        if (!isLooping || !activeVideo || loopStartMs === null || loopEndMs === null) {
          if (loopCheckTimer) {
            clearInterval(loopCheckTimer);
            loopCheckTimer = null;
          }
          return;
        }
        const currentTimeMs = activeVideo.currentTime * 1e3;
        if (currentTimeMs >= loopEndMs) {
          programmaticSeek = true;
          activeVideo.currentTime = loopStartMs / 1e3;
        }
      }, 100);
    }
    function resetPlaybackPrediction() {
      lastReportedPlayback = null;
    }
    function recordPlaybackSample(state) {
      if (!state) {
        return;
      }
      const playbackRate = Number.isFinite(state.playbackRate) ? state.playbackRate : 1;
      const effectiveRate = state.paused ? 0 : playbackRate;
      lastReportedPlayback = {
        currentTime: state.currentTime,
        playbackRate: effectiveRate,
        reportedAt: state.updatedAt
      };
    }
    function predictPlaybackTime(now = Date.now()) {
      if (!lastReportedPlayback) {
        return null;
      }
      const elapsed = now - lastReportedPlayback.reportedAt;
      return lastReportedPlayback.currentTime + elapsed * lastReportedPlayback.playbackRate;
    }
    function ensureDriftMonitor() {
      if (driftMonitorTimer || !monitoringActive) {
        return;
      }
      const tick = () => {
        if (!monitoringActive || !activeVideo) {
          driftMonitorTimer = null;
          return;
        }
        if (!activeVideo.isConnected) {
          endActiveVideoSession("removed-from-dom");
          driftMonitorTimer = null;
          return;
        }
        if (lastReportedPlayback) {
          const predicted = predictPlaybackTime();
          if (predicted !== null) {
            const actual = activeVideo.currentTime * 1e3;
            if (Math.abs(predicted - actual) > DRIFT_THRESHOLD_MS) {
              log.debug("drift", "Playback drift detected", {
                predicted: Math.round(predicted),
                actual: Math.round(actual)
              });
              handleTimeUpdate(activeVideo);
            }
          }
        }
        driftMonitorTimer = window.setTimeout(tick, DRIFT_CHECK_INTERVAL_MS);
      };
      driftMonitorTimer = window.setTimeout(tick, DRIFT_CHECK_INTERVAL_MS);
    }
    function stopDriftMonitor() {
      if (driftMonitorTimer) {
        clearTimeout(driftMonitorTimer);
        driftMonitorTimer = null;
      }
    }
    function endActiveVideoSession(reason = "ended") {
      if (!activeVideo) {
        return;
      }
      const src = activeVideo.currentSrc || activeVideo.src || "(no src)";
      clearLoopState();
      log.info("video", `Video ${reason}`, { src });
      send("video-ended", { pageUrl: location.href });
      setActiveVideo(null);
    }
    function loadBlacklistRules() {
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
    function compileRegex(pattern) {
      if (!pattern) {
        return null;
      }
      if (regexCache.has(pattern)) {
        return regexCache.get(pattern);
      }
      try {
        const regex = new RegExp(pattern);
        regexCache.set(pattern, regex);
        return regex;
      } catch (error) {
        log.warn("blacklist", "Invalid regex", { pattern });
        regexCache.set(pattern, null);
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
    function isUrlBlacklisted(url, rules = blacklistRules) {
      const target = typeof url === "string" ? url : "";
      if (!target) {
        return false;
      }
      return rules.some((rule) => matchesBlacklistRule(rule, target));
    }
    function evaluateBlacklistForCurrentUrl() {
      const blocked = isUrlBlacklisted(location.href);
      if (blocked === isPageBlacklisted) {
        return blocked;
      }
      isPageBlacklisted = blocked;
      if (blocked) {
        log.info("blacklist", "Current page is blacklisted, stopping detection", { url: location.href });
        stopMonitoring();
      } else {
        log.info("blacklist", "Current page removed from blacklist, resuming detection", { url: location.href });
        startMonitoring();
      }
      return blocked;
    }
    function handleStorageChange(changes, areaName) {
      if (areaName !== "local") {
        return;
      }
      if (!Object.prototype.hasOwnProperty.call(changes, BLACKLIST_STORAGE_KEY)) {
        return;
      }
      const nextRules = normalizeBlacklistRules(changes[BLACKLIST_STORAGE_KEY].newValue ?? []);
      blacklistRules = nextRules;
      regexCache.clear();
      evaluateBlacklistForCurrentUrl();
    }
    function ensureUrlWatcher() {
      if (urlMonitorTimer !== null) {
        return;
      }
      const tick = () => {
        if (lastPageUrl !== location.href) {
          lastPageUrl = location.href;
          log.info("page", "URL changed", { url: lastPageUrl, title: document.title });
          if (monitoringActive) {
            send("page-url-changed", { pageUrl: lastPageUrl, title: document.title });
          }
          evaluateBlacklistForCurrentUrl();
        }
        urlMonitorTimer = window.setTimeout(tick, 1e3);
      };
      urlMonitorTimer = window.setTimeout(tick, 1e3);
    }
    function handlePortMessage(message) {
      if (!monitoringActive || !message || typeof message !== "object") return;
      log.debug("msg", `\u2190 ${message.type}`, message);
      if (message.type === "control") {
        applyControl(message.action, message.payload || {});
      }
    }
    function schedulePortReconnect() {
      if (!monitoringActive) {
        return;
      }
      if (reconnectTimer) return;
      log.info("conn", `Reconnecting... ${RECONNECT_DELAY_MS}ms`);
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        connectPort();
      }, RECONNECT_DELAY_MS);
    }
    function connectPort() {
      if (!monitoringActive) {
        return null;
      }
      if (port) return port;
      let nextPort = null;
      try {
        nextPort = chrome.runtime.connect({ name: PORT_NAME });
        log.info("conn", "Connected", { url: location.href });
      } catch (err) {
        log.error("conn", "Connection failed", err);
        schedulePortReconnect();
        return null;
      }
      nextPort.onMessage.addListener(handlePortMessage);
      nextPort.onDisconnect.addListener(() => {
        if (port === nextPort) {
          port = null;
          log.info("conn", "Disconnected");
        }
        if (monitoringActive) {
          schedulePortReconnect();
        }
      });
      port = nextPort;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      if (activeVideo) {
        log.info("conn", "Reconnected successfully, syncing video state");
        send("video-context", gatherVideoState(activeVideo));
        handleTimeUpdate(activeVideo);
      }
      return nextPort;
    }
    function startKeepAlive() {
      if (keepAliveTimer !== null || !monitoringActive) {
        return;
      }
      const tick = () => {
        if (!monitoringActive) {
          stopKeepAlive();
          return;
        }
        send("keepalive", {
          pageUrl: location.href,
          title: document.title,
          timestamp: Date.now()
        });
        keepAliveTimer = window.setTimeout(tick, KEEPALIVE_INTERVAL_MS);
      };
      keepAliveTimer = window.setTimeout(tick, KEEPALIVE_INTERVAL_MS);
    }
    function stopKeepAlive() {
      if (keepAliveTimer !== null) {
        clearTimeout(keepAliveTimer);
        keepAliveTimer = null;
      }
    }
    function send(type, payload = {}) {
      if (!monitoringActive) {
        return;
      }
      const channel = port || connectPort();
      if (!channel) {
        log.warn("msg", `Send failed: ${type} (no connection)`);
        return;
      }
      try {
        log.debug("msg", `\u2192 ${type}`, payload);
        channel.postMessage({ type, payload });
      } catch (err) {
        log.error("msg", `Send failed: ${type}`, err);
        if (port === channel) {
          port = null;
        }
        schedulePortReconnect();
      }
    }
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
        // Convert seconds to milliseconds
        duration: Number.isFinite(video.duration) ? video.duration * 1e3 : null,
        // Convert seconds to milliseconds
        paused: video.paused,
        muted: video.muted,
        volume: video.volume,
        readyState: video.readyState,
        title: document.title,
        updatedAt: Date.now()
      };
    }
    function handleTimeUpdate(video) {
      if (!monitoringActive) {
        return;
      }
      const state = gatherVideoState(video);
      if (!state) {
        return;
      }
      send("time-update", state);
      recordPlaybackSample(state);
    }
    function setActiveVideo(video) {
      if (!monitoringActive) {
        return;
      }
      const nextVideo = video ?? null;
      const switchedVideo = activeVideo !== nextVideo;
      activeVideo = nextVideo;
      if (video) {
        log.info("video", "Video activated", { src: video.currentSrc || video.src, duration: video.duration });
        send("video-context", gatherVideoState(video));
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
    function watchVideo(video) {
      if (!monitoringActive || !video || !(video instanceof HTMLVideoElement)) return;
      const root = video.getRootNode?.();
      if (root instanceof ShadowRoot) {
        ensureDocListeners(root);
      } else {
        ensureDocListeners(document);
      }
      if (hooked.has(video)) return;
      hooked.add(video);
      log.info("video", "Video detected", {
        src: video.currentSrc || video.src || "(no src)",
        duration: video.duration,
        readyState: video.readyState
      });
      handleTimeUpdate(video);
    }
    function applyControl(action, payload) {
      if (!monitoringActive) {
        return;
      }
      const target = activeVideo || document.querySelector("video");
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
            log.warn("ctrl", `seek failed: invalid time`, payload);
          }
          break;
        case "loop":
          if (typeof payload.start === "number" && typeof payload.end === "number" && Number.isFinite(payload.start) && Number.isFinite(payload.end)) {
            log.debug("ctrl", "loop requested", { start: payload.start, end: payload.end, before: Math.round(target.currentTime * 1e3) });
            loopStartMs = payload.start;
            loopEndMs = payload.end;
            isLooping = true;
            programmaticSeek = true;
            const wasPaused = target.paused;
            target.currentTime = loopStartMs / 1e3;
            log.debug("ctrl", "loop applied", { after: Math.round(target.currentTime * 1e3) });
            if (wasPaused) {
              target.play().catch((err) => {
                log.error("ctrl", "Auto-play after loop enabled failed", err);
              });
            }
            startLoopCheck();
            send("loop-started", {});
          } else {
            log.warn("ctrl", `loop failed: invalid times`, payload);
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
    function ensureDocListeners(target) {
      if (!target || typeof target.addEventListener !== "function" || observedDocs.has(target)) return;
      observedDocs.add(target);
      MEDIA_EVENTS.forEach((eventName) => {
        target.addEventListener(eventName, handleDocumentMediaEvent, { capture: true, passive: true });
      });
    }
    function handleDocumentMediaEvent(event) {
      if (!monitoringActive) {
        return;
      }
      const target = event?.target;
      if (!(target instanceof HTMLVideoElement)) return;
      log.debug("event", event.type, {
        time: target.currentTime?.toFixed(1),
        paused: target.paused,
        active: target === activeVideo
      });
      watchVideo(target);
      switch (event.type) {
        case "play":
        case "playing":
          setActiveVideo(target);
          handleTimeUpdate(target);
          break;
        case "loadedmetadata":
          if (!activeVideo) {
            setActiveVideo(target);
          } else {
            send("video-context", gatherVideoState(target));
          }
          break;
        case "loadeddata":
          if (!activeVideo) {
            setActiveVideo(target);
          }
          handleTimeUpdate(target);
          break;
        case "pause":
          if (target === activeVideo) {
            clearLoopState();
            handleTimeUpdate(target);
          }
          break;
        case "seeking":
          if (target === activeVideo && !programmaticSeek) {
            clearLoopState();
          }
          programmaticSeek = false;
          break;
        case "seeked":
          programmaticSeek = false;
          if (target === activeVideo) {
            handleTimeUpdate(target);
          }
          break;
        case "durationchange":
        case "volumechange":
        case "enterpictureinpicture":
        case "leavepictureinpicture":
          if (activeVideo === target) {
            handleTimeUpdate(target);
          }
          break;
        case "ratechange":
          if (activeVideo === target) {
            handleTimeUpdate(target);
          }
          break;
        case "ended":
          if (activeVideo === target) {
            endActiveVideoSession("playback-ended");
          }
          break;
        default:
          break;
      }
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
      if (!root) return;
      const elements = root.querySelectorAll("*");
      elements.forEach((element) => {
        const shadowRoot = getShadowRoot(element);
        if (shadowRoot && !observedDocs.has(shadowRoot)) {
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
          if (video === activeVideo && !video.isConnected) {
            endActiveVideoSession("removed-from-dom");
          }
        });
      });
    }
    function setupDOMMutationObserver() {
      const observer = new MutationObserver((mutations) => {
        if (!monitoringActive) return;
        mutations.forEach((mutation) => {
          mutation.removedNodes.forEach((node) => handleRemovedNode(node));
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const shadowRoot = getShadowRoot(node);
              if (shadowRoot && !observedDocs.has(shadowRoot)) {
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
      return observer;
    }
    let domObserver = null;
    function ensurePrototypeHooks() {
      if (prototypesHooked) {
        return;
      }
      prototypesHooked = true;
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
    function startMonitoring() {
      if (monitoringActive || isPageBlacklisted) {
        return;
      }
      monitoringActive = true;
      ensurePrototypeHooks();
      connectPort();
      ensureDocListeners(document);
      startKeepAlive();
      log.info("shadow", "Scanning for existing Shadow DOMs...");
      scanForShadowRoots();
      domObserver = setupDOMMutationObserver();
    }
    function stopMonitoring() {
      if (!monitoringActive) {
        return;
      }
      monitoringActive = false;
      stopDriftMonitor();
      resetPlaybackPrediction();
      activeVideo = null;
      stopKeepAlive();
      if (domObserver) {
        domObserver.disconnect();
        domObserver = null;
      }
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      if (port) {
        try {
          port.disconnect();
        } catch (err) {
          log.warn("conn", "Failed to disconnect port", err);
        }
        port = null;
      }
    }
    async function bootstrap() {
      try {
        const raw = await loadBlacklistRules();
        blacklistRules = normalizeBlacklistRules(raw);
      } catch (error) {
        log.logError("blacklist", "Failed to init blacklist", error);
        blacklistRules = [];
      }
      regexCache.clear();
      isPageBlacklisted = isUrlBlacklisted(location.href);
      if (isPageBlacklisted) {
        log.info("blacklist", "Current page is blacklisted, skipping detection", { url: location.href });
      } else {
        startMonitoring();
      }
      ensureUrlWatcher();
    }
    chrome.storage.onChanged.addListener(handleStorageChange);
    ["beforeunload", "unload"].forEach((eventName) => {
      window.addEventListener(eventName, () => {
        stopDriftMonitor();
      });
    });
    bootstrap();
  })();
})();
//# sourceMappingURL=content-script.js.map
