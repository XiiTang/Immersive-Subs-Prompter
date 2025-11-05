(function () {
  const UPDATE_INTERVAL_MS = 300;
  const PORT_NAME = "usp-video-channel";
  const RECONNECT_DELAY_MS = 1000;
  let port = null;
  let reconnectTimer = null;
  let activeVideo = null;
  let ticker = null;
  const hooked = new WeakSet();
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
      playbackRate: video.playbackRate,
      currentTime: video.currentTime,
      duration: Number.isFinite(video.duration) ? video.duration : null,
      paused: video.paused,
      muted: video.muted,
      volume: video.volume,
      readyState: video.readyState,
      title: document.title
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
    if (!video || hooked.has(video)) return;
    hooked.add(video);

    video.addEventListener("play", () => {
      setActiveVideo(video);
      handleTimeUpdate(video);
    });

    video.addEventListener("loadedmetadata", () => {
      if (!activeVideo) {
        setActiveVideo(video);
      } else {
        send("video-context", gatherVideoState(video));
      }
    });

    video.addEventListener("pause", () => {
      if (activeVideo === video) {
        handleTimeUpdate(video);
      }
    });

    video.addEventListener("ratechange", () => {
      if (activeVideo === video) {
        send("playback-rate", gatherVideoState(video));
      }
    });

    video.addEventListener("timeupdate", () => {
      if (activeVideo === video) {
        handleTimeUpdate(video);
      }
    });

    video.addEventListener("loadeddata", () => {
      if (!activeVideo) {
        setActiveVideo(video);
      }
      handleTimeUpdate(video);
    });

    video.addEventListener("ended", () => {
      if (activeVideo === video) {
        send("video-ended", { pageUrl: location.href });
        setActiveVideo(null);
      }
    });
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

  function scanForVideos() {
    document.querySelectorAll("video").forEach(watchVideo);
  }

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      mutation.addedNodes.forEach((node) => {
        if (!(node instanceof Element)) return;
        if (node.tagName === "VIDEO") {
          watchVideo(node);
        } else {
          node.querySelectorAll("video").forEach(watchVideo);
        }
      });
    }
  });

  observer.observe(document.documentElement || document.body, {
    childList: true,
    subtree: true
  });

  function monitorUrlChanges() {
    if (lastPageUrl !== location.href) {
      lastPageUrl = location.href;
      send("page-url-changed", { pageUrl: lastPageUrl, title: document.title });
      scanForVideos();
    }
    setTimeout(monitorUrlChanges, 1000);
  }

  connectPort();
  scanForVideos();
  monitorUrlChanges();
})();
