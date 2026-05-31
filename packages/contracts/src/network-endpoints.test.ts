import { describe, expect, it } from "vitest";
import {
  buildNetworkEndpointUrl,
  isLoopbackHost,
  networkEndpointKey,
  normalizeEndpoint,
  normalizeEndpointList,
  parseNetworkEndpointInput
} from "./index.js";

describe("network endpoint utilities", () => {
  it("parses host:port inputs used by the desktop endpoint editor", () => {
    expect(parseNetworkEndpointInput("127.0.0.1:44501")).toEqual({
      ok: true,
      endpoint: { host: "127.0.0.1", port: 44501 }
    });
    expect(parseNetworkEndpointInput("192.168.1.2:44502")).toEqual({
      ok: true,
      endpoint: { host: "192.168.1.2", port: 44502 }
    });
    expect(parseNetworkEndpointInput("[::1]:44501")).toEqual({
      ok: true,
      endpoint: { host: "::1", port: 44501 }
    });
  });

  it("parses desktop-generated ws URLs without accepting broader protocols", () => {
    expect(parseNetworkEndpointInput("ws://192.168.1.2:44501/?token=abc")).toEqual({
      ok: true,
      endpoint: { host: "192.168.1.2", port: 44501 }
    });
    expect(parseNetworkEndpointInput("wss://192.168.1.2:44501")).toEqual({
      ok: false,
      error: "Endpoint must use ws:// when a protocol is included"
    });
  });

  it("rejects empty, missing-port, invalid-port, and non-root URL inputs", () => {
    expect(parseNetworkEndpointInput("")).toEqual({ ok: false, error: "Endpoint is empty" });
    expect(parseNetworkEndpointInput("https://192.168.1.2:44501")).toEqual({
      ok: false,
      error: "Endpoint must use ws:// when a protocol is included"
    });
    expect(parseNetworkEndpointInput("192.168.1.2")).toEqual({
      ok: false,
      error: "Endpoint must include a host and port"
    });
    expect(parseNetworkEndpointInput("192.168.1.2:70000")).toEqual({
      ok: false,
      error: "Port must be between 1 and 65535"
    });
    expect(parseNetworkEndpointInput("ws://192.168.1.2:44501/custom")).toEqual({
      ok: false,
      error: "Endpoint URL path must be /"
    });
    expect(parseNetworkEndpointInput("bad host:44501")).toEqual({
      ok: false,
      error: "Endpoint host is invalid"
    });
  });

  it("normalizes extension endpoint strings through the same parser", () => {
    expect(normalizeEndpoint("192.168.1.2:44501")).toBe("ws://192.168.1.2:44501/");
    expect(normalizeEndpoint("ws://192.168.1.2:44501/?token=abc")).toBe("ws://192.168.1.2:44501/?token=abc");
    expect(normalizeEndpoint("wss://192.168.1.2:44501")).toBeNull();
    expect(normalizeEndpoint("192.168.1.2")).toBeNull();
    expect(normalizeEndpoint("bad host:44501")).toBeNull();
    expect(normalizeEndpointList(["127.0.0.1:44501", "ws://127.0.0.1:44501/", "bad", "bad host:44501"])).toEqual([
      "ws://127.0.0.1:44501/"
    ]);
  });

  it("normalizes keys and authenticated URLs", () => {
    expect(networkEndpointKey({ host: " [::1] ", port: 44501 })).toBe("::1:44501");

    expect(isLoopbackHost("127.0.0.1")).toBe(true);
    expect(isLoopbackHost("::1")).toBe(true);
    expect(isLoopbackHost("192.168.1.2")).toBe(false);
    expect(buildNetworkEndpointUrl({ host: "127.0.0.1", port: 44501 }, "secret")).toBe("ws://127.0.0.1:44501/");
    expect(buildNetworkEndpointUrl({ host: "192.168.1.2", port: 44501 }, "secret")).toBe(
      "ws://192.168.1.2:44501/?token=secret"
    );
    expect(buildNetworkEndpointUrl({ host: "::1", port: 44501 }, "secret")).toBe("ws://[::1]:44501/");
  });
});
