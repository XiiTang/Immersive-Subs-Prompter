import { Logger } from "../../shared/Logger.js";

const RETRY_DELAY_MS = 2000;

const logger = new Logger("desktop-conn");

export class DesktopConnection {
  constructor(endpoint, onDesktopMessage, onStatusChange) {
    this.endpoint = endpoint;
    this.onDesktopMessage = onDesktopMessage;
    this.onStatusChange = onStatusChange;
    this.socket = null;
    this.retryTimer = null;
    this.pending = [];
    this.stopped = false;
    this.state = "idle";
    this.lastError = null;
    this.lastChangeAt = Date.now();
  }

  getSnapshot() {
    return {
      endpoint: this.endpoint,
      state: this.state,
      lastError: this.lastError,
      lastChangeAt: this.lastChangeAt,
      pendingMessages: this.pending.length
    };
  }

  updateState(nextState, error = null) {
    if (this.state === nextState && this.lastError === error) {
      return;
    }
    this.state = nextState;
    this.lastError = error;
    this.lastChangeAt = Date.now();
    this.onStatusChange?.(this.getSnapshot());
  }

  connect() {
    if (this.stopped) return;
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return;
    }
    clearTimeout(this.retryTimer);
    this.updateState("connecting");

    try {
      logger.info("ws", "Connecting...", { endpoint: this.endpoint });
      this.socket = new WebSocket(this.endpoint);
    } catch (err) {
      logger.error("ws", "Failed to create connection", { endpoint: this.endpoint, err });
      this.updateState("disconnected", err?.message || String(err));
      this.scheduleReconnect();
      return;
    }

    this.socket.addEventListener("open", () => {
      this.updateState("connected");
      this.flushPending();
    });

    this.socket.addEventListener("close", () => {
      logger.warn("ws", "Disconnected", { endpoint: this.endpoint });
      this.updateState("disconnected");
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

        if (payload.type === "heartbeat") {
          this.send({ type: "heartbeat-ack" });
          logger.debug("ws", "Received heartbeat, sent ACK", { endpoint: this.endpoint });
          return;
        }

        logger.debug("ws", `->${payload.type}`, { source: payload.source, endpoint: this.endpoint });
        this.onDesktopMessage?.(payload, this.endpoint);
      } catch (err) {
        logger.error("ws", "Failed to parse message", err);
      }
    });

    this.socket.addEventListener("error", (err) => {
      logger.error("ws", "WebSocket error", err);
      this.updateState("disconnected", err?.message || String(err));
      this.socket?.close();
    });
  }

  scheduleReconnect() {
    if (this.stopped) return;
    clearTimeout(this.retryTimer);
    logger.info("ws", `Reconnecting... ${RETRY_DELAY_MS}ms`, { endpoint: this.endpoint });
    this.retryTimer = setTimeout(() => this.connect(), RETRY_DELAY_MS);
  }

  flushPending() {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
    if (this.pending.length > 0) {
      logger.info("ws", `Sending queue: ${this.pending.length} messages`, { endpoint: this.endpoint });
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

    logger.debug("ws", `->${payload.type}`, { tabId: payload.tabId, endpoint: this.endpoint });

    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(data);
    } else {
      this.pending.push(data);
      this.connect();
    }
  }

  destroy() {
    this.stopped = true;
    clearTimeout(this.retryTimer);
    if (this.socket) {
      try {
        this.socket.close();
      } catch (err) {
        logger.warn("ws", "Failed to close socket cleanly", { endpoint: this.endpoint, err });
      }
    }
    this.socket = null;
    this.pending = [];
    this.updateState("idle");
  }
}
