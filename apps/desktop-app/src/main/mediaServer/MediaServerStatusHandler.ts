import { JellyfinembySubtitleService } from "../jellyfinemby/index.js";
import { createLogger } from "../logger.js";
import { StateManager } from "../stateManager.js";
import type {
  MediaServerPlaybackPayload,
  MediaServerStatusPayload,
  MediaServerSubtitlesPayload
} from "../types.js";
import { TabContextRegistry } from "./TabContextRegistry.js";

export class MediaServerStatusHandler {
  private readonly log = createLogger("mediaserver-status-handler");

  constructor(
    private readonly stateManager: StateManager,
    private readonly mediaServerService: JellyfinembySubtitleService,
    private readonly tabRegistry: TabContextRegistry
  ) {}

  handleMediaServerStatusUpdate(payload: MediaServerStatusPayload) {
    const current = this.stateManager.getState().mediaServer.connected;
    if (current === payload.connected) {
      return;
    }
    this.stateManager.updateState((draft) => {
      draft.mediaServer.connected = payload.connected;
    });
    this.log.debug("Media server status changed", payload);

    if (!payload.connected) {
      this.stateManager.updateState((draft) => {
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
      if (this.stateManager.getState().activeSource !== "mediaserver") {
        this.stateManager.resetSubtitleState();
      }
      this.mediaServerService.setActiveSession(null);
      return;
    }

    this.mediaServerService.requestSessionsBurst("ws-status-connected");
  }

  handleMediaServerSubtitlesUpdate(payload: MediaServerSubtitlesPayload) {
    const state = this.stateManager.getState();
    if (state.activeSource !== "mediaserver" || !payload.sessionId) {
      return;
    }
    if (payload.sessionId !== state.mediaServer.selectedSessionId) {
      return;
    }
    this.stateManager.setSubtitleTracks(payload.tracks);
    if (payload.tracks.length) {
      const status = this.stateManager.getState().status;
      if (status === "awaiting-video" || status === "idle" || status === "error") {
        this.stateManager.setStatus("loading-subtitles");
      }
      this.stateManager.applyPreferredTracksFromSettings(payload.tracks);
      this.stateManager.setStatus("ready");
      this.stateManager.updateState((draft) => {
        draft.error = null;
      });
    } else {
      this.stateManager.resetSubtitleState();
      this.stateManager.updateState((draft) => {
        draft.status = "error";
        draft.error = "No media server subtitles available for this session";
      });
    }
  }

  handleMediaServerPlaybackUpdate(payload: MediaServerPlaybackPayload) {
    const state = this.stateManager.getState();
    if (state.activeSource !== "mediaserver") {
      return;
    }
    if (!payload.sessionId || payload.sessionId !== state.mediaServer.selectedSessionId) {
      return;
    }

    const activeTabContext = this.tabRegistry.get(state.activeTabId);
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
    this.stateManager.updatePlayback({
      currentTime,
      playbackRate,
      duration
    });
  }
}
