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
    if (message.type === "control") {
      applyControl(message.action, message.payload || {});
    }
  }

  function schedulePortReconnect() {
    if (reconnectTimer) return;
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
    } catch (err) {
      console.warn("[USP] Failed to connect to background", err);
      schedulePortReconnect();
      return null;
    }

    nextPort.onMessage.addListener(handlePortMessage);
    nextPort.onDisconnect.addListener(() => {
      if (port === nextPort) {
        port = null;
      }
      schedulePortReconnect();
    });

    port = nextPort;
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    if (activeVideo) {
      send("video-context", gatherVideoState(activeVideo));
      handleTimeUpdate(activeVideo);
    }
    return nextPort;
  }

  function send(type, payload = {}) {
    const channel = port || connectPort();
    if (!channel) return;
    try {
      channel.postMessage({ type, payload });
    } catch (err) {
      console.warn("[USP] Failed to send message", err);
      if (port === channel) {
        port = null;
      }
      schedulePortReconnect();
    }
  }

  function detectSite() {
    const host = location.hostname;
    if (host.includes("youtube.com")) return "youtube";
    if (host.includes("bilibili.com")) return "bilibili";
    if (host.includes("douyin.com")) return "douyin";
    return "unknown";
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
      send("video-context", gatherVideoState(video));
      ensureTicker();
    } else if (!video) {
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
  }

  function applyControl(action, payload) {
    const target = activeVideo || document.querySelector("video");
    if (!target) return;

    switch (action) {
      case "seek":
        if (typeof payload.time === "number" && Number.isFinite(payload.time)) {
          const clamped = Math.max(0, Math.min(payload.time, target.duration || payload.time));
          target.currentTime = clamped;
          handleTimeUpdate(target);
        }
        break;
      case "pause":
        target.pause();
        break;
      case "play":
        target.play().catch((err) => {
          console.warn("[USP] Failed to resume playback", err);
        });
        break;
      default:
        break;
    }
  }

  function monitorUrlChanges() {
    if (lastPageUrl !== location.href) {
      lastPageUrl = location.href;
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
