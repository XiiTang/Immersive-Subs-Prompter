const log = (() => {
  const PREFIX = "[USP][offscreen]";
  const fmt = (cat, msg) => {
    const time = new Date().toISOString().split("T")[1].slice(0, -1);
    return `${PREFIX}[${cat}] ${time} ${msg}`;
  };
  return {
    debug: (cat, msg, data) => console.debug(fmt(cat, msg), data ?? ""),
    info: (cat, msg, data) => console.info(fmt(cat, msg), data ?? ""),
    warn: (cat, msg, data) => console.warn(fmt(cat, msg), data ?? ""),
    error: (cat, msg, err) => console.error(fmt(cat, msg), err ?? "")
  };
})();

const WS_ENDPOINT = "ws://127.0.0.1:44501";
const RETRY_DELAY_MS = 2000;
const SERVICE_WORKER_PORT = "usp-offscreen-bridge";
const KEEPALIVE_INTERVAL_MS = 15000;

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
      log.info("ws", "Connecting...", { endpoint: WS_ENDPOINT });
      this.socket = new WebSocket(WS_ENDPOINT);
    } catch (err) {
      log.error("ws", "Failed to create connection", err);
      this.scheduleReconnect();
      return;
    }

    this.socket.addEventListener("open", () => {
      log.info("ws", "Connected");
      this.flushPending();
    });

    this.socket.addEventListener("close", () => {
      log.warn("ws", "Disconnected");
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
        log.debug("ws", `← ${payload.type}`, { source: payload.source });
        this.onDesktopMessage?.(payload);
      } catch (err) {
        log.error("ws", "Failed to parse message", err);
      }
    });

    this.socket.addEventListener("error", (err) => {
      log.error("ws", "WebSocket error", err);
      this.socket.close();
    });
  }

  scheduleReconnect() {
    clearTimeout(this.retryTimer);
    log.info("ws", `Reconnecting... ${RETRY_DELAY_MS}ms`);
    this.retryTimer = setTimeout(() => this.connect(), RETRY_DELAY_MS);
  }

  flushPending() {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
    if (this.pending.length > 0) {
      log.info("ws", `Sending queue: ${this.pending.length} messages`);
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

    log.debug("ws", `→ ${payload.type}`, { tabId: payload.tabId });

    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(data);
    } else {
      log.debug("ws", `Queue +1 (${this.pending.length + 1})`);
      this.pending.push(data);
      this.connect();
    }
  }
}

let serviceWorkerPort = null;
const pendingMessagesToWorker = [];

function postToWorker(message) {
  if (!serviceWorkerPort) {
    pendingMessagesToWorker.push(message);
    return;
  }
  try {
    serviceWorkerPort.postMessage(message);
  } catch (error) {
    log.error("port", "Failed to post to worker, queueing", error);
    pendingMessagesToWorker.push(message);
    serviceWorkerPort = null;
    connectToServiceWorker();
  }
}

function flushPendingMessages() {
  if (!serviceWorkerPort || !pendingMessagesToWorker.length) {
    return;
  }
  while (pendingMessagesToWorker.length) {
    serviceWorkerPort.postMessage(pendingMessagesToWorker.shift());
  }
}

const bridge = new DesktopBridge((message) => {
  postToWorker({
    type: "from-desktop",
    payload: message
  });
});

function connectToServiceWorker() {
  try {
    serviceWorkerPort = chrome.runtime.connect({ name: SERVICE_WORKER_PORT });
  } catch (error) {
    log.error("port", "Failed to connect to service worker", error);
    setTimeout(connectToServiceWorker, RETRY_DELAY_MS);
    return;
  }
  log.info("port", "Connected to service worker");
  flushPendingMessages();
  postToWorker({ type: "bridge-ready" });

  serviceWorkerPort.onMessage.addListener((message) => {
    if (!message || typeof message !== "object") {
      return;
    }
    if (message.type === "to-desktop" && message.payload) {
      bridge.send(message.payload);
    } else if (message.type === "bridge-connect") {
      bridge.connect();
    }
  });

  serviceWorkerPort.onDisconnect.addListener(() => {
    log.warn("port", "Service worker disconnected, retrying...");
    serviceWorkerPort = null;
    setTimeout(connectToServiceWorker, RETRY_DELAY_MS);
  });
}

function startKeepAlivePulse() {
  setInterval(() => {
    postToWorker({ type: "offscreen-keepalive", sentAt: Date.now() });
  }, KEEPALIVE_INTERVAL_MS);
}

startKeepAlivePulse();
connectToServiceWorker();
