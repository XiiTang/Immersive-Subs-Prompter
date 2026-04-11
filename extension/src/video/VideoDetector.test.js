import { beforeEach, describe, expect, it, vi } from "vitest";
import { state } from "../content/state.js";
import * as sender from "../connection/MessageSender.js";
import { handleDocumentMediaEvent } from "./VideoDetector.js";
import { startLoop } from "./LoopController.js";

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
});
