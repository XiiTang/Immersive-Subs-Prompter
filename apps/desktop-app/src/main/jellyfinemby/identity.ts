import { app } from "electron";
import { createHash, randomUUID } from "crypto";
import os from "os";
import { JellyfinembyIdentity } from "../jellyfinembyUtils.js";
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
  } catch {
    // ignore
  }
  return DEFAULT_DEVICE_NAME;
}

export function deriveDeviceId(): string {
  try {
    const hostname = os.hostname();
    const username = (() => {
      try {
        return os.userInfo().username;
      } catch {
        return "user";
      }
    })();
    const seed = `${hostname ?? DEFAULT_DEVICE_NAME}:${username}`;
    return createHash("sha1").update(seed).digest("hex");
  } catch {
    return randomUUID().replace(/-/g, "");
  }
}

export function getClientVersion(): string {
  try {
    return app?.getVersion?.() ?? FALLBACK_VERSION;
  } catch {
    return FALLBACK_VERSION;
  }
}
