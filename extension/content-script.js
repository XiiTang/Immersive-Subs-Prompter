const log = (() => {
  const PREFIX = "[USP][content]";
  const fmt = (cat, msg, data) => {
    const time = new Date().toISOString().split('T')[1].slice(0, -1);
    return data !== undefined 
      ? `${PREFIX}[${cat}] ${time} ${msg}` 
      : `${PREFIX}[${cat}] ${time} ${msg}`;
  };
  return {
    debug: (cat, msg, data) => console.log(fmt(cat, msg), data),
    info: (cat, msg, data) => console.info(fmt(cat, msg), data),
    warn: (cat, msg, data) => console.warn(fmt(cat, msg), data),
    error: (cat, msg, err) => console.error(fmt(cat, msg), err)
  };
})();

(function () {
  const BLACKLIST_STORAGE_KEY = "uspBlacklistRules";
  const BLACKLIST_MODES = new Set(["contains", "exact", "regex"]);
  const DRIFT_CHECK_INTERVAL_MS = 250;
  const DRIFT_THRESHOLD_MS = 200;
  const PORT_NAME = "usp-video-channel";
  const RECONNECT_DELAY_MS = 1000;

  let port = null;
  let reconnectTimer = null;
  let activeVideo = null;
  let driftMonitorTimer = null;
  const hooked = new WeakSet();
  const observedDocs = new WeakSet();
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
  const regexCache = new Map();
  let lastReportedPlayback = null;
  
  // Loop control variables (stored in milliseconds for precision)
  let loopStartMs = null;
  let loopEndMs = null;
  let isLooping = false;
  let programmaticSeek = false; // Track if seek is triggered by program, not user
  let loopCheckTimer = null; // Timer for checking loop condition
  
  // Helper function to clear loop state and notify desktop-app
  function clearLoopState() {
    if (isLooping) {
      isLooping = false;
      loopStartMs = null;
      loopEndMs = null;
      if (loopCheckTimer) {
        clearInterval(loopCheckTimer);
        loopCheckTimer = null;
      }
      
      // Notify desktop-app to update UI
      send("loop-cleared", {});
    } else {
      log.debug('loop', 'clearLoopState called but not looping');
    }
  }
  
  // Start loop check timer
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
      
      const currentTimeMs = activeVideo.currentTime * 1000;
      
      // Check if we've exceeded the loop end point
      if (currentTimeMs >= loopEndMs) {
        // Seek back to loop start
        programmaticSeek = true;
        activeVideo.currentTime = loopStartMs / 1000;
      }
    }, 100); // Check every 100ms for responsive looping
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
      
      if (lastReportedPlayback) {
        const predicted = predictPlaybackTime();
        if (predicted !== null) {
          const actual = activeVideo.currentTime * 1000;
          if (Math.abs(predicted - actual) > DRIFT_THRESHOLD_MS) {
            log.debug('drift', 'Playback drift detected', {
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

  function normalizeBlacklistRules(input) {
    if (!Array.isArray(input)) {
      return [];
    }
    return input
      .map((entry, index) => {
        if (!entry || typeof entry !== "object") {
          return null;
        }
        const id =
          typeof entry.id === "string" && entry.id.length
            ? entry.id
            : `rule-${Date.now()}-${index}`;
        const mode =
          typeof entry.mode === "string" && BLACKLIST_MODES.has(entry.mode)
            ? entry.mode
            : "contains";
        const value = typeof entry.value === "string" ? entry.value.trim() : "";
        return { id, mode, value };
      })
      .filter(Boolean);
  }

  function loadBlacklistRules() {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.get([BLACKLIST_STORAGE_KEY], (result) => {
          if (chrome.runtime?.lastError) {
            console.error("[USP] Failed to read blacklist", chrome.runtime.lastError);
            resolve([]);
            return;
          }
          resolve(result?.[BLACKLIST_STORAGE_KEY] ?? []);
        });
      } catch (error) {
        console.error("[USP] Failed to read blacklist", error);
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
      log.warn('blacklist', 'Invalid regex', { pattern });
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
      log.info('blacklist', 'Current page is blacklisted, stopping detection', { url: location.href });
      stopMonitoring();
    } else {
      log.info('blacklist', 'Current page removed from blacklist, resuming detection', { url: location.href });
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
        log.info('page', 'URL changed', { url: lastPageUrl, title: document.title });
        if (monitoringActive) {
          send("page-url-changed", { pageUrl: lastPageUrl, title: document.title });
        }
        evaluateBlacklistForCurrentUrl();
      }
      urlMonitorTimer = window.setTimeout(tick, 1000);
    };
    urlMonitorTimer = window.setTimeout(tick, 1000);
  }

  function handlePortMessage(message) {
    if (!monitoringActive || !message || typeof message !== "object") return;
    log.debug('msg', `← ${message.type}`, message);
    if (message.type === "control") {
      applyControl(message.action, message.payload || {});
    }
  }

  function schedulePortReconnect() {
    if (!monitoringActive) {
      return;
    }
    if (reconnectTimer) return;
    log.info('conn', `Reconnecting... ${RECONNECT_DELAY_MS}ms`);
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
      log.info('conn', 'Connected', { url: location.href });
    } catch (err) {
      log.error('conn', 'Connection failed', err);
      schedulePortReconnect();
      return null;
    }

    nextPort.onMessage.addListener(handlePortMessage);
    nextPort.onDisconnect.addListener(() => {
      if (port === nextPort) {
        port = null;
        log.info('conn', 'Disconnected');
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
      log.info('conn', 'Reconnected successfully, syncing video state');
      send("video-context", gatherVideoState(activeVideo));
      handleTimeUpdate(activeVideo);
    }
    return nextPort;
  }

  function send(type, payload = {}) {
    if (!monitoringActive) {
      return;
    }
    const channel = port || connectPort();
    if (!channel) {
      log.warn('msg', `Send failed: ${type} (no connection)`);
      return;
    }
    try {
      log.debug('msg', `→ ${type}`, payload);
      channel.postMessage({ type, payload });
    } catch (err) {
      log.error('msg', `Send failed: ${type}`, err);
      if (port === channel) {
        port = null;
      }
      schedulePortReconnect();
    }
  }

  function detectSite() {
    const host = location.hostname;
    const site = host.includes("youtube.com") ? "youtube" :
                 host.includes("bilibili.com") ? "bilibili" :
                 host.includes("douyin.com") ? "douyin" : "unknown";
    log.debug('site', `Detected: ${site}`, { hostname: host });
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
      currentTime: video.currentTime * 1000, // Convert seconds to milliseconds
      duration: Number.isFinite(video.duration) ? video.duration * 1000 : null, // Convert seconds to milliseconds
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
      log.info('video', 'Video activated', { src: video.currentSrc || video.src, duration: video.duration });
      send("video-context", gatherVideoState(video));
      if (switchedVideo) {
        resetPlaybackPrediction();
      }
      ensureDriftMonitor();
    } else {
      log.info('video', 'Video cleared');
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
    log.info('video', 'Video detected', { 
      src: video.currentSrc || video.src || '(no src)',
      duration: video.duration,
      readyState: video.readyState
    });
  }

  function applyControl(action, payload) {
    if (!monitoringActive) {
      return;
    }
    const target = activeVideo || document.querySelector("video");
    if (!target) {
      log.warn('ctrl', `Failed to execute: ${action} (no video)`);
      return;
    }

    switch (action) {
      case "seek":
        // Clear loop state when seeking manually
        clearLoopState();
        if (typeof payload.time === "number" && Number.isFinite(payload.time)) {
          const timeInSeconds = payload.time / 1000; // Convert milliseconds to seconds
          const clamped = Math.max(0, Math.min(timeInSeconds, target.duration || timeInSeconds));
          const wasPaused = target.paused;
          target.currentTime = clamped;
          // Auto-play if video was paused
          if (wasPaused) {
            target.play().catch((err) => {
              log.error('ctrl', 'Auto-play after seek failed', err);
            });
          }
          handleTimeUpdate(target);
        } else {
          log.warn('ctrl', `seek failed: invalid time`, payload);
        }
        break;
      case "loop":
        if (typeof payload.start === "number" && typeof payload.end === "number" && 
            Number.isFinite(payload.start) && Number.isFinite(payload.end)) {
          loopStartMs = payload.start;
          loopEndMs = payload.end;
          isLooping = true;
          programmaticSeek = true;
          const wasPaused = target.paused;
          target.currentTime = loopStartMs / 1000;
          if (wasPaused) {
            target.play().catch((err) => {
              log.error('ctrl', 'Auto-play after loop enabled failed', err);
            });
          }
          
          // Start loop check timer
          startLoopCheck();
          
          // Notify desktop that loop started
          send("loop-started", {});
        } else {
          log.warn('ctrl', `loop failed: invalid times`, payload);
          // Notify desktop that loop failed
          send("loop-cleared", {});
        }
        break;
      case "stopLoop":
        clearLoopState();
        break;
      case "pause":
        // Clear loop state when pausing
        clearLoopState();
        target.pause();
        break;
      case "play":
        // Clear loop state when playing
        clearLoopState();
        target.play().catch((err) => {
          log.error('ctrl', 'play failed', err);
        });
        break;
      default:
        log.warn('ctrl', `Unknown command: ${action}`);
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
    
    log.debug('event', event.type, { 
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
        // Clear loop when user manually pauses
        if (target === activeVideo) {
          clearLoopState();
          handleTimeUpdate(target);
        }
        break;
      case "seeking":
        // Only clear loop if this is a user-triggered seek, not programmatic
        if (target === activeVideo && !programmaticSeek) {
          clearLoopState();
        }
        programmaticSeek = false; // Reset flag
        break;
      case "seeked":
        // Reset flag when seek completes
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
          clearLoopState();
          log.info('video', 'Playback ended');
          send("video-ended", { pageUrl: location.href });
          setActiveVideo(null);
        }
        break;
      default:
        break;
    }
  }

  // Helper function to get Shadow DOM (including closed ones)
  function getShadowRoot(element) {
    if (!element) return null;
    // Try to get shadow root via Chrome API for closed shadow roots
    if (typeof chrome !== 'undefined' && chrome.dom && chrome.dom.openOrClosedShadowRoot) {
      try {
        return chrome.dom.openOrClosedShadowRoot(element);
      } catch (err) {
        // Fallback to normal shadowRoot
      }
    }
    return element.shadowRoot;
  }

  // Recursively scan for Shadow DOMs
  function scanForShadowRoots(root = document.body) {
    if (!root) return;
    
    const elements = root.querySelectorAll('*');
    elements.forEach(element => {
      const shadowRoot = getShadowRoot(element);
      if (shadowRoot && !observedDocs.has(shadowRoot)) {
        log.info('shadow', 'Found Shadow DOM', { host: element.tagName });
        ensureDocListeners(shadowRoot);
        // Recursively scan inside shadow root
        scanForShadowRoots(shadowRoot);
      }
    });
  }

  // Set up MutationObserver to detect dynamically added elements
  function setupDOMMutationObserver() {
    const observer = new MutationObserver((mutations) => {
      if (!monitoringActive) return;
      
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            // Check if added node has shadow root
            const shadowRoot = getShadowRoot(node);
            if (shadowRoot && !observedDocs.has(shadowRoot)) {
              log.info('shadow', 'New Shadow DOM detected via mutation', { host: node.tagName });
              ensureDocListeners(shadowRoot);
              scanForShadowRoots(shadowRoot);
            }
            // Also scan descendants of added node
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
      HTMLMediaElement.prototype[methodName] = function (...args) {
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
      Element.prototype.attachShadow = function (...args) {
        const shadowRoot = originalAttachShadow.apply(this, args);
        log.info('shadow', 'attachShadow called', { host: this.tagName, mode: args[0]?.mode });
        ensureDocListeners(shadowRoot);
        // Scan for nested shadow roots
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
    
    // Scan for existing Shadow DOMs that may have been created before script injection
    log.info('shadow', 'Scanning for existing Shadow DOMs...');
    scanForShadowRoots();
    
    // Set up mutation observer to detect new shadow roots
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
    
    // Disconnect mutation observer
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
        log.warn('conn', 'Failed to disconnect port', err);
      }
      port = null;
    }
  }

  async function bootstrap() {
    try {
      const raw = await loadBlacklistRules();
      blacklistRules = normalizeBlacklistRules(raw);
    } catch (error) {
      console.error("[USP] Failed to init blacklist", error);
      blacklistRules = [];
    }
    regexCache.clear();
    isPageBlacklisted = isUrlBlacklisted(location.href);
    if (isPageBlacklisted) {
      log.info('blacklist', 'Current page is blacklisted, skipping detection', { url: location.href });
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
