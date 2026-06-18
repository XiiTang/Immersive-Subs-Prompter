import { describe, expect, expectTypeOf, it } from "vitest";
import type {
  ControlLoopCommandMessage,
  ControlSeekCommandMessage,
  FromExtensionMessage,
  LoopSession,
  LoopSnapshot,
  LoopStartedMessage,
  PlaybackSnapshot,
  ToExtensionMessage,
  VideoStateSnapshot
} from "./index.js";
import { projectPlaybackSnapshot } from "./index.js";

describe("@immersive-subs/contracts", () => {
  it("requires action-specific payloads for control commands", () => {
    expectTypeOf<ControlSeekCommandMessage["payload"]>().toEqualTypeOf<{ time: number }>();
    expectTypeOf<ControlLoopCommandMessage["payload"]>().toEqualTypeOf<LoopSession>();
    expectTypeOf<Extract<ToExtensionMessage, { type: "heartbeat" }>>().not.toHaveProperty("payload");
  });

  it("constrains loop-started payload to the LoopSession shape", () => {
    expectTypeOf<LoopStartedMessage["payload"]>().toEqualTypeOf<LoopSession>();
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

  it("projects a playing playback snapshot from its sample timestamp", () => {
    const projected = projectPlaybackSnapshot(
      {
        currentTime: 12_000,
        updatedAt: 1000,
        playbackRate: 1.25,
        paused: false,
        duration: 20_000
      },
      3000
    );

    expect(projected).toEqual({
      currentTime: 14_500,
      updatedAt: 3000,
      playbackRate: 1.25
    });
  });

  it("keeps paused playback snapshots fixed while moving the timestamp baseline", () => {
    const projected = projectPlaybackSnapshot(
      {
        currentTime: 12_000,
        updatedAt: 1000,
        playbackRate: 2,
        paused: true,
        duration: 20_000
      },
      4000
    );

    expect(projected).toEqual({
      currentTime: 12_000,
      updatedAt: 4000,
      playbackRate: 0
    });
  });

  it("clamps negative elapsed time and projected time beyond duration", () => {
    expect(
      projectPlaybackSnapshot(
        {
          currentTime: 9000,
          updatedAt: 5000,
          playbackRate: 1,
          paused: false,
          duration: 10_000
        },
        3000
      )
    ).toEqual({
      currentTime: 9000,
      updatedAt: 3000,
      playbackRate: 1
    });

    expect(
      projectPlaybackSnapshot(
        {
          currentTime: 9000,
          updatedAt: 1000,
          playbackRate: 2,
          paused: false,
          duration: 10_000
        },
        3000
      )
    ).toEqual({
      currentTime: 10_000,
      updatedAt: 3000,
      playbackRate: 2
    });
  });

  it("normalizes invalid playback projection input to current contract defaults", () => {
    expect(
      projectPlaybackSnapshot(
        {
          currentTime: Number.NaN,
          updatedAt: "bad",
          playbackRate: "bad",
          paused: false,
          duration: null
        },
        7000
      )
    ).toEqual({
      currentTime: 0,
      updatedAt: 7000,
      playbackRate: 1
    });
  });
});
