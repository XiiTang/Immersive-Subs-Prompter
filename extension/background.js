const WS_ENDPOINT = "ws://127.0.0.1:44501";
const RETRY_DELAY_MS = 2000;

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
      this.socket = new WebSocket(WS_ENDPOINT);
    } catch (err) {
      console.error("[USP] Failed to create WebSocket", err);
      this.scheduleReconnect();
      return;
    }

    this.socket.addEventListener("open", () => {
      console.info("[USP] Connected to desktop app");
      this.flushPending();
    });

    this.socket.addEventListener("close", () => {
      console.warn("[USP] Desktop app disconnected");
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
        this.onDesktopMessage?.(payload);
      } catch (err) {
        console.error("[USP] Failed to parse desktop message", err);
      }
    });

    this.socket.addEventListener("error", (err) => {
      console.error("[USP] WebSocket error", err);
      this.socket.close();
    });
  }

  scheduleReconnect() {
    clearTimeout(this.retryTimer);
    this.retryTimer = setTimeout(() => this.connect(), RETRY_DELAY_MS);
  }

  flushPending() {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
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

    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(data);
    } else {
      this.pending.push(data);
      this.connect();
    }
  }
}

const tabMetadata = new Map();
const tabPorts = new Map();

function sendToContentScript(tabId, message) {
  const port = tabPorts.get(tabId);
  if (!port) {
    console.warn("[USP] No content script port for tab", tabId);
    return;
  }
  try {
    port.postMessage(message);
  } catch (err) {
    console.error("[USP] Failed to deliver message to tab", tabId, err);
  }
}

function handleDesktopMessage(message) {
  if (!message || typeof message !== "object") return;
  if (message.source !== "usp-desktop") return;

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
  if (port.name !== "usp-video-channel") {
    return;
  }

  const tabId = port.sender?.tab?.id;
  if (tabId === undefined) {
    console.warn("[USP] Ignoring port without tab id");
    return;
  }

  tabMetadata.set(tabId, { lastVideoUrl: null });
  tabPorts.set(tabId, port);

  port.onMessage.addListener((message) => {
    bridge.send({
      tabId,
      type: message.type,
      payload: message.payload
    });

    if (message.type === "video-context") {
      const tabInfo = tabMetadata.get(tabId) || {};
      tabInfo.lastVideoUrl = message.payload.pageUrl;
      tabMetadata.set(tabId, tabInfo);
    }
  });

  port.onDisconnect.addListener(() => {
    tabMetadata.delete(tabId);
    tabPorts.delete(tabId);
    bridge.send({
      tabId,
      type: "video-ended",
      payload: {}
    });
  });
});
