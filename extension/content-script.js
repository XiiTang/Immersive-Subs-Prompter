// 简化的日志函数
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
    "timeupdate",
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

  function handlePortMessage(message) {
    if (!message || typeof message !== "object") return;
    log.debug('msg', `← ${message.type}`, message);
    if (message.type === "control") {
      log.info('ctrl', `接收: ${message.action}`, message.payload);
      applyControl(message.action, message.payload || {});
    }
  }

  function schedulePortReconnect() {
    if (reconnectTimer) return;
    log.info('conn', `重连中... ${RECONNECT_DELAY_MS}ms`);
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connectPort();
    }, RECONNECT_DELAY_MS);
  }

  function connectPort() {
    if (port) return port;
    let nextPort = null;
    try {
      nextPort = chrome.runtime.connect({ name: PORT_NAME });
      log.info('conn', '已连接', { url: location.href });
    } catch (err) {
      log.error('conn', '连接失败', err);
      schedulePortReconnect();
      return null;
    }

    nextPort.onMessage.addListener(handlePortMessage);
    nextPort.onDisconnect.addListener(() => {
      if (port === nextPort) {
        port = null;
        log.info('conn', '已断开');
      }
      schedulePortReconnect();
    });

    port = nextPort;
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    if (activeVideo) {
      log.info('conn', '重连成功，同步视频状态');
      send("video-context", gatherVideoState(activeVideo));
      handleTimeUpdate(activeVideo);
    }
    return nextPort;
  }

  function send(type, payload = {}) {
    const channel = port || connectPort();
    if (!channel) {
      log.warn('msg', `发送失败: ${type} (无连接)`);
      return;
    }
    try {
      log.debug('msg', `→ ${type}`, payload);
      channel.postMessage({ type, payload });
    } catch (err) {
      log.error('msg', `发送失败: ${type}`, err);
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
    log.debug('site', `检测: ${site}`, { hostname: host });
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
    const state = gatherVideoState(video);
    if (state) {
      send("time-update", state);
    }
  }

  function ensureTicker() {
    if (ticker) return;
    ticker = setInterval(() => {
      if (activeVideo && !activeVideo.paused) {
        handleTimeUpdate(activeVideo);
      }
    }, UPDATE_INTERVAL_MS);
  }

  function stopTicker() {
    clearInterval(ticker);
    ticker = null;
  }

  function setActiveVideo(video) {
    activeVideo = video;
    if (video) {
      log.info('video', '激活视频', { src: video.currentSrc || video.src, duration: video.duration });
      send("video-context", gatherVideoState(video));
      ensureTicker();
    } else if (!video) {
      log.info('video', '视频已清空');
      stopTicker();
    }
  }

  function watchVideo(video) {
    if (!video || !(video instanceof HTMLVideoElement)) return;
    const root = video.getRootNode?.();
    if (root instanceof ShadowRoot) {
      ensureDocListeners(root);
    } else {
      ensureDocListeners(window);
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

  function monitorUrlChanges() {
    if (lastPageUrl !== location.href) {
      lastPageUrl = location.href;
      log.info('page', 'URL变化', { url: lastPageUrl, title: document.title });
      send("page-url-changed", { pageUrl: lastPageUrl, title: document.title });
    }
    setTimeout(monitorUrlChanges, 1000);
  }

  function ensureDocListeners(target) {
    if (!target || typeof target.addEventListener !== "function" || observedDocs.has(target)) return;
    observedDocs.add(target);
    MEDIA_EVENTS.forEach((eventName) => {
      target.addEventListener(eventName, handleDocumentMediaEvent, { capture: true, passive: true });
    });
  }

  function handleDocumentMediaEvent(event) {
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
      case "timeupdate":
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

  // Mirror GlobalSpeed's passive detection by wrapping media prototype methods.
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

  connectPort();
  ensureDocListeners(window);
  ensureDocListeners(document);
  monitorUrlChanges();
})();
