# Multiple Network Endpoints Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the desktop app listen on multiple explicit WebSocket endpoints such as `127.0.0.1:44501` and `192.168.1.2:44501` without relying on `0.0.0.0`.

**Architecture:** Replace the single `network.host` and `network.port` model with `network.endpoints[]` plus one shared auth token. Keep endpoint parsing and URL formatting in a shared utility, run one `WebSocketServer` per endpoint, and expose listener status to the settings UI. The settings UI shows saved endpoints as read-only URL pills and uses a trailing draft pill to add structured `{ id, host, port }` records.

**Tech Stack:** Electron main process, Vue 3, Pinia, TypeScript, `ws`, Vitest main/jsdom/browser projects, existing desktop settings primitives.

---

## Source Documents

- Spec: `docs/superpowers/specs/2026-05-23-multiple-network-endpoints-design.md`
- Existing single-listener runtime: `apps/desktop-app/src/main/connectionManager.ts`
- Existing auth helper: `apps/desktop-app/src/main/connectionAuth.ts`
- Existing settings UI: `apps/desktop-app/src/renderer/components/settings/SettingsGlobal.vue`
- Existing pill UI reference: `apps/desktop-app/src/renderer/components/settings/profiles/PriorityEditor.vue`

## Execution Constraints

- Do not add compatibility, migration, or legacy read support for `network.host` and `network.port`.
- Do not preserve old settings JSON shapes.
- Do not implement automatic network interface discovery.
- Do not implement per-endpoint auth tokens.
- Do not change browser extension connection semantics beyond documentation updates.
- Keep each task committed before starting the next task.

## Final File Structure

Shared endpoint parsing and formatting:

- Create: `apps/desktop-app/src/common/networkEndpoints.ts`
- Create: `apps/desktop-app/src/main/networkEndpoints.test.ts`

Settings model and validation:

- Modify: `apps/desktop-app/src/main/types.ts`
- Modify: `apps/desktop-app/src/main/default-settings.json`
- Modify: `apps/desktop-app/src/main/settings/constants.ts`
- Modify: `apps/desktop-app/src/main/settings/sanitizers/networkSanitizer.ts`
- Create: `apps/desktop-app/src/main/settings/sanitizers/networkSanitizer.test.ts`
- Modify: `apps/desktop-app/src/main/settings/SettingsStore.ts`
- Modify: `apps/desktop-app/src/main/settings/SettingsStore.test.ts`
- Modify: `apps/desktop-app/src/main/settings/appSettingsSanitizer.test.ts`

Auth and listener runtime:

- Modify: `apps/desktop-app/src/main/connectionAuth.ts`
- Modify: `apps/desktop-app/src/main/connectionAuth.test.ts`
- Modify: `apps/desktop-app/src/main/connectionManager.ts`
- Create: `apps/desktop-app/src/main/connectionManager.test.ts`
- Modify: `apps/desktop-app/src/main/stateManager.ts`
- Modify: `apps/desktop-app/src/main/stateManager.test.ts`
- Modify: `apps/desktop-app/src/main/window/windowController.ts`

Renderer store and settings UI:

- Modify: `apps/desktop-app/src/renderer/stores/desktop/actions/settingsActions.ts`
- Modify: `apps/desktop-app/src/renderer/stores/desktop.test.ts`
- Create: `apps/desktop-app/src/renderer/components/settings/NetworkEndpointEditor.vue`
- Modify: `apps/desktop-app/src/renderer/components/settings/SettingsGlobal.vue`
- Modify: `apps/desktop-app/src/renderer/components/settings/SettingsGlobal.test.ts`
- Modify: `apps/desktop-app/src/renderer/components/settings/SettingsWindowShell.test.ts`
- Modify: `apps/desktop-app/src/renderer/components/settings/SettingsWindowShell.browser.test.ts`
- Modify: `apps/desktop-app/src/renderer/components/settings/SettingsMediaServer.test.ts`
- Modify: `apps/desktop-app/src/renderer/components/settings/SettingsPlugins.test.ts`
- Modify: `apps/desktop-app/src/renderer/components/settings/SettingsProfiles.browser.test.ts`
- Modify: `apps/desktop-app/src/renderer/components/subtitle/SubtitleView.browser.test.ts`
- Modify: `apps/desktop-app/src/renderer/locales/en.json`
- Modify: `apps/desktop-app/src/renderer/locales/zh.json`
- Modify: `apps/desktop-app/src/renderer/style.css`

Documentation:

- Modify: `README.md`

---

### Task 1: Add Shared Endpoint Parsing And URL Formatting

**Files:**
- Create: `apps/desktop-app/src/common/networkEndpoints.ts`
- Create: `apps/desktop-app/src/main/networkEndpoints.test.ts`

- [ ] **Step 1: Write failing endpoint utility tests**

Create `apps/desktop-app/src/main/networkEndpoints.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  buildNetworkEndpointUrl,
  formatNetworkEndpointInput,
  isLoopbackHost,
  networkEndpointKey,
  parseNetworkEndpointInput
} from "../common/networkEndpoints.js";

describe("network endpoint utilities", () => {
  it("parses host:port inputs", () => {
    expect(parseNetworkEndpointInput("127.0.0.1:44501")).toEqual({
      ok: true,
      endpoint: { host: "127.0.0.1", port: 44501 }
    });
    expect(parseNetworkEndpointInput("192.168.1.2:44502")).toEqual({
      ok: true,
      endpoint: { host: "192.168.1.2", port: 44502 }
    });
    expect(parseNetworkEndpointInput("[::1]:44501")).toEqual({
      ok: true,
      endpoint: { host: "::1", port: 44501 }
    });
  });

  it("parses ws URLs without persisting token or path details", () => {
    expect(parseNetworkEndpointInput("ws://192.168.1.2:44501/?token=abc")).toEqual({
      ok: true,
      endpoint: { host: "192.168.1.2", port: 44501 }
    });
  });

  it("rejects empty, non-ws, missing-port, and out-of-range inputs", () => {
    expect(parseNetworkEndpointInput("")).toEqual({ ok: false, error: "Endpoint is empty" });
    expect(parseNetworkEndpointInput("https://192.168.1.2:44501")).toEqual({
      ok: false,
      error: "Endpoint must use ws:// when a protocol is included"
    });
    expect(parseNetworkEndpointInput("192.168.1.2")).toEqual({
      ok: false,
      error: "Endpoint must include a host and port"
    });
    expect(parseNetworkEndpointInput("192.168.1.2:70000")).toEqual({
      ok: false,
      error: "Port must be between 1 and 65535"
    });
  });

  it("normalizes keys and editing values", () => {
    expect(networkEndpointKey({ host: " [::1] ", port: 44501 })).toBe("::1:44501");
    expect(formatNetworkEndpointInput({ id: "a", host: "::1", port: 44501 })).toBe("[::1]:44501");
    expect(formatNetworkEndpointInput({ id: "b", host: "127.0.0.1", port: 44501 })).toBe("127.0.0.1:44501");
  });

  it("builds extension URLs with tokens only for non-loopback hosts", () => {
    expect(isLoopbackHost("127.0.0.1")).toBe(true);
    expect(isLoopbackHost("::1")).toBe(true);
    expect(isLoopbackHost("192.168.1.2")).toBe(false);
    expect(buildNetworkEndpointUrl({ host: "127.0.0.1", port: 44501 }, "secret")).toBe("ws://127.0.0.1:44501/");
    expect(buildNetworkEndpointUrl({ host: "192.168.1.2", port: 44501 }, "secret")).toBe(
      "ws://192.168.1.2:44501/?token=secret"
    );
    expect(buildNetworkEndpointUrl({ host: "::1", port: 44501 }, "secret")).toBe("ws://[::1]:44501/");
  });
});
```

- [ ] **Step 2: Run utility tests and verify they fail**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app test:renderer -- src/main/networkEndpoints.test.ts
```

Expected: FAIL because `../common/networkEndpoints.js` does not exist.

- [ ] **Step 3: Implement the shared endpoint utility**

Create `apps/desktop-app/src/common/networkEndpoints.ts`:

```ts
export interface NetworkEndpointValue {
  id?: string;
  host: string;
  port: number;
}

export type NetworkEndpointParseResult =
  | { ok: true; endpoint: { host: string; port: number } }
  | { ok: false; error: string };

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "::1"]);

export function stripIpv6Brackets(host: string): string {
  const trimmed = host.trim();
  return trimmed.startsWith("[") && trimmed.endsWith("]") ? trimmed.slice(1, -1) : trimmed;
}

export function isLoopbackHost(host: string): boolean {
  return LOOPBACK_HOSTS.has(stripIpv6Brackets(host).toLowerCase());
}

export function formatHostForUrl(host: string): string {
  const normalized = stripIpv6Brackets(host);
  return normalized.includes(":") ? `[${normalized}]` : normalized;
}

export function formatNetworkEndpointInput(endpoint: NetworkEndpointValue): string {
  return `${formatHostForUrl(endpoint.host)}:${endpoint.port}`;
}

export function networkEndpointKey(endpoint: Pick<NetworkEndpointValue, "host" | "port">): string {
  return `${stripIpv6Brackets(endpoint.host).trim().toLowerCase()}:${endpoint.port}`;
}

export function buildNetworkEndpointUrl(endpoint: Pick<NetworkEndpointValue, "host" | "port">, authToken: string): string {
  const url = new URL(`ws://${formatHostForUrl(endpoint.host)}:${endpoint.port}/`);
  if (!isLoopbackHost(endpoint.host) && authToken) {
    url.searchParams.set("token", authToken);
  }
  return url.toString();
}

export function parseNetworkEndpointInput(value: unknown): NetworkEndpointParseResult {
  if (typeof value !== "string") {
    return { ok: false, error: "Endpoint must be text" };
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return { ok: false, error: "Endpoint is empty" };
  }

  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) {
    return parseEndpointUrl(trimmed);
  }

  return parseHostPort(trimmed);
}

function parseEndpointUrl(value: string): NetworkEndpointParseResult {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return { ok: false, error: "Endpoint URL is invalid" };
  }

  if (url.protocol !== "ws:") {
    return { ok: false, error: "Endpoint must use ws:// when a protocol is included" };
  }

  if (!url.hostname || !url.port) {
    return { ok: false, error: "Endpoint must include a host and port" };
  }

  return validateHostPort(stripIpv6Brackets(url.hostname), Number(url.port));
}

function parseHostPort(value: string): NetworkEndpointParseResult {
  const ipv6Match = value.match(/^\[([^\]]+)\]:(\d+)$/);
  if (ipv6Match) {
    return validateHostPort(ipv6Match[1] ?? "", Number(ipv6Match[2]));
  }

  const separator = value.lastIndexOf(":");
  if (separator <= 0 || separator === value.length - 1) {
    return { ok: false, error: "Endpoint must include a host and port" };
  }

  const host = value.slice(0, separator);
  const port = Number(value.slice(separator + 1));
  return validateHostPort(host, port);
}

function validateHostPort(host: string, port: number): NetworkEndpointParseResult {
  const normalizedHost = stripIpv6Brackets(host).trim();
  if (!normalizedHost) {
    return { ok: false, error: "Host is empty" };
  }
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return { ok: false, error: "Port must be between 1 and 65535" };
  }
  return { ok: true, endpoint: { host: normalizedHost, port } };
}
```

- [ ] **Step 4: Run utility tests and verify they pass**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app test:renderer -- src/main/networkEndpoints.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit endpoint utility**

```bash
git add apps/desktop-app/src/common/networkEndpoints.ts apps/desktop-app/src/main/networkEndpoints.test.ts
git commit -m "feat: add network endpoint utilities"
```

---

### Task 2: Replace Network Settings With Endpoint Lists

**Files:**
- Modify: `apps/desktop-app/src/main/types.ts`
- Modify: `apps/desktop-app/src/main/default-settings.json`
- Modify: `apps/desktop-app/src/main/settings/constants.ts`
- Modify: `apps/desktop-app/src/main/settings/sanitizers/networkSanitizer.ts`
- Create: `apps/desktop-app/src/main/settings/sanitizers/networkSanitizer.test.ts`
- Modify: `apps/desktop-app/src/main/settings/SettingsStore.ts`
- Modify: `apps/desktop-app/src/main/settings/SettingsStore.test.ts`
- Modify: `apps/desktop-app/src/main/settings/appSettingsSanitizer.test.ts`

- [ ] **Step 1: Write failing network sanitizer tests**

Create `apps/desktop-app/src/main/settings/sanitizers/networkSanitizer.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { DEFAULT_NETWORK_SETTINGS } from "../constants.js";
import {
  sanitizeNetworkSettings,
  validateNetworkSettingsForUpdate
} from "./networkSanitizer.js";

describe("networkSanitizer", () => {
  it("keeps valid endpoint lists", () => {
    const result = sanitizeNetworkSettings({
      endpoints: [
        { id: "loopback", host: "127.0.0.1", port: 44501 },
        { id: "lan", host: "192.168.1.2", port: 44502 }
      ],
      authToken: "0123456789abcdef0123456789abcdef"
    });

    expect(result.endpoints).toEqual([
      { id: "loopback", host: "127.0.0.1", port: 44501 },
      { id: "lan", host: "192.168.1.2", port: 44502 }
    ]);
    expect(result.authToken).toBe("0123456789abcdef0123456789abcdef");
  });

  it("falls back to defaults when stored endpoints are missing or invalid", () => {
    expect(sanitizeNetworkSettings({ endpoints: [], authToken: "0123456789abcdef0123456789abcdef" })).toEqual(
      DEFAULT_NETWORK_SETTINGS
    );
    expect(
      sanitizeNetworkSettings({
        endpoints: [{ id: "bad", host: "127.0.0.1", port: 70000 }],
        authToken: "0123456789abcdef0123456789abcdef"
      })
    ).toEqual(DEFAULT_NETWORK_SETTINGS);
  });

  it("rejects invalid update payloads instead of returning defaults", () => {
    expect(() => validateNetworkSettingsForUpdate({ endpoints: [], authToken: "0123456789abcdef0123456789abcdef" })).toThrow(
      "At least one network endpoint is required"
    );
    expect(() =>
      validateNetworkSettingsForUpdate({
        endpoints: [
          { id: "a", host: "127.0.0.1", port: 44501 },
          { id: "b", host: "127.0.0.1", port: 44501 }
        ],
        authToken: "0123456789abcdef0123456789abcdef"
      })
    ).toThrow("Duplicate network endpoint: 127.0.0.1:44501");
  });
});
```

- [ ] **Step 2: Update SettingsStore tests for endpoint defaults and rejected updates**

Modify `apps/desktop-app/src/main/settings/SettingsStore.test.ts`:

```ts
it("initializes with endpoint defaults when no file exists", async () => {
  const store = await loadStore();
  const settings = store.get();
  expect(settings.profiles.length).toBeGreaterThan(0);
  expect(settings.defaultProfileId).toBe(settings.profiles.at(-1)?.id);
  expect(settings.network.endpoints).toEqual([
    { id: "default", host: "127.0.0.1", port: 44501 }
  ]);
  expect(settings.network.authToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
});

it("preserves current network settings when an update contains invalid endpoints", async () => {
  const store = await loadStore();
  const currentNetwork = store.get().network;

  expect(() =>
    store.update({
      network: {
        ...currentNetwork,
        endpoints: []
      }
    })
  ).toThrow("At least one network endpoint is required");

  expect(store.get().network).toEqual(currentNetwork);
});
```

Replace the old `settings.network.host` assertion in the existing defaults test with the endpoint assertion above.

- [ ] **Step 3: Run settings tests and verify they fail**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app test:renderer -- src/main/settings/sanitizers/networkSanitizer.test.ts src/main/settings/SettingsStore.test.ts
```

Expected: FAIL because `NetworkSettings` still has `host` and `port`, and `validateNetworkSettingsForUpdate` does not exist.

- [ ] **Step 4: Update settings types and defaults**

Modify `apps/desktop-app/src/main/types.ts`:

```ts
export interface NetworkEndpoint {
  id: string;
  host: string;
  port: number;
}

export interface NetworkListenerStatus {
  endpointId: string;
  host: string;
  port: number;
  status: "listening" | "error";
  error: string | null;
}

export interface NetworkSettings {
  endpoints: NetworkEndpoint[];
  authToken: string;
}
```

In `DesktopState`, add:

```ts
networkListeners: NetworkListenerStatus[];
```

Modify `apps/desktop-app/src/main/default-settings.json`:

```json
"network": {
  "endpoints": [
    {
      "id": "default",
      "host": "127.0.0.1",
      "port": 44501
    }
  ],
  "authToken": ""
}
```

Modify `apps/desktop-app/src/main/settings/constants.ts`:

```ts
export const DEFAULT_WS_ENDPOINT_ID = "default";
export const DEFAULT_WS_HOST = (process.env.USP_WS_HOST ?? "127.0.0.1").trim() || "127.0.0.1";
export const DEFAULT_WS_PORT = clampPort(Number(process.env.USP_WS_PORT ?? 44501));

export const DEFAULT_NETWORK_SETTINGS: NetworkSettings = {
  endpoints: [
    {
      id: DEFAULT_WS_ENDPOINT_ID,
      host: DEFAULT_WS_HOST,
      port: DEFAULT_WS_PORT
    }
  ],
  authToken: createConnectionAuthToken()
};
```

- [ ] **Step 5: Implement strict network sanitization and update validation**

Modify `apps/desktop-app/src/main/settings/sanitizers/networkSanitizer.ts`:

```ts
import { networkEndpointKey, stripIpv6Brackets } from "../../../common/networkEndpoints.js";
import type { NetworkEndpoint, NetworkSettings } from "../../types.js";
import { DEFAULT_NETWORK_SETTINGS } from "../constants.js";
import { sanitizeConnectionAuthToken } from "../../connectionAuth.js";

export class NetworkSettingsValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NetworkSettingsValidationError";
  }
}

export function sanitizeNetworkSettings(input: Partial<NetworkSettings> | null | undefined): NetworkSettings {
  try {
    return normalizeNetworkSettings(input, { throwOnInvalid: false });
  } catch {
    return cloneDefaultNetworkSettings();
  }
}

export function validateNetworkSettingsForUpdate(input: Partial<NetworkSettings> | null | undefined): NetworkSettings {
  return normalizeNetworkSettings(input, { throwOnInvalid: true });
}

function normalizeNetworkSettings(
  input: Partial<NetworkSettings> | null | undefined,
  options: { throwOnInvalid: boolean }
): NetworkSettings {
  const source = input ?? {};
  const endpoints = normalizeEndpoints(source.endpoints, options);
  const authToken = sanitizeConnectionAuthToken(source.authToken);
  return { endpoints, authToken };
}

function normalizeEndpoints(value: unknown, options: { throwOnInvalid: boolean }): NetworkEndpoint[] {
  if (!Array.isArray(value) || value.length === 0) {
    return invalid("At least one network endpoint is required", options);
  }

  const seen = new Set<string>();
  const endpoints: NetworkEndpoint[] = [];

  for (const entry of value) {
    if (!entry || typeof entry !== "object") {
      return invalid("Network endpoint must be an object", options);
    }

    const candidate = entry as Partial<NetworkEndpoint>;
    const id = typeof candidate.id === "string" && candidate.id.trim() ? candidate.id.trim() : "";
    const host = typeof candidate.host === "string" ? stripIpv6Brackets(candidate.host).trim() : "";
    const port = Number(candidate.port);

    if (!id) {
      return invalid("Network endpoint id is required", options);
    }
    if (!host) {
      return invalid("Network endpoint host is required", options);
    }
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      return invalid("Network endpoint port must be between 1 and 65535", options);
    }

    const normalized = { id, host, port };
    const key = networkEndpointKey(normalized);
    if (seen.has(key)) {
      return invalid(`Duplicate network endpoint: ${key}`, options);
    }
    seen.add(key);
    endpoints.push(normalized);
  }

  return endpoints;
}

function invalid(message: string, options: { throwOnInvalid: boolean }): never {
  if (options.throwOnInvalid) {
    throw new NetworkSettingsValidationError(message);
  }
  throw new Error(message);
}

function cloneDefaultNetworkSettings(): NetworkSettings {
  return {
    endpoints: DEFAULT_NETWORK_SETTINGS.endpoints.map((endpoint) => ({ ...endpoint })),
    authToken: DEFAULT_NETWORK_SETTINGS.authToken
  };
}
```

- [ ] **Step 6: Reject invalid network updates in SettingsStore before saving**

Modify `apps/desktop-app/src/main/settings/SettingsStore.ts`:

```ts
import { validateNetworkSettingsForUpdate } from "./sanitizers/networkSanitizer.js";
```

Update `update`:

```ts
update(partial: Partial<AppSettings>): AppSettings {
  const merged = mergeSettings(this.data, partial);
  if (partial.network) {
    merged.network = validateNetworkSettingsForUpdate(merged.network);
  }
  this.data = sanitizeSettings(merged);
  this.save();
  return this.data;
}
```

- [ ] **Step 7: Update remaining main-process tests that assert the old network shape**

Modify `apps/desktop-app/src/main/settings/appSettingsSanitizer.test.ts` by adding this test near the existing settings shape tests:

```ts
it("uses endpoint-list network settings", () => {
  const result = sanitizeSettings({});
  expect(result.network.endpoints).toEqual([
    { id: "default", host: "127.0.0.1", port: 44501 }
  ]);
  expect(Object.prototype.hasOwnProperty.call(result.network, "host")).toBe(false);
  expect(Object.prototype.hasOwnProperty.call(result.network, "port")).toBe(false);
});
```

- [ ] **Step 8: Run settings tests and verify they pass**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app test:renderer -- src/main/settings/sanitizers/networkSanitizer.test.ts src/main/settings/SettingsStore.test.ts src/main/settings/appSettingsSanitizer.test.ts
```

Expected: PASS.

- [ ] **Step 9: Commit endpoint settings model**

```bash
git add apps/desktop-app/src/main/types.ts apps/desktop-app/src/main/default-settings.json apps/desktop-app/src/main/settings/constants.ts apps/desktop-app/src/main/settings/sanitizers/networkSanitizer.ts apps/desktop-app/src/main/settings/sanitizers/networkSanitizer.test.ts apps/desktop-app/src/main/settings/SettingsStore.ts apps/desktop-app/src/main/settings/SettingsStore.test.ts apps/desktop-app/src/main/settings/appSettingsSanitizer.test.ts
git commit -m "feat: store network endpoints"
```

---

### Task 3: Update Desktop Connection Authentication For Per-Endpoint Checks

**Files:**
- Modify: `apps/desktop-app/src/main/connectionAuth.ts`
- Modify: `apps/desktop-app/src/main/connectionAuth.test.ts`

- [ ] **Step 1: Write failing auth tests for endpoint-based auth**

Modify `apps/desktop-app/src/main/connectionAuth.test.ts`:

```ts
import type { NetworkEndpoint } from "./types.js";

function makeEndpoint(overrides: Partial<NetworkEndpoint> = {}): NetworkEndpoint {
  return {
    id: "default",
    host: "127.0.0.1",
    port: 44501,
    ...overrides
  };
}

const authToken = "0123456789abcdef0123456789abcdef";
```

Replace network-shaped calls with endpoint-shaped calls:

```ts
expect(
  isAuthorizedDesktopClient(
    { origin: "chrome-extension://abcdefghijklmnop", requestUrl: "/" },
    { endpoint: makeEndpoint(), authToken }
  )
).toBe(true);

expect(
  isAuthorizedDesktopClient(
    { origin: "chrome-extension://abcdefghijklmnop", requestUrl: "/" },
    { endpoint: makeEndpoint({ host: "0.0.0.0" }), authToken }
  )
).toBe(false);

expect(
  isAuthorizedDesktopClient(
    {
      origin: "chrome-extension://abcdefghijklmnop",
      requestUrl: "/?token=0123456789abcdef0123456789abcdef"
    },
    { endpoint: makeEndpoint({ host: "192.168.1.2" }), authToken }
  )
).toBe(true);
```

Update the endpoint URL assertion:

```ts
expect(buildAuthenticatedEndpoint(makeEndpoint({ host: "192.168.1.2" }), authToken)).toBe(
  "ws://192.168.1.2:44501/?token=0123456789abcdef0123456789abcdef"
);
```

- [ ] **Step 2: Run auth tests and verify they fail**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app test:renderer -- src/main/connectionAuth.test.ts
```

Expected: FAIL because auth helpers still accept `NetworkSettings`.

- [ ] **Step 3: Implement endpoint-based auth context**

Modify `apps/desktop-app/src/main/connectionAuth.ts`:

```ts
import { buildNetworkEndpointUrl, isLoopbackHost } from "../common/networkEndpoints.js";
import type { NetworkEndpoint } from "./types.js";

export interface DesktopClientAuthContext {
  endpoint: NetworkEndpoint;
  authToken: string;
}
```

Update the auth function signature and host checks:

```ts
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
```

Update endpoint URL generation:

```ts
export function buildAuthenticatedEndpoint(endpoint: NetworkEndpoint, authToken: string): string {
  return buildNetworkEndpointUrl(endpoint, authToken);
}
```

Keep `createConnectionAuthToken`, `sanitizeConnectionAuthToken`, `isTrustedExtensionOrigin`, `extractToken`, and `hasExpectedToken` in this file.

- [ ] **Step 4: Run auth tests and verify they pass**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app test:renderer -- src/main/connectionAuth.test.ts src/main/networkEndpoints.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit endpoint auth**

```bash
git add apps/desktop-app/src/main/connectionAuth.ts apps/desktop-app/src/main/connectionAuth.test.ts
git commit -m "feat: authenticate per network endpoint"
```

---

### Task 4: Run One WebSocket Listener Per Endpoint

**Files:**
- Modify: `apps/desktop-app/src/main/connectionManager.ts`
- Create: `apps/desktop-app/src/main/connectionManager.test.ts`
- Modify: `apps/desktop-app/src/main/stateManager.ts`
- Modify: `apps/desktop-app/src/main/stateManager.test.ts`
- Modify: `apps/desktop-app/src/main/window/windowController.ts`

- [ ] **Step 1: Add network listener state tests**

Modify `apps/desktop-app/src/main/stateManager.test.ts`:

```ts
it("tracks network listener statuses", () => {
  const settings = makeSettings();
  const manager = new StateManager(new AppEventBus(), () => settings);

  manager.setNetworkListenerStatuses([
    {
      endpointId: "default",
      host: "127.0.0.1",
      port: 44501,
      status: "listening",
      error: null
    },
    {
      endpointId: "lan",
      host: "192.168.1.2",
      port: 44501,
      status: "error",
      error: "listen EADDRNOTAVAIL"
    }
  ]);

  expect(manager.getState().networkListeners).toEqual([
    {
      endpointId: "default",
      host: "127.0.0.1",
      port: 44501,
      status: "listening",
      error: null
    },
    {
      endpointId: "lan",
      host: "192.168.1.2",
      port: 44501,
      status: "error",
      error: "listen EADDRNOTAVAIL"
    }
  ]);
});
```

- [ ] **Step 2: Add connection manager multi-listener tests**

Create `apps/desktop-app/src/main/connectionManager.test.ts`:

```ts
import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";
import { ConnectionManager } from "./connectionManager.js";
import { AppEventBus } from "./appEventBus.js";
import type { AppSettings, DesktopState, NetworkSettings } from "./types.js";

class FakeWebSocketServer extends EventEmitter {
  clients = new Set<any>();
  close = vi.fn(() => {
    this.emit("close");
  });
}

function createStateManager() {
  const state: Partial<DesktopState> = {
    connectionCount: 0,
    activeTabId: null,
    playback: { currentTime: 0, duration: null, playbackRate: 1, lastUpdate: null, loop: null },
    networkListeners: []
  };
  return {
    getState: () => state,
    setNetworkListenerStatuses: vi.fn((statuses) => {
      state.networkListeners = statuses;
    }),
    changeConnectionCount: vi.fn(),
    updateState: vi.fn(),
    setPageContext: vi.fn(),
    updatePlayback: vi.fn(),
    selectProfileForUrl: vi.fn(() => ({ profile: null, rule: null })),
    applyProfileSelection: vi.fn(),
    resetSubtitleState: vi.fn(),
    setSubtitleTracks: vi.fn(),
    applyPreferredTracksFromSettings: vi.fn()
  };
}

function makeSettings(network: NetworkSettings): AppSettings {
  return {
    global: {} as never,
    network,
    profiles: [],
    defaultProfileId: "",
    rules: [],
    plugins: {},
    cache: {} as never
  };
}

describe("ConnectionManager network listeners", () => {
  it("starts one WebSocket server per endpoint", () => {
    const network: NetworkSettings = {
      endpoints: [
        { id: "loopback", host: "127.0.0.1", port: 44501 },
        { id: "lan", host: "192.168.1.2", port: 44502 }
      ],
      authToken: "0123456789abcdef0123456789abcdef"
    };
    const stateManager = createStateManager();
    const created: Array<{ options: { host?: string; port?: number }; server: FakeWebSocketServer }> = [];

    const manager = new ConnectionManager({
      getNetworkSettings: () => network,
      getSettings: () => makeSettings(network),
      subtitleService: {} as never,
      stateManager: stateManager as never,
      bus: new AppEventBus(),
      createWebSocketServer: (options) => {
        const server = new FakeWebSocketServer();
        created.push({ options, server });
        return server as never;
      }
    });

    manager.start();

    expect(created.map((entry) => ({ host: entry.options.host, port: entry.options.port }))).toEqual([
      { host: "127.0.0.1", port: 44501 },
      { host: "192.168.1.2", port: 44502 }
    ]);
    expect(stateManager.setNetworkListenerStatuses).toHaveBeenLastCalledWith([
      { endpointId: "loopback", host: "127.0.0.1", port: 44501, status: "listening", error: null },
      { endpointId: "lan", host: "192.168.1.2", port: 44502, status: "listening", error: null }
    ]);
  });

  it("keeps other listeners running when one endpoint fails to bind", () => {
    const network: NetworkSettings = {
      endpoints: [
        { id: "loopback", host: "127.0.0.1", port: 44501 },
        { id: "lan", host: "192.168.1.2", port: 44502 }
      ],
      authToken: "0123456789abcdef0123456789abcdef"
    };
    const stateManager = createStateManager();

    const manager = new ConnectionManager({
      getNetworkSettings: () => network,
      getSettings: () => makeSettings(network),
      subtitleService: {} as never,
      stateManager: stateManager as never,
      bus: new AppEventBus(),
      createWebSocketServer: (options) => {
        if (options.host === "192.168.1.2") {
          throw new Error("listen EADDRNOTAVAIL");
        }
        return new FakeWebSocketServer() as never;
      }
    });

    manager.start();

    expect(stateManager.setNetworkListenerStatuses).toHaveBeenLastCalledWith([
      { endpointId: "loopback", host: "127.0.0.1", port: 44501, status: "listening", error: null },
      { endpointId: "lan", host: "192.168.1.2", port: 44502, status: "error", error: "listen EADDRNOTAVAIL" }
    ]);
  });

  it("closes only removed endpoint listeners on settings update", () => {
    let network: NetworkSettings = {
      endpoints: [
        { id: "loopback", host: "127.0.0.1", port: 44501 },
        { id: "lan", host: "192.168.1.2", port: 44502 }
      ],
      authToken: "0123456789abcdef0123456789abcdef"
    };
    const created = new Map<string, FakeWebSocketServer>();

    const manager = new ConnectionManager({
      getNetworkSettings: () => network,
      getSettings: () => makeSettings(network),
      subtitleService: {} as never,
      stateManager: createStateManager() as never,
      bus: new AppEventBus(),
      createWebSocketServer: (options) => {
        const server = new FakeWebSocketServer();
        created.set(`${options.host}:${options.port}`, server);
        return server as never;
      }
    });

    manager.start();
    network = {
      ...network,
      endpoints: [{ id: "loopback", host: "127.0.0.1", port: 44501 }]
    };
    manager.applyNetworkSettings();

    expect(created.get("192.168.1.2:44502")?.close).toHaveBeenCalledTimes(1);
    expect(created.get("127.0.0.1:44501")?.close).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run listener tests and verify they fail**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app test:renderer -- src/main/stateManager.test.ts src/main/connectionManager.test.ts
```

Expected: FAIL because `networkListeners`, `setNetworkListenerStatuses`, and `createWebSocketServer` do not exist.

- [ ] **Step 4: Add listener status state to StateManager**

In `apps/desktop-app/src/main/stateManager.ts`, add `networkListeners` to the `createInitialState` state object immediately after `connectionCount`:

```ts
connectionCount: 0,
networkListeners: [],
activeTabId: null,
```

Add:

```ts
setNetworkListenerStatuses(statuses: DesktopState["networkListeners"]) {
  return this.updateState((draft) => {
    draft.networkListeners = statuses.map((status) => ({ ...status }));
  });
}
```

- [ ] **Step 5: Refactor ConnectionManager to diff endpoint listeners**

Modify `apps/desktop-app/src/main/connectionManager.ts` with these structural changes:

```ts
import type { WebSocketServerOptions } from "ws";
import { networkEndpointKey } from "../common/networkEndpoints.js";
import type { NetworkEndpoint, NetworkListenerStatus } from "./types.js";

type WebSocketServerFactory = (options: WebSocketServerOptions) => WebSocketServer;

type ListenerRecord = {
  endpoint: NetworkEndpoint;
  server: WebSocketServer | null;
  connectedClients: Set<WebSocket>;
  heartbeatInterval: NodeJS.Timeout | null;
  status: "listening" | "error";
  error: string | null;
};
```

Extend options:

```ts
type ConnectionManagerOptions = {
  getNetworkSettings: () => NetworkSettings;
  getSettings: () => AppSettings;
  subtitleService: SubtitleService;
  stateManager: StateManager;
  bus: AppEventBus;
  createWebSocketServer?: WebSocketServerFactory;
};
```

Replace single-server fields:

```ts
private readonly createWebSocketServer: WebSocketServerFactory;
private readonly listeners = new Map<string, ListenerRecord>();
private currentNetwork: NetworkSettings | null = null;
```

Initialize the factory in the constructor:

```ts
constructor(private readonly options: ConnectionManagerOptions) {
  this.createWebSocketServer =
    options.createWebSocketServer ?? ((serverOptions) => new WebSocketServer(serverOptions));
}
```

Implement endpoint diffing:

```ts
applyNetworkSettings(forceRestart = false) {
  const target = this.options.getNetworkSettings();
  if (!forceRestart && this.currentNetwork && this.isSameNetwork(target, this.currentNetwork)) {
    return;
  }

  const targetIds = new Set(target.endpoints.map((endpoint) => endpoint.id));
  for (const endpointId of Array.from(this.listeners.keys())) {
    if (forceRestart || !targetIds.has(endpointId)) {
      this.shutdownListener(endpointId);
    }
  }

  for (const endpoint of target.endpoints) {
    const current = this.listeners.get(endpoint.id);
    const shouldRestart =
      forceRestart ||
      !current ||
      networkEndpointKey(current.endpoint) !== networkEndpointKey(endpoint) ||
      this.currentNetwork?.authToken !== target.authToken;

    if (shouldRestart) {
      this.shutdownListener(endpoint.id);
      this.startListener(endpoint, target.authToken);
    }
  }

  this.currentNetwork = {
    endpoints: target.endpoints.map((endpoint) => ({ ...endpoint })),
    authToken: target.authToken
  };
  this.publishListenerStatuses();
}
```

Implement listener startup:

```ts
private startListener(endpoint: NetworkEndpoint, authToken: string) {
  const record: ListenerRecord = {
    endpoint: { ...endpoint },
    server: null,
    connectedClients: new Set(),
    heartbeatInterval: null,
    status: "listening",
    error: null
  };
  this.listeners.set(endpoint.id, record);

  try {
    record.server = this.bootstrapWebSocketServer(endpoint, authToken, record);
  } catch (error) {
    record.status = "error";
    record.error = error instanceof Error ? error.message : String(error);
  }
}
```

Update `bootstrapWebSocketServer` to accept `endpoint`, `authToken`, and `record`. Use `this.createWebSocketServer` instead of `new WebSocketServer`. Pass the endpoint-specific auth context:

```ts
const wss = this.createWebSocketServer({
  port: endpoint.port,
  host: endpoint.host,
  verifyClient: ({ req }, done) => {
    const authorized = this.isAuthorizedRequest(req, endpoint, authToken);
    done(authorized, authorized ? undefined : 401, authorized ? undefined : "Unauthorized");
  }
});
```

Inside `bootstrapWebSocketServer`, mark server runtime errors on the listener record:

```ts
wss.on("error", (error: Error) => {
  record.status = "error";
  record.error = error.message;
  this.log.error("WebSocket server error", error);
  this.publishListenerStatuses();
});
```

Update authorization:

```ts
private isAuthorizedRequest(req: IncomingMessage, endpoint: NetworkEndpoint, authToken: string): boolean {
  return isAuthorizedDesktopClient(
    {
      origin: req.headers.origin,
      requestUrl: req.url
    },
    { endpoint, authToken }
  );
}
```

Implement listener shutdown and status publishing:

```ts
private shutdownListener(endpointId: string) {
  const record = this.listeners.get(endpointId);
  if (!record) return;
  if (record.heartbeatInterval) {
    clearInterval(record.heartbeatInterval);
  }
  for (const client of record.connectedClients) {
    try {
      client.close();
    } catch (error) {
      this.log.warn("Failed to close WebSocket client during listener shutdown", error);
    }
  }
  record.server?.close();
  this.listeners.delete(endpointId);
}

private shutdownServer() {
  for (const endpointId of Array.from(this.listeners.keys())) {
    this.shutdownListener(endpointId);
  }
  this.currentNetwork = null;
  this.publishListenerStatuses();
}

private publishListenerStatuses() {
  const statuses: NetworkListenerStatus[] = Array.from(this.listeners.values()).map((record) => ({
    endpointId: record.endpoint.id,
    host: record.endpoint.host,
    port: record.endpoint.port,
    status: record.status,
    error: record.error
  }));
  this.options.stateManager.setNetworkListenerStatuses(statuses);
}
```

Update `isSameNetwork`:

```ts
private isSameNetwork(a: NetworkSettings, b: NetworkSettings): boolean {
  if (a.authToken !== b.authToken || a.endpoints.length !== b.endpoints.length) {
    return false;
  }
  return a.endpoints.every((endpoint, index) => {
    const other = b.endpoints[index];
    return !!other && endpoint.id === other.id && networkEndpointKey(endpoint) === networkEndpointKey(other);
  });
}
```

- [ ] **Step 6: Restart listeners when endpoint lists or auth token change**

Modify `apps/desktop-app/src/main/window/windowController.ts`:

```ts
import { networkEndpointKey } from "../../common/networkEndpoints.js";
```

Add a helper near `updateAppSettings`:

```ts
function areNetworkSettingsEqual(a: AppSettings["network"], b: AppSettings["network"]): boolean {
  if (a.authToken !== b.authToken || a.endpoints.length !== b.endpoints.length) {
    return false;
  }
  return a.endpoints.every((endpoint, index) => {
    const other = b.endpoints[index];
    return !!other && endpoint.id === other.id && networkEndpointKey(endpoint) === networkEndpointKey(other);
  });
}
```

Replace the old host/port comparison:

```ts
if (!areNetworkSettingsEqual(previousNetwork, appSettings.network)) {
  this.options.connectionManager.applyNetworkSettings();
}
```

- [ ] **Step 7: Run listener tests and verify they pass**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app test:renderer -- src/main/stateManager.test.ts src/main/connectionManager.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit multi-listener runtime**

```bash
git add apps/desktop-app/src/main/connectionManager.ts apps/desktop-app/src/main/connectionManager.test.ts apps/desktop-app/src/main/stateManager.ts apps/desktop-app/src/main/stateManager.test.ts apps/desktop-app/src/main/window/windowController.ts
git commit -m "feat: run websocket listeners per endpoint"
```

---

### Task 5: Add Renderer Store Rollback For Rejected Settings Updates

**Files:**
- Modify: `apps/desktop-app/src/renderer/stores/desktop/actions/settingsActions.ts`
- Modify: `apps/desktop-app/src/renderer/stores/desktop.test.ts`

- [ ] **Step 1: Add a failing optimistic rollback test**

Modify `apps/desktop-app/src/renderer/stores/desktop.test.ts`:

```ts
it("rolls back optimistic settings when updateSettings rejects", async () => {
  const store = useDesktopStore();
  const original = createSettings();
  store.settings = original;
  vi.stubGlobal("window", {
    usp: {
      updateSettings: vi.fn(async () => {
        throw new Error("At least one network endpoint is required");
      })
    }
  });

  await store.updateSettings({
    network: {
      ...original.network,
      endpoints: []
    }
  });

  expect(store.settings).toEqual(original);
});
```

Update `createSettings()` in this test file to use:

```ts
network: {
  endpoints: [{ id: "default", host: "127.0.0.1", port: 4312 }],
  authToken: "0123456789abcdef0123456789abcdef"
},
```

- [ ] **Step 2: Run the store test and verify it fails**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app test:renderer -- src/renderer/stores/desktop.test.ts
```

Expected: FAIL because `updateSettings` keeps the optimistic patch after IPC rejection.

- [ ] **Step 3: Implement rollback in settingsActions**

Modify `apps/desktop-app/src/renderer/stores/desktop/actions/settingsActions.ts`:

```ts
export async function updateSettings(this: DesktopStoreThis, partial: Partial<AppSettings>) {
  if (!this.settings) {
    return;
  }
  const previous = toPlain(this.settings);
  const payload = toPlain(partial);
  this.applySettingsPatch(payload);
  try {
    const next = await window.usp.updateSettings(payload);
    this.settings = next;
  } catch (error) {
    this.settings = previous;
    reportError(error, "settings.update");
  }
}
```

- [ ] **Step 4: Run the store test and verify it passes**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app test:renderer -- src/renderer/stores/desktop.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit settings rollback**

```bash
git add apps/desktop-app/src/renderer/stores/desktop/actions/settingsActions.ts apps/desktop-app/src/renderer/stores/desktop.test.ts
git commit -m "fix: roll back rejected settings updates"
```

---

### Task 6: Replace Network Fields With Endpoint Pill Editing

**Files:**
- Create: `apps/desktop-app/src/renderer/components/settings/NetworkEndpointEditor.vue`
- Modify: `apps/desktop-app/src/renderer/components/settings/SettingsGlobal.vue`
- Modify: `apps/desktop-app/src/renderer/components/settings/SettingsGlobal.test.ts`
- Modify: `apps/desktop-app/src/renderer/style.css`
- Modify: `apps/desktop-app/src/renderer/locales/en.json`
- Modify: `apps/desktop-app/src/renderer/locales/zh.json`

- [ ] **Step 1: Add failing SettingsGlobal tests for endpoint pills**

Modify `apps/desktop-app/src/renderer/components/settings/SettingsGlobal.test.ts`:

```ts
import { nextTick } from "vue";
import { vi } from "vitest";
```

Update `createSettings()` network:

```ts
network: {
  endpoints: [
    { id: "default", host: "127.0.0.1", port: 44501 },
    { id: "lan", host: "192.168.1.2", port: 44502 }
  ],
  authToken: "0123456789abcdef0123456789abcdef"
},
```

Add tests:

```ts
it("renders endpoint pills as extension URLs", () => {
  const store = useDesktopStore();
  store.settings = createSettings();

  const wrapper = mount(SettingsGlobal);

  expect(wrapper.text()).toContain("ws://127.0.0.1:44501/");
  expect(wrapper.text()).toContain("ws://192.168.1.2:44502/?token=0123456789abcdef0123456789abcdef");
  expect(wrapper.find("#network-host").exists()).toBe(false);
  expect(wrapper.find("#network-port").exists()).toBe(false);
});

it("adds a draft endpoint from host:port input", async () => {
  const store = useDesktopStore();
  store.settings = createSettings();
  const updateSpy = vi.spyOn(store, "updateNetworkSetting").mockImplementation((key, value) => {
    if (store.settings && key === "endpoints") {
      store.settings.network.endpoints = value as never;
    }
  });

  const wrapper = mount(SettingsGlobal);
  const input = wrapper.get<HTMLInputElement>('[data-testid="network-endpoint-draft-input"]');
  await input.setValue("192.168.1.3:44503");
  await input.trigger("keyup.enter");

  expect(updateSpy).toHaveBeenCalledWith("endpoints", [
    { id: "default", host: "127.0.0.1", port: 44501 },
    { id: "lan", host: "192.168.1.2", port: 44502 },
    expect.objectContaining({ host: "192.168.1.3", port: 44503 })
  ]);
});

it("keeps saved endpoint pills read-only", async () => {
  const store = useDesktopStore();
  store.settings = createSettings();
  const updateSpy = vi.spyOn(store, "updateNetworkSetting").mockImplementation(() => undefined);

  const wrapper = mount(SettingsGlobal);
  await wrapper.get('[data-testid="network-endpoint-display-default"]').trigger("click");
  await nextTick();

  expect(wrapper.find('[data-testid="network-endpoint-edit-default"]').exists()).toBe(false);
  expect(updateSpy).not.toHaveBeenCalled();
});

it("adds a draft endpoint on blur and displays its extension URL", async () => {
  const store = useDesktopStore();
  store.settings = createSettings();
  vi.spyOn(store, "updateNetworkSetting").mockImplementation((key, value) => {
    if (store.settings && key === "endpoints") {
      store.settings.network.endpoints = value as never;
    }
  });

  const wrapper = mount(SettingsGlobal);
  const input = wrapper.get<HTMLInputElement>('[data-testid="network-endpoint-draft-input"]');
  await input.setValue("192.168.1.3:44503");
  await input.trigger("blur");
  await nextTick();

  expect(input.element.value).toBe("");
  expect(wrapper.text()).toContain("ws://192.168.1.3:44503/?token=0123456789abcdef0123456789abcdef");
});

it("rejects duplicate endpoint input", async () => {
  const store = useDesktopStore();
  store.settings = createSettings();
  const updateSpy = vi.spyOn(store, "updateNetworkSetting").mockImplementation(() => undefined);

  const wrapper = mount(SettingsGlobal);
  const input = wrapper.get<HTMLInputElement>('[data-testid="network-endpoint-draft-input"]');
  await input.setValue("127.0.0.1:44501");
  await input.trigger("keyup.enter");

  expect(wrapper.text()).toContain("Endpoint already exists");
  expect(updateSpy).not.toHaveBeenCalled();
});

it("does not remove the final endpoint", async () => {
  const store = useDesktopStore();
  store.settings = {
    ...createSettings(),
    network: {
      endpoints: [{ id: "default", host: "127.0.0.1", port: 44501 }],
      authToken: "0123456789abcdef0123456789abcdef"
    }
  };
  const updateSpy = vi.spyOn(store, "updateNetworkSetting").mockImplementation(() => undefined);

  const wrapper = mount(SettingsGlobal);
  expect(wrapper.find('[data-testid="network-endpoint-remove-default"]').exists()).toBe(false);
  expect(updateSpy).not.toHaveBeenCalled();
});

it("shows listener errors from desktop state", () => {
  const store = useDesktopStore();
  store.settings = createSettings();
  store.desktopState = {
    networkListeners: [
      {
        endpointId: "lan",
        host: "192.168.1.2",
        port: 44502,
        status: "error",
        error: "listen EADDRNOTAVAIL"
      }
    ]
  } as never;

  const wrapper = mount(SettingsGlobal);

  expect(wrapper.text()).toContain("192.168.1.2:44502 - listen EADDRNOTAVAIL");
});
```

- [ ] **Step 2: Run SettingsGlobal tests and verify they fail**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app test:renderer -- src/renderer/components/settings/SettingsGlobal.test.ts
```

Expected: FAIL because endpoint pill UI does not exist.

- [ ] **Step 3: Create NetworkEndpointEditor component**

Create `apps/desktop-app/src/renderer/components/settings/NetworkEndpointEditor.vue`:

```vue
<template>
  <div class="network-endpoint-editor">
    <div class="priority-editor__header">
      <div class="priority-editor__label-row">
        <span class="settings-field__label">{{ label }}</span>
      </div>
      <span class="priority-editor__hint">{{ hint }}</span>
    </div>

    <div class="priority-editor__list network-endpoint-editor__list">
      <span
        v-for="endpoint in endpoints"
        :key="endpoint.id"
        class="ui-chip priority-editor__item network-endpoint-editor__item"
        :class="{
          'network-endpoint-editor__item--error': statusById.get(endpoint.id)?.status === 'error',
          'network-endpoint-editor__item--removable': endpoints.length > 1
        }"
      >
        <span
          class="network-endpoint-editor__display"
          :data-testid="`network-endpoint-display-${endpoint.id}`"
          :title="endpointUrl(endpoint)"
        >
          {{ endpointUrl(endpoint) }}
        </span>

        <UiIconButton
          v-if="endpoints.length > 1"
          class="network-endpoint-editor__remove"
          size="sm"
          variant="ghost"
          :label="removeLabel"
          :data-testid="`network-endpoint-remove-${endpoint.id}`"
          @click.stop="removeEndpoint(endpoint.id)"
        >
          <IconClose size="sm" />
        </UiIconButton>
      </span>

      <span class="priority-editor__item priority-editor__draft network-endpoint-editor__draft">
        <UiInput
          class="priority-editor__draft-input network-endpoint-editor__input"
          data-testid="network-endpoint-draft-input"
          :model-value="draftValue"
          :placeholder="placeholder"
          @update:model-value="draftValue = String($event)"
          @blur="commitDraft"
          @keyup.enter="commitDraft"
        />
      </span>
    </div>

    <div v-if="error" class="settings-field__error">{{ error }}</div>
    <div
      v-for="status in errorStatuses"
      :key="status.endpointId"
      class="settings-field__error"
    >
      {{ status.host }}:{{ status.port }} - {{ status.error }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import type { NetworkEndpoint, NetworkListenerStatus } from "../../../main/types";
import {
  buildNetworkEndpointUrl,
  networkEndpointKey,
  parseNetworkEndpointInput
} from "../../../common/networkEndpoints";
import { IconClose } from "../icons";
import { UiIconButton, UiInput } from "../ui";

const props = defineProps<{
  endpoints: NetworkEndpoint[];
  authToken: string;
  listenerStatuses: NetworkListenerStatus[];
  label: string;
  hint: string;
  placeholder: string;
  removeLabel: string;
}>();

const emit = defineEmits<{
  (event: "update:endpoints", endpoints: NetworkEndpoint[]): void;
}>();

const draftValue = ref("");
const error = ref<string | null>(null);

const statusById = computed(() => new Map(props.listenerStatuses.map((status) => [status.endpointId, status])));
const errorStatuses = computed(() => props.listenerStatuses.filter((status) => status.status === "error"));

function endpointUrl(endpoint: NetworkEndpoint): string {
  return buildNetworkEndpointUrl(endpoint, props.authToken);
}

function commitDraft() {
  const value = draftValue.value.trim();
  if (!value) {
    error.value = null;
    return;
  }
  const nextEndpoint = parseEditableEndpoint(value);
  if (!nextEndpoint) return;
  emit("update:endpoints", [...props.endpoints, nextEndpoint]);
  draftValue.value = "";
  error.value = null;
}

function removeEndpoint(endpointId: string) {
  if (props.endpoints.length <= 1) return;
  emit("update:endpoints", props.endpoints.filter((endpoint) => endpoint.id !== endpointId));
}

function parseEditableEndpoint(value: string): NetworkEndpoint | null {
  const parsed = parseNetworkEndpointInput(value);
  if (!parsed.ok) {
    error.value = parsed.error;
    return null;
  }
  const duplicate = props.endpoints.some((endpoint) => networkEndpointKey(endpoint) === networkEndpointKey(parsed.endpoint));
  if (duplicate) {
    error.value = "Endpoint already exists";
    return null;
  }
  return {
    id: createEndpointId(),
    ...parsed.endpoint
  };
}

function createEndpointId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `endpoint-${crypto.randomUUID()}`;
  }
  return `endpoint-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
</script>
```

- [ ] **Step 4: Replace network host/port fields in SettingsGlobal**

Modify `apps/desktop-app/src/renderer/components/settings/SettingsGlobal.vue`:

```vue
<NetworkEndpointEditor
  :endpoints="networkEndpoints"
  :auth-token="networkAuthToken"
  :listener-statuses="networkListenerStatuses"
  :label="t('network-endpoints-label', 'Listening Endpoints')"
  :hint="t('network-endpoints-hint', 'Add explicit addresses such as 127.0.0.1:44501 or 192.168.1.2:44501.')"
  :placeholder="t('network-endpoints-placeholder', '127.0.0.1:44501')"
  :remove-label="t('network-endpoint-remove', 'Remove endpoint')"
  @update:endpoints="updateNetworkEndpoints"
/>
```

Remove the old `network-host`, `network-port`, and `network-endpoint` fields.

Add script imports and computed values:

```ts
import NetworkEndpointEditor from "./NetworkEndpointEditor.vue";
import type { NetworkEndpoint } from "../../../main/types";

const networkEndpoints = computed(() => store.settings?.network.endpoints ?? []);
const networkAuthToken = computed(() => store.settings?.network.authToken ?? "");
const networkListenerStatuses = computed(() => store.desktopState?.networkListeners ?? []);

function updateNetworkEndpoints(endpoints: NetworkEndpoint[]) {
  store.updateNetworkSetting("endpoints", endpoints);
}
```

Remove `serverHost`, `serverPort`, `extensionEndpoint`, and local `isLoopbackHost`.

- [ ] **Step 5: Add endpoint editor styles using the existing pill visual language**

Modify `apps/desktop-app/src/renderer/style.css`:

```css
.network-endpoint-editor {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.network-endpoint-editor__list {
  align-items: center;
}

.network-endpoint-editor__item {
  position: relative;
  max-width: 100%;
  cursor: default;
}

.network-endpoint-editor__item--removable {
  padding-right: 20px;
}

.network-endpoint-editor__item--error {
  border-color: var(--ui-danger);
}

.network-endpoint-editor__draft {
  flex: 0 0 110px;
  width: 110px;
  min-width: 110px;
}

.network-endpoint-editor__display {
  min-width: 0;
  max-width: min(100%, 520px);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  border: 0;
  padding: 0;
  color: inherit;
  background: transparent;
  font: inherit;
  cursor: text;
  user-select: text;
}

.network-endpoint-editor__remove.ui-icon-button {
  position: absolute;
  top: -2px;
  right: -2px;
  width: 12px;
  height: 12px;
  border: 1px solid var(--ui-border);
  border-radius: 999px;
  color: var(--ui-text-muted);
  background: var(--ui-surface);
  opacity: 0;
  pointer-events: none;
}

.network-endpoint-editor__remove .icon {
  width: 9px;
  height: 9px;
}

.network-endpoint-editor__item:hover .network-endpoint-editor__remove,
.network-endpoint-editor__item:focus-within .network-endpoint-editor__remove {
  opacity: 1;
  pointer-events: auto;
}

.network-endpoint-editor__input {
  min-width: 0;
}

.network-endpoint-editor__input.ui-input {
  min-height: 26px;
  border: 0;
  outline: 0;
}

.network-endpoint-editor__input.ui-input:focus-visible {
  outline: 0;
}
```

- [ ] **Step 6: Add locale keys**

Modify `apps/desktop-app/src/renderer/locales/en.json`:

```json
"network-endpoints-label": "Listening Endpoints",
"network-endpoints-hint": "Add explicit addresses such as 127.0.0.1:44501 or 192.168.1.2:44501.",
"network-endpoints-placeholder": "127.0.0.1:44501",
"network-endpoint-remove": "Remove endpoint"
```

Modify `apps/desktop-app/src/renderer/locales/zh.json`:

```json
"network-endpoints-label": "监听端点",
"network-endpoints-hint": "添加具体地址，例如 127.0.0.1:44501 或 192.168.1.2:44501。",
"network-endpoints-placeholder": "127.0.0.1:44501",
"network-endpoint-remove": "移除端点"
```

Remove unused old network host, port, and extension endpoint locale keys.

- [ ] **Step 7: Run SettingsGlobal tests and verify they pass**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app test:renderer -- src/renderer/components/settings/SettingsGlobal.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit endpoint pill UI**

```bash
git add apps/desktop-app/src/renderer/components/settings/NetworkEndpointEditor.vue apps/desktop-app/src/renderer/components/settings/SettingsGlobal.vue apps/desktop-app/src/renderer/components/settings/SettingsGlobal.test.ts apps/desktop-app/src/renderer/style.css apps/desktop-app/src/renderer/locales/en.json apps/desktop-app/src/renderer/locales/zh.json
git commit -m "feat: show network endpoints as pills"
```

---

### Task 7: Update Typed Fixtures And Documentation

**Files:**
- Modify: `apps/desktop-app/src/renderer/components/settings/SettingsWindowShell.test.ts`
- Modify: `apps/desktop-app/src/renderer/components/settings/SettingsWindowShell.browser.test.ts`
- Modify: `apps/desktop-app/src/renderer/components/settings/SettingsMediaServer.test.ts`
- Modify: `apps/desktop-app/src/renderer/components/settings/SettingsPlugins.test.ts`
- Modify: `apps/desktop-app/src/renderer/components/settings/SettingsProfiles.browser.test.ts`
- Modify: `apps/desktop-app/src/renderer/components/subtitle/SubtitleView.browser.test.ts`
- Modify: `README.md`

- [ ] **Step 1: Update renderer test fixtures to the endpoint-list shape**

Replace network fixtures like this:

```ts
network: {
  host: "127.0.0.1",
  port: 4312
}
```

with:

```ts
network: {
  endpoints: [{ id: "default", host: "127.0.0.1", port: 4312 }],
  authToken: "0123456789abcdef0123456789abcdef"
}
```

Apply this replacement in:

- `apps/desktop-app/src/renderer/components/settings/SettingsWindowShell.test.ts`
- `apps/desktop-app/src/renderer/components/settings/SettingsWindowShell.browser.test.ts`
- `apps/desktop-app/src/renderer/components/settings/SettingsMediaServer.test.ts`
- `apps/desktop-app/src/renderer/components/settings/SettingsPlugins.test.ts`
- `apps/desktop-app/src/renderer/components/settings/SettingsProfiles.browser.test.ts`
- `apps/desktop-app/src/renderer/components/subtitle/SubtitleView.browser.test.ts`

- [ ] **Step 2: Update README network documentation**

Modify the README network section that currently says the desktop app listens on one endpoint.

Use this final wording:

```md
By default the app listens on `ws://127.0.0.1:44501/`. Under **Settings -> Network**, add explicit listening endpoints such as `127.0.0.1:44501` and `192.168.1.2:44501` when another extension client must connect over your LAN. Non-loopback endpoints are displayed as tokenized URLs such as `ws://192.168.1.2:44501/?token=...`; enter one reachable URL per desktop app instance in the extension popup.
```

- [ ] **Step 3: Search for stale network field references**

Run:

```bash
rg -n "network\\.host|network\\.port|network-host|network-port|Bind Address|0\\.0\\.0\\.0" apps README.md
```

Expected: no results outside deliberate test names or removed lines. If results remain in active source files, replace them with endpoint-list references.

- [ ] **Step 4: Run affected renderer tests**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app test:renderer -- src/renderer/components/settings/SettingsWindowShell.test.ts src/renderer/components/settings/SettingsWindowShell.browser.test.ts src/renderer/components/settings/SettingsMediaServer.test.ts src/renderer/components/settings/SettingsPlugins.test.ts src/renderer/components/settings/SettingsProfiles.browser.test.ts src/renderer/components/subtitle/SubtitleView.browser.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit fixture and documentation updates**

```bash
git add apps/desktop-app/src/renderer/components/settings/SettingsWindowShell.test.ts apps/desktop-app/src/renderer/components/settings/SettingsWindowShell.browser.test.ts apps/desktop-app/src/renderer/components/settings/SettingsMediaServer.test.ts apps/desktop-app/src/renderer/components/settings/SettingsPlugins.test.ts apps/desktop-app/src/renderer/components/settings/SettingsProfiles.browser.test.ts apps/desktop-app/src/renderer/components/subtitle/SubtitleView.browser.test.ts README.md
git commit -m "docs: update network endpoint guidance"
```

---

### Task 8: Final Typecheck And Full Verification

**Files:**
- Modify only files that fail verification.

- [ ] **Step 1: Run desktop renderer, main, and browser tests**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app test:renderer
```

Expected: PASS.

- [ ] **Step 2: Run desktop typecheck**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app typecheck
```

Expected: PASS.

- [ ] **Step 3: Run root silent-catch guard**

Run:

```bash
pnpm lint:silent-catches
```

Expected: PASS.

- [ ] **Step 4: Search for stale single-listener network fields**

Run:

```bash
rg -n "network\\.host|network\\.port|DEFAULT_WS_HOST|DEFAULT_WS_PORT|Bind Address|network-host|network-port" apps README.md docs/superpowers/specs/2026-05-23-multiple-network-endpoints-design.md
```

Expected: no active source references to the old `network.host` or `network.port` model. `DEFAULT_WS_HOST` and `DEFAULT_WS_PORT` may remain only as default endpoint construction constants in `settings/constants.ts`.

---

## Implementation Order

1. Shared endpoint utility.
2. Settings model and strict validation.
3. Endpoint-based auth.
4. Multi-listener runtime and listener status.
5. Renderer settings rollback.
6. Endpoint pill settings UI.
7. Fixture and README cleanup.
8. Full verification.

This order keeps broken type states short and gives each task a focused test target.
