export function normalizeEndpoint(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!/^wss?:\/\//i.test(trimmed)) {
    if (/^[a-z0-9.-]+(:\d+)?$/i.test(trimmed)) {
      return `ws://${trimmed}`;
    }
    return null;
  }
  return trimmed;
}

export function normalizeEndpointList(list) {
  const endpoints = [];
  const seen = new Set();
  (Array.isArray(list) ? list : []).forEach((entry) => {
    const normalized = normalizeEndpoint(entry);
    if (!normalized || seen.has(normalized)) {
      return;
    }
    seen.add(normalized);
    endpoints.push(normalized);
  });
  return endpoints;
}
