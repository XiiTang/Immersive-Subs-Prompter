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
  const UPDATE_INTERVAL_MS = 300;
  const PORT_NAME = "usp-video-channel";
  const RECONNECT_DELAY_MS = 1000;

  let port = null;
  let reconnectTimer = null;
  let activeVideo = null;
  let ticker = null;
  const hooked = new WeakSet();
  const observedDocs = new WeakSet();
  const MEDIA_EVENTS = [
    "play",
    "playing",
    "pause",
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
      log.info('ctrl', `Received: ${message.action}`, message.payload);
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
      currentTime: video.currentTime,
      duration: Number.isFinite(video.duration) ? video.duration : null,
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
  }

  function ensureTicker() {
    if (ticker || !monitoringActive) return;
    ticker = setInterval(() => {
      if (activeVideo && !activeVideo.paused) {
        handleTimeUpdate(activeVideo);
      }
    }, UPDATE_INTERVAL_MS);
  }

  function stopTicker() {
    if (ticker) {
      clearInterval(ticker);
      ticker = null;
    }
  }

  function setActiveVideo(video) {
    if (!monitoringActive) {
      return;
    }
    activeVideo = video;
    if (video) {
      log.info('video', 'Video activated', { src: video.currentSrc || video.src, duration: video.duration });
      send("video-context", gatherVideoState(video));
      ensureTicker();
    } else {
      log.info('video', 'Video cleared');
      stopTicker();
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
    log.info('video', '检测到视频', { 
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
      log.warn('ctrl', `执行失败: ${action} (无视频)`);
      return;
    }

    switch (action) {
      case "seek":
        if (typeof payload.time === "number" && Number.isFinite(payload.time)) {
          const clamped = Math.max(0, Math.min(payload.time, target.duration || payload.time));
          target.currentTime = clamped;
          handleTimeUpdate(target);
          log.info('ctrl', `seek → ${clamped.toFixed(2)}s`);
        } else {
          log.warn('ctrl', `seek 失败: 无效时间`, payload);
        }
        break;
      case "pause":
        target.pause();
        log.info('ctrl', 'pause');
        break;
      case "play":
        target.play().catch((err) => {
          log.error('ctrl', 'play 失败', err);
        }).then(() => {
          log.info('ctrl', 'play');
        });
        break;
      default:
        log.warn('ctrl', `未知命令: ${action}`);
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
          send("playback-rate", gatherVideoState(target));
        }
        break;
      case "ended":
        if (activeVideo === target) {
          log.info('video', '播放结束');
          send("video-ended", { pageUrl: location.href });
          setActiveVideo(null);
        }
        break;
      default:
        break;
    }
  }

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
        ensureDocListeners(shadowRoot);
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
  }

  function stopMonitoring() {
    if (!monitoringActive) {
      return;
    }
    monitoringActive = false;
    stopTicker();
    activeVideo = null;
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    if (port) {
      try {
        port.disconnect();
      } catch (err) {
        log.warn('conn', '断开端口失败', err);
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
      log.info('blacklist', '当前页面在黑名单中，跳过检测', { url: location.href });
    } else {
      startMonitoring();
    }
    ensureUrlWatcher();
  }

  chrome.storage.onChanged.addListener(handleStorageChange);
  ["beforeunload", "unload"].forEach((eventName) => {
    window.addEventListener(eventName, () => {
      stopTicker();
    });
  });
  bootstrap();
})();
