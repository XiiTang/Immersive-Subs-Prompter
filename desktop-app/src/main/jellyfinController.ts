import { AppEventBus, ConnectionMessageEvent } from "./appEventBus.js";
import { StateManager } from "./stateManager.js";
import { JellyfinSubtitleService } from "./jellyfinSubtitleService.js";
import { SubtitleCacheManager } from "./subtitleCacheManager.js";
import { createLogger } from "./logger.js";
import { normalizeServerUrl } from "./jellyfinUtils.js";
import {
  AppSettings,
  ExtensionMessage,
  ExtensionPayload,
  JellyfinConfig,
  JellyfinPlaybackPayload,
  JellyfinSessionSummary,
  JellyfinStatusPayload,
  JellyfinSubtitlesPayload
} from "./types.js";

type TabJellyfinContext = {
  itemId: string | null;
  sessionId: string | null;
  serverConfigId: string | null;
};

type JellyfinControllerOptions = {
  bus: AppEventBus;
  stateManager: StateManager;
  getSettings: () => AppSettings;
  cacheManager: SubtitleCacheManager;
};

export class JellyfinController {
  private readonly log = createLogger("jellyfin-controller");
  private readonly tabJellyfinContexts = new Map<number, TabJellyfinContext>();
  private readonly jellyfinService: JellyfinSubtitleService;

  constructor(private readonly options: JellyfinControllerOptions) {
    this.jellyfinService = new JellyfinSubtitleService(
      () => this.options.getSettings().jellyfin,
      this.options.cacheManager
    );
  }

  start() {
    this.registerBusListeners();
    this.registerServiceListeners();
    this.jellyfinService.start();
  }

  handleSettingsUpdated() {
    this.jellyfinService.refresh();
  }

  private registerBusListeners() {
    this.options.bus.on("connection:message", (event) => this.handleConnectionMessage(event));
    this.options.bus.on("connection:tab-removed", ({ tabId }) => this.clearTabJellyfinContext(tabId));
    this.options.bus.on("state:connection-count", ({ count }) => {
      const continuous = count === 0;
      this.jellyfinService.setContinuousSessionPolling(continuous);
    });
  }

  private registerServiceListeners() {
    this.jellyfinService.on("status", ({ connected }) => this.handleJellyfinStatusUpdate({ connected }));
    this.jellyfinService.on("sessions", (sessions) => this.handleJellyfinSessionsUpdate(sessions));
    this.jellyfinService.on("subtitles", (payload) => this.handleJellyfinSubtitlesUpdate(payload));
    this.jellyfinService.on("playback", (payload) => this.handleJellyfinPlaybackUpdate(payload));
    this.jellyfinService.on("error", (error) => {
      this.log.error("Jellyfin service error", error);
    });
  }

  private handleConnectionMessage(event: ConnectionMessageEvent) {
    if (event.message.type !== "video-context") {
      return;
    }
    const url = event.resolvedUrl;
    const configId = this.resolveJellyfinConfigIdFromUrls([
      url,
      event.message.payload.pageUrl ?? null,
      event.message.payload.videoSrc ?? null
    ]);
    const existingTabContext = this.getTabJellyfinContext(event.message.tabId);
    const jellyfinConfigId = configId ?? existingTabContext?.serverConfigId ?? null;
    const isJellyfin = Boolean(jellyfinConfigId);

    if (!isJellyfin) {
      this.handleNonJellyfinSwitch(event.message.tabId);
      return;
    }

    this.options.stateManager.setPageContext(event.message.tabId, {
      pageUrl: event.message.payload.pageUrl ?? null,
      site: event.message.payload.site ?? null,
      title: event.message.payload.title ?? null
    });

    if (jellyfinConfigId) {
      this.updateTabJellyfinContext(event.message.tabId, { serverConfigId: jellyfinConfigId });
    }

    if (!url) {
      return;
    }

    event.markHandled();
    void this.processJellyfinVideoContext(event.message, url);
  }

  private handleNonJellyfinSwitch(tabId: number) {
    const state = this.options.stateManager.getState();
    this.clearTabJellyfinContext(tabId);
    if (state.activeSource !== "extension") {
      this.options.stateManager.updateState((draft) => {
        draft.activeSource = "extension";
        draft.pendingJellyfinItemId = null;
        if (draft.jellyfin.selectedSessionId) {
          draft.jellyfin.selectedSessionId = null;
        }
      });
      this.jellyfinService.setActiveSession(null);
    }
  }

  private async processJellyfinVideoContext(message: ExtensionMessage, url: string) {
    const state = this.options.stateManager.getState();
    const itemId = this.extractItemId(message.payload, url);
    if (itemId) {
      this.updateTabJellyfinContext(message.tabId, { itemId });
    }

    const tabContext = this.getTabJellyfinContext(message.tabId);
    const storedSession =
      tabContext?.sessionId
        ? state.jellyfin.sessions.find((session) => session.id === tabContext.sessionId) ?? null
        : null;

    if (itemId && this.options.getSettings().jellyfin.enabled) {
      this.options.stateManager.updateState((draft) => {
        draft.activeSource = "jellyfin";
        draft.videoUrl = url;
        draft.site = "jellyfin";
      });
      const selection = this.options.stateManager.selectProfileForUrl(url);
      this.options.stateManager.applyProfileSelection(selection.profile, selection.rule);

      const latestState = this.options.stateManager.getState();
      const currentSession = latestState.jellyfin.selectedSessionId
        ? latestState.jellyfin.sessions.find((s) => s.id === latestState.jellyfin.selectedSessionId) ?? null
        : null;
      const currentItemId = currentSession?.nowPlayingItemId;

      if (currentItemId === itemId && latestState.subtitleTracks.length > 0) {
        return;
      }

      const trackedItemId = latestState.pendingJellyfinItemId ?? currentItemId ?? null;
      if (trackedItemId !== itemId) {
        this.jellyfinService.requestSessionsBurst(`jellyfin-video-change:${itemId}`);
      }

      let matchingSession: JellyfinSessionSummary | null = null;
      if (storedSession && storedSession.nowPlayingItemId === itemId) {
        matchingSession = storedSession;
      }
      if (!matchingSession) {
        matchingSession =
          latestState.jellyfin.sessions.find(
            (session) =>
              session.nowPlayingItemId === itemId &&
              (!tabContext?.serverConfigId || session.serverConfigId === tabContext.serverConfigId)
          ) ?? null;
      }

      if (matchingSession) {
        this.options.stateManager.updateState((draft) => {
          draft.jellyfin.selectedSessionId = matchingSession.id;
          draft.status = "loading-subtitles";
          draft.pendingJellyfinItemId = itemId;
        });
        this.options.stateManager.resetSubtitleState();
        this.jellyfinService.setActiveSession(matchingSession.id);
        this.updateTabJellyfinContext(message.tabId, {
          sessionId: matchingSession.id,
          serverConfigId: matchingSession.serverConfigId,
          itemId: matchingSession.nowPlayingItemId ?? itemId
        });
      } else {
        this.options.stateManager.updateState((draft) => {
          draft.pendingJellyfinItemId = itemId;
          draft.status = "loading-subtitles";
        });
        this.options.stateManager.resetSubtitleState();
        this.updateTabJellyfinContext(message.tabId, {
          itemId
        });
      }
      return;
    }

    this.options.stateManager.updateState((draft) => {
      if (draft.activeSource !== "jellyfin") {
        draft.activeSource = "jellyfin";
      }
      if (draft.site !== "jellyfin") {
        draft.site = "jellyfin";
      }
      if (draft.videoUrl !== url) {
        draft.videoUrl = url;
      }
    });

    const selection = this.options.stateManager.selectProfileForUrl(url);
    this.options.stateManager.applyProfileSelection(selection.profile, selection.rule);

    if (storedSession) {
      if (this.options.stateManager.getState().jellyfin.selectedSessionId !== storedSession.id) {
        this.options.stateManager.updateState((draft) => {
          draft.jellyfin.selectedSessionId = storedSession.id;
          draft.pendingJellyfinItemId = storedSession.nowPlayingItemId ?? draft.pendingJellyfinItemId;
        });
        this.jellyfinService.setActiveSession(storedSession.id);
      }
      this.updateTabJellyfinContext(message.tabId, {
        sessionId: storedSession.id,
        serverConfigId: storedSession.serverConfigId,
        ...(storedSession.nowPlayingItemId ? { itemId: storedSession.nowPlayingItemId } : {})
      });
      if (!this.options.stateManager.getState().pendingJellyfinItemId && storedSession.nowPlayingItemId) {
        this.options.stateManager.setPendingJellyfinItemId(storedSession.nowPlayingItemId);
      }
    }

    this.jellyfinService.requestSessionsBurst("jellyfin-video-context-no-itemid");
  }

  private handleJellyfinStatusUpdate(payload: JellyfinStatusPayload) {
    const current = this.options.stateManager.getState().jellyfin.connected;
    if (current === payload.connected) {
      return;
    }
    this.options.stateManager.updateState((draft) => {
      draft.jellyfin.connected = payload.connected;
    });
    this.log.debug("Jellyfin status changed", payload);

    if (!payload.connected) {
      this.options.stateManager.updateState((draft) => {
        draft.jellyfin.sessions = [];
        draft.jellyfin.selectedSessionId = null;
        draft.pendingJellyfinItemId = null;
        if (draft.activeSource === "jellyfin") {
          draft.activeSource = draft.connectionCount > 0 ? "extension" : null;
          draft.status = draft.connectionCount > 0 ? draft.status : "idle";
          draft.title = null;
          draft.pageUrl = null;
          draft.videoUrl = null;
          draft.site = null;
        }
      });
      if (this.options.stateManager.getState().activeSource !== "jellyfin") {
        this.options.stateManager.resetSubtitleState();
      }
      this.jellyfinService.setActiveSession(null);
      return;
    }

    this.jellyfinService.requestSessionsBurst("ws-status-connected");
  }

  private handleJellyfinSessionsUpdate(sessions: JellyfinSessionSummary[]) {
    const state = this.options.stateManager.getState();
    this.log.debug("Received Jellyfin sessions update", {
      count: sessions.length,
      previousSelected: state.jellyfin.selectedSessionId
    });

    this.options.stateManager.setJellyfinSessions(sessions);

    for (const [tabId, context] of this.tabJellyfinContexts.entries()) {
      const sessionById = context.sessionId && sessions.find((session) => session.id === context.sessionId);
      if (sessionById) {
        this.updateTabJellyfinContext(tabId, {
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
        this.updateTabJellyfinContext(tabId, {
          sessionId: matchingByItem.id,
          serverConfigId: matchingByItem.serverConfigId,
          itemId: matchingByItem.nowPlayingItemId ?? context.itemId
        });
      }
    }

    const currentState = this.options.stateManager.getState();
    if (currentState.pendingJellyfinItemId && currentState.activeSource === "jellyfin") {
      const matchingSession = sessions.find(
        (session) => session.nowPlayingItemId === currentState.pendingJellyfinItemId
      );

      if (matchingSession) {
        this.options.stateManager.updateState((draft) => {
          draft.jellyfin.selectedSessionId = matchingSession.id;
        });
        this.jellyfinService.setActiveSession(matchingSession.id);
        if (currentState.activeTabId !== null) {
          this.updateTabJellyfinContext(currentState.activeTabId, {
            sessionId: matchingSession.id,
            serverConfigId: matchingSession.serverConfigId,
            ...(matchingSession.nowPlayingItemId ? { itemId: matchingSession.nowPlayingItemId } : {})
          });
        }
        this.options.stateManager.setPendingJellyfinItemId(null);
      }
    }

    this.handleSessionSelectionAfterUpdate(sessions);
  }

  private handleSessionSelectionAfterUpdate(sessions: JellyfinSessionSummary[]) {
    const state = this.options.stateManager.getState();

    if (state.jellyfin.selectedSessionId) {
      const selected = sessions.find((item) => item.id === state.jellyfin.selectedSessionId) ?? null;
      if (!selected) {
        this.log.warn("Previously selected Jellyfin session vanished", {
          previousSessionId: state.jellyfin.selectedSessionId,
          activeSource: state.activeSource,
          connectionCount: state.connectionCount
        });
        this.options.stateManager.updateState((draft) => {
          draft.jellyfin.selectedSessionId = null;
        });

        if (state.activeSource === "jellyfin" && sessions.length > 0) {
          this.options.stateManager.setJellyfinSelectedSession(sessions[0].id);
          this.jellyfinService.setActiveSession(sessions[0].id);
        } else if (state.activeSource === "jellyfin") {
          this.options.stateManager.updateState((draft) => {
            draft.activeSource = draft.connectionCount > 0 ? "extension" : null;
            draft.status = draft.connectionCount > 0 ? "awaiting-video" : "idle";
            draft.title = null;
            draft.pageUrl = null;
            draft.videoUrl = null;
            draft.site = null;
          });
          this.options.stateManager.resetSubtitleState();
          this.jellyfinService.setActiveSession(null);
        }
      } else if (state.activeSource === "jellyfin") {
        const activeTabContext = this.getTabJellyfinContext(state.activeTabId);
        const activeTabItemId = activeTabContext?.itemId ?? null;
        const sessionItemId = selected.nowPlayingItemId;

        if (state.activeTabId) {
          this.updateTabJellyfinContext(state.activeTabId, {
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
          draft.pageUrl = this.buildJellyfinPageUrl(selected);
          draft.videoUrl = this.buildJellyfinItemUrl(selected) ?? draft.videoUrl;
        });
      }
    } else if (state.activeSource === "jellyfin" && sessions.length > 0) {
      const activeTabContext = this.getTabJellyfinContext(state.activeTabId);
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
        this.updateTabJellyfinContext(state.activeTabId, {
          sessionId: sessionToSelect.id,
          serverConfigId: sessionToSelect.serverConfigId,
          ...(sessionToSelect.nowPlayingItemId ? { itemId: sessionToSelect.nowPlayingItemId } : {})
        });
      }

      this.log.debug("Auto-selecting Jellyfin session", {
        sessionId: sessionToSelect.id,
        serverConfigId: sessionToSelect.serverConfigId,
        serverName: sessionToSelect.serverName,
        nowPlayingItemId: sessionToSelect.nowPlayingItemId,
        activeTabItemId
      });
      this.options.stateManager.setJellyfinSelectedSession(sessionToSelect.id);
      this.jellyfinService.setActiveSession(sessionToSelect.id);
    }

    this.options.stateManager.emitCurrentState();
  }

  private handleJellyfinSubtitlesUpdate(payload: JellyfinSubtitlesPayload) {
    const state = this.options.stateManager.getState();
    if (state.activeSource !== "jellyfin" || !payload.sessionId) {
      return;
    }
    if (payload.sessionId !== state.jellyfin.selectedSessionId) {
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
        draft.error = "No Jellyfin subtitles available for this session";
      });
    }
  }

  private handleJellyfinPlaybackUpdate(payload: JellyfinPlaybackPayload) {
    const state = this.options.stateManager.getState();
    if (state.activeSource !== "jellyfin") {
      return;
    }
    if (!payload.sessionId || payload.sessionId !== state.jellyfin.selectedSessionId) {
      return;
    }

    const activeTabContext = this.getTabJellyfinContext(state.activeTabId);
    const activeTabItemId = activeTabContext?.itemId ?? null;
    const selectedSession = state.jellyfin.sessions.find((session) => session.id === payload.sessionId) ?? null;
    const sessionItemId = selectedSession?.nowPlayingItemId ?? null;
    const extensionControlsSession =
      Boolean(activeTabItemId && sessionItemId && activeTabItemId === sessionItemId);

    if (extensionControlsSession) {
      return;
    }

    const currentTime = payload.positionMs ?? 0;
    const playbackRate = payload.isPaused ? 0 : payload.playbackRate || 1;
    this.options.stateManager.updatePlayback({
      currentTime,
      playbackRate
    });
  }

  private extractItemId(payload: ExtensionPayload, fallbackUrl: string): string | null {
    let itemId: string | null = null;
    try {
      const videoSrc = payload.videoSrc;
      if (videoSrc && typeof videoSrc === "string") {
        const videoUrlObj = new URL(videoSrc);
        itemId = videoUrlObj.searchParams.get("mediaSourceId");
      }

      if (!itemId) {
        const urlObj = new URL(fallbackUrl);
        itemId = urlObj.searchParams.get("mediaSourceId");
      }
    } catch (error) {
      this.log.error(`Failed to parse Jellyfin URL for itemId`, error);
    }
    return itemId;
  }

  private getTabJellyfinContext(tabId: number | null): TabJellyfinContext | null {
    if (tabId === null) {
      return null;
    }
    return this.tabJellyfinContexts.get(tabId) ?? null;
  }

  private updateTabJellyfinContext(
    tabId: number,
    updates: Partial<TabJellyfinContext>
  ): TabJellyfinContext {
    const previous = this.tabJellyfinContexts.get(tabId) ?? {
      itemId: null,
      sessionId: null,
      serverConfigId: null
    };
    const next: TabJellyfinContext = {
      ...previous,
      ...updates
    };
    this.tabJellyfinContexts.set(tabId, next);
    return next;
  }

  private clearTabJellyfinContext(tabId: number) {
    this.tabJellyfinContexts.delete(tabId);
  }

  private resolveJellyfinConfig(configId?: string | null): JellyfinConfig | null {
    const settings = this.options.getSettings().jellyfin;
    if (configId) {
      return settings.configs.find((config) => config.id === configId) ?? null;
    }
    const enabled = settings.configs.find((config) => config.enabled);
    if (enabled) {
      return enabled;
    }
    return settings.configs[0] ?? null;
  }

  private getJellyfinBaseUrl(configId?: string | null): string | null {
    const config = this.resolveJellyfinConfig(configId);
    if (!config) {
      return null;
    }
    const base = normalizeServerUrl(config.serverUrl ?? "");
    return base.length ? base : null;
  }

  private buildJellyfinItemUrl(session: JellyfinSessionSummary | null): string | null {
    if (!session?.nowPlayingItemId) {
      return null;
    }
    const base = this.getJellyfinBaseUrl(session.serverConfigId);
    if (!base) {
      return `jellyfin://${session.nowPlayingItemId}`;
    }
    return `${base}/Items/${session.nowPlayingItemId}`;
  }

  private buildJellyfinPageUrl(session: JellyfinSessionSummary | null): string | null {
    if (!session) {
      return this.getJellyfinBaseUrl();
    }
    if (!session.nowPlayingItemId) {
      return this.getJellyfinBaseUrl(session.serverConfigId);
    }
    const base = this.getJellyfinBaseUrl(session.serverConfigId);
    if (!base) {
      return null;
    }
    return `${base}/web/index.html#!/details?id=${session.nowPlayingItemId}`;
  }

  private resolveJellyfinConfigIdFromUrls(urls: Array<string | null | undefined>): string | null {
    const settings = this.options.getSettings();
    if (!settings.jellyfin.enabled || !settings.jellyfin.configs.length) {
      return null;
    }
    for (const candidate of urls) {
      const origin = this.extractOrigin(candidate);
      if (!origin) {
        continue;
      }
      for (const config of settings.jellyfin.configs) {
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
