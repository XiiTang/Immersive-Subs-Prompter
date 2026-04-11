import { beforeEach, describe, expect, it, vi } from "vitest";
import { state } from "../content/state.js";
import * as gatherer from "./VideoStateGatherer.js";
import * as sender from "../connection/MessageSender.js";
import { clearLoopState, startLoop } from "./LoopController.js";

describe("LoopController", () => {
  beforeEach(() => {
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
    state.monitoringActive = true;
    state.activeVideo = null;
    state.lastReportedPlayback = null;
    vi.spyOn(gatherer, "handleTimeUpdate");
    vi.spyOn(sender, "send").mockImplementation(() => {});
    vi.useFakeTimers();
  });

  it("records A-B loop session metadata when a range loop starts", () => {
    const video = { currentTime: 8, paused: false, play: vi.fn(() => Promise.resolve()) };

    startLoop(video, {
      mode: "ab",
      startMs: 1000,
      endMs: 4000,
      startCueIndex: 1,
      endCueIndex: 4,
      anchorCueIndex: 4,
      origin: "ab-loop"
    });

    expect(state.loop.mode).toBe("ab");
    expect(state.loop.startCueIndex).toBe(1);
    expect(state.loop.endCueIndex).toBe(4);
    expect(sender.send).toHaveBeenCalledWith("loop-started", expect.objectContaining({
      mode: "ab",
      startMs: 1000,
      endMs: 4000,
      startCueIndex: 1,
      endCueIndex: 4
    }));
  });

  it("marks boundaryTransition as loop-wrap before reporting a B-to-A jump", () => {
    const video = { currentTime: 4.2, paused: false, play: vi.fn(() => Promise.resolve()) };
    state.activeVideo = video;

    startLoop(video, {
      mode: "ab",
      startMs: 1000,
      endMs: 4000,
      startCueIndex: 1,
      endCueIndex: 4,
      anchorCueIndex: 4,
      origin: "ab-loop"
    });

    video.currentTime = 4.2;
    vi.advanceTimersByTime(100);

    expect(video.currentTime).toBe(1);
    expect(gatherer.handleTimeUpdate).toHaveBeenCalled();
    expect(sender.send).toHaveBeenCalledWith("time-update", expect.objectContaining({
      loop: expect.objectContaining({
        boundaryTransition: "loop-wrap",
        programmaticSeekReason: "loop-wrap"
      })
    }));
    expect(state.loop.boundaryTransition).toBe("none");
    expect(state.loop.programmaticSeekReason).toBe("loop-wrap");
  });

  it("clears loop metadata when clearLoopState runs", () => {
    state.loop = {
      mode: "ab",
      startMs: 1000,
      endMs: 4000,
      startCueIndex: 1,
      endCueIndex: 4,
      anchorCueIndex: 4,
      origin: "ab-loop",
      isLooping: true,
      programmaticSeekReason: "loop-wrap",
      boundaryTransition: "loop-wrap",
      checkTimer: null
    };

    clearLoopState();

    expect(state.loop.mode).toBe(null);
    expect(state.loop.startCueIndex).toBe(null);
    expect(state.loop.endCueIndex).toBe(null);
    expect(state.loop.boundaryTransition).toBe("none");
    expect(sender.send).toHaveBeenCalledWith("loop-cleared", {});
  });
});
