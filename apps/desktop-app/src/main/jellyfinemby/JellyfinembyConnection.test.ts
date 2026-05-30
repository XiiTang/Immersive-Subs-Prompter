import { afterEach, describe, expect, it, vi } from "vitest";
import { JellyfinembyConnection } from "./JellyfinembyConnection.js";
import { JellyfinembySessionManager } from "./JellyfinembySessionManager.js";
import { JellyfinembySubtitleLoader } from "./JellyfinembySubtitleLoader.js";
import type { ConnectionHooks } from "./types.js";
import type { JellyfinembyIdentity } from "../jellyfinembyUtils.js";
import type { MediaServerConfig, MediaServerSessionSummary } from "../types.js";

const config: MediaServerConfig = {
  id: "server-1",
  name: "Home",
  type: "jellyfinemby",
  serverUrl: "",
  apiKey: "",
  webSocketPath: "/socket",
  enabled: true
};

const identity: JellyfinembyIdentity = {
  clientName: "Immersive Subs",
  deviceName: "Test Device",
  deviceId: "device-1",
  version: "0.0.0-test"
};

const logger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn()
} as never;

const subtitleSrt = "1\n00:00:00,000 --> 00:00:01,000\nHello\n";

function createHooks(): ConnectionHooks {
  return {
    onStatus: vi.fn(),
    onSessions: vi.fn(),
    onPlayback: vi.fn(),
    onSubtitles: vi.fn(),
    onError: vi.fn()
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

function configuredServer(overrides: Partial<MediaServerConfig> = {}): MediaServerConfig {
  return {
    ...config,
    serverUrl: "http://server.local",
    apiKey: "api-key",
    ...overrides
  };
}

function subtitleStream(index = 2) {
  return {
    Index: index,
    Type: "Subtitle",
    DisplayTitle: "English",
    Language: "eng",
    IsExternal: true,
    Codec: "srt",
    IsTextSubtitleStream: true,
    IsDefault: false,
    IsForced: false
  };
}

function sessionRecord(
  itemId: string | null,
  itemName: string | null,
  isPaused: boolean,
  positionTicks: number,
  streams: unknown[] = []
) {
  return {
    Id: "session-1",
    DeviceName: "Player",
    Client: "Web",
    UserName: "User",
    ...(itemId
      ? {
          NowPlayingItem: {
            Id: itemId,
            Name: itemName ?? itemId,
            RunTimeTicks: 120_000_000,
            MediaSources: [
              {
                Id: "media-source-1",
                MediaStreams: streams
              }
            ]
          }
        }
      : {}),
    PlayState: {
      IsPaused: isPaused,
      PositionTicks: positionTicks,
      PlaybackRate: 1,
      MediaSourceId: "media-source-1"
    }
  };
}

function sessionSummary(overrides: Partial<MediaServerSessionSummary> = {}): MediaServerSessionSummary {
  return {
    id: "server-1:session-1",
    serverConfigId: "server-1",
    serverName: "Home",
    serverType: "jellyfinemby",
    deviceName: "Player",
    client: "Web",
    userName: "User",
    nowPlayingItemId: "item-1",
    nowPlayingItemName: "Movie",
    mediaSourceId: "media-source-1",
    runTimeTicks: 120_000_000,
    positionTicks: 10_000,
    isPaused: false,
    playbackRate: 1,
    subtitleStreams: [],
    ...overrides
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("JellyfinembyConnection", () => {
  it("emits playback for a paused newly reported active item", () => {
    const hooks = createHooks();
    const connection = new JellyfinembyConnection(config, identity, hooks);
    const processSessions = (connection as unknown as { processSessions(data: unknown): void }).processSessions.bind(
      connection
    );

    processSessions([sessionRecord("item-old", "Old Movie", false, 10_000)]);
    connection.setActiveSession("server-1:session-1");
    processSessions([sessionRecord("item-old", "Old Movie", false, 20_000)]);
    vi.mocked(hooks.onPlayback).mockClear();

    processSessions([sessionRecord("item-new", "New Movie", true, 10_000)]);

    expect(hooks.onPlayback).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: "server-1:session-1",
        itemName: "New Movie",
        isPaused: true
      })
    );
  });

  it("reloads subtitles when the same media reappears after a no-item session snapshot", async () => {
    const hooks = createHooks();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        text: async () => subtitleSrt
      }))
    );
    const connection = new JellyfinembyConnection(configuredServer(), identity, hooks);
    const processSessions = (connection as unknown as { processSessions(data: unknown): void }).processSessions.bind(
      connection
    );

    processSessions([sessionRecord("item-1", "Movie", false, 10_000, [subtitleStream()])]);
    connection.setActiveSession("server-1:session-1");
    await vi.waitFor(() => {
      expect(hooks.onSubtitles).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: "server-1:session-1",
          tracks: expect.arrayContaining([expect.objectContaining({ sourceFile: "English" })])
        })
      );
    });
    vi.mocked(hooks.onSubtitles).mockClear();

    processSessions([sessionRecord(null, null, true, 0)]);
    expect(hooks.onSubtitles).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: "server-1:session-1",
        tracks: []
      })
    );
    vi.mocked(hooks.onSubtitles).mockClear();

    processSessions([sessionRecord("item-1", "Movie", true, 10_000, [subtitleStream()])]);

    await vi.waitFor(() => {
      expect(hooks.onSubtitles).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: "server-1:session-1",
          tracks: expect.arrayContaining([expect.objectContaining({ sourceFile: "English" })])
        })
      );
    });
  });

  it("does not emit stale subtitles after the active session reports no item", async () => {
    const hooks = createHooks();
    const subtitleDownload = createDeferred<{ ok: boolean; text: () => Promise<string> }>();
    vi.stubGlobal("fetch", vi.fn(() => subtitleDownload.promise));
    const connection = new JellyfinembyConnection(configuredServer(), identity, hooks);
    const processSessions = (connection as unknown as { processSessions(data: unknown): void }).processSessions.bind(
      connection
    );

    processSessions([sessionRecord("item-1", "Movie", false, 10_000, [subtitleStream()])]);
    connection.setActiveSession("server-1:session-1");
    await vi.waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(1);
    });
    vi.mocked(hooks.onSubtitles).mockClear();

    processSessions([sessionRecord(null, null, true, 0)]);
    expect(hooks.onSubtitles).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: "server-1:session-1",
        tracks: []
      })
    );
    vi.mocked(hooks.onSubtitles).mockClear();

    subtitleDownload.resolve({
      ok: true,
      text: async () => subtitleSrt
    });
    await new Promise((resolve) => setImmediate(resolve));

    expect(hooks.onSubtitles).not.toHaveBeenCalled();
  });

  it("does not start duplicate subtitle fetches while unchanged media is already loading", async () => {
    const hooks = createHooks();
    const subtitleDownload = createDeferred<{ ok: boolean; text: () => Promise<string> }>();
    vi.stubGlobal("fetch", vi.fn(() => subtitleDownload.promise));
    const connection = new JellyfinembyConnection(configuredServer(), identity, hooks);
    const processSessions = (connection as unknown as { processSessions(data: unknown): void }).processSessions.bind(
      connection
    );

    processSessions([sessionRecord("item-1", "Movie", false, 10_000, [subtitleStream()])]);
    connection.setActiveSession("server-1:session-1");
    await vi.waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(1);
    });
    vi.mocked(hooks.onSubtitles).mockClear();

    processSessions([sessionRecord("item-1", "Movie", false, 20_000, [subtitleStream()])]);
    await new Promise((resolve) => setImmediate(resolve));

    expect(fetch).toHaveBeenCalledTimes(1);

    subtitleDownload.resolve({
      ok: true,
      text: async () => subtitleSrt
    });

    await vi.waitFor(() => {
      expect(hooks.onSubtitles).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: "server-1:session-1",
          tracks: expect.arrayContaining([expect.objectContaining({ sourceFile: "English" })])
        })
      );
    });
  });

  it("does not emit stale subtitles after a metadata refresh completes late", async () => {
    const hooks = createHooks();
    const metadataRefresh = createDeferred<{ ok: boolean; json: () => Promise<unknown> }>();
    let fetchCount = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(() => {
        fetchCount += 1;
        if (fetchCount !== 1) {
          throw new Error("stale metadata refresh should not request subtitle streams");
        }
        return metadataRefresh.promise;
      })
    );
    const connection = new JellyfinembyConnection(configuredServer(), identity, hooks);
    const processSessions = (connection as unknown as { processSessions(data: unknown): void }).processSessions.bind(
      connection
    );

    processSessions([sessionRecord("item-1", "Movie", false, 10_000)]);
    connection.setActiveSession("server-1:session-1");
    await vi.waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(1);
    });
    vi.mocked(hooks.onSubtitles).mockClear();

    processSessions([sessionRecord(null, null, true, 0)]);
    expect(hooks.onSubtitles).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: "server-1:session-1",
        tracks: []
      })
    );
    vi.mocked(hooks.onSubtitles).mockClear();

    metadataRefresh.resolve({
      ok: true,
      json: async () => ({
        Name: "Movie",
        MediaSources: [
          {
            Id: "media-source-1",
            MediaStreams: [subtitleStream()]
          }
        ]
      })
    });
    await new Promise((resolve) => setImmediate(resolve));

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(hooks.onSubtitles).not.toHaveBeenCalled();
  });

  it("does not refetch Jellyfinemby metadata for unchanged media after streams are resolved", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          Name: "Movie",
          MediaSources: [
            {
              Id: "media-source-1",
              MediaStreams: [subtitleStream()]
            }
          ]
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () => subtitleSrt
      });
    vi.stubGlobal("fetch", fetchMock);

    const serverConfig = configuredServer();
    const loader = new JellyfinembySubtitleLoader(
      serverConfig,
      identity,
      new JellyfinembySessionManager(serverConfig),
      logger
    );
    const summary = sessionSummary();

    const first = await loader.loadSubtitlesForSession(summary);
    const second = await loader.loadSubtitlesForSession(summary);

    expect(first?.tracks).toHaveLength(1);
    expect(second).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("retries unchanged media after a subtitle stream resolves with no cues", async () => {
    const metadataResponse = () => ({
      ok: true,
      json: async () => ({
        Name: "Movie",
        MediaSources: [
          {
            Id: "media-source-1",
            MediaStreams: [subtitleStream()]
          }
        ]
      })
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(metadataResponse())
      .mockResolvedValueOnce({
        ok: true,
        text: async () => ""
      })
      .mockResolvedValueOnce(metadataResponse())
      .mockResolvedValueOnce({
        ok: true,
        text: async () => subtitleSrt
      });
    vi.stubGlobal("fetch", fetchMock);

    const serverConfig = configuredServer();
    const loader = new JellyfinembySubtitleLoader(
      serverConfig,
      identity,
      new JellyfinembySessionManager(serverConfig),
      logger
    );
    const summary = sessionSummary();

    const first = await loader.loadSubtitlesForSession(summary);
    const second = await loader.loadSubtitlesForSession(summary);

    expect(first?.tracks).toEqual([]);
    expect(second?.tracks).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });
});
