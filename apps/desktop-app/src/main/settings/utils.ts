import { randomUUID } from "crypto";

export function clampPort(value: number, fallback = 44501): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  const normalized = Math.round(value);
  if (normalized < 1 || normalized > 65535) {
    return fallback;
  }
  return normalized;
}

export function normalizeColor(value: unknown, fallback: string): string {
  if (typeof value !== "string") {
    return fallback;
  }
  const trimmed = value.trim();
  return trimmed.length ? trimmed : fallback;
}

export function sanitizePriorityList(value: unknown): string[] {
  if (!value) {
    return [];
  }
  const items = Array.isArray(value) ? value : [value];
  return items
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item): item is string => Boolean(item.length));
}

export function sanitizeProcessList(value: unknown): string[] {
  if (!value) {
    return [];
  }
  const items = Array.isArray(value) ? value : [value];
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const item of items) {
    if (typeof item !== "string") {
      continue;
    }
    const trimmed = item.trim();
    if (!trimmed.length) {
      continue;
    }
    const lowercase = trimmed.toLowerCase();
    if (seen.has(lowercase)) {
      continue;
    }
    seen.add(lowercase);
    normalized.push(trimmed);
  }
  return normalized;
}

export function ensureUniqueId(preferredId: string | undefined, used: Set<string>, prefix: string): string {
  const base = preferredId && preferredId.trim().length ? preferredId.trim() : `${prefix}-${randomUUID()}`;
  let candidate = base;
  let counter = 1;
  while (used.has(candidate)) {
    candidate = `${base}-${counter++}`;
  }
  used.add(candidate);
  return candidate;
}

export function assertNoUnknownKeys(
  source: Record<string, unknown>,
  allowedKeys: readonly string[],
  context: string
): void {
  const allowed = new Set(allowedKeys);
  for (const key of Object.keys(source)) {
    if (!allowed.has(key)) {
      throw new Error(`${context} contains unknown setting: ${key}`);
    }
  }
}
