import { describe, expect, it, vi } from "vitest";
import { JellyfinEmbyMediaSource } from "./jellyfinEmbyMediaSource.js";

function createSettings(overrides = {}) {
  return {
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
    },
    ...overrides
  };
}

describe("JellyfinEmbyMediaSource", () => {
  it("does not claim messages while disabled", async () => {
    const source = new JellyfinEmbyMediaSource({
      getSettings: () => createSettings({ enabled: false }),
      fetch: vi.fn() as never
    });

    await expect(
      source.handleConnectionMessage({
        type: "video-context",
        tabId: 1,
        payload: {
          pageUrl: "https://media.example.test/web/index.html#!/details?id=item-1",
          videoSrc: null,
          title: "Movie",
          site: "Jellyfin"
        }
      })
    ).resolves.toBeUndefined();
  });

  it("matches configured server URLs and emits source state", async () => {
    const source = new JellyfinEmbyMediaSource({
      getSettings: () => createSettings(),
      fetch: vi.fn().mockResolvedValue({ ok: true, json: async () => [] }) as never
    });

    const result = await source.handleConnectionMessage({
      type: "video-context",
      tabId: 1,
      payload: {
        pageUrl: "https://media.example.test/web/index.html#!/details?id=item-1",
        videoSrc: "blob:https://media.example.test/video",
        title: "Movie",
        site: "Jellyfin"
      }
    });

    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "sourceMatched",
          tabId: 1,
          pageUrl: expect.stringContaining("media.example.test"),
          site: "jellyfinemby"
        })
      ])
    );
  });

  it("does not use disabled server rows at runtime", async () => {
    const fetch = vi.fn();
    const source = new JellyfinEmbyMediaSource({
      getSettings: () => createSettings({
        config: {
          servers: [
            {
              id: "server-1",
              name: "Disabled",
              serverUrls: "https://media.example.test",
              apiKey: "api-key",
              enabled: false
            }
          ]
        }
      }),
      fetch: fetch as never
    });

    await expect(
      source.handleConnectionMessage({
        type: "video-context",
        tabId: 1,
        payload: {
          pageUrl: "https://media.example.test/web/index.html#!/details?id=item-1",
          videoSrc: null,
          title: "Movie",
          site: "Jellyfin"
        }
      })
    ).resolves.toBeUndefined();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rejects enabled server rows missing required runtime fields", async () => {
    const source = new JellyfinEmbyMediaSource({
      getSettings: () => createSettings({
        config: {
          servers: [
            {
              id: "server-1",
              name: "No token",
              serverUrls: "https://media.example.test",
              apiKey: "",
              enabled: true
            }
          ]
        }
      }),
      fetch: vi.fn() as never
    });

    await expect(
      source.handleConnectionMessage({
        type: "video-context",
        tabId: 1,
        payload: {
          pageUrl: "https://media.example.test/web/index.html#!/details?id=item-1",
          videoSrc: null,
          title: "Movie",
          site: "Jellyfin"
        }
      })
    ).rejects.toThrow("Jellyfin / Emby server 1 must include apiKey.");
  });

  it("rejects enabled server rows without any parsed runtime URL", async () => {
    const source = new JellyfinEmbyMediaSource({
      getSettings: () => createSettings({
        config: {
          servers: [
            {
              id: "server-1",
              name: "No URL",
              serverUrls: ", ,",
              apiKey: "api-key",
              enabled: true
            }
          ]
        }
      }),
      fetch: vi.fn() as never
    });

    await expect(
      source.handleConnectionMessage({
        type: "video-context",
        tabId: 1,
        payload: {
          pageUrl: "https://media.example.test/web/index.html#!/details?id=item-1",
          videoSrc: null,
          title: "Movie",
          site: "Jellyfin"
        }
      })
    ).rejects.toThrow("Jellyfin / Emby server 1 must include serverUrls.");
  });

  it("matches any configured Jellyfin / Emby URL and fetches from the matched configured endpoint", async () => {
    const fetch = vi.fn(async (url: string) => {
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
                RunTimeTicks: 10_000_000,
                MediaSources: [{ Id: "media-1", MediaStreams: [{ Type: "Subtitle", Index: 2, Codec: "srt" }] }]
              },
              PlayState: { MediaSourceId: "media-1", PositionTicks: 1_000_000, IsPaused: false, PlaybackRate: 1 }
            }
          ]
        };
      }
      return {
        ok: true,
        text: async () => "1\n00:00:00,000 --> 00:00:01,000\nhello\n"
      };
    });
    const source = new JellyfinEmbyMediaSource({
      getSettings: () => createSettings({
        config: {
          servers: [
            {
              id: "server-1",
              name: "Home",
              serverUrls: "http://localhost:8096, http://127.0.0.1:8096, http://192.168.1.45:8096",
              apiKey: "api-key",
              enabled: true
            }
          ]
        }
      }),
      fetch: fetch as never
    });

    await source.handleConnectionMessage({
      type: "video-context",
      tabId: 1,
      payload: {
        pageUrl: "http://127.0.0.1:8096/web/index.html#!/details?id=item-1",
        videoSrc: "blob:http://127.0.0.1:8096/video",
        title: "Episode",
        site: "Jellyfin"
      }
    });

    expect(fetch).toHaveBeenCalledWith(expect.stringContaining("http://127.0.0.1:8096/Sessions"), expect.any(Object));
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("http://127.0.0.1:8096/Videos/item-1/media-1/Subtitles/2/Stream.srt"),
      expect.any(Object)
    );
  });

  it("does not claim unconfigured private network Jellyfin / Emby URLs", async () => {
    const fetch = vi.fn();
    const source = new JellyfinEmbyMediaSource({
      getSettings: () => createSettings({
        config: {
          servers: [
            {
              id: "server-1",
              name: "Home",
              serverUrls: "http://localhost:8096",
              apiKey: "api-key",
              enabled: true
            }
          ]
        }
      }),
      fetch: fetch as never
    });

    await expect(
      source.handleConnectionMessage({
        type: "video-context",
        tabId: 1,
        payload: {
          pageUrl: "http://192.168.1.45:8096/web/index.html#!/details?id=item-1",
          videoSrc: null,
          title: "Episode",
          site: "Jellyfin"
        }
      })
    ).resolves.toBeUndefined();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("fetches sessions from enabled configured servers", async () => {
    const fetch = vi.fn(async (url: string) => {
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
                RunTimeTicks: 10_000_000,
                MediaSources: [{ Id: "media-1", MediaStreams: [{ Type: "Subtitle", Index: 2, Codec: "srt" }] }]
              },
              PlayState: { MediaSourceId: "media-1", PositionTicks: 1_000_000, IsPaused: false, PlaybackRate: 1 }
            }
          ]
        };
      }
      return {
        ok: true,
        text: async () => "1\n00:00:00,000 --> 00:00:01,000\nhello\n"
      };
    });
    const source = new JellyfinEmbyMediaSource({ getSettings: () => createSettings(), fetch: fetch as never });

    const result = await source.handleConnectionMessage({
      type: "video-context",
      tabId: 1,
      payload: {
        pageUrl: "https://media.example.test/web/index.html#!/details?id=item-1",
        videoSrc: null,
        title: "Episode",
        site: "Jellyfin"
      }
    });

    expect(fetch).toHaveBeenCalledWith(expect.stringContaining("/Sessions"), expect.any(Object));
    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "sessionsChanged",
          sessions: [expect.objectContaining({ id: "server-1:session-1", serverType: "jellyfinemby" })]
        })
      ])
    );
  });

  it("selects the matching session from Jellyfin hash item routes", async () => {
    const fetch = vi.fn(async (url: string) => {
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
                Name: "Wrong Episode",
                RunTimeTicks: 10_000_000,
                MediaSources: [{ Id: "media-1", MediaStreams: [{ Type: "Subtitle", Index: 1, Codec: "srt" }] }]
              },
              PlayState: { MediaSourceId: "media-1", PositionTicks: 1_000_000, IsPaused: false, PlaybackRate: 1 }
            },
            {
              Id: "session-2",
              DeviceName: "Chrome",
              Client: "Jellyfin Web",
              UserName: "cq",
              NowPlayingItem: {
                Id: "item-2",
                Name: "Target Episode",
                RunTimeTicks: 20_000_000,
                MediaSources: [{ Id: "media-2", MediaStreams: [{ Type: "Subtitle", Index: 2, Codec: "srt" }] }]
              },
              PlayState: { MediaSourceId: "media-2", PositionTicks: 2_000_000, IsPaused: false, PlaybackRate: 1 }
            }
          ]
        };
      }
      return {
        ok: true,
        text: async () => "1\n00:00:00,000 --> 00:00:01,000\ntarget\n"
      };
    });
    const source = new JellyfinEmbyMediaSource({ getSettings: () => createSettings(), fetch: fetch as never });

    const result = await source.handleConnectionMessage({
      type: "video-context",
      tabId: 1,
      payload: {
        pageUrl: "https://media.example.test/web/index.html#!/details?id=item-2",
        videoSrc: null,
        title: "Target Episode",
        site: "Jellyfin"
      }
    });

    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "sourceMatched",
          selectedSessionId: "server-1:session-2"
        }),
        expect.objectContaining({
          type: "subtitleTracksLoaded",
          sessionId: "server-1:session-2",
          tracks: [expect.objectContaining({ id: "server-1:session-2:2" })]
        })
      ])
    );
  });

  it("returns matched source state with the subtitle request error", async () => {
    const fetch = vi.fn(async (url: string) => {
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
                RunTimeTicks: 10_000_000,
                MediaSources: [{ Id: "media-1", MediaStreams: [{ Type: "Subtitle", Index: 2, Codec: "srt" }] }]
              },
              PlayState: { MediaSourceId: "media-1", PositionTicks: 1_000_000, IsPaused: false, PlaybackRate: 1 }
            }
          ]
        };
      }
      return {
        ok: false,
        status: 503,
        statusText: "Unavailable"
      };
    });
    const source = new JellyfinEmbyMediaSource({ getSettings: () => createSettings(), fetch: fetch as never });

    await expect(
      source.handleConnectionMessage({
        type: "video-context",
        tabId: 1,
        payload: {
          pageUrl: "https://media.example.test/web/index.html#!/details?id=item-1",
          videoSrc: null,
          title: "Episode",
          site: "Jellyfin"
        }
      })
    ).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "sourceMatched",
          selectedSessionId: "server-1:session-1"
        }),
        {
          type: "error",
          message: "Jellyfin / Emby subtitle request failed: HTTP 503 Unavailable"
        }
      ])
    );
  });
});
