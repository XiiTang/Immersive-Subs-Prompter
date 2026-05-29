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
    });

    expect(connection.send).toHaveBeenCalledTimes(1);
    expect(connection.send).toHaveBeenCalledWith({
      tabId: 2,
      type: "video-context",
      payload: playingOlder
    });
  });

  it("does not send when there is no current media state", () => {
    const connection = { send: vi.fn() };

    sendCurrentMediaContext(connection, { list: () => [] });

    expect(connection.send).not.toHaveBeenCalled();
  });
});
