import { describe, expect, it } from "vitest";
import { MediaServerUrlResolver } from "./MediaServerUrlResolver.js";
import type { MediaServerConfig } from "../types.js";

type TestJellyfinembyPluginConfig = {
  servers: MediaServerConfig[];
};

function makeConfigProvider(configs: MediaServerConfig[]): () => TestJellyfinembyPluginConfig {
  return () => ({
    servers: configs
  });
}

function makeConfig(overrides: Partial<MediaServerConfig>): MediaServerConfig {
  return {
    id: "cfg-1",
    name: "srv",
    serverUrl: "http://server.local:8096",
    apiKey: "k",
    webSocketPath: "/socket",
    enabled: true,
    ...overrides
  };
}

describe("MediaServerUrlResolver", () => {
  describe("extractOrigin", () => {
    const resolver = new MediaServerUrlResolver(makeConfigProvider([]) as never);

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
    it("matches configured origins without depending on plugin enabled state", () => {
      const resolver = new MediaServerUrlResolver(makeConfigProvider([makeConfig({})]) as never);
      expect(
        resolver.resolveMediaServerConfigIdFromUrls(["http://server.local:8096/web/index.html"])
      ).toBe("cfg-1");
    });

    it("returns null when no configs match", () => {
      const resolver = new MediaServerUrlResolver(
        makeConfigProvider([makeConfig({ serverUrl: "http://other:8096" })]) as never
      );
      expect(
        resolver.resolveMediaServerConfigIdFromUrls(["http://server.local:8096/page"])
      ).toBeNull();
    });

    it("matches by origin when url and config share protocol+host+port", () => {
      const resolver = new MediaServerUrlResolver(
        makeConfigProvider([
          makeConfig({ id: "match", serverUrl: "http://server.local:8096" })
        ]) as never
      );
      expect(
        resolver.resolveMediaServerConfigIdFromUrls([
          "http://server.local:8096/web/index.html#!/details"
        ])
      ).toBe("match");
    });

    it("ignores null entries and continues searching", () => {
      const resolver = new MediaServerUrlResolver(makeConfigProvider([makeConfig({ id: "match" })]) as never);
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
      const resolver = new MediaServerUrlResolver(
        makeConfigProvider([
          makeConfig({ id: "a", enabled: false }),
          makeConfig({ id: "b", enabled: true })
        ]) as never
      );
      expect(resolver.resolveMediaServerConfig("a")?.id).toBe("a");
    });

    it("prefers enabled config when no id supplied", () => {
      const resolver = new MediaServerUrlResolver(
        makeConfigProvider([
          makeConfig({ id: "a", enabled: false }),
          makeConfig({ id: "b", enabled: true })
        ]) as never
      );
      expect(resolver.resolveMediaServerConfig()?.id).toBe("b");
    });

    it("returns null if no config is enabled and no id is supplied", () => {
      const resolver = new MediaServerUrlResolver(
        makeConfigProvider([
          makeConfig({ id: "a", enabled: false }),
          makeConfig({ id: "b", enabled: false })
        ]) as never
      );
      expect(resolver.resolveMediaServerConfig()).toBeNull();
    });
  });

  describe("extractItemId", () => {
    const resolver = new MediaServerUrlResolver(makeConfigProvider([]) as never);

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
    const resolver = new MediaServerUrlResolver(makeConfigProvider([makeConfig({ id: "cfg-1" })]) as never);

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

    it("returns null when no base url is found", () => {
      const empty = new MediaServerUrlResolver(makeConfigProvider([]) as never);
      expect(
        empty.buildMediaServerItemUrl({
          nowPlayingItemId: "9",
          serverConfigId: "x"
        } as any)
      ).toBeNull();
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
