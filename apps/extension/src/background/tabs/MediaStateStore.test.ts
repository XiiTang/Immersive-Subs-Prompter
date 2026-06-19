import { describe, expect, it, vi } from "vitest";
import { MediaStateStore } from "./MediaStateStore";

describe("MediaStateStore", () => {
  it("rejects an initial invalid media payload instead of creating state", () => {
    const onChange = vi.fn();
    const store = new MediaStateStore({ onChange });

    const result = store.setState(7, {
      tabId: 7,
      readyState: 0,
      duration: 5000
    });

    expect(result).toBeNull();
    expect(store.has(7)).toBe(false);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("rejects playback samples without a source updatedAt instead of fabricating a local timestamp", () => {
    vi.useFakeTimers();
    vi.setSystemTime(5000);
    try {
      const onChange = vi.fn();
      const store = new MediaStateStore({ onChange });

      const result = store.setState(
        7,
        {
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
          title: "Episode",
          loop: null
        },
        "time-update"
      );

      expect(result).toBeNull();
      expect(store.has(7)).toBe(false);
      expect(onChange).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps existing state when a later incremental patch omits full media fields", () => {
    vi.useFakeTimers();
    vi.setSystemTime(2000);
    try {
      const store = new MediaStateStore();

      store.setState(
        9,
        {
          pageUrl: "https://example.com/watch",
          site: "unknown",
          videoSrc: "https://cdn.example.com/video.mp4",
          videoWidth: 1920,
          videoHeight: 1080,
          pictureInPicture: false,
          playbackRate: 1,
          currentTime: 1500,
          duration: 20_000,
          paused: false,
          muted: false,
          volume: 0.5,
          readyState: 4,
          title: "Episode 1",
          updatedAt: 1000
        },
        "video-context"
      );

      const result = store.setState(
        9,
        {
          pageUrl: "https://example.com/watch?t=3",
          title: "Episode 1 - details"
        },
        "page-url-changed"
      );

      expect(result).not.toBeNull();
      expect(result).toEqual(
        expect.objectContaining({
          tabId: 9,
          currentTime: 2500,
          updatedAt: 2000,
          duration: 20_000,
          readyState: 4,
          title: "Episode 1 - details",
          videoSrc: "https://cdn.example.com/video.mp4",
          pageUrl: "https://example.com/watch?t=3",
          lastEventType: "page-url-changed"
        })
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("stores media snapshots with a current background playback baseline", () => {
    vi.useFakeTimers();
    vi.setSystemTime(5000);
    try {
      const store = new MediaStateStore();

      const result = store.setState(
        4,
        {
          pageUrl: "https://example.com/watch",
          site: "unknown",
          videoSrc: "https://cdn.example.com/video.mp4",
          videoWidth: 1920,
          videoHeight: 1080,
          pictureInPicture: false,
          playbackRate: 1.5,
          currentTime: 1000,
          duration: 20_000,
          paused: false,
          muted: false,
          volume: 1,
          readyState: 4,
          title: "Episode",
          updatedAt: 3000,
          loop: null
        },
        "time-update"
      );

      expect(result).toEqual(
        expect.objectContaining({
          currentTime: 4000,
          playbackRate: 1.5,
          updatedAt: 5000
        })
      );
    } finally {
      vi.useRealTimers();
    }
  });
});
