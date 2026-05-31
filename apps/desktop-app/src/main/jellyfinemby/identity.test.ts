import { describe, expect, it } from "vitest";
import { createJellyfinembyIdentity } from "./identity.js";
import { CLIENT_NAME } from "./constants.js";

describe("jellyfinemby/identity", () => {
  describe("createJellyfinembyIdentity", () => {
    it("exposes all identity fields", () => {
      const identity = createJellyfinembyIdentity();
      expect(identity.clientName).toBe(CLIENT_NAME);
      expect(identity.deviceName.length).toBeGreaterThan(0);
      expect(identity.deviceId).toMatch(/^[0-9a-f]{40}$/);
      expect(identity.version).toBe("0.0.0-test");
    });
  });
});
