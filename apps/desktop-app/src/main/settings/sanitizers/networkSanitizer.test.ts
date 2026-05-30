import { describe, expect, it } from "vitest";
import { DEFAULT_NETWORK_SETTINGS } from "../constants.js";
import {
  sanitizeNetworkSettings,
  validateNetworkSettingsForUpdate
} from "./networkSanitizer.js";

describe("networkSanitizer", () => {
  it("keeps valid endpoint lists", () => {
    const result = sanitizeNetworkSettings({
      endpoints: [
        { id: "loopback", host: "127.0.0.1", port: 44501 },
        { id: "lan", host: "192.168.1.2", port: 44502 }
      ],
      authToken: "0123456789abcdef0123456789abcdef"
    });

    expect(result.endpoints).toEqual([
      { id: "loopback", host: "127.0.0.1", port: 44501 },
      { id: "lan", host: "192.168.1.2", port: 44502 }
    ]);
    expect(result.authToken).toBe("0123456789abcdef0123456789abcdef");
  });

  it("falls back to defaults when stored endpoints are missing or invalid", () => {
    expect(sanitizeNetworkSettings({ endpoints: [], authToken: "0123456789abcdef0123456789abcdef" })).toEqual(
      DEFAULT_NETWORK_SETTINGS
    );
    expect(
      sanitizeNetworkSettings({
        endpoints: [{ id: "bad", host: "127.0.0.1", port: 70000 }],
        authToken: "0123456789abcdef0123456789abcdef"
      })
    ).toEqual(DEFAULT_NETWORK_SETTINGS);
  });

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
