import type { FromExtensionBroadcastMessage } from "@immersive-subs/contracts";
import { describe, expect, it, vi } from "vitest";
import type { ConnectionMessageEvent } from "../appEventBus.js";
import type { MediaServerSessionSummary } from "../types.js";
import { JellyfinembyMessageHandler } from "./JellyfinembyMessageHandler.js";
import { JellyfinembyTabContextRegistry } from "./JellyfinembyTabContextRegistry.js";

function createVideoContextMessage(): Extract<FromExtensionBroadcastMessage, { type: "video-context" }> {
  return {
    source: "usp-extension",
    type: "video-context",
    sentAt: Date.now(),
    tabId: 7,
    payload: {
      pageUrl: "http://server.local:8096/web/index.html#!/details?id=ITEM1",
      site: "unknown",
      videoSrc: "http://server.local:8096/videos/ITEM1/stream.mp4",
      videoWidth: 1920,
      videoHeight: 1080,
      pictureInPicture: false,
      title: "Movie",
      playbackRate: 1,
      currentTime: 12,
      duration: 120,
      paused: false,
      muted: false,
      volume: 1,
      readyState: 4,
      updatedAt: Date.now(),
      loop: null
    }
  };
}

function createEvent(message = createVideoContextMessage()): ConnectionMessageEvent {
  const event: ConnectionMessageEvent = {
    message,
    resolvedUrl: message.payload.videoSrc,
    handled: false,
    markHandled() {
      this.handled = true;
    }
  };
  return event;
}

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

type TestState = {
  activeSource: "extension" | "mediaserver" | null;
  mediaServer: {
    selectedSessionId: string | null;
    sessions: MediaServerSessionSummary[];
  };
  subtitleTracks: unknown[];
  pendingMediaServerItemId: string | null;
  status?: string;
  videoUrl?: string;
  site?: string;
};

function createStateManager() {
  const state: TestState = {
    activeSource: "extension",
    mediaServer: {
      selectedSessionId: null,
      sessions: []
    },
    subtitleTracks: [],
    pendingMediaServerItemId: null
  };
  return {
    getState: vi.fn(() => state),
    setPageContext: vi.fn(),
    updateState: vi.fn((updater: (draft: typeof state) => void) => updater(state)),
    selectProfileForUrl: vi.fn(() => ({ profile: null, rule: null })),
    applyProfileSelection: vi.fn(),
    resetSubtitleState: vi.fn(),
    setPendingMediaServerItemId: vi.fn()
  };
}

function createUrlResolver(configId: string | null) {
  return {
    resolveMediaServerConfigIdFromUrls: vi.fn(() => configId),
    extractItemId: vi.fn(() => "ITEM1")
  };
}

describe("JellyfinembyMessageHandler", () => {
  it("marks configured Jellyfin / Emby messages handled and ignores them while inactive", () => {
    const stateManager = createStateManager();
    const service = {
      setActiveSession: vi.fn(),
      requestSessionsBurst: vi.fn()
    };
    const handler = new JellyfinembyMessageHandler(
      stateManager as never,
      service as never,
      new JellyfinembyTabContextRegistry(),
      createUrlResolver("server-1") as never,
      () => false
    );

    const event = createEvent();
    handler.handleConnectionMessage(event);

    expect(event.handled).toBe(true);
    expect(stateManager.setPageContext).not.toHaveBeenCalled();
    expect(stateManager.updateState).not.toHaveBeenCalled();
    expect(service.requestSessionsBurst).not.toHaveBeenCalled();
    expect(service.setActiveSession).not.toHaveBeenCalled();
  });

  it("leaves ordinary extension videos unhandled", () => {
    const stateManager = createStateManager();
    const service = {
      setActiveSession: vi.fn(),
      requestSessionsBurst: vi.fn()
    };
    const handler = new JellyfinembyMessageHandler(
      stateManager as never,
      service as never,
      new JellyfinembyTabContextRegistry(),
      createUrlResolver(null) as never,
      () => true
    );

    const event = createEvent({
      ...createVideoContextMessage(),
      payload: {
        ...createVideoContextMessage().payload,
        pageUrl: "https://example.com/watch",
        videoSrc: "https://cdn.example.com/video.mp4"
      }
    });
    handler.handleConnectionMessage(event);

    expect(event.handled).toBe(false);
    expect(stateManager.updateState).not.toHaveBeenCalled();
  });

  it("does not treat ordinary videos as media-server videos through stale tab context", () => {
    const stateManager = createStateManager();
    stateManager.getState().activeSource = "mediaserver";
    stateManager.getState().mediaServer.selectedSessionId = "server-1:s1";
    const service = {
      setActiveSession: vi.fn(),
      requestSessionsBurst: vi.fn()
    };
    const tabRegistry = new JellyfinembyTabContextRegistry();
    tabRegistry.update(7, {
      serverConfigId: "server-1",
      sessionId: "server-1:s1",
      itemId: "ITEM1"
    });
    const handler = new JellyfinembyMessageHandler(
      stateManager as never,
      service as never,
      tabRegistry,
      createUrlResolver(null) as never,
      () => true
    );

    const event = createEvent({
      ...createVideoContextMessage(),
      payload: {
        ...createVideoContextMessage().payload,
        pageUrl: "https://example.com/watch",
        videoSrc: "https://cdn.example.com/video.mp4"
      }
    });
    handler.handleConnectionMessage(event);

    expect(event.handled).toBe(false);
    expect(tabRegistry.get(7)).toBeNull();
    expect(stateManager.getState().activeSource).toBe("extension");
    expect(stateManager.getState().mediaServer.selectedSessionId).toBeNull();
    expect(service.setActiveSession).toHaveBeenCalledWith(null);
    expect(service.requestSessionsBurst).not.toHaveBeenCalled();
  });

  it("does not select a same-item session when the server is unknown", async () => {
    const stateManager = createStateManager();
    stateManager.getState().mediaServer.sessions = [
      session("server-b:s1", "server-b", "ITEM1")
    ];
    const service = {
      setActiveSession: vi.fn(),
      requestSessionsBurst: vi.fn()
    };
    const handler = new JellyfinembyMessageHandler(
      stateManager as never,
      service as never,
      new JellyfinembyTabContextRegistry(),
      createUrlResolver(null) as never,
      () => true
    );

    await handler.processMediaServerVideoContext(
      createVideoContextMessage(),
      "http://unknown.local/videos/ITEM1/stream.mp4"
    );

    expect(stateManager.getState().mediaServer.selectedSessionId).toBeNull();
    expect(service.setActiveSession).not.toHaveBeenCalled();
    expect(stateManager.getState().pendingMediaServerItemId).toBe("ITEM1");
  });

  it("does not select a same-item session through stale server context when the current server is unknown", async () => {
    const stateManager = createStateManager();
    stateManager.getState().mediaServer.sessions = [
      session("server-b:s1", "server-b", "ITEM1")
    ];
    const service = {
      setActiveSession: vi.fn(),
      requestSessionsBurst: vi.fn()
    };
    const tabRegistry = new JellyfinembyTabContextRegistry();
    tabRegistry.update(7, {
      serverConfigId: "server-b",
      sessionId: null,
      itemId: "ITEM1"
    });
    const handler = new JellyfinembyMessageHandler(
      stateManager as never,
      service as never,
      tabRegistry,
      createUrlResolver(null) as never,
      () => true
    );

    await handler.processMediaServerVideoContext(
      createVideoContextMessage(),
      "http://unknown.local/videos/ITEM1/stream.mp4"
    );

    expect(stateManager.getState().mediaServer.selectedSessionId).toBeNull();
    expect(service.setActiveSession).not.toHaveBeenCalled();
    expect(stateManager.getState().pendingMediaServerItemId).toBe("ITEM1");
  });
});
