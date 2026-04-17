import { JellyfinembySubtitleService } from "../jellyfinemby/index.js";
import { createLogger } from "../logger.js";
import { StateManager } from "../stateManager.js";
import type { MediaServerSessionSummary } from "../types.js";
import { MediaServerUrlResolver } from "./MediaServerUrlResolver.js";
import { TabContextRegistry } from "./TabContextRegistry.js";

export class MediaServerSessionHandler {
  private readonly log = createLogger("mediaserver-session-handler");

  constructor(
    private readonly stateManager: StateManager,
    private readonly mediaServerService: JellyfinembySubtitleService,
    private readonly tabRegistry: TabContextRegistry,
    private readonly urlResolver: MediaServerUrlResolver
  ) {}

  handleMediaServerSessionsUpdate(sessions: MediaServerSessionSummary[]) {
    const state = this.stateManager.getState();
    this.log.debug("Received media server sessions update", {
      count: sessions.length,
      previousSelected: state.mediaServer.selectedSessionId
    });

    this.stateManager.setMediaServerSessions(sessions);

    for (const [tabId, context] of this.tabRegistry.entries()) {
      const sessionById = context.sessionId && sessions.find((session) => session.id === context.sessionId);
      if (sessionById) {
        this.tabRegistry.update(tabId, {
          sessionId: sessionById.id,
          serverConfigId: sessionById.serverConfigId,
          itemId: sessionById.nowPlayingItemId ?? context.itemId
        });
        continue;
      }
      if (!context.itemId) {
        continue;
      }
      // First try to match with server preference
      let matchingByItem = sessions.find(
        (session) =>
          session.nowPlayingItemId === context.itemId &&
          context.serverConfigId && session.serverConfigId === context.serverConfigId
      );

      // Fallback: match any session with the same itemId (allows cross-server switching)
      if (!matchingByItem) {
        matchingByItem = sessions.find(
          (session) => session.nowPlayingItemId === context.itemId
        );
      }

      if (matchingByItem) {
        this.tabRegistry.update(tabId, {
          sessionId: matchingByItem.id,
          serverConfigId: matchingByItem.serverConfigId,
          itemId: matchingByItem.nowPlayingItemId ?? context.itemId
        });
      }
    }

    const currentState = this.stateManager.getState();
    if (currentState.pendingMediaServerItemId && currentState.activeSource === "mediaserver") {
      const matchingSession = sessions.find(
        (session) => session.nowPlayingItemId === currentState.pendingMediaServerItemId
      );

      if (matchingSession) {
        this.stateManager.updateState((draft) => {
          draft.mediaServer.selectedSessionId = matchingSession.id;
        });
        this.mediaServerService.setActiveSession(matchingSession.id);
        if (currentState.activeTabId !== null) {
          this.tabRegistry.update(currentState.activeTabId, {
            sessionId: matchingSession.id,
            serverConfigId: matchingSession.serverConfigId,
            ...(matchingSession.nowPlayingItemId ? { itemId: matchingSession.nowPlayingItemId } : {})
          });
        }
        this.stateManager.setPendingMediaServerItemId(null);
      }
    }

    this.handleSessionSelectionAfterUpdate(sessions);
  }

  handleSessionSelectionAfterUpdate(sessions: MediaServerSessionSummary[]) {
    const state = this.stateManager.getState();

    if (state.mediaServer.selectedSessionId) {
      const selected = sessions.find((item) => item.id === state.mediaServer.selectedSessionId) ?? null;
      if (!selected) {
        this.log.warn("Previously selected media server session vanished", {
          previousSessionId: state.mediaServer.selectedSessionId,
          activeSource: state.activeSource,
          connectionCount: state.connectionCount
        });
        this.stateManager.updateState((draft) => {
          draft.mediaServer.selectedSessionId = null;
        });

        if (state.activeSource === "mediaserver" && sessions.length > 0) {
          this.stateManager.setMediaServerSelectedSession(sessions[0].id);
          this.mediaServerService.setActiveSession(sessions[0].id);
        } else if (state.activeSource === "mediaserver") {
          this.stateManager.updateState((draft) => {
            draft.activeSource = draft.connectionCount > 0 ? "extension" : null;
            draft.status = draft.connectionCount > 0 ? "awaiting-video" : "idle";
            draft.title = null;
            draft.pageUrl = null;
            draft.videoUrl = null;
            draft.site = null;
          });
          this.stateManager.resetSubtitleState();
          this.mediaServerService.setActiveSession(null);
        }
      } else if (state.activeSource === "mediaserver") {
        const activeTabContext = this.tabRegistry.get(state.activeTabId);
        const activeTabItemId = activeTabContext?.itemId ?? null;
        const sessionItemId = selected.nowPlayingItemId;

        if (state.activeTabId) {
          this.tabRegistry.update(state.activeTabId, {
            sessionId: selected.id,
            serverConfigId: selected.serverConfigId,
            ...(sessionItemId ? { itemId: sessionItemId } : {})
          });
        }

        if (activeTabItemId && sessionItemId && activeTabItemId !== sessionItemId) {
          this.stateManager.emitCurrentState();
          return;
        }

        this.stateManager.updateState((draft) => {
          draft.title = selected.nowPlayingItemName ?? draft.title;
          draft.pageUrl = this.urlResolver.buildMediaServerPageUrl(selected);
          draft.videoUrl = this.urlResolver.buildMediaServerItemUrl(selected) ?? draft.videoUrl;
        });
      }
    } else if (state.activeSource === "mediaserver" && sessions.length > 0) {
      const activeTabContext = this.tabRegistry.get(state.activeTabId);
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
        // First try to match with server preference
        let matchingSession = sessions.find(
          (session) =>
            session.nowPlayingItemId === activeTabItemId &&
            activeServerId && session.serverConfigId === activeServerId
        );
        // Fallback: match any session with the same itemId
        if (!matchingSession) {
          matchingSession = sessions.find(
            (session) => session.nowPlayingItemId === activeTabItemId
          );
        }
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
        this.tabRegistry.update(state.activeTabId, {
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
      this.stateManager.setMediaServerSelectedSession(sessionToSelect.id);
      this.mediaServerService.setActiveSession(sessionToSelect.id);
    }

    this.stateManager.emitCurrentState();
  }
}
