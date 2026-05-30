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

export function assertRequiredKeys(
  source: Record<string, unknown>,
  requiredKeys: readonly string[],
  context: string
): void {
  for (const key of requiredKeys) {
    if (!Object.prototype.hasOwnProperty.call(source, key)) {
      throw new Error(`${context} is missing current setting: ${key}`);
    }
  }
}
