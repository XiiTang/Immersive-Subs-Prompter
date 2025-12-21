import { NetworkSettings } from "../../types.js";
import { DEFAULT_NETWORK_SETTINGS } from "../constants.js";
import { clampPort } from "../utils.js";

export function sanitizeNetworkSettings(input: Partial<NetworkSettings> | null | undefined): NetworkSettings {
  const source = input ?? {};
  const host =
    typeof source.host === "string" && source.host.trim().length ? source.host.trim() : DEFAULT_NETWORK_SETTINGS.host;
  const port = clampPort(Number(source.port), DEFAULT_NETWORK_SETTINGS.port);
  return { host, port };
}
