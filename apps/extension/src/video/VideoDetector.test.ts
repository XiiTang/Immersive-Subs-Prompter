import { beforeEach, describe, expect, it, vi } from "vitest";
import { state } from "../content/state";
import * as sender from "../connection/MessageSender";
import { endActiveVideoSession, handleDocumentMediaEvent } from "./VideoDetector";
import { startLoop } from "./LoopController";

describe("VideoDetector", () => {
  beforeEach(() => {
    state.monitoringActive = true;
    state.hooked = new WeakSet();
    state.loop = {
      mode: null,
      startMs: null,
      endMs: null,
      startCueIndex: null,
      endCueIndex: null,
      anchorCueIndex: null,
      origin: null,
      isLooping: false,
      programmaticSeekReason: "none",
      boundaryTransition: "none",
      checkTimer: null
    };
    vi.spyOn(sender, "send").mockImplementation(() => {});
  });

  it("does not clear a newly started loop when the video emits the programmatic seeking event", () => {
    const video = document.createElement("video");
    Object.defineProperty(video, "currentTime", {
      configurable: true,
      writable: true,
      value: 8
    });
    Object.defineProperty(video, "paused", {
      configurable: true,
      get: () => false
    });
    video.play = vi.fn(() => Promise.resolve());

    state.activeVideo = video;

    startLoop(video, {
      mode: "ab",
      startMs: 1000,
      endMs: 4000,
      startCueIndex: 1,
      endCueIndex: 4,
      anchorCueIndex: 1,
      origin: "ab-loop"
    });

    handleDocumentMediaEvent({ type: "seeking", target: video });

    expect(state.loop.isLooping).toBe(true);
    expect(sender.send).not.toHaveBeenCalledWith("loop-cleared", {});
  });

  it("reports video-ended with the empty contract payload", () => {
    const video = document.createElement("video");
    state.activeVideo = video;

    endActiveVideoSession("playback-ended");

    expect(sender.send).toHaveBeenCalledWith("video-ended", {});
  });
});
