import { describe, expect, it } from "vitest";
import {
  buildAuthorizationHeader,
  buildSubtitleUrl,
  buildWebSocketUrl,
  createAuthHeaders,
  guessSubtitleFormatFromStream,
  normalizeServerUrl,
  pickSubtitleExtension,
  ticksToMilliseconds,
  ticksToSeconds
} from "./jellyfinembyUtils.js";
import type {
  MediaServerConfig,
  MediaServerSessionSummary,
  MediaServerSubtitleStream
} from "./types.js";

function makeConfig(overrides: Partial<MediaServerConfig> = {}): MediaServerConfig {
  return {
    id: "cfg-1",
    name: "Test",
    serverUrl: "http://server.local:8096",
    apiKey: "key-abc",
    webSocketPath: "/socket",
    enabled: true,
    ...overrides
  } as MediaServerConfig;
}

describe("jellyfinembyUtils", () => {
  describe("normalizeServerUrl", () => {
    it("returns empty string for falsy input", () => {
      expect(normalizeServerUrl(null)).toBe("");
      expect(normalizeServerUrl(undefined)).toBe("");
      expect(normalizeServerUrl("")).toBe("");
    });

    it("strips trailing slashes", () => {
      expect(normalizeServerUrl("http://server.local:8096/")).toBe(
        "http://server.local:8096"
      );
      expect(normalizeServerUrl("http://server.local:8096/path///")).toBe(
        "http://server.local:8096/path"
      );
    });

    it("throws for unparsable urls", () => {
      expect(() => normalizeServerUrl("not a url/")).toThrow("Invalid jellyfinemby server URL");
    });
  });

  describe("buildWebSocketUrl", () => {
    it("upgrades http to ws and sets path", () => {
      const url = buildWebSocketUrl(makeConfig({ serverUrl: "http://s:80" }));
      expect(url).toBe("ws://s/socket");
    });

    it("upgrades https to wss", () => {
      const url = buildWebSocketUrl(
        makeConfig({ serverUrl: "https://s.example:443", webSocketPath: "/custom" })
      );
      expect(url).toBe("wss://s.example/custom");
    });

    it("throws when server url is missing", () => {
      expect(() => buildWebSocketUrl(makeConfig({ serverUrl: "" }))).toThrow(
        /Missing jellyfinemby server URL/
      );
    });

    it("rejects websocket paths that are not already current settings", () => {
      expect(() => buildWebSocketUrl(makeConfig({ webSocketPath: "custom" }))).toThrow(
        "Jellyfin / Emby webSocketPath must start with /"
      );
    });
  });

  describe("ticksToMilliseconds / ticksToSeconds", () => {
    it("converts ticks to milliseconds", () => {
      expect(ticksToMilliseconds(10_000)).toBe(1);
      expect(ticksToMilliseconds(25_000_000)).toBe(2500);
    });

    it("returns null for invalid values", () => {
      expect(ticksToMilliseconds(null)).toBeNull();
      expect(ticksToMilliseconds(undefined)).toBeNull();
      expect(ticksToMilliseconds(Number.NaN)).toBeNull();
    });

    it("converts ticks to seconds", () => {
      expect(ticksToSeconds(10_000_000)).toBe(1);
      expect(ticksToSeconds(null)).toBeNull();
    });
  });

  describe("pickSubtitleExtension", () => {
    it("defaults to vtt when codec is missing", () => {
      expect(pickSubtitleExtension({ codec: "" } as MediaServerSubtitleStream)).toBe("vtt");
    });

    it("maps known codecs", () => {
      expect(pickSubtitleExtension({ codec: "subrip" } as MediaServerSubtitleStream)).toBe("srt");
      expect(pickSubtitleExtension({ codec: "WEBVTT" } as MediaServerSubtitleStream)).toBe("vtt");
      expect(pickSubtitleExtension({ codec: "ass" } as MediaServerSubtitleStream)).toBe("ass");
    });

    it("falls back to last alnum segment for unknown codecs", () => {
      expect(pickSubtitleExtension({ codec: "foo/bar-baz" } as MediaServerSubtitleStream)).toBe(
        "baz"
      );
    });
  });

  describe("guessSubtitleFormatFromStream", () => {
    it("prefers vtt when display title mentions it", () => {
      expect(
        guessSubtitleFormatFromStream({
          displayTitle: "English (VTT)",
          codec: "subrip"
        } as MediaServerSubtitleStream)
      ).toBe("vtt");
    });

    it("returns vtt when codec is vtt", () => {
      expect(
        guessSubtitleFormatFromStream({ codec: "webvtt" } as MediaServerSubtitleStream)
      ).toBe("vtt");
    });

    it("returns srt when codec is subrip", () => {
      expect(
        guessSubtitleFormatFromStream({ codec: "subrip" } as MediaServerSubtitleStream)
      ).toBe("srt");
    });

    it("defaults to srt when no hint", () => {
      expect(
        guessSubtitleFormatFromStream({ codec: "ass" } as MediaServerSubtitleStream)
      ).toBe("srt");
    });
  });

  describe("buildSubtitleUrl", () => {
    const session = {
      nowPlayingItemId: "item-1",
      mediaSourceId: "src-9"
    } as MediaServerSessionSummary;

    it("builds full subtitle url with api_key", () => {
      const url = buildSubtitleUrl(
        makeConfig(),
        session,
        { index: 2, codec: "subrip" } as MediaServerSubtitleStream
      );
      expect(url).toBe(
        "http://server.local:8096/Videos/item-1/src-9/Subtitles/2/Stream.srt?api_key=key-abc"
      );
    });

    it("respects extension override", () => {
      const url = buildSubtitleUrl(
        makeConfig(),
        session,
        { index: 0, codec: "subrip" } as MediaServerSubtitleStream,
        "vtt"
      );
      expect(url.endsWith("Stream.vtt?api_key=key-abc")).toBe(true);
    });

    it("throws when server url is missing", () => {
      expect(() =>
        buildSubtitleUrl(
          makeConfig({ serverUrl: "" }),
          session,
          { index: 0, codec: "subrip" } as MediaServerSubtitleStream
        )
      ).toThrow(/Missing jellyfinemby server URL/);
    });

    it("throws when api key is missing", () => {
      expect(() =>
        buildSubtitleUrl(
          makeConfig({ apiKey: "" }),
          session,
          { index: 0, codec: "subrip" } as MediaServerSubtitleStream
        )
      ).toThrow(/Missing jellyfinemby API key/);
    });

    it("throws when session identifiers are missing", () => {
      expect(() =>
        buildSubtitleUrl(
          makeConfig(),
          { nowPlayingItemId: null } as unknown as MediaServerSessionSummary,
          { index: 0, codec: "subrip" } as MediaServerSubtitleStream
        )
      ).toThrow(/missing media identifiers/);
    });
  });

  describe("buildAuthorizationHeader", () => {
    it("formats MediaBrowser header segments", () => {
      const header = buildAuthorizationHeader(
        {
          clientName: "ISP",
          deviceName: "mac",
          deviceId: "did",
          version: "1.0"
        },
        "tok"
      );
      expect(header).toBe(
        'MediaBrowser Client="ISP", Device="mac", DeviceId="did", Version="1.0", Token="tok"'
      );
    });

    it("escapes embedded double quotes", () => {
      const header = buildAuthorizationHeader(
        {
          clientName: 'has"quote',
          deviceName: "d",
          deviceId: "i",
          version: "v"
        },
        "t"
      );
      expect(header).toContain('Client="has\\"quote"');
    });
  });

  describe("createAuthHeaders", () => {
    it("returns empty object when api key is absent", () => {
      expect(createAuthHeaders(null)).toEqual({});
      expect(createAuthHeaders("")).toEqual({});
    });

    it("returns X-Emby-Token only when identity omitted", () => {
      expect(createAuthHeaders("key")).toEqual({ "X-Emby-Token": "key" });
    });

    it("adds X-Emby-Authorization when identity provided", () => {
      const headers = createAuthHeaders("key", {
        clientName: "c",
        deviceName: "d",
        deviceId: "i",
        version: "v"
      });
      expect(headers["X-Emby-Token"]).toBe("key");
      expect(headers["X-Emby-Authorization"]).toContain('Client="c"');
    });
  });
});
