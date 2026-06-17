# Media URL SSRF and Jellyfin / Emby URLs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Block page-controlled generic `yt-dlp` SSRF while allowing Jellyfin / Emby to match and request only user-configured localhost, loopback, and LAN URLs.

**Architecture:** Keep generic subtitle downloads and Jellyfin / Emby as separate trust paths. Generic `yt-dlp` accepts only recognized public page URLs. Jellyfin / Emby uses a final `serverUrls` comma-separated field, parses it through one shared helper, and uses the matched configured URL as the API base.

Recognized generic site identity is bound to the page URL hostname in the desktop main process. The extension should report only exact supported domains or their subdomains as `youtube`, `bilibili`, or `douyin`, but the desktop process remains the authoritative trust boundary.

**Tech Stack:** Electron main process, Vue 3 renderer, Pinia store, TypeScript, Vitest main/jsdom/browser projects.

---

## Execution Constraints

- Work in `/Users/cq-laptop/Projects/Immersive-Subs-Prompter`.
- Do not use WorkTree.
- Do not add compatibility, migration, alias, or legacy fallback code for `serverUrl`.
- Preserve unrelated user changes. At plan-writing time, `apps/desktop-app/src/main/subtitleService.ts` and `apps/desktop-app/src/main/subtitleService.test.ts` already have uncommitted edits; read them before staging and include them only if they remain part of this security work.
- Use TDD: write each task's failing tests first, run the focused command and observe the expected failure, implement the smallest change, then rerun the focused command.

## File Structure

- Create `apps/desktop-app/src/common/jellyfinEmbyServerUrls.ts`: shared parser/normalizer for comma-separated Jellyfin / Emby server URL lists. Pure TypeScript, no Electron or Node dependencies, usable by main and renderer.
- Create `apps/desktop-app/src/main/settings/jellyfinEmbyServerUrls.test.ts`: main-project tests for URL-list parsing.
- Modify `apps/desktop-app/src/main/types.ts`: replace `JellyfinEmbyServerConfig.serverUrl` with `serverUrls`.
- Modify `apps/desktop-app/src/main/settings/appSettingsSanitizer.ts`: final settings shape validation for `serverUrls` and enabled-row completeness.
- Modify `apps/desktop-app/src/main/settings/appSettingsSanitizer.test.ts`: sanitizer tests for final Jellyfin / Emby shape.
- Modify `apps/desktop-app/src/common/featureDefaults.ts`: ensure cloning keeps final server rows with `serverUrls`.
- Modify `apps/desktop-app/src/renderer/stores/desktop/actions/featureActions.ts`: create, duplicate, and update final server rows.
- Modify `apps/desktop-app/src/renderer/stores/desktop.test.ts`: store action tests for final server rows.
- Modify `apps/desktop-app/src/main/features/jellyfinEmbyMediaSource.ts`: parse `serverUrls`, match configured origins, and fetch from the matched configured URL.
- Modify `apps/desktop-app/src/main/features/jellyfinEmbyMediaSource.test.ts`: runtime matching and request-target tests.
- Modify `apps/desktop-app/src/main/connectionManager.ts`: remove generic unknown-site `videoSrc` and `pageUrl` fallback for `yt-dlp`.
- Modify `apps/desktop-app/src/main/connectionManager.test.ts`: connection URL resolution tests for recognized sites, unknown sites, and private URLs.
- Create `apps/desktop-app/src/main/networkUrlSafety.test.ts`: URL guard coverage for blocked and accepted hosts.
- Modify `apps/extension/src/video/VideoStateGatherer.ts`: classify supported sites by exact domain or subdomain, not substring.
- Create `apps/extension/src/video/VideoStateGatherer.test.ts`: extension site-classification coverage for supported, subdomain, and lookalike hosts.
- Modify `apps/desktop-app/src/renderer/components/settings/JellyfinEmbyFeatureSettings.vue`: replace single URL behavior with comma-separated `serverUrls` drafts, validation, and summary.
- Modify `apps/desktop-app/src/renderer/components/settings/SettingsFeatures.test.ts`: jsdom settings UI tests for valid/invalid URL lists.
- Modify `apps/desktop-app/src/renderer/components/settings/SettingsFeatures.browser.test.ts`: browser contract tests that still prove ProfileList-style server rows and stable summaries.
- Modify `apps/desktop-app/src/renderer/locales/en.json` and `apps/desktop-app/src/renderer/locales/zh.json`: keep labels concise and make validation copy accurate for URL lists.
- Modify `apps/desktop-app/src/renderer/i18nCoverage.test.ts`: require the new Jellyfin / Emby URL-count key.
- Modify stale final-state docs only after source passes: `docs/superpowers/specs/2026-06-15-built-in-features-design.md` and `docs/superpowers/specs/2026-06-16-feature-restoration-design.md`, replacing `serverUrl` examples with `serverUrls`.

### Task 1: Shared Jellyfin / Emby URL List Parser and Settings Sanitizer

**Files:**
- Create: `apps/desktop-app/src/common/jellyfinEmbyServerUrls.ts`
- Create: `apps/desktop-app/src/main/settings/jellyfinEmbyServerUrls.test.ts`
- Modify: `apps/desktop-app/src/main/types.ts`
- Modify: `apps/desktop-app/src/main/settings/appSettingsSanitizer.ts`
- Modify: `apps/desktop-app/src/main/settings/appSettingsSanitizer.test.ts`

- [ ] **Step 1: Write failing parser tests**

Create `apps/desktop-app/src/main/settings/jellyfinEmbyServerUrls.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  isValidJellyfinEmbyServerUrls,
  parseJellyfinEmbyServerUrls
} from "../../common/jellyfinEmbyServerUrls.js";

describe("jellyfinEmbyServerUrls", () => {
  it("parses comma-separated localhost loopback and LAN URLs into ordered origins", () => {
    expect(
      parseJellyfinEmbyServerUrls(
        " http://localhost:8096/web, http://127.0.0.1:8096/?x=1, http://192.168.1.45:8096/#/home ",
        "features.jellyfinEmby.config.servers.0.serverUrls"
      )
    ).toEqual([
      { input: "http://localhost:8096/web", origin: "http://localhost:8096", baseUrl: "http://localhost:8096" },
      { input: "http://127.0.0.1:8096/?x=1", origin: "http://127.0.0.1:8096", baseUrl: "http://127.0.0.1:8096" },
      { input: "http://192.168.1.45:8096/#/home", origin: "http://192.168.1.45:8096", baseUrl: "http://192.168.1.45:8096" }
    ]);
  });

  it("ignores empty comma entries without changing order", () => {
    expect(parseJellyfinEmbyServerUrls("http://localhost:8096,, http://127.0.0.1:8096, ")).toEqual([
      { input: "http://localhost:8096", origin: "http://localhost:8096", baseUrl: "http://localhost:8096" },
      { input: "http://127.0.0.1:8096", origin: "http://127.0.0.1:8096", baseUrl: "http://127.0.0.1:8096" }
    ]);
  });

  it("rejects non-http entries with the invalid entry index", () => {
    expect(() =>
      parseJellyfinEmbyServerUrls(
        "http://localhost:8096, file:///tmp/media",
        "features.jellyfinEmby.config.servers.0.serverUrls"
      )
    ).toThrow("features.jellyfinEmby.config.servers.0.serverUrls entry 2 must be a valid HTTP(S) URL");
  });

  it("returns false for invalid URL-list drafts", () => {
    expect(isValidJellyfinEmbyServerUrls("http://localhost:8096,notaurl")).toBe(false);
    expect(isValidJellyfinEmbyServerUrls("http://localhost:8096,http://127.0.0.1:8096")).toBe(true);
  });
});
```

- [ ] **Step 2: Write failing sanitizer tests**

Append these cases inside `describe("sanitizeSettings", ...)` in `apps/desktop-app/src/main/settings/appSettingsSanitizer.test.ts`:

```ts
    it("accepts final Jellyfin / Emby server URL lists including local network URLs", () => {
      const settings = DEFAULT_SETTINGS_FACTORY();

      expect(() =>
        validateSettingsForUpdate(
          {
            features: {
              jellyfinEmby: {
                enabled: true,
                config: {
                  servers: [
                    {
                      id: "server-1",
                      name: "Home",
                      serverUrls: "http://localhost:8096, http://127.0.0.1:8096, http://192.168.1.45:8096",
                      apiKey: "token",
                      enabled: true
                    }
                  ]
                }
              }
            }
          } as never,
          settings
        )
      ).not.toThrow();
    });

    it("rejects unknown Jellyfin / Emby server fields in final settings", () => {
      const settings = DEFAULT_SETTINGS_FACTORY();

      expect(() =>
        validateSettingsForUpdate(
          {
            features: {
              jellyfinEmby: {
                enabled: true,
                config: {
                  servers: [
                    {
                      id: "server-1",
                      name: "Home",
                      unexpected: "value",
                      apiKey: "token",
                      enabled: true
                    }
                  ]
                }
              }
            }
          } as never,
          settings
        )
      ).toThrow("features.jellyfinEmby.config.servers.0 contains unknown setting: unexpected");
    });

    it("rejects enabled Jellyfin / Emby rows without a URL list or API key", () => {
      const settings = DEFAULT_SETTINGS_FACTORY();

      expect(() =>
        validateSettingsForUpdate(
          {
            features: {
              jellyfinEmby: {
                enabled: true,
                config: {
                  servers: [
                    { id: "server-1", name: "Home", serverUrls: "", apiKey: "token", enabled: true }
                  ]
                }
              }
            }
          } as never,
          settings
        )
      ).toThrow("features.jellyfinEmby.config.servers.0.serverUrls must include at least one URL when enabled");

      expect(() =>
        validateSettingsForUpdate(
          {
            features: {
              jellyfinEmby: {
                enabled: true,
                config: {
                  servers: [{ id: "server-1", name: "Home", serverUrls: ", ,", apiKey: "token", enabled: true }]
                }
              }
            }
          } as never,
          settings
        )
      ).toThrow("features.jellyfinEmby.config.servers.0.serverUrls must include at least one URL when enabled");

      expect(() =>
        validateSettingsForUpdate(
          {
            features: {
              jellyfinEmby: {
                enabled: true,
                config: {
                  servers: [
                    { id: "server-1", name: "Home", serverUrls: "http://localhost:8096", apiKey: "", enabled: true }
                  ]
                }
              }
            }
          } as never,
          settings
        )
      ).toThrow("features.jellyfinEmby.config.servers.0.apiKey must be a non-empty string when enabled");
    });

    it("rejects invalid entries inside Jellyfin / Emby server URL lists", () => {
      const settings = DEFAULT_SETTINGS_FACTORY();

      expect(() =>
        validateSettingsForUpdate(
          {
            features: {
              jellyfinEmby: {
                enabled: true,
                config: {
                  servers: [
                    {
                      id: "server-1",
                      name: "Home",
                      serverUrls: "http://localhost:8096, not a url",
                      apiKey: "token",
                      enabled: true
                    }
                  ]
                }
              }
            }
          } as never,
          settings
        )
      ).toThrow("features.jellyfinEmby.config.servers.0.serverUrls entry 2 must be a valid HTTP(S) URL");
    });
```

- [ ] **Step 3: Run parser and sanitizer tests to verify they fail**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app exec vitest run --project main src/main/settings/jellyfinEmbyServerUrls.test.ts src/main/settings/appSettingsSanitizer.test.ts
```

Expected: FAIL because `../../common/jellyfinEmbyServerUrls.js` does not exist and `serverUrls` is not accepted by the sanitizer yet.

- [ ] **Step 4: Implement the shared parser**

Create `apps/desktop-app/src/common/jellyfinEmbyServerUrls.ts`:

```ts
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
```

- [ ] **Step 5: Change the final settings type**

In `apps/desktop-app/src/main/types.ts`, replace the Jellyfin / Emby server interface with:

```ts
export interface JellyfinEmbyServerConfig {
  id: string;
  name: string;
  serverUrls: string;
  apiKey: string;
  enabled: boolean;
}
```

- [ ] **Step 6: Update sanitizer keys and validation**

In `apps/desktop-app/src/main/settings/appSettingsSanitizer.ts`, import the parser:

```ts
import { parseJellyfinEmbyServerUrls } from "../../common/jellyfinEmbyServerUrls.js";
```

Replace the Jellyfin / Emby server key list:

```ts
const JELLYFIN_EMBY_SERVER_KEYS = ["id", "name", "serverUrls", "apiKey", "enabled"] as const;
```

Replace the per-server validation block inside `validateJellyfinEmbyFeature` with:

```ts
    requireString(record, "id", context);
    requireString(record, "name", context);
    requireString(record, "serverUrls", context);
    requireString(record, "apiKey", context);
    requireBoolean(record, "enabled", context);
    const serverUrls = parseJellyfinEmbyServerUrls(record.serverUrls as string, `${context}.serverUrls`);
    if (record.enabled === true) {
      if (!serverUrls.length) {
        throw new Error(`${context}.serverUrls must include at least one URL when enabled`);
      }
      if (!(record.apiKey as string).trim()) {
        throw new Error(`${context}.apiKey must be a non-empty string when enabled`);
      }
    }
```

Remove the old `validateOptionalHttpUrl(record.serverUrl, ...)` call from this block. Keep `validateOptionalHttpUrl` only if another current sanitizer still uses it; otherwise remove the function.

- [ ] **Step 7: Run parser and sanitizer tests to verify they pass**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app exec vitest run --project main src/main/settings/jellyfinEmbyServerUrls.test.ts src/main/settings/appSettingsSanitizer.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit Task 1**

Run:

```bash
git status --short
git add apps/desktop-app/src/common/jellyfinEmbyServerUrls.ts apps/desktop-app/src/main/settings/jellyfinEmbyServerUrls.test.ts apps/desktop-app/src/main/types.ts apps/desktop-app/src/main/settings/appSettingsSanitizer.ts apps/desktop-app/src/main/settings/appSettingsSanitizer.test.ts
git commit -m "feat: validate jellyfin emby server url lists"
```

### Task 2: Renderer Store and Settings UI Final `serverUrls` Model

**Files:**
- Modify: `apps/desktop-app/src/renderer/stores/desktop/actions/featureActions.ts`
- Modify: `apps/desktop-app/src/renderer/stores/desktop.test.ts`
- Modify: `apps/desktop-app/src/renderer/components/settings/JellyfinEmbyFeatureSettings.vue`
- Modify: `apps/desktop-app/src/renderer/components/settings/SettingsFeatures.test.ts`
- Modify: `apps/desktop-app/src/renderer/components/settings/SettingsFeatures.browser.test.ts`
- Modify: `apps/desktop-app/src/renderer/locales/en.json`
- Modify: `apps/desktop-app/src/renderer/locales/zh.json`
- Modify: `apps/desktop-app/src/renderer/i18nCoverage.test.ts`

- [ ] **Step 1: Write failing store tests**

Update the Jellyfin / Emby expectations in `apps/desktop-app/src/renderer/stores/desktop.test.ts` from `serverUrl` to `serverUrls`.

Use these exact server rows in the add/update/duplicate tests:

```ts
{
  id,
  name: "Server 1",
  serverUrls: "",
  apiKey: "",
  enabled: true
}
```

```ts
{ id: "server-1", name: "Home", serverUrls: "", apiKey: "", enabled: true }
```

```ts
await store.updateJellyfinEmbyServer("server-1", {
  serverUrls: "http://localhost:8096, http://127.0.0.1:8096"
});
```

Expected updated row:

```ts
{
  id: "server-1",
  name: "Home",
  serverUrls: "http://localhost:8096, http://127.0.0.1:8096",
  apiKey: "",
  enabled: true
}
```

Duplicate source row:

```ts
{
  id: "server-1",
  name: "Home",
  serverUrls: "http://localhost:8096, http://127.0.0.1:8096",
  apiKey: "token",
  enabled: true
}
```

- [ ] **Step 2: Write failing renderer tests**

In `apps/desktop-app/src/renderer/components/settings/SettingsFeatures.test.ts`, update all Jellyfin / Emby server fixtures to use `serverUrls`.

Replace the existing invalid URL draft test with:

```ts
  it("keeps invalid Jellyfin / Emby server URL lists in a local draft until every entry is saveable", async () => {
    const store = seedStore();
    store.settings!.features.jellyfinEmby.config.servers = [
      {
        id: "server-1",
        name: "Home",
        serverUrls: "",
        apiKey: "",
        enabled: true
      }
    ];
    const updateServer = vi.spyOn(store, "updateJellyfinEmbyServer").mockResolvedValue();
    const urlInput = mount(JellyfinEmbyFeatureSettings).get<HTMLInputElement>("#feature-jellyfin-emby-server-url");

    await urlInput.setValue("http://localhost:8096, nope");

    expect(urlInput.element.value).toBe("http://localhost:8096, nope");
    expect(updateServer).not.toHaveBeenCalled();

    await urlInput.setValue("http://localhost:8096, http://127.0.0.1:8096");

    expect(updateServer).toHaveBeenCalledWith("server-1", expect.objectContaining({
      serverUrls: "http://localhost:8096, http://127.0.0.1:8096"
    }));
  });
```

In the list-layout test, use:

```ts
serverUrls: "http://localhost:8096, http://127.0.0.1:8096"
```

and assert:

```ts
expect(wrapper.findAll(".profile-list__meta")[0]!.text()).toContain("2 URLs");
```

In `apps/desktop-app/src/renderer/components/settings/SettingsFeatures.browser.test.ts`, update Jellyfin / Emby server fixtures to `serverUrls` and assert the row summary remains a single stable `.profile-list__meta` element per row.

- [ ] **Step 3: Run store and renderer tests to verify they fail**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app exec vitest run --project jsdom src/renderer/stores/desktop.test.ts src/renderer/components/settings/SettingsFeatures.test.ts src/renderer/i18nCoverage.test.ts --project browser src/renderer/components/settings/SettingsFeatures.browser.test.ts
```

Expected: FAIL because store actions and component still read/write `serverUrl`.

- [ ] **Step 4: Update store actions**

In `apps/desktop-app/src/renderer/stores/desktop/actions/featureActions.ts`, update `addJellyfinEmbyServer` to create final rows:

```ts
    {
      id,
      name: `Server ${servers.length + 1}`,
      serverUrls: "",
      apiKey: "",
      enabled: true
    }
```

`duplicateJellyfinEmbyServer` and `updateJellyfinEmbyServer` can keep their existing spread logic after the type change.

- [ ] **Step 5: Update the settings component**

In `apps/desktop-app/src/renderer/components/settings/JellyfinEmbyFeatureSettings.vue`, import the shared validator:

```ts
import { isValidJellyfinEmbyServerUrls, parseJellyfinEmbyServerUrls } from "../../../common/jellyfinEmbyServerUrls";
```

Replace the URL input binding:

```vue
<UiInput
  id="feature-jellyfin-emby-server-url"
  :model-value="editableServer.serverUrls"
  @update:model-value="updateSelectedServer({ serverUrls: String($event) })"
/>
```

Replace `serverMeta`:

```ts
function serverMeta(server: JellyfinEmbyServerConfig): string {
  const urls = parseJellyfinEmbyServerUrls(server.serverUrls);
  if (!urls.length) {
    return t("feature-jellyfin-emby-no-url");
  }
  if (urls.length === 1) {
    return urls[0]!.baseUrl;
  }
  return t("feature-jellyfin-emby-url-count", { count: urls.length });
}
```

Replace URL validation helpers:

```ts
function serverUrlError(server: JellyfinEmbyServerConfig): string | null {
  if (!server.enabled) {
    return null;
  }
  if (!server.serverUrls.trim()) {
    return t("feature-jellyfin-emby-url-required");
  }
  if (!isValidJellyfinEmbyServerUrls(server.serverUrls)) {
    return t("feature-jellyfin-emby-url-http");
  }
  return null;
}

function canPersistServerDraft(server: JellyfinEmbyServerConfig): boolean {
  return !server.serverUrls.trim() || isValidJellyfinEmbyServerUrls(server.serverUrls);
}
```

Keep the existing split layout, list row enable button, inline name editing, and API key row unchanged except for fixture field names.

- [ ] **Step 6: Update locale strings**

In `apps/desktop-app/src/renderer/locales/en.json`, keep the existing keys and set:

```json
"feature-jellyfin-emby-server-url": "Server URLs",
"feature-jellyfin-emby-no-url": "No server URL",
"feature-jellyfin-emby-url-required": "At least one server URL is required",
"feature-jellyfin-emby-url-http": "Every server URL must be HTTP(S)",
"feature-jellyfin-emby-url-count": "{count} URLs"
```

In `apps/desktop-app/src/renderer/locales/zh.json`, set:

```json
"feature-jellyfin-emby-server-url": "服务器 URL",
"feature-jellyfin-emby-no-url": "未配置服务器 URL",
"feature-jellyfin-emby-url-required": "至少需要一个服务器 URL",
"feature-jellyfin-emby-url-http": "每个服务器 URL 都必须是 HTTP(S)",
"feature-jellyfin-emby-url-count": "{count} 个 URL"
```

In `apps/desktop-app/src/renderer/i18nCoverage.test.ts`, add the new key to `requiredKeys` near the other Jellyfin / Emby keys:

```ts
  "feature-jellyfin-emby-url-count"
```

- [ ] **Step 7: Run store and renderer tests to verify they pass**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app exec vitest run --project jsdom src/renderer/stores/desktop.test.ts src/renderer/components/settings/SettingsFeatures.test.ts src/renderer/i18nCoverage.test.ts --project browser src/renderer/components/settings/SettingsFeatures.browser.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit Task 2**

Run:

```bash
git status --short
git add apps/desktop-app/src/renderer/stores/desktop/actions/featureActions.ts apps/desktop-app/src/renderer/stores/desktop.test.ts apps/desktop-app/src/renderer/components/settings/JellyfinEmbyFeatureSettings.vue apps/desktop-app/src/renderer/components/settings/SettingsFeatures.test.ts apps/desktop-app/src/renderer/components/settings/SettingsFeatures.browser.test.ts apps/desktop-app/src/renderer/locales/en.json apps/desktop-app/src/renderer/locales/zh.json apps/desktop-app/src/renderer/i18nCoverage.test.ts
git commit -m "feat: edit jellyfin emby server url lists"
```

### Task 3: Jellyfin / Emby Runtime Matching and Request Target Selection

**Files:**
- Modify: `apps/desktop-app/src/main/features/jellyfinEmbyMediaSource.ts`
- Modify: `apps/desktop-app/src/main/features/jellyfinEmbyMediaSource.test.ts`

- [ ] **Step 1: Write failing runtime tests**

Update `createSettings()` in `apps/desktop-app/src/main/features/jellyfinEmbyMediaSource.test.ts` to use:

```ts
serverUrls: "https://media.example.test"
```

Add this test:

```ts
  it("matches any configured Jellyfin / Emby URL and fetches from the matched configured endpoint", async () => {
    const fetch = vi.fn(async (url: string) => {
      if (url.includes("/Sessions")) {
        return {
          ok: true,
          json: async () => [
            {
              Id: "session-1",
              DeviceName: "Chrome",
              Client: "Jellyfin Web",
              UserName: "cq",
              NowPlayingItem: {
                Id: "item-1",
                Name: "Episode",
                RunTimeTicks: 10_000_000,
                MediaSources: [{ Id: "media-1", MediaStreams: [{ Type: "Subtitle", Index: 2, Codec: "srt" }] }]
              },
              PlayState: { MediaSourceId: "media-1", PositionTicks: 1_000_000, IsPaused: false, PlaybackRate: 1 }
            }
          ]
        };
      }
      return {
        ok: true,
        text: async () => "1\n00:00:00,000 --> 00:00:01,000\nhello\n"
      };
    });
    const source = new JellyfinEmbyMediaSource({
      getSettings: () => createSettings({
        config: {
          servers: [
            {
              id: "server-1",
              name: "Home",
              serverUrls: "http://localhost:8096, http://127.0.0.1:8096, http://192.168.1.45:8096",
              apiKey: "api-key",
              enabled: true
            }
          ]
        }
      }),
      fetch: fetch as never
    });

    await source.handleConnectionMessage({
      type: "video-context",
      tabId: 1,
      payload: {
        pageUrl: "http://127.0.0.1:8096/web/index.html#!/details?id=item-1",
        videoSrc: "blob:http://127.0.0.1:8096/video",
        title: "Episode",
        site: "Jellyfin"
      }
    });

    expect(fetch).toHaveBeenCalledWith(expect.stringContaining("http://127.0.0.1:8096/Sessions"), expect.any(Object));
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining("http://127.0.0.1:8096/Videos/item-1/media-1/Subtitles/2/Stream.srt"), expect.any(Object));
  });
```

Add this test:

```ts
  it("does not claim unconfigured private network Jellyfin / Emby URLs", async () => {
    const fetch = vi.fn();
    const source = new JellyfinEmbyMediaSource({
      getSettings: () => createSettings({
        config: {
          servers: [
            {
              id: "server-1",
              name: "Home",
              serverUrls: "http://localhost:8096",
              apiKey: "api-key",
              enabled: true
            }
          ]
        }
      }),
      fetch: fetch as never
    });

    await expect(
      source.handleConnectionMessage({
        type: "video-context",
        tabId: 1,
        payload: {
          pageUrl: "http://192.168.1.45:8096/web/index.html#!/details?id=item-1",
          videoSrc: null,
          title: "Episode",
          site: "Jellyfin"
        }
      })
    ).resolves.toBeUndefined();
    expect(fetch).not.toHaveBeenCalled();
  });
```

- [ ] **Step 2: Run Jellyfin / Emby runtime tests to verify they fail**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app exec vitest run --project main src/main/features/jellyfinEmbyMediaSource.test.ts
```

Expected: FAIL until runtime parses `serverUrls`, rejects incomplete enabled rows, and uses the matched configured endpoint as `apiBaseUrl`.

- [ ] **Step 3: Implement runtime URL-list parsing**

In `apps/desktop-app/src/main/features/jellyfinEmbyMediaSource.ts`, import:

```ts
import { parseJellyfinEmbyServerUrls } from "../../common/jellyfinEmbyServerUrls.js";
```

Replace the runtime server type:

```ts
type NormalizedServer = Omit<JellyfinEmbyServerConfig, "serverUrls"> & {
  serverUrls: string;
  apiBaseUrl: string;
};
```

Replace `normalizeServer` with a function that returns one runtime endpoint per configured URL:

```ts
function normalizeServer(row: unknown, index: number): NormalizedServer[] {
  const source = requireObject(row, `Jellyfin / Emby server ${index + 1}`);
  const enabled = requireBooleanValue(source, "enabled", `Jellyfin / Emby server ${index + 1}`);
  if (!enabled) {
    return [];
  }
  const serverUrls = requireStringValue(source, "serverUrls", `Jellyfin / Emby server ${index + 1}`);
  const apiKey = requireStringValue(source, "apiKey", `Jellyfin / Emby server ${index + 1}`);
  if (!serverUrls) {
    throw new Error(`Jellyfin / Emby server ${index + 1} must include serverUrls.`);
  }
  if (!apiKey) {
    throw new Error(`Jellyfin / Emby server ${index + 1} must include apiKey.`);
  }
  const id = requireStringValue(source, "id", `Jellyfin / Emby server ${index + 1}`);
  const name = requireStringValue(source, "name", `Jellyfin / Emby server ${index + 1}`);
  const parsedServerUrls = parseJellyfinEmbyServerUrls(serverUrls, `Jellyfin / Emby server ${index + 1} URLs`);
  if (!parsedServerUrls.length) {
    throw new Error(`Jellyfin / Emby server ${index + 1} must include serverUrls.`);
  }
  return parsedServerUrls.map((entry) => ({
    id,
    name,
    serverUrls,
    apiBaseUrl: entry.baseUrl,
    apiKey,
    enabled
  }));
}
```

Replace `parseServers` flattening:

```ts
  return config.servers.flatMap((server, index) => normalizeServer(server, index));
```

Remove `normalizeBaseUrl` if no longer used.

Replace matching to compare configured origins:

```ts
function findServer(servers: NormalizedServer[], urls: unknown[]): NormalizedServer | null {
  for (const server of servers) {
    const base = new URL(server.apiBaseUrl);
    const matched = urls.some((url) => {
      const parsed = parseOptionalUrl(url);
      return parsed && parsed.origin === base.origin;
    });
    if (matched) {
      return server;
    }
  }
  return null;
}
```

Keep `fetchSessions`, `fetchItemMetadata`, `buildSubtitleUrl`, and `toSessionSummary` using `server.apiBaseUrl`; that field is the matched configured endpoint.

- [ ] **Step 4: Run Jellyfin / Emby runtime tests to verify they pass**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app exec vitest run --project main src/main/features/jellyfinEmbyMediaSource.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit Task 3**

Run:

```bash
git status --short
git add apps/desktop-app/src/main/features/jellyfinEmbyMediaSource.ts apps/desktop-app/src/main/features/jellyfinEmbyMediaSource.test.ts
git commit -m "feat: match jellyfin emby configured urls"
```

### Task 4: Generic `yt-dlp` SSRF Boundary

**Files:**
- Modify: `apps/desktop-app/src/main/connectionManager.ts`
- Modify: `apps/desktop-app/src/main/connectionManager.test.ts`
- Create: `apps/desktop-app/src/main/networkUrlSafety.test.ts`
- Review existing edits: `apps/desktop-app/src/main/subtitleService.ts`
- Review existing edits: `apps/desktop-app/src/main/subtitleService.test.ts`

- [ ] **Step 1: Write failing connection resolution tests**

In `apps/desktop-app/src/main/connectionManager.test.ts`, replace the current local/private URL resolution expectations with:

```ts
    expect(resolveVideoUrl({
      pageUrl: "https://youtube.com/watch?v=abc",
      videoSrc: "https://cdn.example.test/video.mp4",
      site: "youtube"
    })).toBe("https://youtube.com/watch?v=abc");

    expect(resolveVideoUrl({
      pageUrl: "https://music.youtube.com/watch?v=abc",
      videoSrc: "https://cdn.example.test/video.mp4",
      site: "youtube"
    })).toBe("https://music.youtube.com/watch?v=abc");

    expect(resolveVideoUrl({
      pageUrl: "https://notyoutube.com/watch?v=abc",
      videoSrc: "https://cdn.example.test/video.mp4",
      site: "youtube"
    })).toBeNull();

    expect(resolveVideoUrl({
      pageUrl: "https://youtube.com.evil.example/watch?v=abc",
      videoSrc: "https://cdn.example.test/video.mp4",
      site: "youtube"
    })).toBeNull();

    expect(resolveVideoUrl({
      pageUrl: "https://youtube.com/watch?v=abc",
      videoSrc: "https://cdn.example.test/video.mp4",
      site: "bilibili"
    })).toBeNull();

    expect(resolveVideoUrl({
      pageUrl: "https://example.test/watch",
      videoSrc: "https://cdn.example.test/video.mp4",
      site: "unknown"
    })).toBeNull();

    expect(resolveVideoUrl({
      pageUrl: "https://example.test/watch",
      videoSrc: "http://127.0.0.1:8080/video.mp4",
      site: "unknown"
    })).toBeNull();

    expect(resolveVideoUrl({
      pageUrl: "http://192.168.1.2/watch",
      videoSrc: "http://169.254.169.254/latest/meta-data",
      site: "unknown"
    })).toBeNull();
```

Add an assertion that recognized sites cannot use private page URLs:

```ts
    expect(resolveVideoUrl({
      pageUrl: "http://127.0.0.1:8080/watch",
      videoSrc: "https://cdn.example.test/video.mp4",
      site: "youtube"
    })).toBeNull();
```

- [ ] **Step 2: Write URL safety guard tests**

Create `apps/desktop-app/src/main/networkUrlSafety.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { assertPublicHttpUrl, isPublicHttpUrl } from "./networkUrlSafety.js";

describe("networkUrlSafety", () => {
  it("rejects local private link-local multicast and metadata hosts", () => {
    for (const url of [
      "http://localhost:8096/watch",
      "http://localhost.:8096/watch",
      "http://app.localhost/watch",
      "http://app.localhost./watch",
      "http://service.local./watch",
      "http://127.0.0.1:8080/watch",
      "http://10.0.0.5/watch",
      "http://172.16.0.5/watch",
      "http://192.168.1.45/watch",
      "http://100.64.0.1/watch",
      "http://169.254.169.254/latest/meta-data",
      "http://metadata.google.internal/computeMetadata/v1",
      "http://metadata.google.internal./computeMetadata/v1",
      "http://224.0.0.1/watch",
      "http://[::1]/watch",
      "http://[fc00::1]/watch",
      "http://[fe80::1]/watch",
      "http://[ff00::1]/watch"
    ]) {
      expect(isPublicHttpUrl(url), url).toBe(false);
    }
  });

  it("accepts public HTTP and HTTPS URLs", () => {
    expect(assertPublicHttpUrl("https://youtube.com/watch?v=abc", "Subtitle video URL")).toBe(
      "https://youtube.com/watch?v=abc"
    );
    expect(isPublicHttpUrl("http://example.com/watch")).toBe(true);
  });
});
```

- [ ] **Step 3: Run URL tests to verify they fail where behavior is still unsafe**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app exec vitest run --project main src/main/connectionManager.test.ts src/main/networkUrlSafety.test.ts src/main/subtitleService.test.ts
```

Expected: FAIL in `connectionManager.test.ts` because unknown-site public `pageUrl`/`videoSrc` fallback still resolves.

- [ ] **Step 4: Restrict generic media URL resolution**

In `apps/desktop-app/src/main/connectionManager.ts`, bind recognized site identity to the page URL hostname, then replace `resolveVideoUrl` with:

```ts
const PAGE_URL_SITE_HOSTS = {
  youtube: ["youtube.com"],
  bilibili: ["bilibili.com"],
  douyin: ["douyin.com"]
} as const;

  private resolveVideoUrl(
    payload: Extract<FromExtensionBroadcastMessage, { type: "video-context" | "time-update" | "playback-rate" }>["payload"]
  ): string | null {
    const pageUrl = typeof payload.pageUrl === "string" ? payload.pageUrl : null;
    const site = payload.site;

    if (pageUrl && siteMatchesPageUrl(site, pageUrl) && isPublicHttpUrl(pageUrl)) {
      return pageUrl;
    }

    return null;
  }
```

Do not add a replacement fallback through `videoSrc`.

Update `apps/extension/src/video/VideoStateGatherer.ts` to use the same exact-or-subdomain classification rule for supported site IDs, and add `apps/extension/src/video/VideoStateGatherer.test.ts` coverage for `notyoutube.com` and `youtube.com.evil.example`.

- [ ] **Step 5: Confirm `SubtitleService` direct guard remains in place**

Read `apps/desktop-app/src/main/subtitleService.ts` and keep this direct guard at the start of `getSubtitles`:

```ts
const safeVideoUrl = assertPublicHttpUrl(videoUrl, "Subtitle video URL");
```

Read `apps/desktop-app/src/main/subtitleService.test.ts` and keep the test that expects:

```ts
await expect(service.getSubtitles("http://127.0.0.1:8080/watch")).rejects.toThrow(
  "Subtitle video URL cannot target local or private network hosts"
);
```

- [ ] **Step 6: Run URL tests to verify they pass**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app exec vitest run --project main src/main/connectionManager.test.ts src/main/networkUrlSafety.test.ts src/main/subtitleService.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit Task 4**

Run:

```bash
git status --short
git add apps/desktop-app/src/main/connectionManager.ts apps/desktop-app/src/main/connectionManager.test.ts apps/desktop-app/src/main/networkUrlSafety.test.ts apps/desktop-app/src/main/subtitleService.ts apps/desktop-app/src/main/subtitleService.test.ts
git commit -m "fix: restrict page controlled subtitle urls"
```

### Task 5: Full Final-Model Sweep, Docs, and Verification

**Files:**
- Modify: `docs/superpowers/specs/2026-06-15-built-in-features-design.md`
- Modify: `docs/superpowers/specs/2026-06-16-feature-restoration-design.md`
- Review: all files touched by Tasks 1-4

- [ ] **Step 1: Search for stale final-model fields**

Run:

```bash
rg -n "serverUrl\\b" apps/desktop-app/src docs/superpowers/specs/2026-06-15-built-in-features-design.md docs/superpowers/specs/2026-06-16-feature-restoration-design.md
```

Expected before docs/source cleanup: matches remain only in files not yet updated by earlier tasks.

- [ ] **Step 2: Remove stale source references**

If `serverUrl` appears under `apps/desktop-app/src`, replace it with `serverUrls` or the runtime matched-base field `apiBaseUrl` in `jellyfinEmbyMediaSource.ts`.

Allowed remaining source matches after cleanup:

```text
apps/desktop-app/src/common/jellyfinEmbyServerUrls.ts
apps/desktop-app/src/main/settings/jellyfinEmbyServerUrls.test.ts
```

`jellyfinEmbyMediaSource.ts` should use `apiBaseUrl` as the matched configured API base on the runtime `NormalizedServer` type.

- [ ] **Step 3: Update stale docs to final `serverUrls` model**

In `docs/superpowers/specs/2026-06-15-built-in-features-design.md` and `docs/superpowers/specs/2026-06-16-feature-restoration-design.md`, replace Jellyfin / Emby examples shaped like:

```ts
serverUrl: string;
```

with:

```ts
serverUrls: string;
```

Where the prose says "server URL", update it to "comma-separated server URLs" only in sections that describe the final current settings model.

- [ ] **Step 4: Run focused tests for the whole change**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app exec vitest run --project main src/main/settings/jellyfinEmbyServerUrls.test.ts src/main/settings/appSettingsSanitizer.test.ts src/main/features/jellyfinEmbyMediaSource.test.ts src/main/connectionManager.test.ts src/main/networkUrlSafety.test.ts src/main/subtitleService.test.ts --project jsdom src/renderer/stores/desktop.test.ts src/renderer/components/settings/SettingsFeatures.test.ts src/renderer/i18nCoverage.test.ts --project browser src/renderer/components/settings/SettingsFeatures.browser.test.ts
```

Expected: PASS.

- [ ] **Step 5: Run package verification**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app typecheck
pnpm --filter @immersive-subs/desktop-app test
pnpm typecheck
pnpm lint:ui-boundaries
pnpm test
```

Expected: all commands complete successfully.

- [ ] **Step 6: Run final residue and whitespace checks**

Run:

```bash
git diff --check
rg -n "serverUrl\\b" apps/desktop-app/src docs/superpowers/specs/2026-06-15-built-in-features-design.md docs/superpowers/specs/2026-06-16-feature-restoration-design.md
rg -n "videoSrc && isPublicHttpUrl|pageUrl && isPublicHttpUrl\\(pageUrl\\)\\)" apps/desktop-app/src/main/connectionManager.ts
```

Expected:

- `git diff --check` prints no output.
- no singular `serverUrl` settings or runtime fields remain; helper and test names may contain `ServerUrl` as part of `ServerUrls`.
- the unsafe `resolveVideoUrl` fallback patterns do not appear.

- [ ] **Step 7: Commit final docs and cleanup**

Run:

```bash
git status --short
git add docs/superpowers/specs/2026-06-15-built-in-features-design.md docs/superpowers/specs/2026-06-16-feature-restoration-design.md
git commit -m "docs: sync jellyfin emby url settings model"
```

Skip this commit if Step 3 found no doc changes. Do not create an empty commit.

## Self-Review

Spec coverage:

- Generic page-controlled `yt-dlp` SSRF boundary is covered by Task 4.
- Direct main-process `SubtitleService` guard is covered by Task 4.
- Final Jellyfin / Emby `serverUrls` model is covered by Tasks 1 and 2.
- Localhost, loopback, and LAN Jellyfin / Emby matching is covered by Task 3.
- Matched configured endpoint as API base is covered by Task 3.
- Invalid URL-list persistence rejection is covered by Tasks 1 and 2.
- Disabled rows not matching is covered by Task 3.
- Enabled incomplete rows rejecting instead of silently skipping is covered by Tasks 1 and 3.
- Stale docs are covered by Task 5.

Placeholder scan:

- The plan contains no placeholder markers and no open-ended validation step without concrete code or tests.

Type consistency:

- Persisted settings use `serverUrls`.
- Runtime matched API base uses `apiBaseUrl` inside `JellyfinEmbyMediaSource`.
- Shared helper returns `{ input, origin, baseUrl }`; tests and runtime use `baseUrl`.
