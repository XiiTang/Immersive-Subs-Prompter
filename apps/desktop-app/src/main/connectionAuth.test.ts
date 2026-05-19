import { describe, expect, it } from "vitest";
import {
  buildAuthenticatedEndpoint,
  createConnectionAuthToken,
  isAuthorizedDesktopClient
} from "./connectionAuth.js";
import type { NetworkSettings } from "./types.js";

function makeNetwork(overrides: Partial<NetworkSettings> = {}): NetworkSettings {
  return {
    host: "127.0.0.1",
    port: 44501,
    authToken: "0123456789abcdef0123456789abcdef",
    ...overrides
  };
}

describe("connectionAuth", () => {
  it("allows extension-origin loopback clients without putting the token in the default endpoint", () => {
    expect(
      isAuthorizedDesktopClient(
        { origin: "chrome-extension://abcdefghijklmnop", requestUrl: "/" },
        makeNetwork()
      )
    ).toBe(true);
    expect(
      isAuthorizedDesktopClient(
        { origin: "moz-extension://2f1c8041-a3fb-44a5-aabf-0be7742fdc1d", requestUrl: "/" },
        makeNetwork({ host: "localhost" })
      )
    ).toBe(true);
  });

  it("rejects ordinary web origins even on loopback", () => {
    expect(
      isAuthorizedDesktopClient(
        { origin: "https://attacker.example", requestUrl: "/" },
        makeNetwork()
      )
    ).toBe(false);
  });

  it("requires the shared token when the desktop listener is reachable beyond loopback", () => {
    const network = makeNetwork({ host: "0.0.0.0" });
    expect(
      isAuthorizedDesktopClient(
        { origin: "chrome-extension://abcdefghijklmnop", requestUrl: "/" },
        network
      )
    ).toBe(false);
    expect(
      isAuthorizedDesktopClient(
        { origin: "chrome-extension://abcdefghijklmnop", requestUrl: "/?token=wrong" },
        network
      )
    ).toBe(false);
    expect(
      isAuthorizedDesktopClient(
        {
          origin: "chrome-extension://abcdefghijklmnop",
          requestUrl: "/?token=0123456789abcdef0123456789abcdef"
        },
        network
      )
    ).toBe(true);
  });

  it("creates strong URL-safe tokens and endpoint URLs", () => {
    expect(createConnectionAuthToken()).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(buildAuthenticatedEndpoint(makeNetwork({ host: "0.0.0.0" }))).toBe(
      "ws://0.0.0.0:44501/?token=0123456789abcdef0123456789abcdef"
    );
  });
});
