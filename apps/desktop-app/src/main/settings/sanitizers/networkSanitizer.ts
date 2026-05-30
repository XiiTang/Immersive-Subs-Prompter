import { networkEndpointKey, stripIpv6Brackets } from "@immersive-subs/contracts";
import type { NetworkEndpoint, NetworkSettings } from "../../types.js";
import { DEFAULT_NETWORK_SETTINGS } from "../constants.js";
import { sanitizeConnectionAuthToken } from "../../connectionAuth.js";
import { assertNoUnknownKeys } from "../utils.js";

const NETWORK_SETTINGS_KEYS = ["endpoints", "authToken"] as const;
const NETWORK_ENDPOINT_KEYS = ["id", "host", "port"] as const;

export function sanitizeNetworkSettings(input: Partial<NetworkSettings> | null | undefined): NetworkSettings {
  try {
    return normalizeNetworkSettings(input, { throwOnInvalid: false });
  } catch {
    return cloneDefaultNetworkSettings();
  }
}

export class NetworkSettingsValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NetworkSettingsValidationError";
  }
}

export function validateNetworkSettingsForUpdate(input: Partial<NetworkSettings> | null | undefined): NetworkSettings {
  return normalizeNetworkSettings(input, { throwOnInvalid: true });
}

function normalizeNetworkSettings(
  input: Partial<NetworkSettings> | null | undefined,
  options: { throwOnInvalid: boolean }
): NetworkSettings {
  const source = input ?? {};
  if (options.throwOnInvalid) {
    assertNoUnknownKeys(source as Record<string, unknown>, NETWORK_SETTINGS_KEYS, "network");
  }
  const endpoints = normalizeEndpoints(source.endpoints, options);
  const authToken = sanitizeConnectionAuthToken(source.authToken);
  return { endpoints, authToken };
}

function normalizeEndpoints(value: unknown, options: { throwOnInvalid: boolean }): NetworkEndpoint[] {
  if (!Array.isArray(value) || value.length === 0) {
    return invalid("At least one network endpoint is required", options);
  }

  const seenKeys = new Set<string>();
  const seenIds = new Set<string>();
  const endpoints: NetworkEndpoint[] = [];

  for (const entry of value) {
    if (!entry || typeof entry !== "object") {
      return invalid("Network endpoint must be an object", options);
    }
    if (options.throwOnInvalid) {
      assertNoUnknownKeys(entry as Record<string, unknown>, NETWORK_ENDPOINT_KEYS, "network endpoint");
    }

    const candidate = entry as Partial<NetworkEndpoint>;
    const id = typeof candidate.id === "string" && candidate.id.trim() ? candidate.id.trim() : "";
    const host = typeof candidate.host === "string" ? stripIpv6Brackets(candidate.host).trim() : "";
    const port = Number(candidate.port);

    if (!id) {
      return invalid("Network endpoint id is required", options);
    }
    if (!host) {
      return invalid("Network endpoint host is required", options);
    }
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      return invalid("Network endpoint port must be between 1 and 65535", options);
    }

    const normalized = { id, host, port };
    if (seenIds.has(id)) {
      return invalid(`Duplicate network endpoint id: ${id}`, options);
    }
    seenIds.add(id);

    const key = networkEndpointKey(normalized);
    if (seenKeys.has(key)) {
      return invalid(`Duplicate network endpoint: ${key}`, options);
    }
    seenKeys.add(key);
    endpoints.push(normalized);
  }

  return endpoints;
}

function invalid(message: string, options: { throwOnInvalid: boolean }): never {
  if (options.throwOnInvalid) {
    throw new NetworkSettingsValidationError(message);
  }
  throw new Error(message);
}

function cloneDefaultNetworkSettings(): NetworkSettings {
  return {
    endpoints: DEFAULT_NETWORK_SETTINGS.endpoints.map((endpoint) => ({ ...endpoint })),
    authToken: DEFAULT_NETWORK_SETTINGS.authToken
  };
}
