import { describe, expect, it, vi } from "vitest";
import { ContentMessageRouter } from "./ContentMessageRouter";

describe("ContentMessageRouter", () => {
  it("broadcasts loop-started exactly once with the shared loop payload", () => {
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
        has: vi.fn(() => true),
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
});
