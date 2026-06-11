import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";
import { AppEventBus } from "./appEventBus.js";
import { ConnectionManager } from "./connectionManager.js";
import type { AppSettings, DesktopState, NetworkSettings, SubtitleTrack } from "./types.js";

class FakeWebSocketServer extends EventEmitter {
  clients = new Set<any>();
  close = vi.fn(() => {
    this.emit("close");
  });
}

function createStateManager() {
  const state: Partial<DesktopState> = {
    connectionCount: 0,
    networkListeners: [],
    activeTabId: null,
    activeSource: "extension",
    videoUrl: null,
    subtitleTracks: [],
    status: "idle",
    playback: { currentTime: 0, duration: null, playbackRate: 1, lastUpdate: null, loop: null }
  };
  return {
    getState: () => state,
    state,
    setNetworkListenerStatuses: vi.fn((statuses) => {
      state.networkListeners = statuses;
    }),
    changeConnectionCount: vi.fn(),
    updateState: vi.fn((producer: (draft: Partial<DesktopState>) => void) => {
      producer(state);
    }),
    setPageContext: vi.fn(),
    updatePlayback: vi.fn(),
    selectProfileForUrl: vi.fn(() => ({ profile: null, rule: null })),
    applyProfileSelection: vi.fn(),
    resetSubtitleState: vi.fn(() => {
      state.subtitleTracks = [];
    }),
    setSubtitleTracks: vi.fn((tracks: SubtitleTrack[]) => {
      state.subtitleTracks = tracks;
    }),
    applyPreferredTracksFromSettings: vi.fn()
  };
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function makeSettings(network: NetworkSettings): AppSettings {
  return {
    global: {} as never,
    network,
    profiles: [],
    defaultProfileId: "",
    rules: [],
    plugins: {},
    cache: {} as never
  };
}

describe("ConnectionManager network listeners", () => {
  it("starts one WebSocket server per endpoint", () => {
    const network: NetworkSettings = {
      endpoints: [
        { id: "loopback", host: "127.0.0.1", port: 44501 },
        { id: "lan", host: "192.168.1.2", port: 44502 }
      ],
      authToken: "0123456789abcdef0123456789abcdef"
    };
    const stateManager = createStateManager();
    const created: Array<{ options: { host?: string; port?: number }; server: FakeWebSocketServer }> = [];

    const manager = new ConnectionManager({
      getNetworkSettings: () => network,
      getSettings: () => makeSettings(network),
      subtitleService: {} as never,
      stateManager: stateManager as never,
      bus: new AppEventBus(),
      createWebSocketServer: (options) => {
        const server = new FakeWebSocketServer();
        created.push({ options, server });
        return server as never;
      }
    });

    manager.start();

    expect(created.map((entry) => ({ host: entry.options.host, port: entry.options.port }))).toEqual([
      { host: "127.0.0.1", port: 44501 },
      { host: "192.168.1.2", port: 44502 }
    ]);
    expect(stateManager.setNetworkListenerStatuses).toHaveBeenLastCalledWith([
      { endpointId: "loopback", host: "127.0.0.1", port: 44501, status: "listening", error: null },
      { endpointId: "lan", host: "192.168.1.2", port: 44502, status: "listening", error: null }
    ]);
  });

  it("keeps other listeners running when one endpoint fails to bind", () => {
    const network: NetworkSettings = {
      endpoints: [
        { id: "loopback", host: "127.0.0.1", port: 44501 },
        { id: "lan", host: "192.168.1.2", port: 44502 }
      ],
      authToken: "0123456789abcdef0123456789abcdef"
    };
    const stateManager = createStateManager();

    const manager = new ConnectionManager({
      getNetworkSettings: () => network,
      getSettings: () => makeSettings(network),
      subtitleService: {} as never,
      stateManager: stateManager as never,
      bus: new AppEventBus(),
      createWebSocketServer: (options) => {
        if (options.host === "192.168.1.2") {
          throw new Error("listen EADDRNOTAVAIL");
        }
        return new FakeWebSocketServer() as never;
      }
    });

    manager.start();

    expect(stateManager.setNetworkListenerStatuses).toHaveBeenLastCalledWith([
      { endpointId: "loopback", host: "127.0.0.1", port: 44501, status: "listening", error: null },
      { endpointId: "lan", host: "192.168.1.2", port: 44502, status: "error", error: "listen EADDRNOTAVAIL" }
    ]);
  });

  it("closes only removed endpoint listeners on settings update", () => {
    let network: NetworkSettings = {
      endpoints: [
        { id: "loopback", host: "127.0.0.1", port: 44501 },
        { id: "lan", host: "192.168.1.2", port: 44502 }
      ],
      authToken: "0123456789abcdef0123456789abcdef"
    };
    const created = new Map<string, FakeWebSocketServer>();

    const manager = new ConnectionManager({
      getNetworkSettings: () => network,
      getSettings: () => makeSettings(network),
      subtitleService: {} as never,
      stateManager: createStateManager() as never,
      bus: new AppEventBus(),
      createWebSocketServer: (options) => {
        const server = new FakeWebSocketServer();
        created.set(`${options.host}:${options.port}`, server);
        return server as never;
      }
    });

    manager.start();
    network = {
      ...network,
      endpoints: [{ id: "loopback", host: "127.0.0.1", port: 44501 }]
    };
    manager.applyNetworkSettings();

    expect(created.get("192.168.1.2:44502")?.close).toHaveBeenCalledTimes(1);
    expect(created.get("127.0.0.1:44501")?.close).not.toHaveBeenCalled();
  });

  it("does not let a stale extension subtitle request overwrite media server state", async () => {
    const network: NetworkSettings = {
      endpoints: [{ id: "loopback", host: "127.0.0.1", port: 44501 }],
      authToken: "0123456789abcdef0123456789abcdef"
    };
    const subtitleDownload = createDeferred<{ tracks: SubtitleTrack[] }>();
    const stateManager = createStateManager();
    const manager = new ConnectionManager({
      getNetworkSettings: () => network,
      getSettings: () => makeSettings(network),
      subtitleService: {
        getSubtitles: vi.fn(() => subtitleDownload.promise)
      } as never,
      stateManager: stateManager as never,
      bus: new AppEventBus(),
      createWebSocketServer: () => new FakeWebSocketServer() as never
    });
    const handleMessage = (manager as unknown as {
      handleMessage(message: unknown, resolvedUrl: string | null): Promise<void>;
    }).handleMessage.bind(manager);

    const pending = handleMessage(
      {
        source: "usp-extension",
        type: "video-context",
        tabId: 1,
        payload: {
          pageUrl: "https://example.test/watch",
          videoSrc: "https://cdn.example.test/video.mp4",
          site: "example",
          title: "Example",
          currentTime: 0,
          paused: false
        }
      },
      "https://cdn.example.test/video.mp4"
    );

    stateManager.state.activeSource = "mediaserver";
    stateManager.state.videoUrl = "http://server.local:8096/Items/item-1";
    subtitleDownload.resolve({
      tracks: [{ id: "stale", sourceFile: "stale.srt", cues: [{ start: 0, end: 1000, text: "stale" }] }]
    });
    await pending;

    expect(stateManager.setSubtitleTracks).not.toHaveBeenCalled();
    expect(stateManager.state.status).toBe("loading-subtitles");
  });

  it("waits for async connection message handlers before falling back to extension subtitle loading", async () => {
    const network: NetworkSettings = {
      endpoints: [{ id: "loopback", host: "127.0.0.1", port: 44501 }],
      authToken: "0123456789abcdef0123456789abcdef"
    };
    const stateManager = createStateManager();
    const bus = new AppEventBus();
    const subtitleService = {
      getSubtitles: vi.fn(async () => ({ tracks: [] }))
    };
    const manager = new ConnectionManager({
      getNetworkSettings: () => network,
      getSettings: () => makeSettings(network),
      subtitleService: subtitleService as never,
      stateManager: stateManager as never,
      bus,
      createWebSocketServer: () => new FakeWebSocketServer() as never
    });
    bus.on("connection:message", (event) => {
      if (typeof (event as any).waitUntil === "function") {
        (event as any).waitUntil(Promise.resolve().then(() => event.markHandled()));
      }
    });
    const handleSocketMessage = (manager as unknown as {
      handleSocketMessage(socket: unknown, raw: Buffer): Promise<void>;
    }).handleSocketMessage.bind(manager);

    await handleSocketMessage(
      {},
      Buffer.from(JSON.stringify({
        source: "usp-extension",
        type: "video-context",
        tabId: 1,
        payload: {
          pageUrl: "https://example.test/watch",
          videoSrc: "https://cdn.example.test/video.mp4",
          site: "example",
          title: "Example",
          currentTime: 0,
          paused: false
        }
      }))
    );

    expect(subtitleService.getSubtitles).not.toHaveBeenCalled();
  });

  it("does not resolve extension media URLs that target local or private network hosts", () => {
    const network: NetworkSettings = {
      endpoints: [{ id: "loopback", host: "127.0.0.1", port: 44501 }],
      authToken: "0123456789abcdef0123456789abcdef"
    };
    const manager = new ConnectionManager({
      getNetworkSettings: () => network,
      getSettings: () => makeSettings(network),
      subtitleService: {} as never,
      stateManager: createStateManager() as never,
      bus: new AppEventBus(),
      createWebSocketServer: () => new FakeWebSocketServer() as never
    });
    const resolveVideoUrl = (manager as unknown as {
      resolveVideoUrl(payload: unknown): string | null;
    }).resolveVideoUrl.bind(manager);

    expect(resolveVideoUrl({
      pageUrl: "https://example.test/watch",
      videoSrc: "http://127.0.0.1:8080/video.mp4",
      site: "unknown"
    })).toBe("https://example.test/watch");
    expect(resolveVideoUrl({
      pageUrl: "http://192.168.1.2/watch",
      videoSrc: "http://169.254.169.254/latest/meta-data",
      site: "unknown"
    })).toBeNull();
  });
});
