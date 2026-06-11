import { isIP } from "node:net";

const METADATA_HOSTS = new Set([
  "169.254.169.254",
  "metadata.google.internal"
]);

export function assertPublicHttpUrl(input: string, label = "URL"): string {
  let parsed: URL;
  try {
    parsed = new URL(input);
  } catch {
    throw new Error(`${label} must be a valid URL.`);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`${label} must use http or https.`);
  }
  if (isBlockedLocalHost(parsed.hostname)) {
    throw new Error(`${label} cannot target local or private network hosts.`);
  }
  return parsed.toString();
}

export function isPublicHttpUrl(input: string): boolean {
  try {
    assertPublicHttpUrl(input);
    return true;
  } catch {
    return false;
  }
}

function isBlockedLocalHost(hostname: string): boolean {
  const host = stripIpv6Brackets(hostname).toLowerCase();
  if (!host || METADATA_HOSTS.has(host) || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) {
    return true;
  }

  const ipVersion = isIP(host);
  if (ipVersion === 4) {
    return isBlockedIpv4(host);
  }
  if (ipVersion === 6) {
    return isBlockedIpv6(host);
  }
  return false;
}

function stripIpv6Brackets(hostname: string): string {
  const trimmed = hostname.trim();
  return trimmed.startsWith("[") && trimmed.endsWith("]") ? trimmed.slice(1, -1) : trimmed;
}

function isBlockedIpv4(host: string): boolean {
  const parts = host.split(".").map((part) => Number.parseInt(part, 10));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return true;
  }
  const [a, b] = parts as [number, number, number, number];
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

function isBlockedIpv6(host: string): boolean {
  if (host === "::" || host === "::1") {
    return true;
  }
  const first = host.split(":").find((segment) => segment.length > 0);
  if (!first) {
    return true;
  }
  const value = Number.parseInt(first, 16);
  if (!Number.isFinite(value)) {
    return true;
  }
  return (value & 0xfe00) === 0xfc00 || (value & 0xffc0) === 0xfe80 || (value & 0xff00) === 0xff00;
}
