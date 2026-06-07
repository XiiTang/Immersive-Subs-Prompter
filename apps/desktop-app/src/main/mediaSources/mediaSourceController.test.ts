import { describe, expect, it, vi } from "vitest";
import { AppEventBus } from "../appEventBus.js";
import { MediaSourceController } from "./mediaSourceController.js";

function createStateManager() {
  const state = {
    connectionCount: 1,
    activeTabId: null,
    pageUrl: null,
    videoUrl: null,
    title: null,
    site: null,
    activeSource: null,
    status: "awaiting-video",
    error: null,
    playback: { currentTime: 0, duration: null, playbackRate: 0, lastUpdate: null, loop: null },
    subtitleTracks: [],
    selectedPrimarySubtitleId: null,
    selectedSecondarySubtitleId: null,
    primarySubtitles: null,
    secondarySubtitles: null,
    pendingMediaServerItemId: null,
    mediaServer: {
      connected: false,
      sessions: [],
      selectedSessionId: null,
      lastUpdated: null
    }
  } as any;
  return {
    state,
    getState: vi.fn(() => state),
    setPageContext: vi.fn((tabId: number, payload: any) => {
      state.activeTabId = tabId;
      state.pageUrl = payload.pageUrl;
      state.site = payload.site;
      state.title = payload.title;
    }),
    updateState: vi.fn((mutator: (draft: any) => void) => {
      mutator(state);
      return state;
    }),
    resetSubtitleState: vi.fn(() => {
      state.subtitleTracks = [];
      state.primarySubtitles = null;
      state.secondarySubtitles = null;
    }),
    selectProfileForUrl: vi.fn(() => ({ profile: { id: "profile-1" }, rule: null })),
    applyProfileSelection: vi.fn(),
    setMediaServerSessions: vi.fn((sessions: any[]) => {
      state.mediaServer.sessions = sessions;
    }),
    setSubtitleTracks: vi.fn((tracks: any[]) => {
      state.subtitleTracks = tracks;
    }),
    applyPreferredTracksFromSettings: vi.fn(),
    setStatus: vi.fn((status: string) => {
      state.status = status;
    }),
    updatePlayback: vi.fn((payload: any) => {
      state.playback = { ...state.playback, ...payload };
    })
  };
}

describe("MediaSourceController", () => {
  it("projects adapter source, subtitle, session, and playback events into host state", async () => {
    const bus = new AppEventBus();
    const stateManager = createStateManager();
    const controller = new MediaSourceController({
      bus,
      stateManager: stateManager as never,
      getAdapters: () => [
        {
          pluginId: "xiitang/media-source",
          adapter: {
            handleConnectionMessage: vi.fn(async () => [
              {
                type: "sourceMatched",
                tabId: 7,
                pageUrl: "https://media.example.test/watch/1",
                videoUrl: "https://media.example.test/items/1",
                title: "Episode 1",
                site: "community-media",
                selectedSessionId: "session-1"
              },
              {
                type: "sessionsChanged",
                sessions: [{ id: "session-1", serverConfigId: "server-1" }]
              },
              {
                type: "subtitleTracksLoaded",
                sessionId: "session-1",
                tracks: [{ id: "track-1", sourceFile: "en.srt", cues: [] }]
              },
              {
                type: "playbackSnapshot",
                sessionId: "session-1",
                positionMs: 5000,
                durationMs: 10000,
                playbackRate: 1,
                paused: false
              }
            ])
          }
        }
      ]
    });
    controller.start();
    const event = {
      message: { source: "usp-extension", type: "video-context", tabId: 7, payload: {} },
      resolvedUrl: "https://media.example.test/watch/1",
      handled: false,
      markHandled() {
        this.handled = true;
      }
    } as any;

    bus.emit("connection:message", event);
    await vi.waitFor(() => {
      expect(event.handled).toBe(true);
      expect(stateManager.state.activeSource).toBe("mediaserver");
      expect(stateManager.state.mediaServer.sessions).toEqual([{ id: "session-1", serverConfigId: "server-1" }]);
      expect(stateManager.state.subtitleTracks).toEqual([{ id: "track-1", sourceFile: "en.srt", cues: [] }]);
      expect(stateManager.state.playback.currentTime).toBe(5000);
    });
  });

  it("marks active media-source playback events as handled", async () => {
    const bus = new AppEventBus();
    const stateManager = createStateManager();
    const handleConnectionMessage = vi
      .fn()
      .mockResolvedValueOnce([
        {
          type: "sourceMatched",
          tabId: 7,
          pageUrl: "https://media.example.test/watch/1",
          videoUrl: "https://media.example.test/items/1",
          title: "Episode 1",
          site: "community-media",
          selectedSessionId: "session-1"
        }
      ])
      .mockResolvedValueOnce([
        {
          type: "playbackSnapshot",
          sessionId: "session-1",
          positionMs: 12000,
          durationMs: 60000,
          playbackRate: 1,
          paused: false
        }
      ]);
    const controller = new MediaSourceController({
      bus,
      stateManager: stateManager as never,
      getAdapters: () => [{ pluginId: "xiitang/media-source", adapter: { handleConnectionMessage } }]
    });
    controller.start();

    bus.emit("connection:message", {
      message: { source: "usp-extension", type: "video-context", tabId: 7, payload: {} },
      resolvedUrl: "https://media.example.test/watch/1",
      handled: false,
      markHandled() {
        this.handled = true;
      }
    } as any);
    await vi.waitFor(() => {
      expect(stateManager.state.activeSource).toBe("mediaserver");
    });

    const playbackEvent = {
      message: { source: "usp-extension", type: "time-update", tabId: 7, payload: { currentTime: 5000 } },
      resolvedUrl: null,
      handled: false,
      markHandled() {
        this.handled = true;
      }
    } as any;

    bus.emit("connection:message", playbackEvent);

    await vi.waitFor(() => {
      expect(playbackEvent.handled).toBe(true);
      expect(stateManager.state.playback.currentTime).toBe(12000);
    });
  });

  it("clears a stale selected session when the same adapter matches a source without a selected session", async () => {
    const bus = new AppEventBus();
    const stateManager = createStateManager();
    const handleConnectionMessage = vi
      .fn()
      .mockResolvedValueOnce([
        {
          type: "sourceMatched",
          tabId: 7,
          pageUrl: "https://media.example.test/watch/1",
          videoUrl: "https://media.example.test/items/1",
          title: "Episode 1",
          site: "community-media",
          selectedSessionId: "session-1"
        }
      ])
      .mockResolvedValueOnce([
        {
          type: "sourceMatched",
          tabId: 7,
          pageUrl: "https://media.example.test/watch/2",
          videoUrl: "https://media.example.test/items/2",
          title: "Episode 2",
          site: "community-media",
          selectedSessionId: null
        },
        {
          type: "subtitleTracksLoaded",
          sessionId: "session-2",
          tracks: [{ id: "track-2", sourceFile: "episode-2.srt", cues: [] }]
        }
      ]);
    const controller = new MediaSourceController({
      bus,
      stateManager: stateManager as never,
      getAdapters: () => [{ pluginId: "xiitang/media-source", adapter: { handleConnectionMessage } }]
    });
    controller.start();

    bus.emit("connection:message", {
      message: { source: "usp-extension", type: "video-context", tabId: 7, payload: {} },
      resolvedUrl: "https://media.example.test/watch/1",
      handled: false,
      markHandled() {
        this.handled = true;
      }
    } as any);
    await vi.waitFor(() => {
      expect(stateManager.state.mediaServer.selectedSessionId).toBe("session-1");
    });

    bus.emit("connection:message", {
      message: { source: "usp-extension", type: "video-context", tabId: 7, payload: {} },
      resolvedUrl: "https://media.example.test/watch/2",
      handled: false,
      markHandled() {
        this.handled = true;
      }
    } as any);

    await vi.waitFor(() => {
      expect(stateManager.state.mediaServer.selectedSessionId).toBeNull();
      expect(stateManager.state.subtitleTracks).toEqual([{ id: "track-2", sourceFile: "episode-2.srt", cues: [] }]);
      expect(stateManager.state.status).toBe("ready");
    });
  });

  it("clears active media-source state when a video context no longer matches any adapter", async () => {
    const bus = new AppEventBus();
    const stateManager = createStateManager();
    const handleConnectionMessage = vi
      .fn()
      .mockResolvedValueOnce([
        {
          type: "sourceMatched",
          tabId: 7,
          pageUrl: "https://media.example.test/watch/1",
          videoUrl: "https://media.example.test/items/1",
          title: "Episode 1",
          site: "community-media",
          selectedSessionId: "session-1"
        }
      ])
      .mockResolvedValueOnce(null);
    const controller = new MediaSourceController({
      bus,
      stateManager: stateManager as never,
      getAdapters: () => [{ pluginId: "xiitang/media-source", adapter: { handleConnectionMessage } }]
    });
    controller.start();

    bus.emit("connection:message", {
      message: { source: "usp-extension", type: "video-context", tabId: 7, payload: {} },
      resolvedUrl: "https://media.example.test/watch/1",
      handled: false,
      markHandled() {
        this.handled = true;
      }
    } as any);
    await vi.waitFor(() => {
      expect(stateManager.state.activeSource).toBe("mediaserver");
    });

    const switchEvent = {
      message: { source: "usp-extension", type: "video-context", tabId: 7, payload: { pageUrl: "https://video.example.test" } },
      resolvedUrl: "https://video.example.test",
      handled: false,
      markHandled() {
        this.handled = true;
      }
    } as any;

    bus.emit("connection:message", switchEvent);

    await vi.waitFor(() => {
      expect(switchEvent.handled).toBe(false);
      expect(stateManager.state.activeSource).toBe("extension");
      expect(stateManager.state.videoUrl).toBeNull();
      expect(stateManager.state.mediaServer.sessions).toEqual([]);
    });
  });

  it("clears media-source state when the owning adapter is removed", async () => {
    const bus = new AppEventBus();
    const stateManager = createStateManager();
    const controller = new MediaSourceController({
      bus,
      stateManager: stateManager as never,
      getAdapters: () => [
        {
          pluginId: "xiitang/media-source",
          adapter: {
            handleConnectionMessage: vi.fn(async () => [
              {
                type: "sourceMatched",
                tabId: 7,
                pageUrl: "https://media.example.test/watch/1",
                videoUrl: "https://media.example.test/items/1",
                title: "Episode 1",
                site: "community-media",
                selectedSessionId: "session-1"
              },
              {
                type: "sessionsChanged",
                sessions: [{ id: "session-1", serverConfigId: "server-1" }]
              }
            ])
          }
        }
      ]
    });
    controller.start();

    bus.emit("connection:message", {
      message: { source: "usp-extension", type: "video-context", tabId: 7, payload: {} },
      resolvedUrl: "https://media.example.test/watch/1",
      markHandled() {}
    } as any);
    await vi.waitFor(() => {
      expect(stateManager.state.activeSource).toBe("mediaserver");
      expect(stateManager.state.mediaServer.sessions).toHaveLength(1);
    });

    (controller as any).handlePluginRemoved("other.media");
    expect(stateManager.state.activeSource).toBe("mediaserver");

    (controller as any).handlePluginRemoved("xiitang/media-source");

    expect(stateManager.state.activeSource).toBe("extension");
    expect(stateManager.state.videoUrl).toBeNull();
    expect(stateManager.state.mediaServer.sessions).toEqual([]);
    expect(stateManager.resetSubtitleState).toHaveBeenCalled();
  });
});
