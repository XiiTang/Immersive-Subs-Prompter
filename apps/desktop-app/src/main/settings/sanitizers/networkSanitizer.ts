import { networkEndpointKey, stripIpv6Brackets } from "@immersive-subs/contracts";
import { isConnectionAuthToken } from "../../connectionAuth.js";
import { assertNoUnknownKeys } from "../utils.js";

const NETWORK_SETTINGS_KEYS = ["endpoints", "authToken"] as const;
const NETWORK_ENDPOINT_KEYS = ["id", "host", "port"] as const;

class NetworkSettingsValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NetworkSettingsValidationError";
  }
}

export function validateNetworkSettingsForUpdate(input: unknown): void {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new NetworkSettingsValidationError("network settings must use the current object setting");
  }
  const source = input as Record<string, unknown>;
  assertNoUnknownKeys(source, NETWORK_SETTINGS_KEYS, "network");
  validateEndpointsForUpdate(source.endpoints);
  if (!isConnectionAuthToken(source.authToken)) {
    throw new NetworkSettingsValidationError("network.authToken must use the current token setting");
  }
}

function validateEndpointsForUpdate(value: unknown): void {
  if (!Array.isArray(value) || value.length === 0) {
    throw new NetworkSettingsValidationError("At least one network endpoint is required");
  }

  const seenKeys = new Set<string>();
  const seenIds = new Set<string>();
  for (const entry of value) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new NetworkSettingsValidationError("Network endpoint must be an object");
    }
    const source = entry as Record<string, unknown>;
    assertNoUnknownKeys(source, NETWORK_ENDPOINT_KEYS, "network endpoint");

    const id = source.id;
    if (typeof id !== "string" || !id.trim()) {
      throw new NetworkSettingsValidationError("Network endpoint id is required");
    }
    if (id !== id.trim()) {
      throw new NetworkSettingsValidationError("Network endpoint id must not require normalization");
    }

    const host = source.host;
    if (typeof host !== "string" || !host.trim()) {
      throw new NetworkSettingsValidationError("Network endpoint host is required");
    }
    if (host !== host.trim() || stripIpv6Brackets(host) !== host) {
      throw new NetworkSettingsValidationError("Network endpoint host must not require normalization");
    }

    const port = source.port;
    if (typeof port !== "number" || !Number.isInteger(port)) {
      throw new NetworkSettingsValidationError("Network endpoint port must use the current integer setting");
    }
    if (port < 1 || port > 65535) {
      throw new NetworkSettingsValidationError("Network endpoint port must be between 1 and 65535");
    }

    if (seenIds.has(id)) {
      throw new NetworkSettingsValidationError(`Duplicate network endpoint id: ${id}`);
    }
    seenIds.add(id);

    const endpoint = { id, host, port };
    const key = networkEndpointKey(endpoint);
    if (seenKeys.has(key)) {
      throw new NetworkSettingsValidationError(`Duplicate network endpoint: ${key}`);
    }
    seenKeys.add(key);
  }
}
