import { describe, expect, it } from "vitest";
import { MediaServerUrlResolver } from "./MediaServerUrlResolver.js";
import type { AppSettings, MediaServerConfig } from "../types.js";

function makeSettings(configs: MediaServerConfig[], enabled = true): AppSettings {
  return {
    mediaServer: { enabled, configs }
  } as AppSettings;
}

function makeConfig(overrides: Partial<MediaServerConfig>): MediaServerConfig {
  return {
    id: "cfg-1",
    name: "srv",
    type: "jellyfinemby",
    serverUrl: "http://server.local:8096",
    apiKey: "k",
    webSocketPath: "/socket",
    enabled: true,
    ...overrides
  };
}

describe("MediaServerUrlResolver", () => {
  describe("extractOrigin", () => {
    const resolver = new MediaServerUrlResolver(() => makeSettings([]));

    it("returns null for missing or blank input", () => {
      expect(resolver.extractOrigin(null)).toBeNull();
      expect(resolver.extractOrigin(undefined)).toBeNull();
      expect(resolver.extractOrigin("   ")).toBeNull();
    });

    it("unwraps blob: URLs", () => {
      expect(resolver.extractOrigin("blob:http://server.local:8096/abc")).toBe(
        "http://server.local:8096"
      );
    });

    it("returns null for unparsable input", () => {
      expect(resolver.extractOrigin("not a url")).toBeNull();
    });

    it("returns protocol + host + port", () => {
      expect(resolver.extractOrigin("https://a.b:81/path")).toBe("https://a.b:81");
      expect(resolver.extractOrigin("https://a.b/path")).toBe("https://a.b");
    });
  });

  describe("resolveMediaServerConfigIdFromUrls", () => {
    it("returns null when mediaServer is disabled", () => {
      const resolver = new MediaServerUrlResolver(() =>
        makeSettings([makeConfig({})], false)
      );
      expect(
        resolver.resolveMediaServerConfigIdFromUrls(["http://server.local:8096"])
      ).toBeNull();
    });

    it("returns null when no configs match", () => {
      const resolver = new MediaServerUrlResolver(() =>
        makeSettings([makeConfig({ serverUrl: "http://other:8096" })])
      );
      expect(
        resolver.resolveMediaServerConfigIdFromUrls(["http://server.local:8096/page"])
      ).toBeNull();
    });

    it("matches by origin when url and config share protocol+host+port", () => {
      const resolver = new MediaServerUrlResolver(() =>
        makeSettings([
          makeConfig({ id: "match", serverUrl: "http://server.local:8096" })
        ])
      );
      expect(
        resolver.resolveMediaServerConfigIdFromUrls([
          "http://server.local:8096/web/index.html#!/details"
        ])
      ).toBe("match");
    });

    it("ignores null entries and continues searching", () => {
      const resolver = new MediaServerUrlResolver(() =>
        makeSettings([makeConfig({ id: "match" })])
      );
      expect(
        resolver.resolveMediaServerConfigIdFromUrls([
          null,
          undefined,
          "http://server.local:8096/x"
        ])
      ).toBe("match");
    });
  });

  describe("resolveMediaServerConfig", () => {
    it("returns specific config by id", () => {
      const resolver = new MediaServerUrlResolver(() =>
        makeSettings([
          makeConfig({ id: "a", enabled: false }),
          makeConfig({ id: "b", enabled: true })
        ])
      );
      expect(resolver.resolveMediaServerConfig("a")?.id).toBe("a");
    });

    it("prefers enabled config when no id supplied", () => {
      const resolver = new MediaServerUrlResolver(() =>
        makeSettings([
          makeConfig({ id: "a", enabled: false }),
          makeConfig({ id: "b", enabled: true })
        ])
      );
      expect(resolver.resolveMediaServerConfig()?.id).toBe("b");
    });

    it("falls back to first config if none enabled", () => {
      const resolver = new MediaServerUrlResolver(() =>
        makeSettings([
          makeConfig({ id: "a", enabled: false }),
          makeConfig({ id: "b", enabled: false })
        ])
      );
      expect(resolver.resolveMediaServerConfig()?.id).toBe("a");
    });
  });

  describe("extractItemId", () => {
    const resolver = new MediaServerUrlResolver(() => makeSettings([]));

    it("extracts item id from /videos/:id path", () => {
      const itemId = resolver.extractItemId(
        { videoSrc: "http://srv/videos/302/stream.mp4" } as any,
        ""
      );
      expect(itemId).toBe("302");
    });

    it("extracts from /items/:id path", () => {
      const itemId = resolver.extractItemId(
        { videoSrc: "http://srv/items/ABC" } as any,
        ""
      );
      expect(itemId).toBe("ABC");
    });

    it("strips the mediasource_ prefix from MediaSourceId query", () => {
      const itemId = resolver.extractItemId(
        {
          videoSrc: "http://srv/stream?MediaSourceId=mediasource_XYZ"
        } as any,
        ""
      );
      expect(itemId).toBe("XYZ");
    });

    it("falls back to fallbackUrl when videoSrc yields nothing", () => {
      const itemId = resolver.extractItemId(
        { videoSrc: "" } as any,
        "http://srv/items/FALL"
      );
      expect(itemId).toBe("FALL");
    });

    it("returns null when nothing matches", () => {
      expect(
        resolver.extractItemId({ videoSrc: "http://srv/other" } as any, "")
      ).toBeNull();
    });
  });

  describe("buildMediaServerItemUrl / buildMediaServerPageUrl", () => {
    const resolver = new MediaServerUrlResolver(() =>
      makeSettings([makeConfig({ id: "cfg-1" })])
    );

    it("returns null when session has no item id", () => {
      expect(
        resolver.buildMediaServerItemUrl({ nowPlayingItemId: null } as any)
      ).toBeNull();
    });

    it("builds a REST item url when config resolves", () => {
      expect(
        resolver.buildMediaServerItemUrl({
          nowPlayingItemId: "42",
          serverConfigId: "cfg-1"
        } as any)
      ).toBe("http://server.local:8096/Items/42");
    });

    it("falls back to jellyfinemby:// scheme when no base url is found", () => {
      const empty = new MediaServerUrlResolver(() => makeSettings([]));
      expect(
        empty.buildMediaServerItemUrl({
          nowPlayingItemId: "9",
          serverConfigId: "x"
        } as any)
      ).toBe("jellyfinemby://9");
    });

    it("builds a details page url when session has an item id", () => {
      expect(
        resolver.buildMediaServerPageUrl({
          nowPlayingItemId: "42",
          serverConfigId: "cfg-1"
        } as any)
      ).toBe("http://server.local:8096/web/index.html#!/details?id=42");
    });
  });
});
