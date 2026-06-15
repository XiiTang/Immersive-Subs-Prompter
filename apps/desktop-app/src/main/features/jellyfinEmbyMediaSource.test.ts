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
          serverUrl: "https://media.example.test/",
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

  it("does not use incomplete or invalid server rows at runtime", async () => {
    const fetch = vi.fn();
    const source = new JellyfinEmbyMediaSource({
      getSettings: () => createSettings({
        config: {
          servers: [
            {
              id: "server-1",
              name: "Broken",
              serverUrl: "not a url",
              apiKey: "api-key",
              enabled: true
            },
            {
              id: "server-2",
              name: "No token",
              serverUrl: "https://media.example.test/",
              apiKey: "",
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
          pageUrl: "https://media.example.test/web/index.html#!/details?id=item-1",
          videoSrc: null,
          title: "Movie",
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

  it("surfaces subtitle stream request failures instead of reporting empty subtitles", async () => {
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
    ).rejects.toThrow("Jellyfin / Emby subtitle request failed: HTTP 503 Unavailable");
  });
});
