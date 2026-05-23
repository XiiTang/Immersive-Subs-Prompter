import { WebSocket, WebSocketServer } from "ws";
import type { IncomingMessage } from "node:http";
import { SubtitleService } from "./subtitleService.js";
import { AppEventBus, ConnectionMessageEvent } from "./appEventBus.js";
import { StateManager } from "./stateManager.js";
import { createLogger } from "./logger.js";
import { isAuthorizedDesktopClient } from "./connectionAuth.js";
import { networkEndpointKey } from "../common/networkEndpoints.js";
import type {
  ControlLoopCommandMessage,
  ControlSeekCommandMessage,
  FromExtensionBroadcastMessage,
  ToExtensionMessage
} from "@immersive-subs/contracts";
import {
  AppSettings,
  NetworkEndpoint,
  NetworkListenerStatus,
  NetworkSettings,
  SubtitleTrack,
  VideoControlCommand
} from "./types.js";

const PAGE_URL_SITES = new Set(["youtube", "bilibili", "douyin"]);

type ConnectionManagerOptions = {
  getNetworkSettings: () => NetworkSettings;
  getSettings: () => AppSettings;
  subtitleService: SubtitleService;
  stateManager: StateManager;
  bus: AppEventBus;
  createWebSocketServer?: WebSocketServerFactory;
};

type WebSocketServerOptions = NonNullable<ConstructorParameters<typeof WebSocketServer>[0]>;
type WebSocketServerFactory = (options: WebSocketServerOptions) => WebSocketServer;

type ListenerRecord = {
  endpoint: NetworkEndpoint;
  server: WebSocketServer | null;
  connectedClients: Set<WebSocket>;
  heartbeatInterval: NodeJS.Timeout | null;
  status: "listening" | "error";
  error: string | null;
};

type TrackSelectionPayload = {
  trackId: string | null;
  role?: "primary" | "secondary";
};

export class ConnectionManager {
  private readonly log = createLogger("connection");
  private readonly createWebSocketServer: WebSocketServerFactory;
  private readonly tabSockets = new Map<number, WebSocket>();
  private readonly socketTabs = new Map<WebSocket, Set<number>>();
  private subtitleRequestToken = 0;
  private readonly listeners = new Map<string, ListenerRecord>();
  private currentNetwork: NetworkSettings | null = null;

  constructor(private readonly options: ConnectionManagerOptions) {
    this.createWebSocketServer =
      options.createWebSocketServer ?? ((serverOptions) => new WebSocketServer(serverOptions));
  }

  start() {
    this.applyNetworkSettings(true);
  }

  stop() {
    this.shutdownServer();
  }

  applyNetworkSettings(forceRestart = false) {
    const target = this.options.getNetworkSettings();
    if (!forceRestart && this.currentNetwork && this.isSameNetwork(target, this.currentNetwork)) {
      return;
    }

    this.log.info("Applying network settings", this.networkLogFields(target));
    const targetIds = new Set(target.endpoints.map((endpoint) => endpoint.id));
    for (const endpointId of Array.from(this.listeners.keys())) {
      if (forceRestart || !targetIds.has(endpointId)) {
        this.shutdownListener(endpointId);
      }
    }

    for (const endpoint of target.endpoints) {
      const current = this.listeners.get(endpoint.id);
      const shouldRestart =
        forceRestart ||
        !current ||
        networkEndpointKey(current.endpoint) !== networkEndpointKey(endpoint) ||
        this.currentNetwork?.authToken !== target.authToken;

      if (shouldRestart) {
        this.shutdownListener(endpoint.id);
        this.startListener(endpoint, target.authToken);
      }
    }

    this.currentNetwork = {
      endpoints: target.endpoints.map((endpoint) => ({ ...endpoint })),
      authToken: target.authToken
    };
    this.publishListenerStatuses();
  }

  sendControlCommand(command: VideoControlCommand): boolean {
    const state = this.options.stateManager.getState();
    if (state.activeTabId === null) {
      this.log.warn("Cannot send control command: no active tab");
      return false;
    }
    const socket = this.tabSockets.get(state.activeTabId);
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      this.log.warn("Cannot send control command: socket not ready", {
        hasSocket: !!socket,
        readyState: socket?.readyState
      });
      return false;
    }

    this.log.debug("Sending control command", {
      type: command.type,
      activeTabId: state.activeTabId,
      readyState: socket.readyState
    });

    const message: ToExtensionMessage =
      command.type === "seek"
        ? ({
            source: "usp-desktop",
            type: "control-command",
            tabId: state.activeTabId,
            action: "seek",
            payload: { time: command.time }
          } satisfies ControlSeekCommandMessage)
        : command.type === "loop"
        ? ({
            source: "usp-desktop",
            type: "control-command",
            tabId: state.activeTabId,
            action: "loop",
            payload: command.loop
          } satisfies ControlLoopCommandMessage)
        : {
            source: "usp-desktop",
            type: "control-command",
            tabId: state.activeTabId,
            action: command.type
          };

    socket.send(
      JSON.stringify(message),
      (err?: Error) => {
        if (err) {
          this.log.error("WebSocket send failed", err);
        } else {
          this.log.debug("Control command dispatched", { type: command.type });
        }
      }
    );
    return true;
  }

  private startListener(endpoint: NetworkEndpoint, authToken: string) {
    const record: ListenerRecord = {
      endpoint: { ...endpoint },
      server: null,
      connectedClients: new Set(),
      heartbeatInterval: null,
      status: "listening",
      error: null
    };
    this.listeners.set(endpoint.id, record);

    try {
      record.server = this.bootstrapWebSocketServer(endpoint, authToken, record);
    } catch (error) {
      record.status = "error";
      record.error = error instanceof Error ? error.message : String(error);
      this.log.error("Failed to start WebSocket listener", {
        endpoint: this.endpointLogFields(endpoint),
        error
      });
    }
  }

  private shutdownListener(endpointId: string) {
    const record = this.listeners.get(endpointId);
    if (!record) {
      return;
    }
    if (record.heartbeatInterval) {
      clearInterval(record.heartbeatInterval);
    }
    for (const client of record.connectedClients) {
      try {
        client.close();
      } catch (error) {
        this.log.warn("Failed to close WebSocket client during listener shutdown", error);
      }
    }
    record.server?.close();
    this.listeners.delete(endpointId);
  }

  private shutdownServer() {
    for (const endpointId of Array.from(this.listeners.keys())) {
      this.shutdownListener(endpointId);
    }
    this.currentNetwork = null;
    this.publishListenerStatuses();
  }

  private isSameNetwork(a: NetworkSettings, b: NetworkSettings): boolean {
    if (a.authToken !== b.authToken || a.endpoints.length !== b.endpoints.length) {
      return false;
    }
    return a.endpoints.every((endpoint, index) => {
      const other = b.endpoints[index];
      return !!other && endpoint.id === other.id && networkEndpointKey(endpoint) === networkEndpointKey(other);
    });
  }

  private networkLogFields(network: NetworkSettings) {
    return {
      endpoints: network.endpoints.map((endpoint) => this.endpointLogFields(endpoint)),
      authRequired: true
    };
  }

  private endpointLogFields(endpoint: NetworkEndpoint) {
    return {
      id: endpoint.id,
      host: endpoint.host,
      port: endpoint.port
    };
  }

  private publishListenerStatuses() {
    const statuses: NetworkListenerStatus[] = Array.from(this.listeners.values()).map((record) => ({
      endpointId: record.endpoint.id,
      host: record.endpoint.host,
      port: record.endpoint.port,
      status: record.status,
      error: record.error
    }));
    this.options.stateManager.setNetworkListenerStatuses(statuses);
  }

  private normalizeDuration(value: unknown): number | null {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return null;
    }
    return Math.max(0, value);
  }

  private bootstrapWebSocketServer(endpoint: NetworkEndpoint, authToken: string, record: ListenerRecord) {
    const wss = this.createWebSocketServer({
      port: endpoint.port,
      host: endpoint.host,
      verifyClient: ({ req }, done) => {
        const authorized = this.isAuthorizedRequest(req, endpoint, authToken);
        if (!authorized) {
          this.log.warn("Rejected unauthorized WebSocket client", {
            host: endpoint.host,
            port: endpoint.port,
            origin: req.headers.origin ?? null
          });
        }
        done(authorized, authorized ? undefined : 401, authorized ? undefined : "Unauthorized");
      }
    });
    this.log.info(`WebSocket server listening on ws://${endpoint.host}:${endpoint.port}`);

    record.heartbeatInterval = setInterval(() => {
      record.connectedClients.forEach((socket) => {
        if (socket.readyState === WebSocket.OPEN) {
          const heartbeat: ToExtensionMessage = { source: "usp-desktop", type: "heartbeat" };
          socket.send(JSON.stringify(heartbeat));
        }
      });
    }, 25000);

    wss.on("connection", (socket: WebSocket) => {
      this.log.info("Extension connected");
      this.options.stateManager.changeConnectionCount(+1);
      record.connectedClients.add(socket);
      this.options.bus.emit("connection:client-connected", { socket });

      socket.on("message", (raw: Buffer) => {
        this.handleSocketMessage(socket, raw).catch((error) => {
          this.log.error("Failed to handle message", error);
        });
      });

      socket.on("close", () => {
        this.log.info("Extension disconnected");
        record.connectedClients.delete(socket);
        this.forgetSocket(socket);
        this.options.stateManager.changeConnectionCount(-1);
        this.options.bus.emit("connection:client-disconnected", { socket });
      });

      socket.on("error", (error: Error) => {
        this.log.error("WebSocket error", error);
        socket.close();
      });
    });

    wss.on("error", (error: Error) => {
      record.status = "error";
      record.error = error.message;
      this.log.error("WebSocket server error", error);
      this.publishListenerStatuses();
    });

    wss.on("close", () => {
      if (record.heartbeatInterval) {
        clearInterval(record.heartbeatInterval);
        record.heartbeatInterval = null;
      }
      record.connectedClients.clear();
    });

    return wss;
  }

  private isAuthorizedRequest(req: IncomingMessage, endpoint: NetworkEndpoint, authToken: string): boolean {
    return isAuthorizedDesktopClient(
      {
        origin: req.headers.origin,
        requestUrl: req.url
      },
      { endpoint, authToken }
    );
  }

  private async handleSocketMessage(socket: WebSocket, raw: Buffer) {
    const parsed = this.parseMessage(raw);
    if (!parsed) {
      return;
    }

    if (parsed.type === "heartbeat-ack") {
      return;
    }

    if (parsed.source !== "usp-extension") {
      return;
    }

    const message = parsed as unknown as FromExtensionBroadcastMessage;
    const { tabId, type, payload } = message;

    this.rememberTabSocket(tabId, socket);
    const resolvedUrl = type === "video-context" ? this.resolveVideoUrl(payload) : null;
    const event: ConnectionMessageEvent = {
      message,
      resolvedUrl,
      handled: false,
      markHandled() {
        this.handled = true;
      }
    };
    this.options.bus.emit("connection:message", event);
    if (event.handled) {
      return;
    }

    await this.handleMessage(event.message, resolvedUrl);
  }

  private parseMessage(raw: Buffer): Record<string, unknown> | null {
    try {
      const data = JSON.parse(raw.toString());
      if (!data || typeof data !== "object") {
        return null;
      }
      return data as Record<string, unknown>;
    } catch (error) {
      this.log.error("Failed to process message", error);
      return null;
    }
  }

  private rememberTabSocket(tabId: number, socket: WebSocket) {
    this.tabSockets.set(tabId, socket);
    let tabs = this.socketTabs.get(socket);
    if (!tabs) {
      tabs = new Set();
      this.socketTabs.set(socket, tabs);
    }
    tabs.add(tabId);
  }

  private forgetSocket(socket: WebSocket) {
    const tabs = this.socketTabs.get(socket);
    if (!tabs) return;
    tabs.forEach((tabId) => {
      this.tabSockets.delete(tabId);
      this.options.bus.emit("connection:tab-removed", { tabId });
    });
    this.socketTabs.delete(socket);
  }

  private async handleMessage(message: FromExtensionBroadcastMessage, resolvedUrl: string | null) {
    switch (message.type) {
      case "video-context": {
        this.options.stateManager.setPageContext(message.tabId, {
          pageUrl: message.payload.pageUrl ?? null,
          site: message.payload.site ?? null,
          title: message.payload.title ?? null
        });

        const initialDuration = this.normalizeDuration(message.payload.duration);
        const initialPlaybackRate = message.payload.paused
          ? 0
          : message.payload.playbackRate ?? this.options.stateManager.getState().playback.playbackRate;
        const initialCurrentTime = message.payload.currentTime ?? 0;
        this.options.stateManager.updatePlayback({
          currentTime: initialCurrentTime,
          duration: initialDuration,
          playbackRate: initialPlaybackRate
        });

        if (!resolvedUrl) {
          this.options.stateManager.updateState((draft) => {
            draft.status = "error";
            draft.error = "Unable to parse video URL";
          });
          return;
        }

        const normalizedUrl = this.normalizeUrl(resolvedUrl);
        if (!normalizedUrl) {
          return;
        }

        const state = this.options.stateManager.getState();
        const previousVideoUrl = state.videoUrl;

        this.options.stateManager.updateState((draft) => {
          draft.activeSource = "extension";
          draft.videoUrl = normalizedUrl;
          draft.error = null;
        });

        const selection = this.options.stateManager.selectProfileForUrl(normalizedUrl);
        this.options.stateManager.applyProfileSelection(selection.profile, selection.rule);

        if (
          normalizedUrl === previousVideoUrl &&
          (state.subtitleTracks.length > 0 || state.status === "error")
        ) {
          this.log.info(
            `Same video detected (normalized URL matches), skipping subtitle reload: ${normalizedUrl}`
          );
          this.options.stateManager.emitCurrentState();
          return;
        }

        this.options.stateManager.resetSubtitleState(true);
        this.options.stateManager.updateState((draft) => {
          draft.status = "loading-subtitles";
        });

        const requestId = ++this.subtitleRequestToken;
        try {
          const result = await this.options.subtitleService.getSubtitles(normalizedUrl);
          if (requestId === this.subtitleRequestToken) {
            const tracks: SubtitleTrack[] = result.tracks;
            this.options.stateManager.setSubtitleTracks(tracks);
            this.options.stateManager.applyPreferredTracksFromSettings(tracks);
            this.options.stateManager.updateState((draft) => {
              draft.status = "ready";
              draft.error = null;
            });
          }
        } catch (error) {
          if (requestId === this.subtitleRequestToken) {
            this.options.stateManager.updateState((draft) => {
              draft.status = "error";
              draft.error =
                error && typeof error === "object" && "message" in error
                  ? (error as Error).message
                  : "Subtitle download failed";
              draft.primarySubtitles = null;
              draft.secondarySubtitles = null;
              draft.selectedPrimarySubtitleId = null;
              draft.selectedSecondarySubtitleId = null;
            });
          }
        }
        break;
      }

      case "time-update":
      case "playback-rate": {
        const state = this.options.stateManager.getState();
        if (state.activeTabId !== null && state.activeTabId !== message.tabId) {
          return;
        }

        const currentTime = message.payload.currentTime ?? state.playback.currentTime;
        const rawPlaybackRate = message.payload.playbackRate ?? state.playback.playbackRate;
        const playbackRate = message.payload.paused ? 0 : rawPlaybackRate;
        const durationUpdate = this.normalizeDuration(message.payload.duration);
        const duration = durationUpdate !== null ? durationUpdate : state.playback.duration ?? null;

        this.options.stateManager.updatePlayback({
          currentTime,
          playbackRate,
          duration,
          loop: message.payload.loop ?? null
        });
        break;
      }

      case "loop-started": {
        const state = this.options.stateManager.getState();
        if (state.activeTabId !== null && state.activeTabId !== message.tabId) {
          return;
        }

        this.options.stateManager.updatePlayback({
          loop: {
            ...message.payload,
            status: "running",
            boundaryTransition: "none",
            programmaticSeekReason: "manual-control"
          }
        });
        break;
      }

      case "loop-cleared": {
        const state = this.options.stateManager.getState();
        if (state.activeTabId !== message.tabId) {
          return;
        }

        this.options.stateManager.updateState((draft) => {
          draft.playback.loop = null;
        });
        this.options.bus.emit("playback:loop-cleared", undefined as void);
        this.options.bus.emit("state:playback", this.options.stateManager.getState().playback);
        break;
      }

      case "video-ended": {
        const state = this.options.stateManager.getState();
        if (state.activeTabId !== message.tabId) {
          break;
        }

        if (state.activeSource === "mediaserver") {
          this.options.stateManager.updateState((draft) => {
            draft.playback = {
              currentTime: 0,
              duration: null,
              playbackRate: 0,
              lastUpdate: null,
              loop: null
            };
          });
          this.options.bus.emit("state:playback", this.options.stateManager.getState().playback);
        } else {
          this.options.stateManager.updateState((draft) => {
            draft.status = draft.connectionCount > 0 ? "awaiting-video" : "idle";
            draft.primarySubtitles = null;
            draft.secondarySubtitles = null;
            draft.subtitleTracks = [];
            draft.selectedPrimarySubtitleId = null;
            draft.selectedSecondarySubtitleId = null;
            draft.videoUrl = null;
            draft.playback = {
              currentTime: 0,
              duration: null,
              playbackRate: 0,
              lastUpdate: null,
              loop: null
            };
          });
          this.options.bus.emit("state:playback", this.options.stateManager.getState().playback);
          const profile = this.options.stateManager.selectProfileForUrl(null).profile;
          this.options.stateManager.applyProfileSelection(profile, null);
        }
        break;
      }

      case "page-url-changed": {
        const state = this.options.stateManager.getState();
        if (state.activeTabId === message.tabId) {
          this.options.stateManager.updateState((draft) => {
            draft.pageUrl = message.payload.pageUrl ?? draft.pageUrl;
            draft.title = message.payload.title ?? draft.title;
          });
        }
        break;
      }

      default:
        break;
    }
  }

  setSubtitleTrack(payload: TrackSelectionPayload | string | null) {
    if (this.isTrackSelectionPayload(payload)) {
      const role = payload.role === "secondary" ? "secondary" : "primary";
      this.options.stateManager.setSubtitleTrack(payload.trackId ?? null, role);
    } else {
      this.options.stateManager.setSubtitleTrack((payload as string | null) ?? null, "primary");
    }
  }

  private isTrackSelectionPayload(value: unknown): value is TrackSelectionPayload {
    return Boolean(value && typeof value === "object" && "trackId" in value);
  }

  private normalizeUrl(url: string | null): string | null {
    if (!url) {
      return null;
    }

    try {
      const urlObj = new URL(url);

      // Bilibili: If no "p" param is present for a video URL, add p=1 to prevent
      // yt-dlp from downloading subtitles for the entire playlist (all episodes)
      // instead of just the first episode. This is safe for single videos too.
      if (
        urlObj.hostname.includes("bilibili.com") &&
        urlObj.pathname.startsWith("/video/") &&
        !urlObj.searchParams.has("p")
      ) {
        urlObj.searchParams.set("p", "1");
        this.log.debug("Added p=1 to Bilibili URL to prevent playlist download", { originalUrl: url });
      }

      const trackingParams = [
        "spm_id_from",
        "vd_source",
        "utm_source",
        "utm_medium",
        "utm_campaign",
        "utm_content",
        "utm_term",
        "from",
        "source",
        "share_source",
        "share_medium",
        "share_plat",
        "share_session_id",
        "share_tag",
        "timestamp"
      ];

      trackingParams.forEach((param) => {
        urlObj.searchParams.delete(param);
      });

      return urlObj.toString();
    } catch (error) {
      this.log.warn(`Failed to normalize URL: ${url}`, error);
      return url;
    }
  }

  private resolveVideoUrl(
    payload: Extract<FromExtensionBroadcastMessage, { type: "video-context" | "time-update" | "playback-rate" }>["payload"]
  ): string | null {
    const pageUrl = typeof payload.pageUrl === "string" ? payload.pageUrl : null;
    const videoSrc = typeof payload.videoSrc === "string" ? payload.videoSrc : null;
    const site = payload.site;

    if (pageUrl && /^https?:\/\//i.test(pageUrl) && site && PAGE_URL_SITES.has(site)) {
      return pageUrl;
    }

    if (videoSrc && /^https?:\/\//i.test(videoSrc)) {
      return videoSrc;
    }

    if (pageUrl && /^https?:\/\//i.test(pageUrl)) {
      return pageUrl;
    }

    return null;
  }
}
