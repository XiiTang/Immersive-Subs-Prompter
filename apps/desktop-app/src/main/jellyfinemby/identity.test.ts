import { describe, expect, it } from "vitest";
import {
  createJellyfinembyIdentity,
  deriveDeviceId,
  deriveDeviceName,
  getClientVersion
} from "./identity.js";
import { CLIENT_NAME } from "./constants.js";

describe("jellyfinemby/identity", () => {
  describe("deriveDeviceName", () => {
    it("returns a non-empty string", () => {
      const name = deriveDeviceName();
      expect(typeof name).toBe("string");
      expect(name.trim().length).toBeGreaterThan(0);
    });
  });

  describe("deriveDeviceId", () => {
    it("returns a deterministic 40-char sha1 hex for the same environment", () => {
      const first = deriveDeviceId();
      const second = deriveDeviceId();
      expect(first).toBe(second);
      expect(first).toMatch(/^[0-9a-f]{40}$/);
    });
  });

  describe("getClientVersion", () => {
    it("returns the mocked app version from the electron mock", () => {
      expect(getClientVersion()).toBe("0.0.0-test");
    });
  });

  describe("createJellyfinembyIdentity", () => {
    it("exposes all identity fields", () => {
      const identity = createJellyfinembyIdentity();
      expect(identity.clientName).toBe(CLIENT_NAME);
      expect(identity.deviceName.length).toBeGreaterThan(0);
      expect(identity.deviceId).toMatch(/^[0-9a-f]{40}$/);
      expect(typeof identity.version).toBe("string");
    });
  });
});
