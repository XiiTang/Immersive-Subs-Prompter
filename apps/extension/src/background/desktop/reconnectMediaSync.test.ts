import { describe, expect, it, vi } from "vitest";
import { sendCurrentMediaContext } from "./reconnectMediaSync";
import type { MediaStateRecord } from "../../shared/types";

function mediaState(overrides: Partial<MediaStateRecord>): MediaStateRecord {
  return {
    tabId: 1,
    pageUrl: "https://example.com/watch",
    site: "unknown",
    videoSrc: "https://cdn.example.com/video.mp4",
    videoWidth: 1920,
    videoHeight: 1080,
    pictureInPicture: false,
    title: "Example",
    playbackRate: 1,
    currentTime: 12,
    duration: 120,
    paused: false,
    muted: false,
    volume: 1,
    readyState: 4,
    updatedAt: 1000,
    loop: null,
    ...overrides
  };
}

describe("sendCurrentMediaContext", () => {
  it("sends one fresh video-context for the current best media state", () => {
    const pausedRecent = mediaState({ tabId: 1, paused: true, updatedAt: 3000 });
    const playingOlder = mediaState({ tabId: 2, paused: false, updatedAt: 2000 });
    const connection = { send: vi.fn() };

    sendCurrentMediaContext(connection, {
      list: () => [pausedRecent, playingOlder]
    }, 3000);

    expect(connection.send).toHaveBeenCalledTimes(1);
    expect(connection.send).toHaveBeenCalledWith({
      tabId: 2,
      type: "video-context",
      payload: expect.objectContaining({
        currentTime: 120,
        updatedAt: 3000,
        tabId: playingOlder.tabId
      })
    });
  });

  it("projects a cached playing media state before reconnect replay", () => {
    const connection = { send: vi.fn() };

    sendCurrentMediaContext(
      connection,
      {
        list: () => [
          mediaState({
            tabId: 2,
            currentTime: 12_000,
            updatedAt: 1000,
            playbackRate: 1.5,
            paused: false,
            duration: 20_000
          })
        ]
      },
      3000
    );

    expect(connection.send).toHaveBeenCalledWith({
      tabId: 2,
      type: "video-context",
      payload: expect.objectContaining({
        currentTime: 15_000,
        updatedAt: 3000,
        playbackRate: 1.5
      })
    });
  });

  it("does not advance a paused cached media state before reconnect replay", () => {
    const connection = { send: vi.fn() };

    sendCurrentMediaContext(
      connection,
      {
        list: () => [
          mediaState({
            tabId: 3,
            currentTime: 12_000,
            updatedAt: 1000,
            playbackRate: 2,
            paused: true,
            duration: 20_000
          })
        ]
      },
      5000
    );

    expect(connection.send).toHaveBeenCalledWith({
      tabId: 3,
      type: "video-context",
      payload: expect.objectContaining({
        currentTime: 12_000,
        updatedAt: 5000,
        playbackRate: 0
      })
    });
  });

  it("does not send when there is no current media state", () => {
    const connection = { send: vi.fn() };

    sendCurrentMediaContext(connection, { list: () => [] });

    expect(connection.send).not.toHaveBeenCalled();
  });
});
