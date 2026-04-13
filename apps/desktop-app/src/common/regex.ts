export function normalizeRegexPattern(pattern: string | null | undefined): string | null {
  if (typeof pattern !== "string") {
    return null;
  }
  const normalized = pattern.trim();
  if (!normalized.length) {
    return null;
  }
  try {
    new RegExp(normalized);
    return normalized;
  } catch {
    return null;
  }
}

export function isValidRegex(pattern: string | null | undefined): boolean {
  return normalizeRegexPattern(pattern) !== null;
}
