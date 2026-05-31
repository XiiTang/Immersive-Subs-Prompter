import { describe, expect, it, vi } from "vitest";
import type { MediaServerSessionSummary } from "../types.js";
import { JellyfinembySessionHandler } from "./JellyfinembySessionHandler.js";
import type { JellyfinembyTabContext } from "./types.js";

function session(
  id: string,
  serverConfigId: string,
  nowPlayingItemId: string | null
): MediaServerSessionSummary {
  return {
    id,
    serverConfigId,
    serverName: serverConfigId,
    serverType: "jellyfinemby",
    deviceName: null,
    client: null,
    userName: null,
    nowPlayingItemId,
    nowPlayingItemName: null,
    mediaSourceId: null,
    runTimeTicks: null,
    positionTicks: null,
    isPaused: false,
    playbackRate: 1,
    subtitleStreams: []
  };
}

function createStateManager(overrides: Record<string, unknown> = {}) {
  const state = {
    connectionCount: 0,
    activeTabId: null,
    activeSource: null,
    status: "idle",
    title: null,
    pageUrl: null,
    videoUrl: null,
    site: null,
    pendingMediaServerItemId: null,
    mediaServer: {
      selectedSessionId: null,
      sessions: []
    },
    ...overrides
  } as any;

  return {
    state,
    getState: vi.fn(() => state),
    setMediaServerSessions: vi.fn((sessions: MediaServerSessionSummary[]) => {
      state.mediaServer.sessions = sessions;
    }),
    updateState: vi.fn((updater: (draft: typeof state) => void) => {
      updater(state);
      return state;
    }),
    setMediaServerSelectedSession: vi.fn((sessionId: string | null) => {
      state.mediaServer.selectedSessionId = sessionId;
    }),
    setPendingMediaServerItemId: vi.fn((itemId: string | null) => {
      state.pendingMediaServerItemId = itemId;
    }),
    resetSubtitleState: vi.fn(),
    emitCurrentState: vi.fn()
  };
}

function createTabContexts() {
  return new Map<number, JellyfinembyTabContext>();
}

function createHandler(stateManager: ReturnType<typeof createStateManager>, tabContexts = createTabContexts()) {
  const service = {
    setActiveSession: vi.fn()
  };
  const handler = new JellyfinembySessionHandler(
    stateManager as never,
    service as never,
    tabContexts,
    {
      buildPageUrl: vi.fn(() => null),
      buildItemUrl: vi.fn(() => null)
    } as never
  );
  return { handler, service, tabContexts };
}

describe("JellyfinembySessionHandler", () => {
  it("does not bind a tab to a same-item session from another server", () => {
    const stateManager = createStateManager();
    const tabContexts = createTabContexts();
    tabContexts.set(7, {
      itemId: "item-1",
      serverConfigId: "server-a",
      sessionId: null
    });
    const { handler } = createHandler(stateManager, tabContexts);

    handler.handleMediaServerSessionsUpdate([
      session("server-b:s1", "server-b", "item-1")
    ]);

    expect(tabContexts.get(7)).toEqual({
      itemId: "item-1",
      serverConfigId: "server-a",
      sessionId: null
    });
  });

  it("does not select a session by item id when the active tab server is unknown", () => {
    const stateManager = createStateManager({
      activeSource: "mediaserver",
      activeTabId: 7
    });
    const tabContexts = createTabContexts();
    tabContexts.set(7, {
      itemId: "item-1",
      serverConfigId: null,
      sessionId: null
    });
    const { handler, service } = createHandler(stateManager, tabContexts);

    handler.handleMediaServerSessionsUpdate([
      session("server-b:s1", "server-b", "item-1")
    ]);

    expect(stateManager.setMediaServerSelectedSession).not.toHaveBeenCalled();
    expect(service.setActiveSession).not.toHaveBeenCalled();
    expect(stateManager.state.mediaServer.selectedSessionId).toBeNull();
  });

  it("does not fall back to the first session when the selected session disappears", () => {
    const stateManager = createStateManager({
      activeSource: "mediaserver",
      mediaServer: {
        selectedSessionId: "server-a:s1",
        sessions: [session("server-a:s1", "server-a", "item-1")]
      }
    });
    const { handler, service } = createHandler(stateManager);

    handler.handleMediaServerSessionsUpdate([
      session("server-b:s1", "server-b", "item-2")
    ]);

    expect(stateManager.state.mediaServer.selectedSessionId).toBeNull();
    expect(service.setActiveSession).toHaveBeenLastCalledWith(null);
  });

  it("clears stale media-server state when the selected session disappears without a replacement", () => {
    const stateManager = createStateManager({
      activeSource: "mediaserver",
      status: "ready",
      title: "Old Movie",
      pageUrl: "http://server-a.local/item-1",
      videoUrl: "http://server-a.local/video-1",
      site: "jellyfinemby",
      pendingMediaServerItemId: "item-1",
      mediaServer: {
        selectedSessionId: "server-a:s1",
        sessions: [session("server-a:s1", "server-a", "item-1")]
      }
    });
    const { handler, service } = createHandler(stateManager);

    handler.handleMediaServerSessionsUpdate([
      session("server-b:s1", "server-b", "item-2")
    ]);

    expect(stateManager.state.activeSource).toBeNull();
    expect(stateManager.state.status).toBe("idle");
    expect(stateManager.state.title).toBeNull();
    expect(stateManager.state.pageUrl).toBeNull();
    expect(stateManager.state.videoUrl).toBeNull();
    expect(stateManager.state.site).toBeNull();
    expect(stateManager.state.pendingMediaServerItemId).toBeNull();
    expect(stateManager.resetSubtitleState).toHaveBeenCalledTimes(1);
    expect(service.setActiveSession).toHaveBeenLastCalledWith(null);
  });
});
