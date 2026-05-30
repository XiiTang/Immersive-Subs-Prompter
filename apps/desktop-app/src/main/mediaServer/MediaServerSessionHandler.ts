import type { JellyfinembySubtitleService } from "../jellyfinemby/JellyfinembySubtitlesService.js";
import { createLogger } from "../logger.js";
import type { StateManager } from "../stateManager.js";
import type { MediaServerSessionSummary } from "../types.js";
import { MediaServerUrlResolver } from "./MediaServerUrlResolver.js";
import { TabContextRegistry, type TabMediaServerContext } from "./TabContextRegistry.js";

type SessionHandlerService = Pick<JellyfinembySubtitleService, "setActiveSession">;

export class MediaServerSessionHandler {
  private readonly log = createLogger("mediaserver-session-handler");

  constructor(
    private readonly stateManager: StateManager,
    private readonly mediaServerService: SessionHandlerService,
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
      const matchingSession = this.findSessionForContext(sessions, context);
      if (matchingSession) {
        this.tabRegistry.update(tabId, {
          sessionId: matchingSession.id,
          serverConfigId: matchingSession.serverConfigId,
          itemId: matchingSession.nowPlayingItemId ?? context.itemId
        });
      }
    }

    const currentState = this.stateManager.getState();
    if (currentState.pendingMediaServerItemId && currentState.activeSource === "mediaserver") {
      const activeTabContext = this.tabRegistry.get(currentState.activeTabId);
      const matchingSession = this.findSessionForContext(sessions, {
        itemId: currentState.pendingMediaServerItemId,
        sessionId: null,
        serverConfigId: activeTabContext?.serverConfigId ?? null
      });

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

        if (state.activeSource === "mediaserver") {
          const replacement = this.findSessionForContext(
            sessions,
            this.tabRegistry.get(state.activeTabId)
          );
          if (replacement) {
            this.stateManager.setMediaServerSelectedSession(replacement.id);
            this.mediaServerService.setActiveSession(replacement.id);
          } else {
            this.mediaServerService.setActiveSession(null);
            this.stateManager.updateState((draft) => {
              draft.activeSource = draft.connectionCount > 0 ? "extension" : null;
              draft.status = draft.connectionCount > 0 ? "awaiting-video" : "idle";
              draft.title = null;
              draft.pageUrl = null;
              draft.videoUrl = null;
              draft.site = null;
              draft.pendingMediaServerItemId = null;
            });
            this.stateManager.resetSubtitleState();
          }
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
      const sessionToSelect = this.findSessionForContext(sessions, activeTabContext);
      if (!sessionToSelect) {
        this.stateManager.emitCurrentState();
        return;
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
        activeTabItemId: activeTabContext?.itemId ?? null
      });
      this.stateManager.setMediaServerSelectedSession(sessionToSelect.id);
      this.mediaServerService.setActiveSession(sessionToSelect.id);
    }

    this.stateManager.emitCurrentState();
  }

  private findSessionForContext(
    sessions: MediaServerSessionSummary[],
    context: TabMediaServerContext | null
  ): MediaServerSessionSummary | null {
    if (!context) {
      return null;
    }
    if (context.sessionId) {
      const matchingBySession = sessions.find((session) => session.id === context.sessionId);
      if (matchingBySession) {
        return matchingBySession;
      }
    }
    if (!context.serverConfigId || !context.itemId) {
      return null;
    }
    return sessions.find(
      (session) =>
        session.serverConfigId === context.serverConfigId &&
        session.nowPlayingItemId === context.itemId
    ) ?? null;
  }
}
