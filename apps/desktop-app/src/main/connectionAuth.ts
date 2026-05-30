import { randomBytes, timingSafeEqual } from "node:crypto";
import { isLoopbackHost } from "@immersive-subs/contracts";
import type { NetworkEndpoint } from "./types.js";

const TOKEN_BYTES = 32;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{32,}$/;
const EXTENSION_ORIGIN_PATTERN = /^(?:chrome|moz)-extension:\/\/[a-z0-9-]+$/i;

export interface DesktopClientAuthInput {
  origin: string | string[] | undefined;
  requestUrl: string | undefined;
}

export interface DesktopClientAuthContext {
  endpoint: NetworkEndpoint;
  authToken: string;
}

export function createConnectionAuthToken(): string {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

export function sanitizeConnectionAuthToken(value: unknown): string {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (isConnectionAuthToken(trimmed)) {
      return trimmed;
    }
  }
  return createConnectionAuthToken();
}

export function isConnectionAuthToken(value: unknown): value is string {
  return typeof value === "string" && TOKEN_PATTERN.test(value);
}

export function isTrustedExtensionOrigin(origin: string | string[] | undefined): boolean {
  const value = Array.isArray(origin) ? origin[0] : origin;
  return typeof value === "string" && EXTENSION_ORIGIN_PATTERN.test(value.trim());
}

export function isAuthorizedDesktopClient(
  request: DesktopClientAuthInput,
  context: DesktopClientAuthContext
): boolean {
  if (!isTrustedExtensionOrigin(request.origin)) {
    return false;
  }
  if (isLoopbackHost(context.endpoint.host)) {
    return true;
  }
  return hasExpectedToken(extractToken(request.requestUrl), context.authToken);
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
