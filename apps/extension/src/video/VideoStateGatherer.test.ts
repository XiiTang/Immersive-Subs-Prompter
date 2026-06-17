import { describe, expect, it, vi } from "vitest";
import { gatherVideoState } from "./VideoStateGatherer";

function withLocation(url: string, run: () => void) {
  const previousLocation = globalThis.location;
  vi.stubGlobal("location", new URL(url));
  try {
    run();
  } finally {
    vi.stubGlobal("location", previousLocation);
  }
}

function makeVideo() {
  const video = document.createElement("video");
  Object.defineProperties(video, {
    currentSrc: { configurable: true, value: "https://cdn.example.test/video.mp4" },
    videoWidth: { configurable: true, value: 1920 },
    videoHeight: { configurable: true, value: 1080 },
    playbackRate: { configurable: true, value: 1 },
    currentTime: { configurable: true, value: 1 },
    duration: { configurable: true, value: 10 },
    paused: { configurable: true, value: false },
    muted: { configurable: true, value: false },
    volume: { configurable: true, value: 1 },
    readyState: { configurable: true, value: 4 }
  });
  return video;
}

describe("VideoStateGatherer site detection", () => {
  it("classifies only exact supported domains and their subdomains", () => {
    const video = makeVideo();

    withLocation("https://www.youtube.com/watch?v=1", () => {
      expect(gatherVideoState(video).site).toBe("youtube");
    });
    withLocation("https://music.youtube.com/watch?v=1", () => {
      expect(gatherVideoState(video).site).toBe("youtube");
    });
    withLocation("https://notyoutube.com/watch?v=1", () => {
      expect(gatherVideoState(video).site).toBe("unknown");
    });
    withLocation("https://youtube.com.evil.example/watch?v=1", () => {
      expect(gatherVideoState(video).site).toBe("unknown");
    });
  });
});
