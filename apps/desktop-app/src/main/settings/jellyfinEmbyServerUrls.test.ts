import { describe, expect, it } from "vitest";
import {
  isValidJellyfinEmbyServerUrls,
  parseJellyfinEmbyServerUrls
} from "../../common/jellyfinEmbyServerUrls.js";

describe("jellyfinEmbyServerUrls", () => {
  it("parses comma-separated localhost loopback and LAN URLs into ordered origins", () => {
    expect(
      parseJellyfinEmbyServerUrls(
        " http://localhost:8096/web, http://127.0.0.1:8096/?x=1, http://192.168.1.45:8096/#/home ",
        "features.jellyfinEmby.config.servers.0.serverUrls"
      )
    ).toEqual([
      { input: "http://localhost:8096/web", origin: "http://localhost:8096", baseUrl: "http://localhost:8096" },
      { input: "http://127.0.0.1:8096/?x=1", origin: "http://127.0.0.1:8096", baseUrl: "http://127.0.0.1:8096" },
      {
        input: "http://192.168.1.45:8096/#/home",
        origin: "http://192.168.1.45:8096",
        baseUrl: "http://192.168.1.45:8096"
      }
    ]);
  });

  it("ignores empty comma entries without changing order", () => {
    expect(parseJellyfinEmbyServerUrls("http://localhost:8096,, http://127.0.0.1:8096, ")).toEqual([
      { input: "http://localhost:8096", origin: "http://localhost:8096", baseUrl: "http://localhost:8096" },
      { input: "http://127.0.0.1:8096", origin: "http://127.0.0.1:8096", baseUrl: "http://127.0.0.1:8096" }
    ]);
  });

  it("rejects non-http entries with the invalid entry index", () => {
    expect(() =>
      parseJellyfinEmbyServerUrls(
        "http://localhost:8096, file:///tmp/media",
        "features.jellyfinEmby.config.servers.0.serverUrls"
      )
    ).toThrow("features.jellyfinEmby.config.servers.0.serverUrls entry 2 must be a valid HTTP(S) URL");
  });

  it("returns false for invalid URL-list drafts", () => {
    expect(isValidJellyfinEmbyServerUrls("http://localhost:8096,notaurl")).toBe(false);
    expect(isValidJellyfinEmbyServerUrls("http://localhost:8096,http://127.0.0.1:8096")).toBe(true);
  });
});
