const REDACTED_VALUE = "REDACTED";
const SENSITIVE_QUERY_KEYS = new Set([
  "api_key",
  "apikey",
  "access_token",
  "auth_token",
  "token"
]);

export function redactUrlSecrets(value: string): string {
  try {
    const url = new URL(value);
    let changed = false;
    url.searchParams.forEach((_paramValue, key) => {
      if (SENSITIVE_QUERY_KEYS.has(key.toLowerCase())) {
        url.searchParams.set(key, REDACTED_VALUE);
        changed = true;
      }
    });
    return changed ? url.toString() : value;
  } catch {
    return value.replace(
      /([?&](?:api_key|apikey|access_token|auth_token|token)=)[^&#]*/gi,
      `$1${REDACTED_VALUE}`
    );
  }
}
