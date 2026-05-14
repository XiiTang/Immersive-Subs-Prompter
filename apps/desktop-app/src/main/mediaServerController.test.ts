import { describe, expect, it, vi } from "vitest";
import { AppEventBus } from "./appEventBus.js";
import { MediaServerController } from "./mediaServerController.js";

function createStateManager() {
  const state = {
    connectionCount: 0,
    activeTabId: null,
    pageUrl: null,
    videoUrl: "http://server.local:8096/Items/1",
    title: null,
    site: null,
    activeSource: "mediaserver",
    status: "ready",
    error: null,
    playback: { currentTime: 1, duration: 10, playbackRate: 1, lastUpdate: null, loop: null },
    subtitleTracks: [{ id: "track", sourceFile: "x.srt", cues: [] }],
    selectedPrimarySubtitleId: "track",
    selectedSecondarySubtitleId: null,
    primarySubtitles: { id: "track", sourceFile: "x.srt", cues: [] },
    secondarySubtitles: null,
    appliedProfileId: null,
    appliedProfileName: null,
    appliedRuleId: null,
    appliedRuleName: null,
    appliedRulePattern: null,
    appliedRuleMatchType: null,
    pendingMediaServerItemId: "1",
    mediaServer: {
      connected: true,
      sessions: [{ id: "server-1:s1", serverConfigId: "server-1" }],
      selectedSessionId: "server-1:s1",
      lastUpdated: 123
    },
    isFullscreen: false,
    transcription: { status: "idle", message: null, configName: null, lastFinishedAt: null }
  } as any;

  return {
    getState: () => state,
    updateState: vi.fn((updater: (draft: any) => void) => {
      updater(state);
      return state;
    }),
    resetSubtitleState: vi.fn(() => {
      state.subtitleTracks = [];
      state.selectedPrimarySubtitleId = null;
      state.selectedSecondarySubtitleId = null;
      state.primarySubtitles = null;
      state.secondarySubtitles = null;
    }),
    setMediaServerSessions: vi.fn(),
    setMediaServerSelectedSession: vi.fn(),
    emitCurrentState: vi.fn(),
    setSubtitleTracks: vi.fn(),
    applyPreferredTracksFromSettings: vi.fn(),
    setStatus: vi.fn(),
    updatePlayback: vi.fn(),
    setPageContext: vi.fn(),
    selectProfileForUrl: vi.fn(() => ({ profile: null, rule: null })),
    applyProfileSelection: vi.fn(),
    setPendingMediaServerItemId: vi.fn((itemId: string | null) => {
      state.pendingMediaServerItemId = itemId;
    }),
    state
  };
}

function createService() {
  const listeners = new Map<string, Function>();
  return {
    start: vi.fn(),
    stop: vi.fn(),
    refresh: vi.fn(),
    setContinuousSessionPolling: vi.fn(),
    setActiveSession: vi.fn(),
    requestSessionsBurst: vi.fn(),
    on: vi.fn((event: string, listener: Function) => {
      listeners.set(event, listener);
      return () => listeners.delete(event);
    })
  };
}

function createSettings() {
  return {
    plugins: {
      "official.jellyfinemby": {
        config: { servers: [] }
      }
    }
  };
}

describe("MediaServerController lifecycle", () => {
  it("registers routing once but does not start service until activated", () => {
    const bus = new AppEventBus();
    const service = createService();
    const controller = new MediaServerController({
      bus,
      stateManager: createStateManager() as never,
      getSettings: createSettings as never,
      cacheManager: {} as never,
      createService: () => service as never
    });

    controller.start();
    controller.start();
    expect(bus.listenerCount("connection:message")).toBe(1);
    expect(service.start).not.toHaveBeenCalled();

    controller.activate();
    expect(service.start).toHaveBeenCalledTimes(1);
    expect(controller.isActive()).toBe(true);
  });

  it("refreshes only while active", () => {
    const service = createService();
    const controller = new MediaServerController({
      bus: new AppEventBus(),
      stateManager: createStateManager() as never,
      getSettings: createSettings as never,
      cacheManager: {} as never,
      createService: () => service as never
    });

    controller.handleSettingsUpdated();
    expect(service.refresh).not.toHaveBeenCalled();

    controller.activate();
    controller.handleSettingsUpdated();
    expect(service.refresh).toHaveBeenCalledTimes(1);
  });

  it("deactivates service and clears media-server runtime state", () => {
    const stateManager = createStateManager();
    const service = createService();
    const controller = new MediaServerController({
      bus: new AppEventBus(),
      stateManager: stateManager as never,
      getSettings: createSettings as never,
      cacheManager: {} as never,
      createService: () => service as never
    });

    controller.activate();
    controller.deactivate();

    expect(service.stop).toHaveBeenCalledTimes(1);
    expect(stateManager.state.mediaServer).toEqual({
      connected: false,
      sessions: [],
      selectedSessionId: null,
      lastUpdated: null
    });
    expect(stateManager.state.pendingMediaServerItemId).toBeNull();
    expect(stateManager.state.activeSource).toBeNull();
    expect(stateManager.state.status).toBe("idle");
    expect(stateManager.state.subtitleTracks).toEqual([]);
  });
});
