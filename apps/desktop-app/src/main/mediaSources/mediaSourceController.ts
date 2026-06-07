import type { ConnectionMessageEvent, AppEventBus } from "../appEventBus.js";
import type { StateManager } from "../stateManager.js";
import type {
  MediaServerSessionSummary,
  PlaybackState,
  SubtitleTrack
} from "../types.js";
import type { MediaSourceAdapter } from "../plugins/pluginContributionRegistry.js";
import { createLogger } from "../logger.js";

export type MediaSourceAdapterEvent =
  | {
      type: "sourceMatched";
      tabId: number;
      pageUrl: string | null;
      videoUrl: string | null;
      title: string | null;
      site: string | null;
      selectedSessionId?: string | null;
    }
  | {
      type: "sessionsChanged";
      sessions: MediaServerSessionSummary[];
    }
  | {
      type: "subtitleTracksLoaded";
      sessionId: string | null;
      tracks: SubtitleTrack[];
    }
  | {
      type: "playbackSnapshot";
      sessionId: string | null;
      positionMs: number | null;
      durationMs: number | null;
      playbackRate: number;
      paused: boolean;
    }
  | { type: "sourceDisconnected" }
  | { type: "error"; message: string };

export interface MediaSourceControllerOptions {
  bus: AppEventBus;
  stateManager: StateManager;
  getAdapters: () => Array<{ pluginKey: string; adapter: MediaSourceAdapter }>;
}

export class MediaSourceController {
  private readonly log = createLogger("media-source-controller");
  private started = false;
  private activeMediaSourcePluginKey: string | null = null;

  constructor(private readonly options: MediaSourceControllerOptions) {}

  start(): void {
    if (this.started) {
      return;
    }
    this.started = true;
    this.options.bus.on("connection:message", (event) => {
      const pending = this.handleConnectionMessage(event);
      if (typeof event.waitUntil === "function") {
        event.waitUntil(pending);
      }
    });
  }

  async stop(): Promise<void> {
    for (const { adapter } of this.options.getAdapters()) {
      if (adapter.stop) {
        await adapter.stop();
      }
    }
    this.clearRuntimeState();
  }

  private async handleConnectionMessage(event: ConnectionMessageEvent): Promise<void> {
    for (const { pluginKey, adapter } of this.options.getAdapters()) {
      if (!adapter.handleConnectionMessage) {
        continue;
      }
      const wasActiveAdapter = this.activeMediaSourcePluginKey === pluginKey;
      try {
        const result = await adapter.handleConnectionMessage(event.message);
        const events = normalizeAdapterEvents(result);
        if (!events.length) {
          continue;
        }
        for (const adapterEvent of events) {
          this.applyAdapterEvent(pluginKey, adapterEvent);
        }
        if (
          wasActiveAdapter ||
          this.activeMediaSourcePluginKey === pluginKey ||
          events.some((adapterEvent) => adapterEvent.type === "sourceMatched")
        ) {
          event.markHandled();
        }
        return;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.log.error(`Media source adapter "${pluginKey}" failed`, error);
        this.applyAdapterEvent(pluginKey, { type: "error", message });
        if (wasActiveAdapter) {
          event.markHandled();
        }
        return;
      }
    }
    if (event.message.type === "video-context" && this.activeMediaSourcePluginKey) {
      this.clearRuntimeState();
    }
  }

  handlePluginRemoved(pluginKey: string): void {
    if (this.activeMediaSourcePluginKey !== pluginKey) {
      return;
    }
    this.clearRuntimeState();
  }

  private applyAdapterEvent(pluginKey: string, event: MediaSourceAdapterEvent): void {
    switch (event.type) {
      case "sourceMatched":
        this.activeMediaSourcePluginKey = pluginKey;
        this.options.stateManager.setPageContext(event.tabId, {
          pageUrl: event.pageUrl,
          site: event.site,
          title: event.title
        });
        this.options.stateManager.resetSubtitleState(true);
        this.options.stateManager.updateState((draft) => {
          draft.activeSource = "mediaserver";
          draft.videoUrl = event.videoUrl;
          draft.pageUrl = event.pageUrl;
          draft.title = event.title;
          draft.site = event.site;
          draft.status = "loading-subtitles";
          draft.error = null;
          draft.mediaServer.connected = true;
          if ("selectedSessionId" in event) {
            draft.mediaServer.selectedSessionId = event.selectedSessionId ?? null;
          }
        });
        if (event.videoUrl) {
          const selection = this.options.stateManager.selectProfileForUrl(event.videoUrl);
          this.options.stateManager.applyProfileSelection(selection.profile, selection.rule);
        }
        break;
      case "sessionsChanged":
        this.options.stateManager.setMediaServerSessions(event.sessions);
        break;
      case "subtitleTracksLoaded":
        this.applySubtitleTracks(event);
        break;
      case "playbackSnapshot":
        this.applyPlaybackSnapshot(event);
        break;
      case "sourceDisconnected":
        this.clearRuntimeState();
        break;
      case "error":
        this.options.stateManager.updateState((draft) => {
          draft.status = "error";
          draft.error = event.message;
        });
        break;
    }
  }

  private applySubtitleTracks(event: Extract<MediaSourceAdapterEvent, { type: "subtitleTracksLoaded" }>): void {
    const state = this.options.stateManager.getState();
    if (state.activeSource !== "mediaserver") {
      return;
    }
    if (event.sessionId && state.mediaServer.selectedSessionId && event.sessionId !== state.mediaServer.selectedSessionId) {
      return;
    }
    this.options.stateManager.setSubtitleTracks(event.tracks);
    if (event.tracks.length) {
      this.options.stateManager.applyPreferredTracksFromSettings(event.tracks);
      this.options.stateManager.setStatus("ready");
      this.options.stateManager.updateState((draft) => {
        draft.error = null;
      });
      return;
    }
    this.options.stateManager.resetSubtitleState();
    this.options.stateManager.updateState((draft) => {
      draft.status = "error";
      draft.error = "No media source subtitles available.";
    });
  }

  private applyPlaybackSnapshot(event: Extract<MediaSourceAdapterEvent, { type: "playbackSnapshot" }>): void {
    const state = this.options.stateManager.getState();
    if (state.activeSource !== "mediaserver") {
      return;
    }
    if (event.sessionId && state.mediaServer.selectedSessionId && event.sessionId !== state.mediaServer.selectedSessionId) {
      return;
    }
    const playback: Partial<PlaybackState> = {
      currentTime: event.positionMs ?? 0,
      duration: typeof event.durationMs === "number" && event.durationMs >= 0 ? event.durationMs : state.playback.duration,
      playbackRate: event.paused ? 0 : event.playbackRate || 1
    };
    this.options.stateManager.updatePlayback(playback);
  }

  private clearRuntimeState(): void {
    this.activeMediaSourcePluginKey = null;
    this.options.stateManager.resetSubtitleState();
    this.options.stateManager.updateState((draft) => {
      draft.mediaServer = {
        connected: false,
        sessions: [],
        selectedSessionId: null,
        lastUpdated: null
      };
      draft.pendingMediaServerItemId = null;
      if (draft.activeSource === "mediaserver") {
        draft.activeSource = draft.connectionCount > 0 ? "extension" : null;
        draft.status = draft.connectionCount > 0 ? "awaiting-video" : "idle";
        draft.title = null;
        draft.pageUrl = null;
        draft.videoUrl = null;
        draft.site = null;
      }
    });
  }
}

function normalizeAdapterEvents(input: unknown): MediaSourceAdapterEvent[] {
  if (!input) {
    return [];
  }
  const events = Array.isArray(input) ? input : [input];
  return events.filter((event): event is MediaSourceAdapterEvent =>
    Boolean(event && typeof event === "object" && typeof (event as { type?: unknown }).type === "string")
  );
}
