import { app } from "electron";
import { createHash } from "crypto";
import os from "os";
import { JellyfinembyIdentity } from "../jellyfinembyUtils.js";
import { swallow } from "../errors.js";
import { CLIENT_NAME, DEFAULT_DEVICE_NAME } from "./constants.js";

export function createJellyfinembyIdentity(): JellyfinembyIdentity {
  return {
    clientName: CLIENT_NAME,
    deviceName: deriveDeviceName(),
    deviceId: deriveDeviceId(),
    version: getClientVersion()
  };
}

function deriveDeviceName(): string {
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

function deriveDeviceId(): string {
  const hostname = os.hostname().trim() || DEFAULT_DEVICE_NAME;
  const username = os.userInfo().username;
  const seed = `${hostname}:${username}`;
  return createHash("sha1").update(seed).digest("hex");
}

function getClientVersion(): string {
  return app.getVersion();
}
