import { describe, expect, it } from "vitest";
import {
  buildNetworkEndpointUrl,
  formatNetworkEndpointInput,
  isLoopbackHost,
  networkEndpointKey,
  parseNetworkEndpointInput
} from "../common/networkEndpoints.js";

describe("network endpoint utilities", () => {
  it("parses host:port inputs", () => {
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

  it("parses ws URLs without persisting token or path details", () => {
    expect(parseNetworkEndpointInput("ws://192.168.1.2:44501/?token=abc")).toEqual({
      ok: true,
      endpoint: { host: "192.168.1.2", port: 44501 }
    });
  });

  it("rejects empty, non-ws, missing-port, and out-of-range inputs", () => {
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
  });

  it("normalizes keys and editing values", () => {
    expect(networkEndpointKey({ host: " [::1] ", port: 44501 })).toBe("::1:44501");
    expect(formatNetworkEndpointInput({ id: "a", host: "::1", port: 44501 })).toBe("[::1]:44501");
    expect(formatNetworkEndpointInput({ id: "b", host: "127.0.0.1", port: 44501 })).toBe("127.0.0.1:44501");
  });

  it("builds extension URLs with tokens only for non-loopback hosts", () => {
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
