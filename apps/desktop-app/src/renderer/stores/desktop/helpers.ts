import { toRaw } from "vue";

export function createId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

export function toPlain<T>(value: T): T {
  const rawValue = toRaw(value) as unknown as T;
  if (rawValue === null || typeof rawValue !== "object") {
    return rawValue;
  }
  if (Array.isArray(rawValue)) {
    return rawValue.map((entry) => toPlain(entry)) as unknown as T;
  }
  const result: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(rawValue as Record<string, unknown>)) {
    result[key] = toPlain(entry);
  }
  return result as T;
}
