import { describe, expect, it, vi } from "vitest";
import { ContentMessageRouter } from "./ContentMessageRouter";

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
    const router = new ContentMessageRouter({
      logger: logger as never,
      tabRegistry: {
        rememberActiveFrame: vi.fn()
      } as never,
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

    return { connectionPool, logger, router };
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
});
