import { describe, expect, it } from "vitest";
import { validateNetworkSettingsForUpdate } from "./networkSanitizer.js";

describe("networkSanitizer", () => {
  it("rejects invalid update payloads instead of returning defaults", () => {
    expect(() =>
      validateNetworkSettingsForUpdate({ endpoints: [], authToken: "0123456789abcdef0123456789abcdef" })
    ).toThrow("At least one network endpoint is required");
    expect(() =>
      validateNetworkSettingsForUpdate({
        endpoints: [
          { id: "a", host: "127.0.0.1", port: 44501 },
          { id: "b", host: "127.0.0.1", port: 44501 }
        ],
        authToken: "0123456789abcdef0123456789abcdef"
      })
    ).toThrow("Duplicate network endpoint: 127.0.0.1:44501");
  });

  it("rejects update payloads that would otherwise be normalized", () => {
    expect(() =>
      validateNetworkSettingsForUpdate(null as never)
    ).toThrow("network settings must use the current object setting");
    expect(() =>
      validateNetworkSettingsForUpdate({
        endpoints: [{ id: " loopback ", host: "127.0.0.1", port: 44501 }],
        authToken: "0123456789abcdef0123456789abcdef"
      })
    ).toThrow("Network endpoint id must not require normalization");
    expect(() =>
      validateNetworkSettingsForUpdate({
        endpoints: [{ id: "loopback", host: "[::1]", port: 44501 }],
        authToken: "0123456789abcdef0123456789abcdef"
      })
    ).toThrow("Network endpoint host must not require normalization");
    expect(() =>
      validateNetworkSettingsForUpdate({
        endpoints: [{ id: "loopback", host: "127.0.0.1", port: "44501" as never }],
        authToken: "0123456789abcdef0123456789abcdef"
      })
    ).toThrow("Network endpoint port must use the current integer setting");
    expect(() =>
      validateNetworkSettingsForUpdate({
        endpoints: [{ id: "loopback", host: "127.0.0.1", port: 44501 }],
        authToken: "bad-token"
      })
    ).toThrow("network.authToken must use the current token setting");
  });

  it("rejects duplicate endpoint ids", () => {
    expect(() =>
      validateNetworkSettingsForUpdate({
        endpoints: [
          { id: "same", host: "127.0.0.1", port: 44501 },
          { id: "same", host: "192.168.1.2", port: 44502 }
        ],
        authToken: "0123456789abcdef0123456789abcdef"
      })
    ).toThrow("Duplicate network endpoint id: same");
  });
});
