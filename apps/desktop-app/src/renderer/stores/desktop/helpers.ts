import { toRaw } from "vue";

export function createId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${(crypto as Crypto).randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

export function mergePartial<T>(target: T | null, patch: Partial<T>): T {
  const base: any = Array.isArray(target) ? [...(target as any)] : { ...(target as any) };
  for (const [key, value] of Object.entries(patch)) {
    const current = (target as any)?.[key];
    if (Array.isArray(value)) {
      base[key] = [...value];
    } else if (value && typeof value === "object") {
      base[key] = mergePartial(current ?? (Array.isArray(value) ? [] : {}), value as any);
    } else if (value !== undefined) {
      base[key] = value;
    }
  }
  return base as T;
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
