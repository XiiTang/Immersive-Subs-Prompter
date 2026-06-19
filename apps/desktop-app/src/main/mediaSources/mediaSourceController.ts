import type { ConnectionMessageEvent, AppEventBus } from "../appEventBus.js";
import type { StateManager } from "../stateManager.js";
import { createLogger } from "../logger.js";
import type { MediaSourceAdapterEvent, MediaSourceRuntime } from "./mediaSourceTypes.js";
import type { SubtitleTrack } from "../types.js";

export interface MediaSourceControllerOptions {
  bus: AppEventBus;
  stateManager: StateManager;
  getSources: () => MediaSourceRuntime[];
}

export class MediaSourceController {
  private readonly log = createLogger("media-source-controller");
  private started = false;
  private activeMediaSourceId: string | null = null;

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
    for (const source of this.options.getSources()) {
      if (source.stop) {
        await source.stop();
      }
    }
    this.clearRuntimeState();
  }

  private async handleConnectionMessage(event: ConnectionMessageEvent): Promise<void> {
    for (const source of this.options.getSources()) {
      if (!source.handleConnectionMessage) {
        continue;
      }
      const sourceId = source.sourceId;
      const wasActiveSource = this.activeMediaSourceId === sourceId;
      try {
        const result = await source.handleConnectionMessage(event.message);
        const events = normalizeSourceEvents(result);
        if (!events.length) {
          continue;
        }
        for (const sourceEvent of events) {
          this.applySourceEvent(sourceId, sourceEvent);
        }
        if (
          wasActiveSource ||
          this.activeMediaSourceId === sourceId ||
          events.some((sourceEvent) => sourceEvent.type === "sourceMatched")
        ) {
          event.markHandled();
        }
        return;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.log.error(`Media source "${sourceId}" failed`, error);
        this.applySourceEvent(sourceId, { type: "error", message });
        if (wasActiveSource) {
          event.markHandled();
        }
        return;
      }
    }
    if (event.message.type === "video-context" && this.activeMediaSourceId) {
      this.clearRuntimeState();
    }
  }

  handleSourceSettingsChanged(sourceId: string): void {
    if (this.activeMediaSourceId !== sourceId) {
      return;
    }
    this.clearRuntimeState();
  }

  private applySourceEvent(sourceId: string, event: MediaSourceAdapterEvent): void {
    switch (event.type) {
      case "sourceMatched":
        this.activeMediaSourceId = sourceId;
        if (this.isSameSourceMatch(sourceId, event)) {
          break;
        }
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
    if (this.hasSameSubtitleTracks(event)) {
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

  private isSameSourceMatch(
    sourceId: string,
    event: Extract<MediaSourceAdapterEvent, { type: "sourceMatched" }>
  ): boolean {
    if (this.activeMediaSourceId !== sourceId) {
      return false;
    }
    const state = this.options.stateManager.getState();
    const selectedSessionId = "selectedSessionId" in event ? event.selectedSessionId ?? null : state.mediaServer.selectedSessionId;
    return (
      state.activeSource === "mediaserver" &&
      state.activeTabId === event.tabId &&
      state.pageUrl === event.pageUrl &&
      state.videoUrl === event.videoUrl &&
      state.title === event.title &&
      state.site === event.site &&
      state.mediaServer.selectedSessionId === selectedSessionId
    );
  }

  private hasSameSubtitleTracks(event: Extract<MediaSourceAdapterEvent, { type: "subtitleTracksLoaded" }>): boolean {
    const state = this.options.stateManager.getState();
    if ((event.sessionId ?? null) !== (state.mediaServer.selectedSessionId ?? null)) {
      return false;
    }
    return areSubtitleTracksEqual(state.subtitleTracks, event.tracks);
  }

  private clearRuntimeState(): void {
    this.activeMediaSourceId = null;
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

function areSubtitleTracksEqual(left: SubtitleTrack[], right: SubtitleTrack[]): boolean {
  if (left.length !== right.length) {
    return false;
  }
  return left.every((track, index) => {
    const other = right[index];
    if (!other || track.id !== other.id || track.sourceFile !== other.sourceFile || track.cues.length !== other.cues.length) {
      return false;
    }
    return track.cues.every((cue, cueIndex) => {
      const otherCue = other.cues[cueIndex];
      return otherCue && cue.start === otherCue.start && cue.end === otherCue.end && cue.text === otherCue.text;
    });
  });
}

function normalizeSourceEvents(input: unknown): MediaSourceAdapterEvent[] {
  if (!input) {
    return [];
  }
  const events = Array.isArray(input) ? input : [input];
  return events.filter((event): event is MediaSourceAdapterEvent =>
    Boolean(event && typeof event === "object" && typeof (event as { type?: unknown }).type === "string")
  );
}
