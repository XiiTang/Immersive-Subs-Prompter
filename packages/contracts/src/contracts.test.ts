import { describe, expect, expectTypeOf, it } from "vitest";
import type {
  ControlLoopCommandMessage,
  ControlSeekCommandMessage,
  FromExtensionMessage,
  LoopSnapshot,
  PlaybackSnapshot,
  ToExtensionMessage,
  VideoStateSnapshot
} from "./index";

describe("@immersive-subs/contracts", () => {
  it("requires action-specific payloads for control commands", () => {
    expectTypeOf<ControlSeekCommandMessage["payload"]>().toEqualTypeOf<{ time: number }>();
    expectTypeOf<ControlLoopCommandMessage["payload"]>().toEqualTypeOf<{
      mode: "single" | "ab";
      startMs: number;
      endMs: number;
      startCueIndex: number | null;
      endCueIndex: number | null;
      anchorCueIndex: number | null;
      origin: "single-loop" | "ab-loop";
    }>();
    expectTypeOf<Extract<ToExtensionMessage, { type: "heartbeat" }>>().not.toHaveProperty("payload");
  });

  it("exports representative extension-to-desktop protocol shapes", () => {
    const loop: LoopSnapshot = {
      mode: "ab",
      startMs: 1000,
      endMs: 2500,
      startCueIndex: 1,
      endCueIndex: 4,
      anchorCueIndex: 1,
      origin: "ab-loop",
      status: "running",
      boundaryTransition: "none",
      programmaticSeekReason: "manual-control"
    };

    const playback: PlaybackSnapshot = {
      playbackRate: 1,
      currentTime: 1250,
      duration: 60000,
      paused: false,
      muted: false,
      volume: 0.8,
      readyState: 4,
      updatedAt: 123456789,
      loop
    };

    const snapshot: VideoStateSnapshot = {
      pageUrl: "https://example.com/watch?v=1",
      site: "youtube",
      videoSrc: "https://cdn.example.com/video.mp4",
      videoWidth: 1920,
      videoHeight: 1080,
      pictureInPicture: false,
      title: "Example",
      ...playback
    };

    const message: FromExtensionMessage = {
      source: "usp-extension",
      tabId: 3,
      type: "time-update",
      payload: snapshot,
      sentAt: 123456789
    };

    expect(message.payload.loop).toEqual(loop);
    expect(message.type).toBe("time-update");
  });

  it("exports representative desktop-to-extension protocol shapes", () => {
    const command: ControlLoopCommandMessage = {
      source: "usp-desktop",
      type: "control-command",
      tabId: 7,
      action: "loop",
      payload: {
        mode: "single",
        startMs: 5000,
        endMs: 7000,
        startCueIndex: 10,
        endCueIndex: 10,
        anchorCueIndex: 10,
        origin: "single-loop"
      }
    };

    expect(command.action).toBe("loop");
    expect(command.payload?.origin).toBe("single-loop");
  });
});
