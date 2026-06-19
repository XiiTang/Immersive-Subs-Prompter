import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";
import { createDefaultAppSettings } from "../common/defaultSettings.js";
import { AppEventBus } from "./appEventBus.js";
import { ConnectionManager } from "./connectionManager.js";
import { JellyfinEmbyMediaSource } from "./features/jellyfinEmbyMediaSource.js";
import { MediaSourceController } from "./mediaSources/mediaSourceController.js";
import { StateManager } from "./stateManager.js";
import type { AppSettings, DesktopState, MediaServerSessionSummary, NetworkSettings, SubtitleTrack } from "./types.js";

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
    pageUrl: null,
    title: null,
    site: null,
    subtitleTracks: [],
    status: "idle",
    playback: { currentTime: 0, duration: null, playbackRate: 1, lastUpdate: null, loop: null },
    mediaServer: {
      connected: false,
      sessions: [],
      selectedSessionId: null,
      lastUpdated: null
    }
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
    setPageContext: vi.fn((tabId: number, payload: Partial<DesktopState>) => {
      state.activeTabId = tabId;
      state.pageUrl = payload.pageUrl ?? null;
      state.site = payload.site ?? null;
      state.title = payload.title ?? null;
    }),
    updatePlayback: vi.fn(),
    selectProfileForUrl: vi.fn(() => ({ profile: null, rule: null })),
    applyProfileSelection: vi.fn(),
    resetSubtitleState: vi.fn(() => {
      state.subtitleTracks = [];
    }),
    setSubtitleTracks: vi.fn((tracks: SubtitleTrack[]) => {
      state.subtitleTracks = tracks;
    }),
    applyPreferredTracksFromSettings: vi.fn(),
    setMediaServerSessions: vi.fn((sessions: MediaServerSessionSummary[]) => {
      state.mediaServer = {
        connected: state.mediaServer?.connected ?? false,
        selectedSessionId: state.mediaServer?.selectedSessionId ?? null,
        sessions,
        lastUpdated: Date.now()
      };
    }),
    setStatus: vi.fn((status: string) => {
      state.status = status;
    })
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
  const base = createDefaultAppSettings({
    networkAuthToken: network.authToken
  });

  return {
    ...base,
    network,
    rules: []
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
          updatedAt: 1000,
          playbackRate: 1,
          duration: 10_000,
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
          updatedAt: 1000,
          playbackRate: 1,
          duration: 10_000,
          paused: false
        }
      }))
    );

    expect(subtitleService.getSubtitles).not.toHaveBeenCalled();
  });

  it("projects playback before media-source handlers observe handled media messages", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(10_000);
    try {
      const network: NetworkSettings = {
        endpoints: [{ id: "loopback", host: "127.0.0.1", port: 44501 }],
        authToken: "0123456789abcdef0123456789abcdef"
      };
      const stateManager = createStateManager();
      stateManager.updatePlayback.mockImplementation((playback) => {
        stateManager.state.playback = {
          ...stateManager.state.playback,
          ...playback
        };
      });
      const bus = new AppEventBus();
      let observedPlayback: DesktopState["playback"] | null = null;
      bus.on("connection:message", (event) => {
        observedPlayback = { ...stateManager.state.playback } as DesktopState["playback"];
        event.markHandled();
      });
      const manager = new ConnectionManager({
        getNetworkSettings: () => network,
        getSettings: () => makeSettings(network),
        subtitleService: {
          getSubtitles: vi.fn(async () => ({ tracks: [] }))
        } as never,
        stateManager: stateManager as never,
        bus,
        createWebSocketServer: () => new FakeWebSocketServer() as never
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
            pageUrl: "https://media.example.test/web/index.html#!/details?id=item-1",
            videoSrc: null,
            site: "jellyfin",
            title: "Episode",
            currentTime: 1000,
            updatedAt: 7000,
            playbackRate: 1.5,
            duration: 20_000,
            paused: false,
            loop: null
          }
        }))
      );

      expect(observedPlayback).toEqual({
        currentTime: 5500,
        duration: 20_000,
        playbackRate: 1.5,
        lastUpdate: 10_000,
        loop: null
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps a first Jellyfin / Emby match failure on the media-source path", async () => {
    const network: NetworkSettings = {
      endpoints: [{ id: "loopback", host: "127.0.0.1", port: 44501 }],
      authToken: "0123456789abcdef0123456789abcdef"
    };
    const settings = makeSettings(network);
    settings.features.jellyfinEmby = {
      enabled: true,
      config: {
        servers: [
          {
            id: "server-1",
            name: "Home",
            serverUrls: "https://media.example.test",
            apiKey: "api-key",
            enabled: true
          }
        ]
      }
    };
    const stateManager = createStateManager();
    const bus = new AppEventBus();
    const subtitleService = {
      getSubtitles: vi.fn(async () => ({ tracks: [] }))
    };
    const source = new JellyfinEmbyMediaSource({
      getSettings: () => settings.features.jellyfinEmby,
      fetch: vi.fn(async () => ({ ok: false, status: 503 })) as never
    });
    const controller = new MediaSourceController({
      bus,
      stateManager: stateManager as never,
      getSources: () => [source]
    });
    controller.start();
    const manager = new ConnectionManager({
      getNetworkSettings: () => network,
      getSettings: () => settings,
      subtitleService: subtitleService as never,
      stateManager: stateManager as never,
      bus,
      createWebSocketServer: () => new FakeWebSocketServer() as never
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
          pageUrl: "https://media.example.test/web/index.html#!/details?id=item-1",
          videoSrc: null,
          site: "jellyfin",
          title: "Episode",
          currentTime: 0,
          updatedAt: 1000,
          playbackRate: 1,
          duration: 10_000,
          paused: false
        }
      }))
    );

    expect(stateManager.state.activeSource).toBe("mediaserver");
    expect(stateManager.state.error).toBe("Jellyfin / Emby request failed: HTTP 503");
    expect(subtitleService.getSubtitles).not.toHaveBeenCalled();
  });

  it("projects Jellyfin / Emby playback from the extension payload while media-source handles subtitles", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(10_000);
    try {
      const network: NetworkSettings = {
        endpoints: [{ id: "loopback", host: "127.0.0.1", port: 44501 }],
        authToken: "0123456789abcdef0123456789abcdef"
      };
      const settings = makeSettings(network);
      settings.features.jellyfinEmby = {
        enabled: true,
        config: {
          servers: [
            {
              id: "server-1",
              name: "Home",
              serverUrls: "https://media.example.test",
              apiKey: "api-key",
              enabled: true
            }
          ]
        }
      };
      const stateManager = createStateManager();
      const bus = new AppEventBus();
      const subtitleService = {
        getSubtitles: vi.fn(async () => ({ tracks: [] }))
      };
      const source = new JellyfinEmbyMediaSource({
        getSettings: () => settings.features.jellyfinEmby,
        fetch: vi.fn(async (url: string) => {
          if (url.includes("/Sessions")) {
            return {
              ok: true,
              json: async () => [
                {
                  Id: "session-1",
                  DeviceName: "Chrome",
                  Client: "Jellyfin Web",
                  UserName: "cq",
                  NowPlayingItem: {
                    Id: "item-1",
                    Name: "Episode",
                    RunTimeTicks: 120_000_000,
                    MediaSources: [{ Id: "media-1", MediaStreams: [] }]
                  },
                  PlayState: {
                    MediaSourceId: "media-1",
                    PositionTicks: 90_000_000,
                    IsPaused: false,
                    PlaybackRate: 1
                  }
                }
              ]
            };
          }
          return { ok: true, text: async () => "" };
        }) as never
      });
      const controller = new MediaSourceController({
        bus,
        stateManager: stateManager as never,
        getSources: () => [source]
      });
      controller.start();
      const manager = new ConnectionManager({
        getNetworkSettings: () => network,
        getSettings: () => settings,
        subtitleService: subtitleService as never,
        stateManager: stateManager as never,
        bus,
        createWebSocketServer: () => new FakeWebSocketServer() as never
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
            pageUrl: "https://media.example.test/web/index.html#!/details?id=item-1",
            videoSrc: null,
            site: "jellyfin",
            title: "Episode",
            currentTime: 1000,
            updatedAt: 7000,
            playbackRate: 1.5,
            duration: 20_000,
            paused: false,
            loop: null
          }
        }))
      );

      expect(stateManager.state.activeSource).toBe("mediaserver");
      expect(subtitleService.getSubtitles).not.toHaveBeenCalled();
      expect(stateManager.updatePlayback).toHaveBeenCalledWith({
        currentTime: 5500,
        playbackRate: 1.5,
        duration: 20_000,
        lastUpdate: 10_000
      });
    } finally {
      vi.useRealTimers();
    }
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
      pageUrl: "https://youtube.com/watch?v=abc",
      videoSrc: "https://cdn.example.test/video.mp4",
      site: "youtube"
    })).toBe("https://youtube.com/watch?v=abc");
    expect(resolveVideoUrl({
      pageUrl: "https://music.youtube.com/watch?v=abc",
      videoSrc: "https://cdn.example.test/video.mp4",
      site: "youtube"
    })).toBe("https://music.youtube.com/watch?v=abc");
    expect(resolveVideoUrl({
      pageUrl: "https://notyoutube.com/watch?v=abc",
      videoSrc: "https://cdn.example.test/video.mp4",
      site: "youtube"
    })).toBeNull();
    expect(resolveVideoUrl({
      pageUrl: "https://youtube.com.evil.example/watch?v=abc",
      videoSrc: "https://cdn.example.test/video.mp4",
      site: "youtube"
    })).toBeNull();
    expect(resolveVideoUrl({
      pageUrl: "https://youtube.com/watch?v=abc",
      videoSrc: "https://cdn.example.test/video.mp4",
      site: "bilibili"
    })).toBeNull();
    expect(resolveVideoUrl({
      pageUrl: "https://example.test/watch",
      videoSrc: "https://cdn.example.test/video.mp4",
      site: "unknown"
    })).toBeNull();
    expect(resolveVideoUrl({
      pageUrl: "https://example.test/watch",
      videoSrc: "http://127.0.0.1:8080/video.mp4",
      site: "unknown"
    })).toBeNull();
    expect(resolveVideoUrl({
      pageUrl: "http://192.168.1.2/watch",
      videoSrc: "http://169.254.169.254/latest/meta-data",
      site: "unknown"
    })).toBeNull();
    expect(resolveVideoUrl({
      pageUrl: "http://127.0.0.1:8080/watch",
      videoSrc: "https://cdn.example.test/video.mp4",
      site: "youtube"
    })).toBeNull();
  });

  it("projects extension time-update payloads from updatedAt before applying playback", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(10_000);
    try {
      const network: NetworkSettings = {
        endpoints: [{ id: "loopback", host: "127.0.0.1", port: 44501 }],
        authToken: "0123456789abcdef0123456789abcdef"
      };
      const stateManager = createStateManager();
      stateManager.state.activeTabId = 1;
      const manager = new ConnectionManager({
        getNetworkSettings: () => network,
        getSettings: () => makeSettings(network),
        subtitleService: {} as never,
        stateManager: stateManager as never,
        bus: new AppEventBus(),
        createWebSocketServer: () => new FakeWebSocketServer() as never
      });
      const handleSocketMessage = (manager as unknown as {
        handleSocketMessage(socket: unknown, raw: Buffer): Promise<void>;
      }).handleSocketMessage.bind(manager);

      await handleSocketMessage(
        {},
        Buffer.from(JSON.stringify({
          source: "usp-extension",
          type: "time-update",
          tabId: 1,
          payload: {
            pageUrl: "https://example.test/watch",
            videoSrc: "https://cdn.example.test/video.mp4",
            site: "unknown",
            title: "Example",
            currentTime: 1000,
            updatedAt: 4000,
            playbackRate: 1.5,
            duration: 12_000,
            paused: false,
            loop: null
          }
        }))
      );

      expect(stateManager.updatePlayback).toHaveBeenCalledWith({
        currentTime: 10_000,
        playbackRate: 1.5,
        duration: 12_000,
        lastUpdate: 10_000
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not clear an existing desktop loop from ordinary playback samples", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(10_000);
    try {
      const network: NetworkSettings = {
        endpoints: [{ id: "loopback", host: "127.0.0.1", port: 44501 }],
        authToken: "0123456789abcdef0123456789abcdef"
      };
      const stateManager = createStateManager();
      stateManager.state.activeTabId = 1;
      stateManager.state.playback.loop = {
        status: "running",
        mode: "ab",
        startMs: 1000,
        endMs: 3000,
        startCueIndex: 0,
        endCueIndex: 1,
        anchorCueIndex: 0,
        origin: "ab-loop",
        boundaryTransition: "none",
        programmaticSeekReason: "none"
      };
      const manager = new ConnectionManager({
        getNetworkSettings: () => network,
        getSettings: () => makeSettings(network),
        subtitleService: {} as never,
        stateManager: stateManager as never,
        bus: new AppEventBus(),
        createWebSocketServer: () => new FakeWebSocketServer() as never
      });
      const handleSocketMessage = (manager as unknown as {
        handleSocketMessage(socket: unknown, raw: Buffer): Promise<void>;
      }).handleSocketMessage.bind(manager);

      await handleSocketMessage(
        {},
        Buffer.from(JSON.stringify({
          source: "usp-extension",
          type: "time-update",
          tabId: 1,
          payload: {
            pageUrl: "https://example.test/watch",
            videoSrc: "https://cdn.example.test/video.mp4",
            site: "unknown",
            title: "Example",
            currentTime: 1000,
            updatedAt: 9000,
            playbackRate: 1,
            duration: 12_000,
            paused: false,
            loop: null
          }
        }))
      );

      const playbackUpdate = vi.mocked(stateManager.updatePlayback).mock.calls[0]![0];
      expect(playbackUpdate).toEqual({
        currentTime: 2000,
        playbackRate: 1,
        duration: 12_000,
        lastUpdate: 10_000
      });
      expect(Object.prototype.hasOwnProperty.call(playbackUpdate, "loop")).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it("applies paused extension playback when the browser reports zero effective rate", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(10_000);
    try {
      const network: NetworkSettings = {
        endpoints: [{ id: "loopback", host: "127.0.0.1", port: 44501 }],
        authToken: "0123456789abcdef0123456789abcdef"
      };
      const stateManager = createStateManager();
      stateManager.state.activeTabId = 1;
      const manager = new ConnectionManager({
        getNetworkSettings: () => network,
        getSettings: () => makeSettings(network),
        subtitleService: {} as never,
        stateManager: stateManager as never,
        bus: new AppEventBus(),
        createWebSocketServer: () => new FakeWebSocketServer() as never
      });
      const handleSocketMessage = (manager as unknown as {
        handleSocketMessage(socket: unknown, raw: Buffer): Promise<void>;
      }).handleSocketMessage.bind(manager);

      await handleSocketMessage(
        {},
        Buffer.from(JSON.stringify({
          source: "usp-extension",
          type: "time-update",
          tabId: 1,
          payload: {
            pageUrl: "https://example.test/watch",
            videoSrc: "https://cdn.example.test/video.mp4",
            site: "unknown",
            title: "Example",
            currentTime: 1000,
            updatedAt: 9000,
            playbackRate: 0,
            duration: 12_000,
            paused: true,
            loop: null
          }
        }))
      );

      expect(stateManager.updatePlayback).toHaveBeenCalledWith({
        currentTime: 1000,
        playbackRate: 0,
        duration: 12_000,
        lastUpdate: 10_000
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps an immediate media-source playback update from the new video tab", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(10_000);
    try {
      const network: NetworkSettings = {
        endpoints: [{ id: "loopback", host: "127.0.0.1", port: 44501 }],
        authToken: "0123456789abcdef0123456789abcdef"
      };
      const stateManager = createStateManager();
      stateManager.state.activeTabId = 99;
      const mediaSourceGate = createDeferred<void>();
      const bus = new AppEventBus();
      bus.on("connection:message", (event) => {
        if (event.message.type === "video-context") {
          event.waitUntil(mediaSourceGate.promise.then(() => event.markHandled()));
        }
      });
      const manager = new ConnectionManager({
        getNetworkSettings: () => network,
        getSettings: () => makeSettings(network),
        subtitleService: {
          getSubtitles: vi.fn(async () => ({ tracks: [] }))
        } as never,
        stateManager: stateManager as never,
        bus,
        createWebSocketServer: () => new FakeWebSocketServer() as never
      });
      const handleSocketMessage = (manager as unknown as {
        handleSocketMessage(socket: unknown, raw: Buffer): Promise<void>;
      }).handleSocketMessage.bind(manager);

      const pendingVideoContext = handleSocketMessage(
        {},
        Buffer.from(JSON.stringify({
          source: "usp-extension",
          type: "video-context",
          tabId: 7,
          payload: {
            pageUrl: "https://media.example.test/web/index.html#!/details?id=item-1",
            videoSrc: null,
            site: "jellyfin",
            title: "Episode",
            currentTime: 1000,
            updatedAt: 9000,
            playbackRate: 2,
            duration: 20_000,
            paused: false,
            loop: null
          }
        }))
      );

      await handleSocketMessage(
        {},
        Buffer.from(JSON.stringify({
          source: "usp-extension",
          type: "time-update",
          tabId: 7,
          payload: {
            pageUrl: "https://media.example.test/web/index.html#!/details?id=item-1",
            videoSrc: null,
            site: "jellyfin",
            title: "Episode",
            currentTime: 2000,
            updatedAt: 9000,
            playbackRate: 0.75,
            duration: 20_000,
            paused: false,
            loop: null
          }
        }))
      );

      expect(stateManager.updatePlayback).toHaveBeenLastCalledWith({
        currentTime: 2750,
        playbackRate: 0.75,
        duration: 20_000,
        lastUpdate: 10_000
      });

      mediaSourceGate.resolve();
      await pendingVideoContext;
    } finally {
      vi.useRealTimers();
    }
  });

  it("uses the extension duration sample instead of retaining an older desktop duration", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(10_000);
    try {
      const network: NetworkSettings = {
        endpoints: [{ id: "loopback", host: "127.0.0.1", port: 44501 }],
        authToken: "0123456789abcdef0123456789abcdef"
      };
      const stateManager = createStateManager();
      stateManager.state.activeTabId = 1;
      stateManager.state.playback.duration = 20_000;
      const manager = new ConnectionManager({
        getNetworkSettings: () => network,
        getSettings: () => makeSettings(network),
        subtitleService: {} as never,
        stateManager: stateManager as never,
        bus: new AppEventBus(),
        createWebSocketServer: () => new FakeWebSocketServer() as never
      });
      const handleSocketMessage = (manager as unknown as {
        handleSocketMessage(socket: unknown, raw: Buffer): Promise<void>;
      }).handleSocketMessage.bind(manager);

      await handleSocketMessage(
        {},
        Buffer.from(JSON.stringify({
          source: "usp-extension",
          type: "time-update",
          tabId: 1,
          payload: {
            pageUrl: "https://example.test/watch",
            videoSrc: "https://cdn.example.test/video.mp4",
            site: "unknown",
            title: "Example",
            currentTime: 1000,
            updatedAt: 9000,
            playbackRate: 1,
            duration: null,
            paused: false,
            loop: null
          }
        }))
      );

      expect(stateManager.updatePlayback).toHaveBeenCalledWith({
        currentTime: 2000,
        playbackRate: 1,
        duration: null,
        lastUpdate: 10_000
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("projects extension video-context playback before subtitle loading", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(8000);
    try {
      const network: NetworkSettings = {
        endpoints: [{ id: "loopback", host: "127.0.0.1", port: 44501 }],
        authToken: "0123456789abcdef0123456789abcdef"
      };
      const stateManager = createStateManager();
      const manager = new ConnectionManager({
        getNetworkSettings: () => network,
        getSettings: () => makeSettings(network),
        subtitleService: {
          getSubtitles: vi.fn(async () => ({ tracks: [] }))
        } as never,
        stateManager: stateManager as never,
        bus: new AppEventBus(),
        createWebSocketServer: () => new FakeWebSocketServer() as never
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
            pageUrl: "https://youtube.com/watch?v=abc",
            videoSrc: "https://cdn.example.test/video.mp4",
            site: "youtube",
            title: "Example",
            currentTime: 2000,
            updatedAt: 5000,
            playbackRate: 2,
            duration: 10_000,
            paused: false,
            loop: null
          }
        }))
      );

      expect(stateManager.updatePlayback).toHaveBeenCalledWith({
        currentTime: 8000,
        playbackRate: 2,
        duration: 10_000,
        lastUpdate: 8000
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps projected extension video-context playback after subtitle state resets", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(8000);
    try {
      const network: NetworkSettings = {
        endpoints: [{ id: "loopback", host: "127.0.0.1", port: 44501 }],
        authToken: "0123456789abcdef0123456789abcdef"
      };
      const settings = makeSettings(network);
      const bus = new AppEventBus();
      const stateManager = new StateManager(bus, () => settings);
      const manager = new ConnectionManager({
        getNetworkSettings: () => network,
        getSettings: () => settings,
        subtitleService: {
          getSubtitles: vi.fn(async () => ({ tracks: [] }))
        } as never,
        stateManager,
        bus,
        createWebSocketServer: () => new FakeWebSocketServer() as never
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
            pageUrl: "https://youtube.com/watch?v=abc",
            videoSrc: "https://cdn.example.test/video.mp4",
            site: "youtube",
            title: "Example",
            currentTime: 2000,
            updatedAt: 5000,
            playbackRate: 2,
            duration: 10_000,
            paused: false,
            loop: null
          }
        }))
      );

      expect(stateManager.getState().playback).toEqual({
        currentTime: 8000,
        playbackRate: 2,
        duration: 10_000,
        loop: null,
        lastUpdate: 8000
      });
    } finally {
      vi.useRealTimers();
    }
  });
});
