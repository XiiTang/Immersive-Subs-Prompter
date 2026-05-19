import { randomBytes, timingSafeEqual } from "node:crypto";
import type { NetworkSettings } from "./types.js";

const TOKEN_BYTES = 32;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{32,}$/;
const EXTENSION_ORIGIN_PATTERN = /^(?:chrome|moz)-extension:\/\/[a-z0-9-]+$/i;
const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);

export interface DesktopClientAuthInput {
  origin: string | string[] | undefined;
  requestUrl: string | undefined;
}

export function createConnectionAuthToken(): string {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

export function sanitizeConnectionAuthToken(value: unknown): string {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (TOKEN_PATTERN.test(trimmed)) {
      return trimmed;
    }
  }
  return createConnectionAuthToken();
}

export function isLoopbackHost(host: string): boolean {
  return LOOPBACK_HOSTS.has(host.trim().toLowerCase());
}

export function isTrustedExtensionOrigin(origin: string | string[] | undefined): boolean {
  const value = Array.isArray(origin) ? origin[0] : origin;
  return typeof value === "string" && EXTENSION_ORIGIN_PATTERN.test(value.trim());
}

export function isAuthorizedDesktopClient(
  request: DesktopClientAuthInput,
  network: NetworkSettings
): boolean {
  if (!isTrustedExtensionOrigin(request.origin)) {
    return false;
  }
  if (isLoopbackHost(network.host)) {
    return true;
  }
  return hasExpectedToken(extractToken(request.requestUrl), network.authToken);
}

export function buildAuthenticatedEndpoint(network: NetworkSettings): string {
  const host = network.host.includes(":") && !network.host.startsWith("[")
    ? `[${network.host}]`
    : network.host;
  const url = new URL(`ws://${host}:${network.port}/`);
  url.searchParams.set("token", network.authToken);
  return url.toString();
}

function extractToken(requestUrl: string | undefined): string | null {
  try {
    const url = new URL(requestUrl ?? "/", "ws://desktop.local");
    return url.searchParams.get("token");
  } catch {
    return null;
  }
}

function hasExpectedToken(actual: string | null, expected: string): boolean {
  if (!actual || !expected) {
    return false;
  }
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}
