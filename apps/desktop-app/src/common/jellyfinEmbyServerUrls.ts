export interface ParsedJellyfinEmbyServerUrl {
  input: string;
  origin: string;
  baseUrl: string;
}

export function parseJellyfinEmbyServerUrls(
  input: string,
  context = "Jellyfin / Emby server URLs"
): ParsedJellyfinEmbyServerUrl[] {
  if (typeof input !== "string") {
    throw new Error(`${context} must use the current string setting`);
  }

  return input
    .split(",")
    .map((entry) => entry.trim())
    .map((entry, index) => ({ entry, index }))
    .filter(({ entry }) => entry.length > 0)
    .map(({ entry, index }) => normalizeJellyfinEmbyServerUrlEntry(entry, index, context));
}

export function isValidJellyfinEmbyServerUrls(input: string): boolean {
  try {
    parseJellyfinEmbyServerUrls(input);
    return true;
  } catch {
    return false;
  }
}

function normalizeJellyfinEmbyServerUrlEntry(
  input: string,
  index: number,
  context: string
): ParsedJellyfinEmbyServerUrl {
  let parsed: URL;
  try {
    parsed = new URL(input);
  } catch {
    throw new Error(`${context} entry ${index + 1} must be a valid HTTP(S) URL`);
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`${context} entry ${index + 1} must be a valid HTTP(S) URL`);
  }

  return {
    input,
    origin: parsed.origin,
    baseUrl: parsed.origin
  };
}
