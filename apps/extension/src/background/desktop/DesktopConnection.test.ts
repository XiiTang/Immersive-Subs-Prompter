import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { VideoStateSnapshot } from "@immersive-subs/contracts";
import { DesktopConnection } from "./DesktopConnection";

const videoState: VideoStateSnapshot = {
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
  loop: null
};

type Listener = (event?: unknown) => void;

class FakeWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSED = 3;
  static instances: FakeWebSocket[] = [];

  readyState = FakeWebSocket.CONNECTING;
  sent: string[] = [];
  listeners = new Map<string, Listener[]>();

  constructor(readonly endpoint: string) {
    FakeWebSocket.instances.push(this);
  }

  addEventListener(type: string, listener: Listener) {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  send(data: string) {
    this.sent.push(data);
  }

  close() {
    this.readyState = FakeWebSocket.CLOSED;
    this.emit("close");
  }

  open() {
    this.readyState = FakeWebSocket.OPEN;
    this.emit("open");
  }

  emit(type: string, event?: unknown) {
    for (const listener of this.listeners.get(type) ?? []) {
      listener(event);
    }
  }
}

describe("DesktopConnection", () => {
  const originalWebSocket = globalThis.WebSocket;

  beforeEach(() => {
    FakeWebSocket.instances = [];
    vi.useFakeTimers();
    (globalThis as any).WebSocket = FakeWebSocket;
  });

  afterEach(() => {
    (globalThis as any).WebSocket = originalWebSocket;
  });

  it("drops offline sends instead of exposing queued messages", () => {
    const connection = new DesktopConnection("ws://127.0.0.1:44501");

    connection.send({
      tabId: 1,
      type: "time-update",
      payload: videoState
    });

    expect(FakeWebSocket.instances).toHaveLength(1);
    expect(FakeWebSocket.instances[0]!.sent).toEqual([]);
    expect(connection.getSnapshot()).not.toHaveProperty("pendingMessages");
  });

  it("notifies callers when the socket opens so they can sync current media", () => {
    const onConnected = vi.fn((connection: DesktopConnection) => {
      connection.send({
        tabId: 7,
        type: "video-context",
        payload: videoState
      });
    });
    new DesktopConnection("ws://127.0.0.1:44501", undefined, undefined, onConnected).connect();

    FakeWebSocket.instances[0]!.open();

    expect(onConnected).toHaveBeenCalledTimes(1);
    expect(FakeWebSocket.instances[0]!.sent).toHaveLength(1);
    expect(JSON.parse(FakeWebSocket.instances[0]!.sent[0]!)).toMatchObject({
      source: "usp-extension",
      tabId: 7,
      type: "video-context",
      payload: videoState
    });
  });
});
