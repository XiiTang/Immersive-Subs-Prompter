import { Logger } from "../../shared/Logger";
import type {
  ConnectionState,
  DesktopConnectionSnapshot
} from "../../shared/types";
import type { FromExtensionBroadcastMessage, HeartbeatAckMessage, ToExtensionMessage } from "@immersive-subs/contracts";

const RETRY_DELAY_MS = 2000;

const logger = new Logger("desktop-conn");

type OutgoingDesktopMessage = FromExtensionBroadcastMessage | HeartbeatAckMessage;
type WithoutTransportEnvelope<T> = T extends unknown ? Omit<T, "source" | "sentAt"> : never;
export type DesktopConnectionSendPayload = WithoutTransportEnvelope<OutgoingDesktopMessage>;

export class DesktopConnection {
  endpoint: string;
  onDesktopMessage?: (message: ToExtensionMessage, sourceEndpoint: string) => void;
  onStatusChange?: (snapshot: DesktopConnectionSnapshot) => void;
  socket: WebSocket | null;
  retryTimer: ReturnType<typeof setTimeout> | null;
  stopped: boolean;
  state: ConnectionState;
  lastError: string | null;
  lastChangeAt: number;

  constructor(
    endpoint: string,
    onDesktopMessage?: (message: ToExtensionMessage, sourceEndpoint: string) => void,
    onStatusChange?: (snapshot: DesktopConnectionSnapshot) => void,
    private readonly onConnected?: (connection: DesktopConnection) => void
  ) {
    this.endpoint = endpoint;
    this.onDesktopMessage = onDesktopMessage;
    this.onStatusChange = onStatusChange;
    this.socket = null;
    this.retryTimer = null;
    this.stopped = false;
    this.state = "idle";
    this.lastError = null;
    this.lastChangeAt = Date.now();
  }

  getSnapshot(): DesktopConnectionSnapshot {
    return {
      endpoint: this.endpoint,
      state: this.state,
      lastError: this.lastError,
      lastChangeAt: this.lastChangeAt
    };
  }

  updateState(nextState: ConnectionState, error: string | null = null) {
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
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
    }
    this.updateState("connecting");

    try {
      logger.info("ws", "Connecting...", { endpoint: this.endpoint });
      this.socket = new WebSocket(this.endpoint);
    } catch (err) {
      logger.error("ws", "Failed to create connection", { endpoint: this.endpoint, err });
      this.updateState("disconnected", err instanceof Error ? err.message : String(err));
      this.scheduleReconnect();
      return;
    }

    this.socket.addEventListener("open", () => {
      this.updateState("connected");
      this.onConnected?.(this);
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
        const payload = JSON.parse(raw) as ToExtensionMessage;

        if (payload.type === "heartbeat") {
          const ack: DesktopConnectionSendPayload = { type: "heartbeat-ack" };
          this.send(ack);
          logger.debug("ws", "Received heartbeat, sent ACK", { endpoint: this.endpoint });
          return;
        }

        logger.debug("ws", `->${payload.type}`, { source: payload.source, endpoint: this.endpoint });
        this.onDesktopMessage?.(payload, this.endpoint);
      } catch (err) {
        logger.error("ws", "Failed to parse message", err);
      }
    });

    this.socket.addEventListener("error", (err: Event) => {
      logger.error("ws", "WebSocket error", err);
      this.updateState("disconnected", String(err));
      this.socket?.close();
    });
  }

  scheduleReconnect() {
    if (this.stopped) return;
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
    }
    logger.info("ws", `Reconnecting... ${RETRY_DELAY_MS}ms`, { endpoint: this.endpoint });
    this.retryTimer = setTimeout(() => this.connect(), RETRY_DELAY_MS);
  }

  send(payload: DesktopConnectionSendPayload) {
    const data = JSON.stringify({
      source: "usp-extension",
      ...payload,
      sentAt: Date.now()
    });

    logger.debug("ws", `->${payload.type}`, {
      tabId: "tabId" in payload ? payload.tabId : undefined,
      endpoint: this.endpoint
    });

    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(data);
    } else {
      this.connect();
    }
  }

  destroy() {
    this.stopped = true;
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
    }
    if (this.socket) {
      try {
        this.socket.close();
      } catch (err) {
        logger.warn("ws", "Failed to close socket cleanly", { endpoint: this.endpoint, err });
      }
    }
    this.socket = null;
    this.updateState("idle");
  }
}
