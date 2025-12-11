import { WebSocket, WebSocketServer } from "ws";
import { SubtitleService } from "./subtitleService.js";
import { AppEventBus, ConnectionMessageEvent } from "./appEventBus.js";
import { StateManager } from "./stateManager.js";
import { createLogger } from "./logger.js";
import { SubtitleCacheManager } from "./subtitleCacheManager.js";
import {
  ExtensionMessage,
  ExtensionMessageType,
  ExtensionPayload,
  NetworkSettings,
  SubtitleTrack,
  VideoControlCommand
} from "./types.js";

const PAGE_URL_SITES = new Set(["youtube", "bilibili", "douyin"]);

type ConnectionManagerOptions = {
  getNetworkSettings: () => NetworkSettings;
  subtitleService: SubtitleService;
  stateManager: StateManager;
  bus: AppEventBus;
  cacheManager: SubtitleCacheManager;
};

type TrackSelectionPayload = {
  trackId: string | null;
  role?: "primary" | "secondary";
};

export class ConnectionManager {
  private readonly log = createLogger("connection");
  private readonly tabSockets = new Map<number, WebSocket>();
  private readonly socketTabs = new Map<WebSocket, Set<number>>();
  private subtitleRequestToken = 0;
  private server: WebSocketServer | null = null;
  private currentNetwork: NetworkSettings | null = null;

  constructor(private readonly options: ConnectionManagerOptions) {}

  start() {
    this.applyNetworkSettings(true);
  }

  stop() {
    this.shutdownServer();
  }

  applyNetworkSettings(forceRestart = false) {
    const target = this.options.getNetworkSettings();
    if (!forceRestart && this.server && this.currentNetwork && this.isSameNetwork(target, this.currentNetwork)) {
      return;
    }
    this.log.info("Applying network settings", target);
    this.restartServer(target);
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

    let payload: Record<string, unknown> | undefined;
    if (command.type === "seek") {
      payload = { time: command.time };
    } else if (command.type === "loop") {
      this.options.stateManager.updateState((draft) => {
        draft.playback.loopCueIndex = command.cueIndex;
      });
      payload = { start: command.start, end: command.end };
    }

    this.log.debug("Sending control command", {
      type: command.type,
      payload,
      activeTabId: state.activeTabId,
      readyState: socket.readyState
    });

    socket.send(
      JSON.stringify({
        source: "usp-desktop",
        type: "control-command",
        tabId: state.activeTabId,
        action: command.type,
        payload
      }),
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

  private restartServer(target: NetworkSettings) {
    this.shutdownServer();
    try {
      this.server = this.bootstrapWebSocketServer(target);
      this.currentNetwork = { ...target };
    } catch (error) {
      this.log.error("Failed to start WebSocket server with new settings", { target, error });
      this.currentNetwork = null;
    }
  }

  private shutdownServer() {
    if (!this.server) {
      return;
    }
    try {
      for (const client of this.server.clients) {
        try {
          client.close();
        } catch (error) {
          this.log.warn("Failed to close WebSocket client during shutdown", error);
        }
      }
    } catch (error) {
      this.log.warn("Failed to iterate WebSocket clients during shutdown", error);
    }
    this.server.close();
    this.server = null;
    this.currentNetwork = null;
  }

  private isSameNetwork(a: NetworkSettings, b: NetworkSettings): boolean {
    return a.host === b.host && a.port === b.port;
  }

  private bootstrapWebSocketServer(network: NetworkSettings) {
    const wss = new WebSocketServer({ port: network.port, host: network.host });
    this.log.info(`WebSocket server listening on ws://${network.host}:${network.port}`);

    const connectedClients = new Set<WebSocket>();

    const heartbeatInterval = setInterval(() => {
      connectedClients.forEach((socket) => {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ source: "usp-desktop", type: "heartbeat" }));
        }
      });
    }, 25000);

    wss.on("connection", (socket: WebSocket) => {
      this.log.info("Extension connected");
      this.options.stateManager.changeConnectionCount(+1);
      connectedClients.add(socket);
      this.options.bus.emit("connection:client-connected", { socket });

      socket.on("message", (raw: Buffer) => {
        this.handleSocketMessage(socket, raw).catch((error) => {
          this.log.error("Failed to handle message", error);
        });
      });

      socket.on("close", () => {
        this.log.info("Extension disconnected");
        connectedClients.delete(socket);
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
      this.log.error("WebSocket server error", error);
    });

    wss.on("close", () => {
      clearInterval(heartbeatInterval);
      connectedClients.clear();
    });

    return wss;
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

    const { tabId, type, payload } = parsed as {
      tabId: number;
      type: ExtensionMessageType;
      payload: ExtensionPayload;
    };

    this.rememberTabSocket(tabId, socket);
    const resolvedUrl = type === "video-context" ? this.resolveVideoUrl(payload) : null;
    const event: ConnectionMessageEvent = {
      message: { tabId, type, payload },
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

  private async getCachedTranscriptionTracks(videoUrl: string): Promise<SubtitleTrack[]> {
    try {
      const cached = await this.options.cacheManager.get(videoUrl, "transcription");
      return cached?.tracks ?? [];
    } catch (error) {
      this.log.warn("Failed to read transcription cache", { videoUrl, error });
      return [];
    }
  }

  private async handleMessage(message: ExtensionMessage, resolvedUrl: string | null) {
    switch (message.type) {
      case "video-context": {
        this.options.stateManager.setPageContext(message.tabId, {
          pageUrl: message.payload.pageUrl ?? null,
          site: message.payload.site ?? null,
          title: message.payload.title ?? null
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

        const cachedTranscriptionTracks = await this.getCachedTranscriptionTracks(normalizedUrl);
        if (cachedTranscriptionTracks.length) {
          this.log.info("Using cached transcription for video", { url: normalizedUrl });
        }

        const requestId = ++this.subtitleRequestToken;
        try {
          const result = await this.options.subtitleService.getSubtitles(resolvedUrl);
          if (requestId === this.subtitleRequestToken) {
            const tracks: SubtitleTrack[] = cachedTranscriptionTracks.length
              ? [...cachedTranscriptionTracks, ...result.tracks]
              : result.tracks;
            this.options.stateManager.setSubtitleTracks(tracks);
            this.options.stateManager.applyPreferredTracksFromSettings(tracks);
            this.options.stateManager.updateState((draft) => {
              draft.status = "ready";
              draft.error = null;
            });
          }
        } catch (error) {
          if (requestId === this.subtitleRequestToken) {
            if (cachedTranscriptionTracks.length) {
              this.options.stateManager.setSubtitleTracks(cachedTranscriptionTracks);
              this.options.stateManager.applyPreferredTracksFromSettings(cachedTranscriptionTracks);
              this.options.stateManager.updateState((draft) => {
                draft.status = "ready";
                draft.error = null;
              });
            } else {
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

        this.options.stateManager.updatePlayback({
          currentTime,
          playbackRate
        });
        break;
      }

      case "loop-started": {
        const state = this.options.stateManager.getState();
        if (state.activeTabId !== null && state.activeTabId !== message.tabId) {
          return;
        }

        this.options.stateManager.updatePlayback({
          isLooping: true
        });
        break;
      }

      case "loop-cleared": {
        const state = this.options.stateManager.getState();
        if (state.activeTabId !== message.tabId) {
          return;
        }

        this.options.stateManager.updateState((draft) => {
          draft.playback.isLooping = false;
          draft.playback.loopCueIndex = null;
        });
        this.options.bus.emit("playback:loop-cleared", undefined as void);
        this.options.bus.emit("state:playback", this.options.stateManager.getState().playback);
        break;
      }

      case "video-ended": {
        const state = this.options.stateManager.getState();
        if (state.activeTabId === message.tabId && state.activeSource !== "jellyfin") {
          this.options.stateManager.updateState((draft) => {
            draft.status = draft.connectionCount > 0 ? "awaiting-video" : "idle";
            draft.primarySubtitles = null;
            draft.secondarySubtitles = null;
            draft.subtitleTracks = [];
            draft.selectedPrimarySubtitleId = null;
            draft.selectedSecondarySubtitleId = null;
            draft.videoUrl = null;
          });
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

  private resolveVideoUrl(payload: ExtensionPayload): string | null {
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
