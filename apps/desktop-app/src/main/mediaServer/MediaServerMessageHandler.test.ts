import type { FromExtensionBroadcastMessage } from "@immersive-subs/contracts";
import { describe, expect, it, vi } from "vitest";
import type { ConnectionMessageEvent } from "../appEventBus.js";
import { MediaServerMessageHandler } from "./MediaServerMessageHandler.js";
import { TabContextRegistry } from "./TabContextRegistry.js";

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

function createStateManager() {
  const state = {
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

describe("MediaServerMessageHandler", () => {
  it("marks configured Jellyfin / Emby messages handled and ignores them while inactive", () => {
    const stateManager = createStateManager();
    const service = {
      setActiveSession: vi.fn(),
      requestSessionsBurst: vi.fn()
    };
    const handler = new MediaServerMessageHandler(
      stateManager as never,
      service as never,
      new TabContextRegistry(),
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
    const handler = new MediaServerMessageHandler(
      stateManager as never,
      service as never,
      new TabContextRegistry(),
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
});
