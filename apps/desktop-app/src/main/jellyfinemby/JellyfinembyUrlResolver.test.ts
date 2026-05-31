import { describe, expect, it } from "vitest";
import { JellyfinembyUrlResolver } from "./JellyfinembyUrlResolver.js";
import type { JellyfinembyServerConfig } from "../types.js";

type TestJellyfinembyPluginConfig = {
  servers: JellyfinembyServerConfig[];
};

function makeConfigProvider(configs: JellyfinembyServerConfig[]): () => TestJellyfinembyPluginConfig {
  return () => ({
    servers: configs
  });
}

function makeConfig(overrides: Partial<JellyfinembyServerConfig>): JellyfinembyServerConfig {
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

describe("JellyfinembyUrlResolver", () => {
  describe("extractOrigin", () => {
    const resolver = new JellyfinembyUrlResolver(makeConfigProvider([]) as never);

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

  describe("resolveConfigIdFromUrls", () => {
    it("matches enabled configured origins", () => {
      const resolver = new JellyfinembyUrlResolver(makeConfigProvider([makeConfig({})]) as never);
      expect(
        resolver.resolveConfigIdFromUrls(["http://server.local:8096/web/index.html"])
      ).toBe("cfg-1");
    });

    it("does not claim video-context messages for disabled servers", () => {
      const resolver = new JellyfinembyUrlResolver(
        makeConfigProvider([makeConfig({ enabled: false })]) as never
      );

      expect(
        resolver.resolveConfigIdFromUrls(["http://server.local:8096/web/index.html"])
      ).toBeNull();
    });

    it("returns null when no configs match", () => {
      const resolver = new JellyfinembyUrlResolver(
        makeConfigProvider([makeConfig({ serverUrl: "http://other:8096" })]) as never
      );
      expect(
        resolver.resolveConfigIdFromUrls(["http://server.local:8096/page"])
      ).toBeNull();
    });

    it("matches by origin when url and config share protocol+host+port", () => {
      const resolver = new JellyfinembyUrlResolver(
        makeConfigProvider([
          makeConfig({ id: "match", serverUrl: "http://server.local:8096" })
        ]) as never
      );
      expect(
        resolver.resolveConfigIdFromUrls([
          "http://server.local:8096/web/index.html#!/details"
        ])
      ).toBe("match");
    });

    it("ignores null entries and continues searching", () => {
      const resolver = new JellyfinembyUrlResolver(makeConfigProvider([makeConfig({ id: "match" })]) as never);
      expect(
        resolver.resolveConfigIdFromUrls([
          null,
          undefined,
          "http://server.local:8096/x"
        ])
      ).toBe("match");
    });
  });

  describe("resolveConfig", () => {
    it("returns specific config by id", () => {
      const resolver = new JellyfinembyUrlResolver(
        makeConfigProvider([
          makeConfig({ id: "a", enabled: false }),
          makeConfig({ id: "b", enabled: true })
        ]) as never
      );
      expect(resolver.resolveConfig("a")?.id).toBe("a");
    });

    it("prefers enabled config when no id supplied", () => {
      const resolver = new JellyfinembyUrlResolver(
        makeConfigProvider([
          makeConfig({ id: "a", enabled: false }),
          makeConfig({ id: "b", enabled: true })
        ]) as never
      );
      expect(resolver.resolveConfig()?.id).toBe("b");
    });

    it("returns null if no config is enabled and no id is supplied", () => {
      const resolver = new JellyfinembyUrlResolver(
        makeConfigProvider([
          makeConfig({ id: "a", enabled: false }),
          makeConfig({ id: "b", enabled: false })
        ]) as never
      );
      expect(resolver.resolveConfig()).toBeNull();
    });
  });

  describe("extractItemId", () => {
    const resolver = new JellyfinembyUrlResolver(makeConfigProvider([]) as never);

    it("extracts item id from /videos/:id path", () => {
      const itemId = resolver.extractItemId(
        { videoSrc: "http://srv/videos/302/stream.mp4" } as any
      );
      expect(itemId).toBe("302");
    });

    it("extracts from /items/:id path", () => {
      const itemId = resolver.extractItemId(
        { videoSrc: "http://srv/items/ABC" } as any
      );
      expect(itemId).toBe("ABC");
    });

    it("does not treat MediaSourceId as an item id", () => {
      const itemId = resolver.extractItemId(
        {
          videoSrc: "http://srv/stream?MediaSourceId=mediasource_XYZ"
        } as any
      );
      expect(itemId).toBeNull();
    });

    it("returns null when nothing matches", () => {
      expect(
        resolver.extractItemId({ videoSrc: "http://srv/other" } as any)
      ).toBeNull();
    });
  });

  describe("buildItemUrl / buildPageUrl", () => {
    const resolver = new JellyfinembyUrlResolver(makeConfigProvider([makeConfig({ id: "cfg-1" })]) as never);

    it("returns null when session has no item id", () => {
      expect(
        resolver.buildItemUrl({ nowPlayingItemId: null } as any)
      ).toBeNull();
    });

    it("builds a REST item url when config resolves", () => {
      expect(
        resolver.buildItemUrl({
          nowPlayingItemId: "42",
          serverConfigId: "cfg-1"
        } as any)
      ).toBe("http://server.local:8096/Items/42");
    });

    it("returns null when no base url is found", () => {
      const empty = new JellyfinembyUrlResolver(makeConfigProvider([]) as never);
      expect(
        empty.buildItemUrl({
          nowPlayingItemId: "9",
          serverConfigId: "x"
        } as any)
      ).toBeNull();
    });

    it("builds a details page url when session has an item id", () => {
      expect(
        resolver.buildPageUrl({
          nowPlayingItemId: "42",
          serverConfigId: "cfg-1"
        } as any)
      ).toBe("http://server.local:8096/web/index.html#!/details?id=42");
    });
  });
});
