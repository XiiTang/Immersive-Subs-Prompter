import { describe, expect, it, vi } from "vitest";
import { JellyfinembyStatusHandler } from "./JellyfinembyStatusHandler.js";
import { JellyfinembyTabContextRegistry } from "./JellyfinembyTabContextRegistry.js";

function createStateManager() {
  const state = {
    connectionCount: 1,
    activeSource: "mediaserver",
    status: "ready",
    title: "Movie",
    pageUrl: "http://server.local/web/index.html#!/details?id=item-1",
    videoUrl: "http://server.local/Items/item-1",
    site: "jellyfinemby",
    pendingMediaServerItemId: "item-1",
    mediaServer: {
      connected: true,
      sessions: [{ id: "server-1:s1" }],
      selectedSessionId: "server-1:s1"
    },
    subtitleTracks: [{ id: "track" }]
  };

  return {
    state,
    getState: vi.fn(() => state),
    updateState: vi.fn((updater: (draft: typeof state) => void) => {
      updater(state);
      return state;
    }),
    resetSubtitleState: vi.fn(() => {
      state.subtitleTracks = [];
    }),
    setSubtitleTracks: vi.fn(),
    applyPreferredTracksFromSettings: vi.fn(),
    setStatus: vi.fn(),
    updatePlayback: vi.fn()
  };
}

describe("JellyfinembyStatusHandler", () => {
  it("moves back to awaiting-video when a connected extension remains after media server disconnects", () => {
    const stateManager = createStateManager();
    const service = {
      setActiveSession: vi.fn(),
      requestSessionsBurst: vi.fn()
    };
    const handler = new JellyfinembyStatusHandler(
      stateManager as never,
      service as never,
      new JellyfinembyTabContextRegistry()
    );

    handler.handleMediaServerStatusUpdate({ connected: false, serverType: "jellyfinemby" });

    expect(stateManager.state.activeSource).toBe("extension");
    expect(stateManager.state.status).toBe("awaiting-video");
    expect(stateManager.state.title).toBeNull();
    expect(stateManager.state.pageUrl).toBeNull();
    expect(stateManager.state.videoUrl).toBeNull();
    expect(stateManager.state.site).toBeNull();
    expect(stateManager.state.mediaServer.sessions).toEqual([]);
    expect(stateManager.state.mediaServer.selectedSessionId).toBeNull();
    expect(stateManager.state.pendingMediaServerItemId).toBeNull();
    expect(stateManager.resetSubtitleState).toHaveBeenCalledTimes(1);
    expect(service.setActiveSession).toHaveBeenCalledWith(null);
  });
});
