import { describe, expect, it, vi } from "vitest";
import { ContentMessageRouter } from "./ContentMessageRouter";
import { SnapshotBuilder } from "./SnapshotBuilder";
import { MediaStateStore } from "../tabs/MediaStateStore";

describe("ContentMessageRouter", () => {
  function createRouter({
    hasMediaState = true
  }: {
    hasMediaState?: boolean;
  } = {}) {
    const logger = {
      info: vi.fn(),
      debug: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    };
    const connectionPool = {
      broadcast: vi.fn()
    };
    const tabRegistry = {
      rememberActiveFrame: vi.fn()
    };
    const router = new ContentMessageRouter({
      logger: logger as never,
      tabRegistry: tabRegistry as never,
      mediaStateStore: {
        has: vi.fn(() => hasMediaState),
        isValidMedia: vi.fn(() => false),
        get: vi.fn(() => ({
          currentTime: 999,
          duration: 4000
        }))
      } as never,
      connectionPool: connectionPool as never,
      snapshotBuilder: {
        buildMediaInfo: vi.fn(() => ({
          currentTime: 999,
          duration: 4000,
          updatedAgo: 0,
          progress: 0.2,
          isPlaying: true
        }))
      } as never
    });

    return { connectionPool, logger, router, tabRegistry };
  }

  it("broadcasts loop-started exactly once with the shared loop payload", () => {
    const { connectionPool, router } = createRouter();

    router.handleMessage(7, 0, {
      type: "loop-started",
      payload: {
        mode: "ab",
        startMs: 1000,
        endMs: 2000,
        startCueIndex: 1,
        endCueIndex: 2,
        anchorCueIndex: 1,
        origin: "ab-loop"
      }
    });

    expect(connectionPool.broadcast).toHaveBeenCalledTimes(1);
    expect(connectionPool.broadcast).toHaveBeenCalledWith({
      tabId: 7,
      type: "loop-started",
      payload: {
        mode: "ab",
        startMs: 1000,
        endMs: 2000,
        startCueIndex: 1,
        endCueIndex: 2,
        anchorCueIndex: 1,
        origin: "ab-loop"
      }
    });
  });

  it("ignores unknown content message types instead of forwarding them to desktop", () => {
    const { connectionPool, router } = createRouter();

    router.handleMessage(7, 0, {
      type: "keepalive",
      payload: {
        pageUrl: "https://example.com/watch?v=1",
        title: "Example",
        timestamp: 123
      }
    } as never);

    expect(connectionPool.broadcast).not.toHaveBeenCalled();
  });

  it("ignores subframe media messages instead of replacing tab-level state", () => {
    const { connectionPool, router, tabRegistry } = createRouter();

    router.handleMessage(7, 12, {
      type: "video-context",
      payload: {
        pageUrl: "https://embed.example.test/watch",
        site: "unknown",
        videoSrc: "https://cdn.example.test/video.mp4",
        videoWidth: 1920,
        videoHeight: 1080,
        pictureInPicture: false,
        playbackRate: 1,
        currentTime: 0,
        duration: 20_000,
        paused: false,
        muted: false,
        volume: 1,
        readyState: 4,
        title: "Embed",
        updatedAt: 1
      }
    });

    expect(tabRegistry.rememberActiveFrame).not.toHaveBeenCalled();
    expect(connectionPool.broadcast).not.toHaveBeenCalled();
  });

  it("broadcasts projected media info instead of stale stored playback time", () => {
    vi.useFakeTimers();
    vi.setSystemTime(5000);
    try {
      const logger = {
        info: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
      };
      const connectionPool = {
        broadcast: vi.fn(),
        describe: vi.fn(() => [])
      };
      const tabRegistry = {
        rememberActiveFrame: vi.fn()
      };
      const mediaStateStore = new MediaStateStore({ logger: logger as never });
      const snapshotBuilder = new SnapshotBuilder({
        mediaStateStore,
        connectionPool: connectionPool as never,
        getEndpoints: () => [],
        logger: logger as never
      });
      const router = new ContentMessageRouter({
        logger: logger as never,
        tabRegistry: tabRegistry as never,
        mediaStateStore,
        connectionPool: connectionPool as never,
        snapshotBuilder
      });

      router.handleMessage(7, 0, {
        type: "time-update",
        payload: {
          pageUrl: "https://example.com/watch",
          site: "unknown",
          videoSrc: "https://cdn.example.com/video.mp4",
          videoWidth: 1920,
          videoHeight: 1080,
          pictureInPicture: false,
          playbackRate: 1,
          currentTime: 1000,
          duration: 20_000,
          paused: false,
          muted: false,
          volume: 1,
          readyState: 4,
          title: "Example",
          updatedAt: 1000,
          loop: null
        }
      });

      expect(connectionPool.broadcast).toHaveBeenCalledWith({
        tabId: 7,
        type: "time-update",
        payload: expect.objectContaining({
          currentTime: 5000,
          updatedAt: 5000,
          progress: 0.25
        })
      });
    } finally {
      vi.useRealTimers();
    }
  });
});
