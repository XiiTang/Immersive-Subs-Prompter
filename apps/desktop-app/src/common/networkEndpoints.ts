export interface NetworkEndpointValue {
  id?: string;
  host: string;
  port: number;
}

export type NetworkEndpointParseResult =
  | { ok: true; endpoint: { host: string; port: number } }
  | { ok: false; error: string };

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "::1"]);

export function stripIpv6Brackets(host: string): string {
  const trimmed = host.trim();
  return trimmed.startsWith("[") && trimmed.endsWith("]") ? trimmed.slice(1, -1) : trimmed;
}

export function isLoopbackHost(host: string): boolean {
  return LOOPBACK_HOSTS.has(stripIpv6Brackets(host).toLowerCase());
}

export function formatHostForUrl(host: string): string {
  const normalized = stripIpv6Brackets(host);
  return normalized.includes(":") ? `[${normalized}]` : normalized;
}

export function formatNetworkEndpointInput(endpoint: NetworkEndpointValue): string {
  return `${formatHostForUrl(endpoint.host)}:${endpoint.port}`;
}

export function networkEndpointKey(endpoint: Pick<NetworkEndpointValue, "host" | "port">): string {
  return `${stripIpv6Brackets(endpoint.host).trim().toLowerCase()}:${endpoint.port}`;
}

export function buildNetworkEndpointUrl(endpoint: Pick<NetworkEndpointValue, "host" | "port">, authToken: string): string {
  const url = new URL(`ws://${formatHostForUrl(endpoint.host)}:${endpoint.port}/`);
  if (!isLoopbackHost(endpoint.host) && authToken) {
    url.searchParams.set("token", authToken);
  }
  return url.toString();
}

export function parseNetworkEndpointInput(value: unknown): NetworkEndpointParseResult {
  if (typeof value !== "string") {
    return { ok: false, error: "Endpoint must be text" };
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return { ok: false, error: "Endpoint is empty" };
  }

  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) {
    return parseEndpointUrl(trimmed);
  }

  return parseHostPort(trimmed);
}

function parseEndpointUrl(value: string): NetworkEndpointParseResult {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return { ok: false, error: "Endpoint URL is invalid" };
  }

  if (url.protocol !== "ws:") {
    return { ok: false, error: "Endpoint must use ws:// when a protocol is included" };
  }

  if (!url.hostname || !url.port) {
    return { ok: false, error: "Endpoint must include a host and port" };
  }

  return validateHostPort(stripIpv6Brackets(url.hostname), Number(url.port));
}

function parseHostPort(value: string): NetworkEndpointParseResult {
  const ipv6Match = value.match(/^\[([^\]]+)\]:(\d+)$/);
  if (ipv6Match) {
    return validateHostPort(ipv6Match[1] ?? "", Number(ipv6Match[2]));
  }

  const separator = value.lastIndexOf(":");
  if (separator <= 0 || separator === value.length - 1) {
    return { ok: false, error: "Endpoint must include a host and port" };
  }

  const host = value.slice(0, separator);
  const portText = value.slice(separator + 1);
  if (host.includes(":")) {
    return { ok: false, error: "IPv6 endpoints must use [host]:port syntax" };
  }
  if (!/^\d+$/.test(portText)) {
    return { ok: false, error: "Port must be a number" };
  }
  return validateHostPort(host, Number(portText));
}

function validateHostPort(hostValue: string, port: number): NetworkEndpointParseResult {
  const host = stripIpv6Brackets(hostValue).trim();
  if (!host) {
    return { ok: false, error: "Endpoint must include a host and port" };
  }
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return { ok: false, error: "Port must be between 1 and 65535" };
  }
  return { ok: true, endpoint: { host, port } };
}
