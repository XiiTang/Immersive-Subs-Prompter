import WebSocket from "ws";
import { buildWebSocketUrl, createAuthHeaders, JellyfinembyIdentity } from "../jellyfinembyUtils.js";
import { MediaServerConfig } from "../types.js";
import { swallow } from "../errors.js";
import { KEEP_ALIVE_INTERVAL_MS, RECONNECT_DELAY_MS } from "./constants.js";

type Logger = {
  info: (message: string, ...details: unknown[]) => void;
  warn: (message: string, ...details: unknown[]) => void;
  error: (message: string, ...details: unknown[]) => void;
  debug: (message: string, ...details: unknown[]) => void;
};

export type TransportHooks = {
  onOpen: () => void;
  onMessage: (raw: WebSocket.RawData) => void;
  onClose: () => void;
  onError: (error: Error) => void;
};

export class JellyfinembyWebSocketTransport {
  private socket: WebSocket | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private keepAliveTimer: NodeJS.Timeout | null = null;
  private disposed = false;

  constructor(
    private config: MediaServerConfig,
    private readonly identity: JellyfinembyIdentity,
    private readonly log: Logger,
    private readonly hooks: TransportHooks
  ) {}

  updateConfig(nextConfig: MediaServerConfig) {
    this.config = nextConfig;
  }

  isOpen(): boolean {
    return !!this.socket && this.socket.readyState === WebSocket.OPEN;
  }

  connect() {
    if (this.socket || this.reconnectTimer || this.disposed) {
      return;
    }

    if (!this.config.serverUrl || !this.config.apiKey) {
      this.log.warn(`[${this.config.name}] Jellyfinemby server URL or API key missing, skipping connection`);
      return;
    }

    try {
      const wsUrl = new URL(buildWebSocketUrl(this.config));
      wsUrl.searchParams.set("api_key", this.config.apiKey);
      wsUrl.searchParams.set("deviceId", this.identity.deviceId);
      wsUrl.searchParams.set("client", this.identity.clientName);
      wsUrl.searchParams.set("deviceName", this.identity.deviceName);
      wsUrl.searchParams.set("version", this.identity.version);
      const headers = {
        ...createAuthHeaders(this.config.apiKey, this.identity)
      };
      this.log.info(`[${this.config.name}] Connecting to Jellyfinemby WebSocket ${wsUrl.toString()}`);
      this.socket = new WebSocket(wsUrl.toString(), { headers });
    } catch (error) {
      this.log.error(`[${this.config.name}] Failed to create Jellyfinemby WebSocket`, error);
      this.scheduleReconnect();
      return;
    }

    this.socket.on("open", () => {
      this.log.info(`[${this.config.name}] Jellyfinemby WebSocket connected`);
      this.startKeepAlive();
      this.hooks.onOpen();
    });
    this.socket.on("message", (raw) => this.hooks.onMessage(raw));
    this.socket.on("close", () => {
      this.log.warn(`[${this.config.name}] Jellyfinemby WebSocket closed`);
      this.stopKeepAlive();
      this.socket = null;
      this.hooks.onClose();
      this.scheduleReconnect();
    });
    this.socket.on("error", (error) => {
      this.log.error(`[${this.config.name}] Jellyfinemby WebSocket error`, error);
      this.hooks.onError(error instanceof Error ? error : new Error(String(error)));
    });
  }

  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.stopKeepAlive();
    if (this.socket) {
      try {
        this.socket.close();
      } catch (error) {
        swallow(error, "jellyfinemby.ws.disconnect", "socket already closed");
      }
      this.socket = null;
    }
  }

  sendMessage(message: unknown) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return;
    }
    try {
      this.socket.send(JSON.stringify(message));
    } catch (error) {
      this.log.error("Failed to send Jellyfinemby message", error);
    }
  }

  dispose() {
    this.disposed = true;
    this.disconnect();
  }

  private scheduleReconnect() {
    if (this.disposed || this.reconnectTimer) {
      return;
    }
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, RECONNECT_DELAY_MS);
  }

  private sendKeepAlive() {
    this.sendMessage({ MessageType: "KeepAlive" });
  }

  handleForceKeepAlive() {
    this.sendKeepAlive();
  }

  private startKeepAlive() {
    this.stopKeepAlive();
    this.keepAliveTimer = setInterval(() => this.sendKeepAlive(), KEEP_ALIVE_INTERVAL_MS);
  }

  private stopKeepAlive() {
    if (this.keepAliveTimer) {
      clearInterval(this.keepAliveTimer);
      this.keepAliveTimer = null;
    }
  }

  reset() {
    this.disposed = false;
  }
}
