import { AppEventBus, ConnectionMessageEvent } from "./appEventBus.js";
import { StateManager } from "./stateManager.js";
import { JellyfinembySubtitleService } from "./jellyfinembySubtitleService.js";
import { SubtitleCacheManager } from "./subtitleCacheManager.js";
import { createLogger } from "./logger.js";
import { normalizeServerUrl } from "./jellyfinembyUtils.js";
import {
  AppSettings,
  ExtensionMessage,
  ExtensionPayload,
  MediaServerConfig,
  MediaServerPlaybackPayload,
  MediaServerSessionSummary,
  MediaServerStatusPayload,
  MediaServerSubtitlesPayload
} from "./types.js";

type TabMediaServerContext = {
  itemId: string | null;
  sessionId: string | null;
  serverConfigId: string | null;
};

type MediaServerControllerOptions = {
  bus: AppEventBus;
  stateManager: StateManager;
  getSettings: () => AppSettings;
  cacheManager: SubtitleCacheManager;
};

export class MediaServerController {
  private readonly log = createLogger("mediaserver-controller");
  private readonly tabMediaServerContexts = new Map<number, TabMediaServerContext>();
  private readonly mediaServerService: JellyfinembySubtitleService;

  constructor(private readonly options: MediaServerControllerOptions) {
    this.mediaServerService = new JellyfinembySubtitleService(
      () => this.options.getSettings().mediaServer,
      this.options.cacheManager
    );
  }

  start() {
    this.registerBusListeners();
    this.registerServiceListeners();
    this.mediaServerService.start();
  }

  handleSettingsUpdated() {
    this.mediaServerService.refresh();
  }

  private registerBusListeners() {
    this.options.bus.on("connection:message", (event) => this.handleConnectionMessage(event));
    this.options.bus.on("connection:tab-removed", ({ tabId }) => this.clearTabMediaServerContext(tabId));
    this.options.bus.on("state:connection-count", ({ count }) => {
      const continuous = count === 0;
      this.mediaServerService.setContinuousSessionPolling(continuous);
    });
  }

  private registerServiceListeners() {
    this.mediaServerService.on("status", (payload) => this.handleMediaServerStatusUpdate(payload));
    this.mediaServerService.on("sessions", (sessions) => this.handleMediaServerSessionsUpdate(sessions));
    this.mediaServerService.on("subtitles", (payload) => this.handleMediaServerSubtitlesUpdate(payload));
    this.mediaServerService.on("playback", (payload) => this.handleMediaServerPlaybackUpdate(payload));
    this.mediaServerService.on("error", (error) => {
      this.log.error("Media server service error", error);
    });
  }

  private handleConnectionMessage(event: ConnectionMessageEvent) {
    if (event.message.type !== "video-context") {
      return;
    }
    const url = event.resolvedUrl;
    const configId = this.resolveMediaServerConfigIdFromUrls([
      url,
      event.message.payload.pageUrl ?? null,
      event.message.payload.videoSrc ?? null
    ]);
    const existingTabContext = this.getTabMediaServerContext(event.message.tabId);
    const mediaServerConfigId = configId ?? existingTabContext?.serverConfigId ?? null;
    const isMediaServer = Boolean(mediaServerConfigId);

    if (!isMediaServer) {
      this.handleNonMediaServerSwitch(event.message.tabId);
      return;
    }

    const serverChanged =
      Boolean(
        mediaServerConfigId &&
        existingTabContext?.serverConfigId &&
        existingTabContext.serverConfigId !== mediaServerConfigId
      );

    this.options.stateManager.setPageContext(event.message.tabId, {
      pageUrl: event.message.payload.pageUrl ?? null,
      site: event.message.payload.site ?? null,
      title: event.message.payload.title ?? null
    });

    if (mediaServerConfigId) {
      this.updateTabMediaServerContext(event.message.tabId, {
        serverConfigId: mediaServerConfigId,
        sessionId: serverChanged ? null : existingTabContext?.sessionId ?? null,
        itemId: serverChanged ? null : existingTabContext?.itemId ?? null
      });
    }

    if (serverChanged) {
      const currentState = this.options.stateManager.getState();
      const selectedSessionId = currentState.mediaServer.selectedSessionId;
      const selectedSession = selectedSessionId
        ? currentState.mediaServer.sessions.find((session) => session.id === selectedSessionId)
        : null;

      if (selectedSession && selectedSession.serverConfigId !== mediaServerConfigId) {
        this.options.stateManager.resetSubtitleState();
        this.options.stateManager.updateState((draft) => {
          draft.mediaServer.selectedSessionId = null;
          draft.pendingMediaServerItemId = null;
          if (draft.activeSource === "mediaserver") {
            draft.status = "loading-subtitles";
          }
        });
        this.mediaServerService.setActiveSession(null);
      }
    }

    if (!url) {
      return;
    }

    event.markHandled();
    void this.processMediaServerVideoContext(event.message, url);
  }

  private handleNonMediaServerSwitch(tabId: number) {
    const state = this.options.stateManager.getState();
    this.clearTabMediaServerContext(tabId);
    if (state.activeSource !== "extension") {
      this.options.stateManager.updateState((draft) => {
        draft.activeSource = "extension";
        draft.pendingMediaServerItemId = null;
        if (draft.mediaServer.selectedSessionId) {
          draft.mediaServer.selectedSessionId = null;
        }
      });
      this.mediaServerService.setActiveSession(null);
    }
  }

  private async processMediaServerVideoContext(message: ExtensionMessage, url: string) {
    const state = this.options.stateManager.getState();
    const itemId = this.extractItemId(message.payload, url);
    if (itemId) {
      this.updateTabMediaServerContext(message.tabId, { itemId });
    }

    const tabContext = this.getTabMediaServerContext(message.tabId);
    const storedSession =
      tabContext?.sessionId
        ? state.mediaServer.sessions.find((session) => session.id === tabContext.sessionId) ?? null
        : null;

    if (itemId && this.options.getSettings().mediaServer.enabled) {
      this.options.stateManager.updateState((draft) => {
        draft.activeSource = "mediaserver";
        draft.videoUrl = url;
        draft.site = "jellyfinemby";
      });
      const selection = this.options.stateManager.selectProfileForUrl(url);
      this.options.stateManager.applyProfileSelection(selection.profile, selection.rule);

      const latestState = this.options.stateManager.getState();
      const currentSession = latestState.mediaServer.selectedSessionId
        ? latestState.mediaServer.sessions.find((s) => s.id === latestState.mediaServer.selectedSessionId) ?? null
        : null;
      const currentItemId = currentSession?.nowPlayingItemId;

      if (currentItemId === itemId && latestState.subtitleTracks.length > 0) {
        return;
      }

      const trackedItemId = latestState.pendingMediaServerItemId ?? currentItemId ?? null;
      if (trackedItemId !== itemId) {
        this.mediaServerService.requestSessionsBurst(`mediaserver-video-change:${itemId}`);
      }

      let matchingSession: MediaServerSessionSummary | null = null;
      if (storedSession && storedSession.nowPlayingItemId === itemId) {
        matchingSession = storedSession;
      }
      if (!matchingSession) {
        matchingSession =
          latestState.mediaServer.sessions.find(
            (session) =>
              session.nowPlayingItemId === itemId &&
              (!tabContext?.serverConfigId || session.serverConfigId === tabContext.serverConfigId)
          ) ?? null;
      }

      if (matchingSession) {
        this.options.stateManager.updateState((draft) => {
          draft.mediaServer.selectedSessionId = matchingSession.id;
          draft.status = "loading-subtitles";
          draft.pendingMediaServerItemId = itemId;
        });
        this.options.stateManager.resetSubtitleState();
        this.mediaServerService.setActiveSession(matchingSession.id);
        this.updateTabMediaServerContext(message.tabId, {
          sessionId: matchingSession.id,
          serverConfigId: matchingSession.serverConfigId,
          itemId: matchingSession.nowPlayingItemId ?? itemId
        });
      } else {
        this.options.stateManager.updateState((draft) => {
          draft.pendingMediaServerItemId = itemId;
          draft.status = "loading-subtitles";
        });
        this.options.stateManager.resetSubtitleState();
        this.updateTabMediaServerContext(message.tabId, {
          itemId
        });
      }
      return;
    }

    this.options.stateManager.updateState((draft) => {
      if (draft.activeSource !== "mediaserver") {
        draft.activeSource = "mediaserver";
      }
      if (draft.site !== "jellyfinemby") {
        draft.site = "jellyfinemby";
      }
      if (draft.videoUrl !== url) {
        draft.videoUrl = url;
      }
    });

    const selection = this.options.stateManager.selectProfileForUrl(url);
    this.options.stateManager.applyProfileSelection(selection.profile, selection.rule);

    if (storedSession) {
      if (this.options.stateManager.getState().mediaServer.selectedSessionId !== storedSession.id) {
        this.options.stateManager.updateState((draft) => {
          draft.mediaServer.selectedSessionId = storedSession.id;
          draft.pendingMediaServerItemId = storedSession.nowPlayingItemId ?? draft.pendingMediaServerItemId;
        });
        this.mediaServerService.setActiveSession(storedSession.id);
      }
      this.updateTabMediaServerContext(message.tabId, {
        sessionId: storedSession.id,
        serverConfigId: storedSession.serverConfigId,
        ...(storedSession.nowPlayingItemId ? { itemId: storedSession.nowPlayingItemId } : {})
      });
      if (!this.options.stateManager.getState().pendingMediaServerItemId && storedSession.nowPlayingItemId) {
        this.options.stateManager.setPendingMediaServerItemId(storedSession.nowPlayingItemId);
      }
    }

    this.mediaServerService.requestSessionsBurst("mediaserver-video-context-no-itemid");
  }

  private handleMediaServerStatusUpdate(payload: MediaServerStatusPayload) {
    const current = this.options.stateManager.getState().mediaServer.connected;
    if (current === payload.connected) {
      return;
    }
    this.options.stateManager.updateState((draft) => {
      draft.mediaServer.connected = payload.connected;
    });
    this.log.debug("Media server status changed", payload);

    if (!payload.connected) {
      this.options.stateManager.updateState((draft) => {
        draft.mediaServer.sessions = [];
        draft.mediaServer.selectedSessionId = null;
        draft.pendingMediaServerItemId = null;
        if (draft.activeSource === "mediaserver") {
          draft.activeSource = draft.connectionCount > 0 ? "extension" : null;
          draft.status = draft.connectionCount > 0 ? draft.status : "idle";
          draft.title = null;
          draft.pageUrl = null;
          draft.videoUrl = null;
          draft.site = null;
        }
      });
      if (this.options.stateManager.getState().activeSource !== "mediaserver") {
        this.options.stateManager.resetSubtitleState();
      }
      this.mediaServerService.setActiveSession(null);
      return;
    }

    this.mediaServerService.requestSessionsBurst("ws-status-connected");
  }

  private handleMediaServerSessionsUpdate(sessions: MediaServerSessionSummary[]) {
    const state = this.options.stateManager.getState();
    this.log.debug("Received media server sessions update", {
      count: sessions.length,
      previousSelected: state.mediaServer.selectedSessionId
    });

    this.options.stateManager.setMediaServerSessions(sessions);

    for (const [tabId, context] of this.tabMediaServerContexts.entries()) {
      const sessionById = context.sessionId && sessions.find((session) => session.id === context.sessionId);
      if (sessionById) {
        this.updateTabMediaServerContext(tabId, {
          sessionId: sessionById.id,
          serverConfigId: sessionById.serverConfigId,
          itemId: sessionById.nowPlayingItemId ?? context.itemId
        });
        continue;
      }
      if (!context.itemId) {
        continue;
      }
      const matchingByItem = sessions.find(
        (session) =>
          session.nowPlayingItemId === context.itemId &&
          (!context.serverConfigId || session.serverConfigId === context.serverConfigId)
      );
      if (matchingByItem) {
        this.updateTabMediaServerContext(tabId, {
          sessionId: matchingByItem.id,
          serverConfigId: matchingByItem.serverConfigId,
          itemId: matchingByItem.nowPlayingItemId ?? context.itemId
        });
      }
    }

    const currentState = this.options.stateManager.getState();
    if (currentState.pendingMediaServerItemId && currentState.activeSource === "mediaserver") {
      const matchingSession = sessions.find(
        (session) => session.nowPlayingItemId === currentState.pendingMediaServerItemId
      );

      if (matchingSession) {
        this.options.stateManager.updateState((draft) => {
          draft.mediaServer.selectedSessionId = matchingSession.id;
        });
        this.mediaServerService.setActiveSession(matchingSession.id);
        if (currentState.activeTabId !== null) {
          this.updateTabMediaServerContext(currentState.activeTabId, {
            sessionId: matchingSession.id,
            serverConfigId: matchingSession.serverConfigId,
            ...(matchingSession.nowPlayingItemId ? { itemId: matchingSession.nowPlayingItemId } : {})
          });
        }
        this.options.stateManager.setPendingMediaServerItemId(null);
      }
    }

    this.handleSessionSelectionAfterUpdate(sessions);
  }

  private handleSessionSelectionAfterUpdate(sessions: MediaServerSessionSummary[]) {
    const state = this.options.stateManager.getState();

    if (state.mediaServer.selectedSessionId) {
      const selected = sessions.find((item) => item.id === state.mediaServer.selectedSessionId) ?? null;
      if (!selected) {
        this.log.warn("Previously selected media server session vanished", {
          previousSessionId: state.mediaServer.selectedSessionId,
          activeSource: state.activeSource,
          connectionCount: state.connectionCount
        });
        this.options.stateManager.updateState((draft) => {
          draft.mediaServer.selectedSessionId = null;
        });

        if (state.activeSource === "mediaserver" && sessions.length > 0) {
          this.options.stateManager.setMediaServerSelectedSession(sessions[0].id);
          this.mediaServerService.setActiveSession(sessions[0].id);
        } else if (state.activeSource === "mediaserver") {
          this.options.stateManager.updateState((draft) => {
            draft.activeSource = draft.connectionCount > 0 ? "extension" : null;
            draft.status = draft.connectionCount > 0 ? "awaiting-video" : "idle";
            draft.title = null;
            draft.pageUrl = null;
            draft.videoUrl = null;
            draft.site = null;
          });
          this.options.stateManager.resetSubtitleState();
          this.mediaServerService.setActiveSession(null);
        }
      } else if (state.activeSource === "mediaserver") {
        const activeTabContext = this.getTabMediaServerContext(state.activeTabId);
        const activeTabItemId = activeTabContext?.itemId ?? null;
        const sessionItemId = selected.nowPlayingItemId;

        if (state.activeTabId) {
          this.updateTabMediaServerContext(state.activeTabId, {
            sessionId: selected.id,
            serverConfigId: selected.serverConfigId,
            ...(sessionItemId ? { itemId: sessionItemId } : {})
          });
        }

        if (activeTabItemId && sessionItemId && activeTabItemId !== sessionItemId) {
          this.options.stateManager.emitCurrentState();
          return;
        }

        this.options.stateManager.updateState((draft) => {
          draft.title = selected.nowPlayingItemName ?? draft.title;
          draft.pageUrl = this.buildMediaServerPageUrl(selected);
          draft.videoUrl = this.buildMediaServerItemUrl(selected) ?? draft.videoUrl;
        });
      }
    } else if (state.activeSource === "mediaserver" && sessions.length > 0) {
      const activeTabContext = this.getTabMediaServerContext(state.activeTabId);
      const activeTabItemId = activeTabContext?.itemId ?? null;
      const activeTabSessionId = activeTabContext?.sessionId ?? null;
      const activeServerId = activeTabContext?.serverConfigId ?? null;

      let sessionToSelect = sessions[0];
      if (activeTabSessionId) {
        const matchingBySession = sessions.find((session) => session.id === activeTabSessionId);
        if (matchingBySession) {
          sessionToSelect = matchingBySession;
        }
      } else if (activeTabItemId) {
        const matchingSession = sessions.find(
          (session) =>
            session.nowPlayingItemId === activeTabItemId &&
            (!activeServerId || session.serverConfigId === activeServerId)
        );
        if (matchingSession) {
          sessionToSelect = matchingSession;
        }
      } else if (activeServerId) {
        const matchingByServer = sessions.find((session) => session.serverConfigId === activeServerId);
        if (matchingByServer) {
          sessionToSelect = matchingByServer;
        }
      }

      if (state.activeTabId) {
        this.updateTabMediaServerContext(state.activeTabId, {
          sessionId: sessionToSelect.id,
          serverConfigId: sessionToSelect.serverConfigId,
          ...(sessionToSelect.nowPlayingItemId ? { itemId: sessionToSelect.nowPlayingItemId } : {})
        });
      }

      this.log.debug("Auto-selecting media server session", {
        sessionId: sessionToSelect.id,
        serverConfigId: sessionToSelect.serverConfigId,
        serverName: sessionToSelect.serverName,
        nowPlayingItemId: sessionToSelect.nowPlayingItemId,
        activeTabItemId
      });
      this.options.stateManager.setMediaServerSelectedSession(sessionToSelect.id);
      this.mediaServerService.setActiveSession(sessionToSelect.id);
    }

    this.options.stateManager.emitCurrentState();
  }

  private handleMediaServerSubtitlesUpdate(payload: MediaServerSubtitlesPayload) {
    const state = this.options.stateManager.getState();
    if (state.activeSource !== "mediaserver" || !payload.sessionId) {
      return;
    }
    if (payload.sessionId !== state.mediaServer.selectedSessionId) {
      return;
    }
    this.options.stateManager.setSubtitleTracks(payload.tracks);
    if (payload.tracks.length) {
      const status = this.options.stateManager.getState().status;
      if (status === "awaiting-video" || status === "idle" || status === "error") {
        this.options.stateManager.setStatus("loading-subtitles");
      }
      this.options.stateManager.applyPreferredTracksFromSettings(payload.tracks);
      this.options.stateManager.setStatus("ready");
      this.options.stateManager.updateState((draft) => {
        draft.error = null;
      });
    } else {
      this.options.stateManager.resetSubtitleState();
      this.options.stateManager.updateState((draft) => {
        draft.status = "error";
        draft.error = "No media server subtitles available for this session";
      });
    }
  }

  private handleMediaServerPlaybackUpdate(payload: MediaServerPlaybackPayload) {
    const state = this.options.stateManager.getState();
    if (state.activeSource !== "mediaserver") {
      return;
    }
    if (!payload.sessionId || payload.sessionId !== state.mediaServer.selectedSessionId) {
      return;
    }

    const activeTabContext = this.getTabMediaServerContext(state.activeTabId);
    const activeTabItemId = activeTabContext?.itemId ?? null;
    const selectedSession = state.mediaServer.sessions.find((session) => session.id === payload.sessionId) ?? null;
    const sessionItemId = selectedSession?.nowPlayingItemId ?? null;
    const extensionControlsSession =
      Boolean(activeTabItemId && sessionItemId && activeTabItemId === sessionItemId);

    if (extensionControlsSession) {
      return;
    }

    const currentTime = payload.positionMs ?? 0;
    const playbackRate = payload.isPaused ? 0 : payload.playbackRate || 1;
    const duration = typeof payload.runTimeMs === "number" && payload.runTimeMs >= 0 ? payload.runTimeMs : state.playback.duration ?? null;
    this.options.stateManager.updatePlayback({
      currentTime,
      playbackRate,
      duration
    });
  }

  private extractItemId(payload: ExtensionPayload, fallbackUrl: string): string | null {
    const extractFromUrl = (candidate: string | null | undefined): string | null => {
      if (!candidate || typeof candidate !== "string") {
        return null;
      }
      try {
        const urlObj = new URL(candidate);
        for (const [key, value] of urlObj.searchParams.entries()) {
          if (key.toLowerCase() === "mediasourceid") {
            return value;
          }
        }
        const pathMatch = urlObj.pathname.match(/\/(?:videos|items)\/([^/]+)/i);
        if (pathMatch?.[1]) {
          return pathMatch[1];
        }
      } catch (error) {
        this.log.error(`Failed to parse media server URL for itemId`, error);
      }
      return null;
    };

    return extractFromUrl(payload.videoSrc) ?? extractFromUrl(fallbackUrl);
  }

  private getTabMediaServerContext(tabId: number | null): TabMediaServerContext | null {
    if (tabId === null) {
      return null;
    }
    return this.tabMediaServerContexts.get(tabId) ?? null;
  }

  private updateTabMediaServerContext(
    tabId: number,
    updates: Partial<TabMediaServerContext>
  ): TabMediaServerContext {
    const previous = this.tabMediaServerContexts.get(tabId) ?? {
      itemId: null,
      sessionId: null,
      serverConfigId: null
    };
    const next: TabMediaServerContext = {
      ...previous,
      ...updates
    };
    this.tabMediaServerContexts.set(tabId, next);
    return next;
  }

  private clearTabMediaServerContext(tabId: number) {
    this.tabMediaServerContexts.delete(tabId);
  }

  private resolveMediaServerConfig(configId?: string | null): MediaServerConfig | null {
    const settings = this.options.getSettings().mediaServer;
    const configs = settings.configs.filter((config) => config.type === "jellyfinemby");
    if (configId) {
      return configs.find((config) => config.id === configId) ?? null;
    }
    const enabled = configs.find((config) => config.enabled);
    if (enabled) {
      return enabled;
    }
    return configs[0] ?? null;
  }

  private getMediaServerBaseUrl(configId?: string | null): string | null {
    const config = this.resolveMediaServerConfig(configId);
    if (!config) {
      return null;
    }
    const base = normalizeServerUrl(config.serverUrl ?? "");
    return base.length ? base : null;
  }

  private buildMediaServerItemUrl(session: MediaServerSessionSummary | null): string | null {
    if (!session?.nowPlayingItemId) {
      return null;
    }
    const base = this.getMediaServerBaseUrl(session.serverConfigId);
    if (!base) {
      return `jellyfinemby://${session.nowPlayingItemId}`;
    }
    return `${base}/Items/${session.nowPlayingItemId}`;
  }

  private buildMediaServerPageUrl(session: MediaServerSessionSummary | null): string | null {
    if (!session) {
      return this.getMediaServerBaseUrl();
    }
    if (!session.nowPlayingItemId) {
      return this.getMediaServerBaseUrl(session.serverConfigId);
    }
    const base = this.getMediaServerBaseUrl(session.serverConfigId);
    if (!base) {
      return null;
    }
    return `${base}/web/index.html#!/details?id=${session.nowPlayingItemId}`;
  }

  private resolveMediaServerConfigIdFromUrls(urls: Array<string | null | undefined>): string | null {
    const settings = this.options.getSettings();
    if (!settings.mediaServer.enabled || !settings.mediaServer.configs.length) {
      return null;
    }
    const configs = settings.mediaServer.configs.filter((config) => config.type === "jellyfinemby");
    for (const candidate of urls) {
      const origin = this.extractOrigin(candidate);
      if (!origin) {
        continue;
      }
      for (const config of configs) {
        if (!config.serverUrl) {
          continue;
        }
        try {
          const serverUrl = new URL(normalizeServerUrl(config.serverUrl));
          const serverOrigin = `${serverUrl.protocol}//${serverUrl.hostname}${
            serverUrl.port ? ":" + serverUrl.port : ""
          }`;
          if (serverOrigin === origin) {
            return config.id;
          }
        } catch {
          continue;
        }
      }
    }
    return null;
  }

  private extractOrigin(url: string | null | undefined): string | null {
    if (!url) {
      return null;
    }
    let candidate = url.trim();
    if (!candidate) {
      return null;
    }
    if (candidate.startsWith("blob:")) {
      candidate = candidate.slice(5);
    }
    try {
      const parsed = new URL(candidate);
      return `${parsed.protocol}//${parsed.hostname}${parsed.port ? ":" + parsed.port : ""}`;
    } catch {
      return null;
    }
  }
}
