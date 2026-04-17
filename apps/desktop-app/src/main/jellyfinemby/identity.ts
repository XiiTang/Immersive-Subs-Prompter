import { app } from "electron";
import { createHash, randomUUID } from "crypto";
import os from "os";
import { JellyfinembyIdentity } from "../jellyfinembyUtils.js";
import { swallow } from "../errors.js";
import { CLIENT_NAME, DEFAULT_DEVICE_NAME, FALLBACK_VERSION } from "./constants.js";

export function createJellyfinembyIdentity(): JellyfinembyIdentity {
  return {
    clientName: CLIENT_NAME,
    deviceName: deriveDeviceName(),
    deviceId: deriveDeviceId(),
    version: getClientVersion()
  };
}

export function deriveDeviceName(): string {
  try {
    const hostname = os.hostname();
    if (hostname && hostname.trim().length) {
      return hostname.trim();
    }
  } catch (error) {
    swallow(error, "jellyfinemby.identity.hostname", "OS hostname unavailable; using default device name");
  }
  return DEFAULT_DEVICE_NAME;
}

export function deriveDeviceId(): string {
  try {
    const hostname = os.hostname();
    const username = (() => {
      try {
        return os.userInfo().username;
      } catch (error) {
        swallow(error, "jellyfinemby.identity.userInfo", "userInfo unavailable; fall back to literal 'user'");
        return "user";
      }
    })();
    const seed = `${hostname ?? DEFAULT_DEVICE_NAME}:${username}`;
    return createHash("sha1").update(seed).digest("hex");
  } catch (error) {
    swallow(error, "jellyfinemby.identity.deviceId", "deterministic derivation failed; fall back to random UUID");
    return randomUUID().replace(/-/g, "");
  }
}

export function getClientVersion(): string {
  try {
    return app?.getVersion?.() ?? FALLBACK_VERSION;
  } catch (error) {
    swallow(error, "jellyfinemby.identity.version", "electron app.getVersion() unavailable in this context");
    return FALLBACK_VERSION;
  }
}
