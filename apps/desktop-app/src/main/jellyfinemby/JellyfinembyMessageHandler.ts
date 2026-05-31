import type { FromExtensionBroadcastMessage } from "@immersive-subs/contracts";
import type { ConnectionMessageEvent } from "../appEventBus.js";
import type { JellyfinembySubtitleService } from "./JellyfinembySubtitlesService.js";
import type { StateManager } from "../stateManager.js";
import { JellyfinembyUrlResolver } from "./JellyfinembyUrlResolver.js";
import {
  getJellyfinembyTabContext,
  updateJellyfinembyTabContext,
  type JellyfinembyTabContext
} from "./types.js";

export class JellyfinembyMessageHandler {
  constructor(
    private readonly stateManager: StateManager,
    private readonly jellyfinembyService: JellyfinembySubtitleService,
    private readonly tabContexts: Map<number, JellyfinembyTabContext>,
    private readonly urlResolver: JellyfinembyUrlResolver,
    private readonly isActive: () => boolean
  ) {}

  handleConnectionMessage(event: ConnectionMessageEvent) {
    if (event.message.type !== "video-context") {
      return;
    }
    const url = event.resolvedUrl;
    const configId = this.urlResolver.resolveConfigIdFromUrls([
      url,
      event.message.payload.pageUrl ?? null,
      event.message.payload.videoSrc ?? null
    ]);
    const existingTabContext = getJellyfinembyTabContext(this.tabContexts, event.message.tabId);
    const mediaServerConfigId = configId;
    const isMediaServer = Boolean(mediaServerConfigId);

    if (!isMediaServer) {
      this.handleNonMediaServerSwitch(event.message.tabId);
      return;
    }

    event.markHandled();
    if (!this.isActive()) {
      return;
    }

    const serverChanged =
      Boolean(
        mediaServerConfigId &&
        existingTabContext?.serverConfigId &&
        existingTabContext.serverConfigId !== mediaServerConfigId
      );

    this.stateManager.setPageContext(event.message.tabId, {
      pageUrl: event.message.payload.pageUrl ?? null,
      site: event.message.payload.site ?? null,
      title: event.message.payload.title ?? null
    });

    if (mediaServerConfigId) {
      updateJellyfinembyTabContext(this.tabContexts, event.message.tabId, {
        serverConfigId: mediaServerConfigId,
        sessionId: serverChanged ? null : existingTabContext?.sessionId ?? null,
        itemId: serverChanged ? null : existingTabContext?.itemId ?? null
      });
    }

    if (serverChanged) {
      const currentState = this.stateManager.getState();
      const selectedSessionId = currentState.mediaServer.selectedSessionId;
      const selectedSession = selectedSessionId
        ? currentState.mediaServer.sessions.find((session) => session.id === selectedSessionId)
        : null;

      if (selectedSession && selectedSession.serverConfigId !== mediaServerConfigId) {
        this.stateManager.resetSubtitleState();
        this.stateManager.updateState((draft) => {
          draft.mediaServer.selectedSessionId = null;
          draft.pendingMediaServerItemId = null;
          if (draft.activeSource === "mediaserver") {
            draft.status = "loading-subtitles";
          }
        });
        this.jellyfinembyService.setActiveSession(null);
      }
    }

    if (!url) {
      return;
    }

    void this.processMediaServerVideoContext(event.message, url);
  }

  handleNonMediaServerSwitch(tabId: number) {
    const state = this.stateManager.getState();
    this.tabContexts.delete(tabId);
    if (state.activeSource !== "extension") {
      this.stateManager.updateState((draft) => {
        draft.activeSource = "extension";
        draft.pendingMediaServerItemId = null;
        if (draft.mediaServer.selectedSessionId) {
          draft.mediaServer.selectedSessionId = null;
        }
      });
      this.jellyfinembyService.setActiveSession(null);
    }
  }

  async processMediaServerVideoContext(
    message: Extract<FromExtensionBroadcastMessage, { type: "video-context" }>,
    url: string
  ) {
    const state = this.stateManager.getState();
    const itemId = this.urlResolver.extractItemId(message.payload);
    const currentServerConfigId = this.urlResolver.resolveConfigIdFromUrls([
      url,
      message.payload.pageUrl,
      message.payload.videoSrc
    ]);

    if (itemId) {
      updateJellyfinembyTabContext(this.tabContexts, message.tabId, { itemId });
    }

    const tabContext = getJellyfinembyTabContext(this.tabContexts, message.tabId);
    const storedSession =
      tabContext?.sessionId
        ? state.mediaServer.sessions.find((session) => session.id === tabContext.sessionId) ?? null
        : null;

    if (itemId && this.isActive()) {
      this.stateManager.updateState((draft) => {
        draft.activeSource = "mediaserver";
        draft.videoUrl = url;
        draft.site = "jellyfinemby";
      });
      const selection = this.stateManager.selectProfileForUrl(url);
      this.stateManager.applyProfileSelection(selection.profile, selection.rule);

      const latestState = this.stateManager.getState();
      const currentSession = latestState.mediaServer.selectedSessionId
        ? latestState.mediaServer.sessions.find((s) => s.id === latestState.mediaServer.selectedSessionId) ?? null
        : null;
      const currentItemId = currentSession?.nowPlayingItemId;

      if (currentItemId === itemId && latestState.subtitleTracks.length > 0) {
        return;
      }

      const trackedItemId = latestState.pendingMediaServerItemId ?? currentItemId ?? null;
      if (trackedItemId !== itemId) {
        this.jellyfinembyService.requestSessionsBurst(`mediaserver-video-change:${itemId}`);
      }

      const targetServerConfigId = currentServerConfigId;
      const storedSessionMatchesContext =
        storedSession?.nowPlayingItemId === itemId &&
        targetServerConfigId !== null &&
        storedSession.serverConfigId === targetServerConfigId;
      const matchingSession = storedSessionMatchesContext
        ? storedSession
        : targetServerConfigId === null
          ? null
          : latestState.mediaServer.sessions.find(
              (session) =>
                session.nowPlayingItemId === itemId &&
                session.serverConfigId === targetServerConfigId
            ) ?? null;

      if (matchingSession) {
        this.stateManager.updateState((draft) => {
          draft.mediaServer.selectedSessionId = matchingSession.id;
          draft.status = "loading-subtitles";
          draft.pendingMediaServerItemId = itemId;
        });
        this.stateManager.resetSubtitleState();
        this.jellyfinembyService.setActiveSession(matchingSession.id);
        updateJellyfinembyTabContext(this.tabContexts, message.tabId, {
          sessionId: matchingSession.id,
          serverConfigId: matchingSession.serverConfigId,
          itemId: matchingSession.nowPlayingItemId ?? itemId
        });
      } else {
        this.stateManager.updateState((draft) => {
          draft.pendingMediaServerItemId = itemId;
          draft.status = "loading-subtitles";
        });
        this.stateManager.resetSubtitleState();
        updateJellyfinembyTabContext(this.tabContexts, message.tabId, {
          itemId
        });
      }
      return;
    }

    this.stateManager.updateState((draft) => {
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

    const selection = this.stateManager.selectProfileForUrl(url);
    this.stateManager.applyProfileSelection(selection.profile, selection.rule);

    if (storedSession) {
      if (this.stateManager.getState().mediaServer.selectedSessionId !== storedSession.id) {
        this.stateManager.updateState((draft) => {
          draft.mediaServer.selectedSessionId = storedSession.id;
          draft.pendingMediaServerItemId = storedSession.nowPlayingItemId ?? draft.pendingMediaServerItemId;
        });
        this.jellyfinembyService.setActiveSession(storedSession.id);
      }
      updateJellyfinembyTabContext(this.tabContexts, message.tabId, {
        sessionId: storedSession.id,
        serverConfigId: storedSession.serverConfigId,
        ...(storedSession.nowPlayingItemId ? { itemId: storedSession.nowPlayingItemId } : {})
      });
      if (!this.stateManager.getState().pendingMediaServerItemId && storedSession.nowPlayingItemId) {
        this.stateManager.setPendingMediaServerItemId(storedSession.nowPlayingItemId);
      }
    }

    this.jellyfinembyService.requestSessionsBurst("mediaserver-video-context-no-itemid");
  }
}
