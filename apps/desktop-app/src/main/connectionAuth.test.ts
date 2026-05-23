import { describe, expect, it } from "vitest";
import {
  buildAuthenticatedEndpoint,
  createConnectionAuthToken,
  isAuthorizedDesktopClient
} from "./connectionAuth.js";
import type { NetworkEndpoint } from "./types.js";

const authToken = "0123456789abcdef0123456789abcdef";

function makeEndpoint(overrides: Partial<NetworkEndpoint> = {}): NetworkEndpoint {
  return {
    id: "default",
    host: "127.0.0.1",
    port: 44501,
    ...overrides
  };
}

describe("connectionAuth", () => {
  it("allows extension-origin loopback clients without putting the token in the default endpoint", () => {
    expect(
      isAuthorizedDesktopClient(
        { origin: "chrome-extension://abcdefghijklmnop", requestUrl: "/" },
        { endpoint: makeEndpoint(), authToken }
      )
    ).toBe(true);
    expect(
      isAuthorizedDesktopClient(
        { origin: "moz-extension://2f1c8041-a3fb-44a5-aabf-0be7742fdc1d", requestUrl: "/" },
        { endpoint: makeEndpoint({ host: "localhost" }), authToken }
      )
    ).toBe(true);
  });

  it("rejects ordinary web origins even on loopback", () => {
    expect(
      isAuthorizedDesktopClient(
        { origin: "https://attacker.example", requestUrl: "/" },
        { endpoint: makeEndpoint(), authToken }
      )
    ).toBe(false);
  });

  it("requires the shared token when the desktop listener is reachable beyond loopback", () => {
    const context = { endpoint: makeEndpoint({ host: "192.168.1.2" }), authToken };
    expect(
      isAuthorizedDesktopClient(
        { origin: "chrome-extension://abcdefghijklmnop", requestUrl: "/" },
        context
      )
    ).toBe(false);
    expect(
      isAuthorizedDesktopClient(
        { origin: "chrome-extension://abcdefghijklmnop", requestUrl: "/?token=wrong" },
        context
      )
    ).toBe(false);
    expect(
      isAuthorizedDesktopClient(
        {
          origin: "chrome-extension://abcdefghijklmnop",
          requestUrl: "/?token=0123456789abcdef0123456789abcdef"
        },
        context
      )
    ).toBe(true);
  });

  it("creates strong URL-safe tokens and endpoint URLs", () => {
    expect(createConnectionAuthToken()).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(buildAuthenticatedEndpoint(makeEndpoint({ host: "192.168.1.2" }), authToken)).toBe(
      "ws://192.168.1.2:44501/?token=0123456789abcdef0123456789abcdef"
    );
  });
});
