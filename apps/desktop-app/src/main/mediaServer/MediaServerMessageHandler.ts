import type { FromExtensionBroadcastMessage } from "@immersive-subs/contracts";
import type { ConnectionMessageEvent } from "../appEventBus.js";
import type { JellyfinembySubtitleService } from "../jellyfinemby/index.js";
import { createLogger } from "../logger.js";
import type { StateManager } from "../stateManager.js";
import { MediaServerUrlResolver } from "./MediaServerUrlResolver.js";
import { TabContextRegistry } from "./TabContextRegistry.js";

type MessageHandlerService = Pick<
  JellyfinembySubtitleService,
  "setActiveSession" | "requestSessionsBurst"
>;

export class MediaServerMessageHandler {
  private readonly log = createLogger("mediaserver-message-handler");

  constructor(
    private readonly stateManager: StateManager,
    private readonly mediaServerService: MessageHandlerService,
    private readonly tabRegistry: TabContextRegistry,
    private readonly urlResolver: MediaServerUrlResolver,
    private readonly isActive: () => boolean
  ) {}

  handleConnectionMessage(event: ConnectionMessageEvent) {
    if (event.message.type !== "video-context") {
      return;
    }
    const url = event.resolvedUrl;
    const configId = this.urlResolver.resolveMediaServerConfigIdFromUrls([
      url,
      event.message.payload.pageUrl ?? null,
      event.message.payload.videoSrc ?? null
    ]);
    const existingTabContext = this.tabRegistry.get(event.message.tabId);
    const mediaServerConfigId = configId ?? existingTabContext?.serverConfigId ?? null;
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
      this.tabRegistry.update(event.message.tabId, {
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
        this.mediaServerService.setActiveSession(null);
      }
    }

    if (!url) {
      return;
    }

    void this.processMediaServerVideoContext(event.message, url);
  }

  handleNonMediaServerSwitch(tabId: number) {
    const state = this.stateManager.getState();
    this.tabRegistry.clear(tabId);
    if (state.activeSource !== "extension") {
      this.stateManager.updateState((draft) => {
        draft.activeSource = "extension";
        draft.pendingMediaServerItemId = null;
        if (draft.mediaServer.selectedSessionId) {
          draft.mediaServer.selectedSessionId = null;
        }
      });
      this.mediaServerService.setActiveSession(null);
    }
  }

  async processMediaServerVideoContext(
    message: Extract<FromExtensionBroadcastMessage, { type: "video-context" }>,
    url: string
  ) {
    const state = this.stateManager.getState();
    const itemId = this.urlResolver.extractItemId(message.payload, url);
    const currentServerConfigId = this.urlResolver.resolveMediaServerConfigIdFromUrls([
      url,
      message.payload.pageUrl,
      message.payload.videoSrc
    ]);

    if (itemId) {
      this.tabRegistry.update(message.tabId, { itemId });
    }

    const tabContext = this.tabRegistry.get(message.tabId);
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
        this.mediaServerService.requestSessionsBurst(`mediaserver-video-change:${itemId}`);
      }

      const targetServerConfigId = currentServerConfigId ?? tabContext?.serverConfigId ?? null;
      const matchingSession =
        storedSession?.nowPlayingItemId === itemId &&
        (!targetServerConfigId || storedSession.serverConfigId === targetServerConfigId)
          ? storedSession
          : latestState.mediaServer.sessions.find(
              (session) =>
                session.nowPlayingItemId === itemId &&
                (!targetServerConfigId || session.serverConfigId === targetServerConfigId)
            ) ?? null;

      if (matchingSession) {
        this.stateManager.updateState((draft) => {
          draft.mediaServer.selectedSessionId = matchingSession.id;
          draft.status = "loading-subtitles";
          draft.pendingMediaServerItemId = itemId;
        });
        this.stateManager.resetSubtitleState();
        this.mediaServerService.setActiveSession(matchingSession.id);
        this.tabRegistry.update(message.tabId, {
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
        this.tabRegistry.update(message.tabId, {
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
        this.mediaServerService.setActiveSession(storedSession.id);
      }
      this.tabRegistry.update(message.tabId, {
        sessionId: storedSession.id,
        serverConfigId: storedSession.serverConfigId,
        ...(storedSession.nowPlayingItemId ? { itemId: storedSession.nowPlayingItemId } : {})
      });
      if (!this.stateManager.getState().pendingMediaServerItemId && storedSession.nowPlayingItemId) {
        this.stateManager.setPendingMediaServerItemId(storedSession.nowPlayingItemId);
      }
    }

    this.mediaServerService.requestSessionsBurst("mediaserver-video-context-no-itemid");
  }
}
