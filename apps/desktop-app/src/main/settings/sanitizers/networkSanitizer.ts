import { networkEndpointKey, stripIpv6Brackets } from "@immersive-subs/contracts";
import type { NetworkEndpoint, NetworkSettings } from "../../types.js";
import { DEFAULT_NETWORK_SETTINGS } from "../constants.js";
import { isConnectionAuthToken, sanitizeConnectionAuthToken } from "../../connectionAuth.js";
import { assertNoUnknownKeys } from "../utils.js";

const NETWORK_SETTINGS_KEYS = ["endpoints", "authToken"] as const;
const NETWORK_ENDPOINT_KEYS = ["id", "host", "port"] as const;

export function sanitizeNetworkSettings(input: Partial<NetworkSettings> | null | undefined): NetworkSettings {
  try {
    return normalizeNetworkSettings(input);
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

function normalizeNetworkSettings(
  input: Partial<NetworkSettings> | null | undefined
): NetworkSettings {
  const source = input ?? {};
  const endpoints = normalizeEndpoints(source.endpoints);
  const authToken = sanitizeConnectionAuthToken(source.authToken);
  return { endpoints, authToken };
}

function normalizeEndpoints(value: unknown): NetworkEndpoint[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error("At least one network endpoint is required");
  }

  const seenKeys = new Set<string>();
  const seenIds = new Set<string>();
  const endpoints: NetworkEndpoint[] = [];

  for (const entry of value) {
    if (!entry || typeof entry !== "object") {
      throw new Error("Network endpoint must be an object");
    }

    const candidate = entry as Partial<NetworkEndpoint>;
    const id = typeof candidate.id === "string" && candidate.id.trim() ? candidate.id.trim() : "";
    const host = typeof candidate.host === "string" ? stripIpv6Brackets(candidate.host).trim() : "";
    const port = Number(candidate.port);

    if (!id) {
      throw new Error("Network endpoint id is required");
    }
    if (!host) {
      throw new Error("Network endpoint host is required");
    }
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      throw new Error("Network endpoint port must be between 1 and 65535");
    }

    const normalized = { id, host, port };
    if (seenIds.has(id)) {
      throw new Error(`Duplicate network endpoint id: ${id}`);
    }
    seenIds.add(id);

    const key = networkEndpointKey(normalized);
    if (seenKeys.has(key)) {
      throw new Error(`Duplicate network endpoint: ${key}`);
    }
    seenKeys.add(key);
    endpoints.push(normalized);
  }

  return endpoints;
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

function cloneDefaultNetworkSettings(): NetworkSettings {
  return {
    endpoints: DEFAULT_NETWORK_SETTINGS.endpoints.map((endpoint) => ({ ...endpoint })),
    authToken: DEFAULT_NETWORK_SETTINGS.authToken
  };
}
