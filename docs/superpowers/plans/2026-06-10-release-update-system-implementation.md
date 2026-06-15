# Release Update System Implementation Plan

> Historical note, 2026-06-15: Plugin-distribution references in this plan predate the built-in Features replacement. Current release checks do not build plugin artifacts and do not check `plugin-repository`; treat any plugin-distribution references below as implementation history, not current release guidance.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the release, version, manifest, and update-check system described in `docs/superpowers/specs/2026-06-10-release-update-system-design.md`.

**Architecture:** The main process owns update checks and exposes explicit IPC state. The renderer only displays the current release state and invokes main-process actions. Root release scripts own version consistency, extension ZIP packaging, checksum generation, manifest generation, and GitHub Actions release automation.

**Tech Stack:** TypeScript, Electron, Vue 3, Pinia, Vitest, Node.js scripts, Electron Forge, GitHub Actions.

---

## Scope Check

This is one implementation plan because the desktop app, extension ZIPs, release manifest, and CI workflow all share one product version. The work is split into task-sized units so each commit leaves the repository in a coherent state.

The project has not launched. Do not add compatibility readers, data migrations, old asset-name aliases, old manifest schema readers, or fallbacks to GitHub Release API parsing.

The reference project for release/update architecture is `/Users/cq-laptop/Projects/referrence projects/cherry-studio`. Use it as a separation-of-concerns reference, not as a requirement to copy its `electron-updater`, multi-mirror, channel, or auto-install system.

## File Structure

- Create `apps/desktop-app/src/main/releases/releaseManifest.ts`: release manifest types, schema validation, version comparison, platform-key selection.
- Create `apps/desktop-app/src/main/releases/releaseManifest.test.ts`: focused manifest and version tests.
- Create `apps/desktop-app/src/main/appReleaseService.ts`: update-check service with injected fetch/open callbacks for tests.
- Create `apps/desktop-app/src/main/appReleaseService.test.ts`: service tests for success, no update, errors, and rate limiting.
- Create `apps/desktop-app/src/main/ipc/handlers/releaseHandlers.ts`: IPC handlers for release state, update check, and opening download links.
- Modify `apps/desktop-app/src/main/ipc/ipcRouter.ts`: add release service to IPC context.
- Modify `apps/desktop-app/src/main/window/windowController.ts`: construct release service, register handlers, and schedule startup checks.
- Modify `apps/desktop-app/src/preload.cts`: expose release APIs and release-state subscription.
- Modify `apps/desktop-app/src/main/types.ts`, `apps/desktop-app/src/common/defaultSettings.ts`, `apps/desktop-app/src/main/settings/appSettingsSanitizer.ts`, `apps/desktop-app/src/main/settings/sanitizers/globalSanitizer.ts`: add current update-check settings.
- Create `apps/desktop-app/src/renderer/stores/desktop/actions/releaseActions.ts`: Pinia actions for release state.
- Modify `apps/desktop-app/src/renderer/stores/desktop.ts` and `apps/desktop-app/src/renderer/stores/desktop/types.ts`: wire release state into the store.
- Create `apps/desktop-app/src/renderer/components/settings/SettingsReleaseUpdate.vue`: update-check UI.
- Modify `apps/desktop-app/src/renderer/components/settings/SettingsGlobal.vue`: mount the update section.
- Modify `apps/desktop-app/src/renderer/locales/en.json` and `apps/desktop-app/src/renderer/locales/zh.json`: add visible labels.
- Modify `apps/desktop-app/src/renderer/components/icons/index.ts`: add the external-link icon used by the update download button.
- Create `scripts/release/utils.mjs`: shared release script helpers.
- Create `scripts/release/prepare.mjs`: unified version bump script.
- Create `scripts/release/check.mjs`: release preflight checks.
- Create `scripts/release/collect-desktop-artifact.mjs`: standard desktop artifact naming for CI release assets.
- Create `scripts/release/zip-extension.mjs`: deterministic Chrome and Firefox ZIP creation.
- Create `scripts/release/manifest.mjs`: manifest generation from artifacts and checksums.
- Create `scripts/release/release-scripts.test.mjs`: Node test coverage for release script helpers.
- Modify `package.json`: add release scripts and include release script tests in `pnpm test`.
- Create `.github/workflows/release.yml`: CI release workflow.
- Modify `DEPLOYMENT.md`: final release procedure.

## Task 1: Release Settings Contract

**Files:**
- Modify: `apps/desktop-app/src/main/types.ts`
- Modify: `apps/desktop-app/src/common/defaultSettings.ts`
- Modify: `apps/desktop-app/src/main/settings/appSettingsSanitizer.ts`
- Modify: `apps/desktop-app/src/main/settings/sanitizers/globalSanitizer.ts`
- Modify: `apps/desktop-app/src/main/settings/SettingsStore.test.ts`
- Modify: `apps/desktop-app/src/renderer/components/settings/SettingsGlobal.test.ts`
- Modify: `apps/desktop-app/src/renderer/stores/desktop.test.ts`

- [ ] **Step 1: Write the failing settings-store tests**

Add these assertions and test cases to `apps/desktop-app/src/main/settings/SettingsStore.test.ts`:

```ts
it("initializes update-check settings with current defaults", async () => {
  const store = await loadStore();
  expect(store.get().global.autoCheckUpdates).toBe(true);
  expect(store.get().global.lastUpdateCheckAt).toBeNull();
});

it("persists valid update-check settings", async () => {
  const store = await loadStore();
  store.update({
    global: {
      autoLaunch: store.get().global.autoLaunch,
      toggleWindowShortcut: store.get().global.toggleWindowShortcut,
      gameProcessBlacklist: store.get().global.gameProcessBlacklist,
      autoHidePanels: store.get().global.autoHidePanels,
      alwaysOnTop: store.get().global.alwaysOnTop,
      panelOpacity: store.get().global.panelOpacity,
      language: store.get().global.language,
      appearance: store.get().global.appearance,
      autoCheckUpdates: false,
      lastUpdateCheckAt: 1760000000000
    }
  });

  expect(store.get().global.autoCheckUpdates).toBe(false);
  expect(store.get().global.lastUpdateCheckAt).toBe(1760000000000);
});

it("rejects invalid update-check settings", async () => {
  const store = await loadStore();
  const current = store.get();

  expect(() =>
    store.update({
      global: {
        autoLaunch: current.global.autoLaunch,
        toggleWindowShortcut: current.global.toggleWindowShortcut,
        gameProcessBlacklist: current.global.gameProcessBlacklist,
        autoHidePanels: current.global.autoHidePanels,
        alwaysOnTop: current.global.alwaysOnTop,
        panelOpacity: current.global.panelOpacity,
        language: current.global.language,
        appearance: current.global.appearance,
        autoCheckUpdates: "yes" as unknown as boolean,
        lastUpdateCheckAt: null
      }
    })
  ).toThrow("global.autoCheckUpdates must use the current boolean setting");

  expect(() =>
    store.update({
      global: {
        autoLaunch: current.global.autoLaunch,
        toggleWindowShortcut: current.global.toggleWindowShortcut,
        gameProcessBlacklist: current.global.gameProcessBlacklist,
        autoHidePanels: current.global.autoHidePanels,
        alwaysOnTop: current.global.alwaysOnTop,
        panelOpacity: current.global.panelOpacity,
        language: current.global.language,
        appearance: current.global.appearance,
        autoCheckUpdates: true,
        lastUpdateCheckAt: -1
      }
    })
  ).toThrow("global.lastUpdateCheckAt must be null or a non-negative integer timestamp");
});
```

- [ ] **Step 2: Run the failing settings test**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app exec vitest run src/main/settings/SettingsStore.test.ts --project main
```

Expected: FAIL because `autoCheckUpdates` and `lastUpdateCheckAt` do not exist yet.

- [ ] **Step 3: Add the settings fields**

In `apps/desktop-app/src/main/types.ts`, extend `GlobalSettings`:

```ts
export interface GlobalSettings {
  autoLaunch: boolean;
  toggleWindowShortcut: string;
  gameProcessBlacklist: string[];
  autoHidePanels: boolean;
  alwaysOnTop: AlwaysOnTopLevel;
  panelOpacity: number;
  language: string;
  appearance: AppearanceSettings;
  autoCheckUpdates: boolean;
  lastUpdateCheckAt: number | null;
}
```

In `apps/desktop-app/src/common/defaultSettings.ts`, add defaults to `DEFAULT_GLOBAL_SETTINGS`:

```ts
export const DEFAULT_GLOBAL_SETTINGS: GlobalSettings = {
  autoLaunch: true,
  toggleWindowShortcut: "CommandOrControl+Shift+S",
  gameProcessBlacklist: ["r5apex_dx12.exe"],
  autoHidePanels: true,
  alwaysOnTop: "screen-saver",
  panelOpacity: 0,
  language: "zh",
  appearance: {
    theme: "system"
  },
  autoCheckUpdates: true,
  lastUpdateCheckAt: null
};
```

In both sanitizer files, add the new keys to the current global key arrays and validate them:

```ts
if (Object.prototype.hasOwnProperty.call(source, "autoCheckUpdates") && typeof source.autoCheckUpdates !== "boolean") {
  throw new Error("global.autoCheckUpdates must use the current boolean setting");
}
if (Object.prototype.hasOwnProperty.call(source, "lastUpdateCheckAt")) {
  const value = source.lastUpdateCheckAt;
  if (value !== null && (typeof value !== "number" || !Number.isInteger(value) || value < 0)) {
    throw new Error("global.lastUpdateCheckAt must be null or a non-negative integer timestamp");
  }
}
```

In `cloneGlobalSettings`, no extra clone is required because both fields are primitives.

- [ ] **Step 4: Update test fixtures that construct `GlobalSettings`**

In `apps/desktop-app/src/renderer/components/settings/SettingsGlobal.test.ts` and `apps/desktop-app/src/renderer/stores/desktop.test.ts`, add these fields to every hand-built `global` object:

```ts
autoCheckUpdates: true,
lastUpdateCheckAt: null
```

- [ ] **Step 5: Run the settings tests**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app exec vitest run src/main/settings/SettingsStore.test.ts src/renderer/components/settings/SettingsGlobal.test.ts src/renderer/stores/desktop.test.ts --project main --project jsdom
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/desktop-app/src/main/types.ts apps/desktop-app/src/common/defaultSettings.ts apps/desktop-app/src/main/settings/appSettingsSanitizer.ts apps/desktop-app/src/main/settings/sanitizers/globalSanitizer.ts apps/desktop-app/src/main/settings/SettingsStore.test.ts apps/desktop-app/src/renderer/components/settings/SettingsGlobal.test.ts apps/desktop-app/src/renderer/stores/desktop.test.ts
git commit -m "feat: add release update settings"
```

## Task 2: Release Manifest Domain

**Files:**
- Create: `apps/desktop-app/src/main/releases/releaseManifest.ts`
- Create: `apps/desktop-app/src/main/releases/releaseManifest.test.ts`

- [ ] **Step 1: Write the failing manifest tests**

Create `apps/desktop-app/src/main/releases/releaseManifest.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  RELEASE_MANIFEST_SCHEMA_VERSION,
  compareReleaseVersions,
  getDesktopPlatformKey,
  selectDesktopArtifact,
  validateReleaseManifest
} from "./releaseManifest.js";

const checksum = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

function manifest() {
  return {
    schemaVersion: RELEASE_MANIFEST_SCHEMA_VERSION,
    version: "1.2.0",
    releasedAt: "2026-06-10T12:00:00Z",
    releaseUrl: "https://github.com/XiiTang/Immersive-Subs-Prompter/releases/tag/v1.2.0",
    minimumSupportedVersion: "1.0.0",
    notes: {
      en: "English notes",
      zh: "中文说明"
    },
    desktop: {
      "darwin-arm64": {
        fileName: "Immersive-Subs-Prompter-1.2.0-darwin-arm64.dmg",
        url: "https://github.com/XiiTang/Immersive-Subs-Prompter/releases/download/v1.2.0/mac.dmg",
        sha256: checksum,
        signed: false
      }
    },
    extension: {
      chrome: {
        version: "1.2.0",
        artifactUrl: "https://github.com/XiiTang/Immersive-Subs-Prompter/releases/download/v1.2.0/chrome.zip",
        sha256: checksum,
        storeStatus: "manual-review"
      },
      firefox: {
        version: "1.2.0",
        artifactUrl: "https://github.com/XiiTang/Immersive-Subs-Prompter/releases/download/v1.2.0/firefox.zip",
        sha256: checksum,
        storeStatus: "manual-review"
      }
    }
  };
}

describe("release manifest domain", () => {
  it("validates the current schema", () => {
    expect(validateReleaseManifest(manifest()).version).toBe("1.2.0");
  });

  it("rejects unknown schema versions", () => {
    expect(() => validateReleaseManifest(Object.assign(manifest(), { schemaVersion: 2 }))).toThrow("Unsupported release manifest schema");
  });

  it("compares plain semantic versions", () => {
    expect(compareReleaseVersions("1.2.0", "1.1.9")).toBeGreaterThan(0);
    expect(compareReleaseVersions("1.2.0", "1.2.0")).toBe(0);
    expect(compareReleaseVersions("1.2.0", "1.3.0")).toBeLessThan(0);
  });

  it("maps Electron platform and architecture to manifest keys", () => {
    expect(getDesktopPlatformKey("darwin", "arm64")).toBe("darwin-arm64");
    expect(getDesktopPlatformKey("win32", "x64")).toBe("win32-x64");
    expect(getDesktopPlatformKey("linux", "x64")).toBe("linux-x64");
  });

  it("selects the platform artifact when it exists", () => {
    const parsed = validateReleaseManifest(manifest());
    expect(selectDesktopArtifact(parsed, "darwin-arm64")?.fileName).toContain("darwin-arm64");
    expect(selectDesktopArtifact(parsed, "linux-arm64")).toBeNull();
  });
});
```

- [ ] **Step 2: Run the failing manifest tests**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app exec vitest run src/main/releases/releaseManifest.test.ts --project main
```

Expected: FAIL because `releaseManifest.ts` does not exist.

- [ ] **Step 3: Implement the manifest domain**

Create `apps/desktop-app/src/main/releases/releaseManifest.ts` with these exported contracts and functions:

```ts
export const RELEASE_MANIFEST_SCHEMA_VERSION = 1;
export const RELEASE_MANIFEST_URL =
  "https://raw.githubusercontent.com/XiiTang/Immersive-Subs-Prompter/main/releases/latest.json";

export type DesktopPlatformKey =
  | "darwin-arm64"
  | "darwin-x64"
  | "win32-arm64"
  | "win32-x64"
  | "linux-arm64"
  | "linux-x64";

export type ExtensionStoreStatus = "not-submitted" | "manual-review" | "published" | "rejected";

export interface DesktopReleaseArtifact {
  fileName: string;
  url: string;
  sha256: string;
  signed: boolean;
}

export interface ExtensionReleaseArtifact {
  version: string;
  artifactUrl: string;
  sha256: string;
  storeStatus: ExtensionStoreStatus;
}

export interface ReleaseManifest {
  schemaVersion: 1;
  version: string;
  releasedAt: string;
  releaseUrl: string;
  minimumSupportedVersion: string;
  notes: {
    en: string;
    zh: string;
  };
  desktop: Partial<Record<DesktopPlatformKey, DesktopReleaseArtifact>>;
  extension: {
    chrome: ExtensionReleaseArtifact;
    firefox: ExtensionReleaseArtifact;
  };
}

export interface ReleaseState {
  status: "idle" | "checking" | "available" | "unavailable" | "error";
  currentVersion: string;
  latestVersion: string | null;
  checkedAt: number | null;
  manifest: ReleaseManifest | null;
  platformKey: DesktopPlatformKey;
  platformArtifact: DesktopReleaseArtifact | null;
  error: {
    code:
      | "network-error"
      | "invalid-manifest"
      | "unsupported-schema"
      | "platform-artifact-missing"
      | "open-url-failed";
    message: string;
  } | null;
}
```

Implement validation with explicit type guards:

```ts
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const HTTPS_PATTERN = /^https:\/\//;

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function assertString(value: unknown, name: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${name} must be a non-empty string`);
  }
  return value;
}

function assertHttpsUrl(value: unknown, name: string): string {
  const url = assertString(value, name);
  if (!HTTPS_PATTERN.test(url)) {
    throw new Error(`${name} must be an HTTPS URL`);
  }
  return url;
}

function assertSha256(value: unknown, name: string): string {
  const hash = assertString(value, name);
  if (!SHA256_PATTERN.test(hash)) {
    throw new Error(`${name} must be a lowercase SHA-256 hash`);
  }
  return hash;
}
```

Implement `compareReleaseVersions` using a local `X.Y.Z` parser. Do not add a semver dependency:

```ts
function parseReleaseVersion(version: string): [number, number, number] {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) {
    throw new Error(`Invalid release version "${version}"`);
  }
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

export function compareReleaseVersions(left: string, right: string): number {
  const a = parseReleaseVersion(left);
  const b = parseReleaseVersion(right);
  for (let index = 0; index < a.length; index += 1) {
    if (a[index] !== b[index]) {
      return a[index] - b[index];
    }
  }
  return 0;
}
```

Implement `getDesktopPlatformKey`, `validateReleaseManifest`, and `selectDesktopArtifact` in the same file. Validation must reject unknown `schemaVersion`, invalid HTTPS URLs, invalid checksums, invalid `storeStatus`, invalid `signed`, and unsupported desktop platform keys.

- [ ] **Step 4: Run the manifest tests**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app exec vitest run src/main/releases/releaseManifest.test.ts --project main
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop-app/src/main/releases/releaseManifest.ts apps/desktop-app/src/main/releases/releaseManifest.test.ts
git commit -m "feat: add release manifest domain"
```

## Task 3: Main-Process Release Service And IPC

**Files:**
- Create: `apps/desktop-app/src/main/appReleaseService.ts`
- Create: `apps/desktop-app/src/main/appReleaseService.test.ts`
- Create: `apps/desktop-app/src/main/ipc/handlers/releaseHandlers.ts`
- Modify: `apps/desktop-app/src/main/ipc/ipcRouter.ts`
- Modify: `apps/desktop-app/src/main/window/windowController.ts`
- Modify: `apps/desktop-app/src/preload.cts`

- [ ] **Step 1: Write failing release-service tests**

Create `apps/desktop-app/src/main/appReleaseService.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppReleaseService } from "./appReleaseService.js";
import type { AppSettings } from "./types.js";

const checksum = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

function settings(overrides: Partial<AppSettings["global"]> = {}): AppSettings {
  const global = Object.assign(
    {
      autoLaunch: false,
      toggleWindowShortcut: "",
      gameProcessBlacklist: [],
      autoHidePanels: false,
      alwaysOnTop: "off",
      panelOpacity: 100,
      language: "en",
      appearance: { theme: "system" },
      autoCheckUpdates: true,
      lastUpdateCheckAt: null
    },
    overrides
  );

  return {
    global,
    network: { endpoints: [{ id: "default", host: "127.0.0.1", port: 44501 }], authToken: "token" },
    profiles: [],
    defaultProfileId: "",
    rules: [],
    plugins: {},
    cache: { enabled: true, path: "", retentionDays: 7 }
  };
}

function remoteManifest(version = "1.2.0") {
  return {
    schemaVersion: 1,
    version,
    releasedAt: "2026-06-10T12:00:00Z",
    releaseUrl: `https://github.com/XiiTang/Immersive-Subs-Prompter/releases/tag/v${version}`,
    minimumSupportedVersion: "1.0.0",
    notes: { en: "English notes", zh: "中文说明" },
    desktop: {
      "darwin-arm64": {
        fileName: `Immersive-Subs-Prompter-${version}-darwin-arm64.dmg`,
        url: `https://github.com/XiiTang/Immersive-Subs-Prompter/releases/download/v${version}/mac.dmg`,
        sha256: checksum,
        signed: false
      }
    },
    extension: {
      chrome: {
        version,
        artifactUrl: `https://github.com/XiiTang/Immersive-Subs-Prompter/releases/download/v${version}/chrome.zip`,
        sha256: checksum,
        storeStatus: "manual-review"
      },
      firefox: {
        version,
        artifactUrl: `https://github.com/XiiTang/Immersive-Subs-Prompter/releases/download/v${version}/firefox.zip`,
        sha256: checksum,
        storeStatus: "manual-review"
      }
    }
  };
}

describe("AppReleaseService", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-10T12:00:00Z"));
  });

  it("reports an available update", async () => {
    let currentSettings = settings();
    const service = new AppReleaseService({
      getCurrentVersion: () => "1.0.0",
      getSettings: () => currentSettings,
      updateSettings: (partial) => {
        currentSettings = Object.assign({}, currentSettings, {
          global: Object.assign({}, currentSettings.global, partial.global)
        });
        return currentSettings;
      },
      fetchManifest: vi.fn().mockResolvedValue(remoteManifest("1.2.0")),
      openExternal: vi.fn(),
      platform: "darwin",
      arch: "arm64",
      now: () => Date.now()
    });

    const state = await service.checkForUpdates();

    expect(state.status).toBe("available");
    expect(state.latestVersion).toBe("1.2.0");
    expect(state.platformArtifact?.fileName).toContain("darwin-arm64");
    expect(currentSettings.global.lastUpdateCheckAt).toBe(Date.now());
  });

  it("reports unavailable when the manifest is not newer", async () => {
    const service = new AppReleaseService({
      getCurrentVersion: () => "1.2.0",
      getSettings: () => settings(),
      updateSettings: () => settings(),
      fetchManifest: vi.fn().mockResolvedValue(remoteManifest("1.2.0")),
      openExternal: vi.fn(),
      platform: "darwin",
      arch: "arm64",
      now: () => Date.now()
    });

    expect((await service.checkForUpdates()).status).toBe("unavailable");
  });

  it("rate-limits automatic checks", async () => {
    const fetchManifest = vi.fn().mockResolvedValue(remoteManifest("1.2.0"));
    const service = new AppReleaseService({
      getCurrentVersion: () => "1.0.0",
      getSettings: () => settings({ lastUpdateCheckAt: Date.now() - 60_000 }),
      updateSettings: () => settings(),
      fetchManifest,
      openExternal: vi.fn(),
      platform: "darwin",
      arch: "arm64",
      now: () => Date.now()
    });

    const state = await service.maybeCheckAutomatically();

    expect(state.status).toBe("idle");
    expect(fetchManifest).not.toHaveBeenCalled();
  });

  it("opens the selected download URL", async () => {
    const openExternal = vi.fn().mockResolvedValue(undefined);
    const service = new AppReleaseService({
      getCurrentVersion: () => "1.0.0",
      getSettings: () => settings(),
      updateSettings: () => settings(),
      fetchManifest: vi.fn().mockResolvedValue(remoteManifest("1.2.0")),
      openExternal,
      platform: "darwin",
      arch: "arm64",
      now: () => Date.now()
    });

    await service.checkForUpdates();
    await service.openDownload();

    expect(openExternal).toHaveBeenCalledWith("https://github.com/XiiTang/Immersive-Subs-Prompter/releases/download/v1.2.0/mac.dmg");
  });
});
```

- [ ] **Step 2: Run the failing service tests**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app exec vitest run src/main/appReleaseService.test.ts --project main
```

Expected: FAIL because `AppReleaseService` does not exist.

- [ ] **Step 3: Implement `AppReleaseService`**

Create `apps/desktop-app/src/main/appReleaseService.ts` with these public methods:

```ts
export class AppReleaseService {
  getState(): ReleaseState;
  checkForUpdates(): Promise<ReleaseState>;
  maybeCheckAutomatically(): Promise<ReleaseState>;
  openDownload(url?: string): Promise<{ ok: boolean; error?: string }>;
}
```

Use an injected constructor so tests do not hit the network:

```ts
type AppReleaseServiceOptions = {
  getCurrentVersion: () => string;
  getSettings: () => AppSettings;
  updateSettings: (partial: Partial<AppSettings>) => AppSettings;
  fetchManifest?: () => Promise<unknown>;
  openExternal: (url: string) => Promise<void>;
  platform?: NodeJS.Platform;
  arch?: NodeJS.Architecture;
  now?: () => number;
  onStateChange?: (state: ReleaseState) => void;
};
```

Default `fetchManifest` uses Electron `net.fetch(RELEASE_MANIFEST_URL, { cache: "no-store" })` and parses JSON. Default `now` uses `Date.now`.

The automatic check interval is:

```ts
const UPDATE_AUTO_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;
```

`maybeCheckAutomatically` returns the current idle state without fetching when `autoCheckUpdates` is false or `lastUpdateCheckAt` is inside the interval.

`checkForUpdates` must set state to `checking`, update `global.lastUpdateCheckAt` for the check attempt, fetch the manifest, validate it, compare versions, and emit state through `onStateChange`.

- [ ] **Step 4: Add release IPC handlers**

Create `apps/desktop-app/src/main/ipc/handlers/releaseHandlers.ts`:

```ts
import { ipcMain } from "electron";
import type { IpcContext } from "../ipcRouter.js";

export function registerReleaseHandlers(context: IpcContext) {
  ipcMain.handle("usp:get-release-state", () => context.releaseService.getState());
  ipcMain.handle("usp:check-for-updates", () => context.releaseService.checkForUpdates());
  ipcMain.handle("usp:open-release-download", (_event, payload: { url?: string } | null) =>
    context.releaseService.openDownload(payload?.url)
  );
}
```

Modify `apps/desktop-app/src/main/ipc/ipcRouter.ts`:

```ts
import { AppReleaseService } from "../appReleaseService.js";
import { registerReleaseHandlers } from "./handlers/releaseHandlers.js";

export type IpcContext = {
  releaseService: AppReleaseService;
};

registerReleaseHandlers(this.context);
```

Keep the existing context fields and handler registrations intact.

- [ ] **Step 5: Wire preload APIs**

In `apps/desktop-app/src/preload.cts`, add:

```ts
  getReleaseState: (): Promise<any> => ipcRenderer.invoke("usp:get-release-state"),
  checkForUpdates: (): Promise<any> => ipcRenderer.invoke("usp:check-for-updates"),
  openReleaseDownload: (url?: string): Promise<{ ok: boolean; error?: string }> =>
    ipcRenderer.invoke("usp:open-release-download", { url }),
  onReleaseStateChange: (listener: Listener<any>) => subscribe("usp:release-state", listener),
```

- [ ] **Step 6: Wire the service into `WindowController`**

In `apps/desktop-app/src/main/window/windowController.ts`, add a private `releaseService` field. Construct it before `IpcRouter`:

```ts
this.releaseService = new AppReleaseService({
  getCurrentVersion: () => app.getVersion(),
  getSettings: this.options.getSettings,
  updateSettings: (partial) => this.updateAppSettings(partial),
  openExternal: (url) => shell.openExternal(url),
  onStateChange: (state) => this.pushReleaseState(state)
});
```

Import `shell` from `electron` along with `app`. Add `releaseService` to the IPC context.

Add a broadcaster:

```ts
private pushReleaseState(state = this.releaseService.getState()) {
  this.windowManager.getWindow()?.webContents.send("usp:release-state", state);
  this.settingsWindowManager.getWindow()?.webContents.send("usp:release-state", state);
}
```

Call `this.pushReleaseState()` from both window `onDidFinishLoad` callbacks. After `this.windowManager.createWindow()` in `initialize`, schedule:

```ts
setTimeout(() => {
  void this.releaseService.maybeCheckAutomatically();
}, 5000);
```

- [ ] **Step 7: Run release service tests**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app exec vitest run src/main/appReleaseService.test.ts src/main/releases/releaseManifest.test.ts --project main
```

Expected: PASS.

- [ ] **Step 8: Run typecheck for main and preload**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app typecheck:main
pnpm --filter @immersive-subs/desktop-app typecheck:preload
```

Expected: both commands PASS.

- [ ] **Step 9: Commit**

```bash
git add apps/desktop-app/src/main/appReleaseService.ts apps/desktop-app/src/main/appReleaseService.test.ts apps/desktop-app/src/main/ipc/handlers/releaseHandlers.ts apps/desktop-app/src/main/ipc/ipcRouter.ts apps/desktop-app/src/main/window/windowController.ts apps/desktop-app/src/preload.cts
git commit -m "feat: add desktop release update service"
```

## Task 4: Renderer Store And Settings UI

**Files:**
- Create: `apps/desktop-app/src/renderer/stores/desktop/actions/releaseActions.ts`
- Create: `apps/desktop-app/src/renderer/components/settings/SettingsReleaseUpdate.vue`
- Create: `apps/desktop-app/src/renderer/components/settings/SettingsReleaseUpdate.test.ts`
- Modify: `apps/desktop-app/src/renderer/stores/desktop.ts`
- Modify: `apps/desktop-app/src/renderer/stores/desktop/types.ts`
- Modify: `apps/desktop-app/src/renderer/stores/desktop/actions/initActions.ts`
- Modify: `apps/desktop-app/src/renderer/components/settings/SettingsGlobal.vue`
- Modify: `apps/desktop-app/src/renderer/components/settings/SettingsGlobal.test.ts`
- Modify: `apps/desktop-app/src/renderer/locales/en.json`
- Modify: `apps/desktop-app/src/renderer/locales/zh.json`
- Modify: `apps/desktop-app/src/renderer/components/icons/index.ts`

- [ ] **Step 1: Write the failing component tests**

Create `apps/desktop-app/src/renderer/components/settings/SettingsReleaseUpdate.test.ts`:

```ts
import { createPinia, setActivePinia } from "pinia";
import { mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SettingsReleaseUpdate from "./SettingsReleaseUpdate.vue";
import { useDesktopStore } from "../../stores/desktop";
import type { AppSettings } from "../../../main/types";

function settings(): AppSettings {
  return {
    global: {
      autoLaunch: false,
      toggleWindowShortcut: "",
      gameProcessBlacklist: [],
      autoHidePanels: false,
      alwaysOnTop: "off",
      panelOpacity: 100,
      language: "en",
      appearance: { theme: "system" },
      autoCheckUpdates: true,
      lastUpdateCheckAt: null
    },
    network: { endpoints: [{ id: "default", host: "127.0.0.1", port: 44501 }], authToken: "token" },
    profiles: [],
    defaultProfileId: "",
    rules: [],
    plugins: {},
    cache: { enabled: true, path: "", retentionDays: 7 }
  };
}

describe("SettingsReleaseUpdate", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("shows current version and manual check action", () => {
    const store = useDesktopStore();
    store.settings = settings();
    store.releaseState = {
      status: "idle",
      currentVersion: "1.0.0",
      latestVersion: null,
      checkedAt: null,
      manifest: null,
      platformKey: "darwin-arm64",
      platformArtifact: null,
      error: null
    };
    vi.spyOn(store, "checkForUpdates").mockResolvedValue();

    const wrapper = mount(SettingsReleaseUpdate);

    expect(wrapper.text()).toContain("Updates");
    expect(wrapper.text()).toContain("Current version");
    expect(wrapper.text()).toContain("1.0.0");
    expect(wrapper.find('[data-testid="release-check"]').exists()).toBe(true);
  });

  it("shows available release notes and opens the download page", async () => {
    const store = useDesktopStore();
    store.settings = settings();
    store.releaseState = {
      status: "available",
      currentVersion: "1.0.0",
      latestVersion: "1.2.0",
      checkedAt: Date.UTC(2026, 5, 10),
      platformKey: "darwin-arm64",
      platformArtifact: {
        fileName: "Immersive-Subs-Prompter-1.2.0-darwin-arm64.dmg",
        url: "https://github.com/XiiTang/Immersive-Subs-Prompter/releases/download/v1.2.0/mac.dmg",
        sha256: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
        signed: false
      },
      manifest: {
        schemaVersion: 1,
        version: "1.2.0",
        releasedAt: "2026-06-10T12:00:00Z",
        releaseUrl: "https://github.com/XiiTang/Immersive-Subs-Prompter/releases/tag/v1.2.0",
        minimumSupportedVersion: "1.0.0",
        notes: { en: "English notes", zh: "中文说明" },
        desktop: {},
        extension: {
          chrome: {
            version: "1.2.0",
            artifactUrl: "https://github.com/XiiTang/Immersive-Subs-Prompter/releases/download/v1.2.0/chrome.zip",
            sha256: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
            storeStatus: "manual-review"
          },
          firefox: {
            version: "1.2.0",
            artifactUrl: "https://github.com/XiiTang/Immersive-Subs-Prompter/releases/download/v1.2.0/firefox.zip",
            sha256: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
            storeStatus: "manual-review"
          }
        }
      },
      error: null
    };
    const openSpy = vi.spyOn(store, "openReleaseDownload").mockResolvedValue();

    const wrapper = mount(SettingsReleaseUpdate);
    await wrapper.get('[data-testid="release-open-download"]').trigger("click");

    expect(wrapper.text()).toContain("1.2.0");
    expect(wrapper.text()).toContain("English notes");
    expect(wrapper.text()).toContain("Immersive-Subs-Prompter-1.2.0-darwin-arm64.dmg");
    expect(openSpy).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run the failing component test**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app exec vitest run src/renderer/components/settings/SettingsReleaseUpdate.test.ts --project jsdom
```

Expected: FAIL because the component and store fields do not exist yet.

- [ ] **Step 3: Add release state to the desktop store**

In `apps/desktop-app/src/renderer/stores/desktop/types.ts`, import `ReleaseState` from the main release manifest module and add:

```ts
releaseState: ReleaseState | null;
checkForUpdates(): Promise<void>;
openReleaseDownload(url?: string): Promise<void>;
```

In `apps/desktop-app/src/renderer/stores/desktop.ts`, add to state:

```ts
releaseState: null as ReleaseState | null
```

Add `releaseActions` to the actions list.

Create `apps/desktop-app/src/renderer/stores/desktop/actions/releaseActions.ts`:

```ts
import { reportError } from "../../../utils/errorBus";
import type { DesktopStoreThis } from "../types";

export async function refreshReleaseState(this: DesktopStoreThis) {
  this.releaseState = await window.usp.getReleaseState();
}

export async function checkForUpdates(this: DesktopStoreThis) {
  try {
    this.releaseState = await window.usp.checkForUpdates();
  } catch (error) {
    reportError(error, "release.check");
  }
}

export async function openReleaseDownload(this: DesktopStoreThis, url?: string) {
  const result = await window.usp.openReleaseDownload(url);
  if (!result.ok) {
    reportError(new Error(result.error ?? "Failed to open release download"), "release.open-download");
  }
}

export const releaseActions = {
  refreshReleaseState,
  checkForUpdates,
  openReleaseDownload
};
```

In `initActions.initialize`, fetch release state with the initial state/settings calls:

```ts
const [state, settings, releaseState] = await Promise.all([
  window.usp.getInitialState(),
  window.usp.getSettings(),
  window.usp.getReleaseState()
]);
this.releaseState = releaseState;
```

In `attachIpcListeners`, add:

```ts
window.usp.onReleaseStateChange((state) => {
  this.releaseState = state;
});
```

- [ ] **Step 4: Add the update settings component**

Create `apps/desktop-app/src/renderer/components/settings/SettingsReleaseUpdate.vue`. Use existing UI primitives and keep the component focused on update controls:

```vue
<template>
  <section class="global-settings__group">
    <h3 class="global-settings__group-title">{{ t("global-updates") }}</h3>

    <div class="global-settings__row">
      <div class="global-settings__row-meta">
        <span class="ui-field__label">{{ t("release-current-version") }}</span>
        <span class="ui-field__hint">{{ currentVersion }}</span>
      </div>
      <div class="global-settings__control global-settings__control--compact">
        <UiButton data-testid="release-check" :disabled="checking" @click="check">
          <IconRefresh size="sm" :class="{ 'icon--spinning': checking }" />
          {{ checking ? t("release-checking") : t("release-check") }}
        </UiButton>
      </div>
    </div>

    <div class="global-settings__row">
      <div class="global-settings__row-meta">
        <span class="ui-field__label">{{ t("release-auto-check") }}</span>
        <span class="ui-field__hint">{{ t("release-auto-check-hint") }}</span>
      </div>
      <div class="global-settings__control global-settings__control--compact">
        <UiSwitch v-model="autoCheckUpdates" :label="autoCheckUpdates ? t('toggle-on') : t('toggle-off')" />
      </div>
    </div>

    <div v-if="state?.status === 'available'" class="global-settings__row global-settings__row--editor">
      <div class="global-settings__row-meta">
        <UiStatus tone="success">{{ t("release-update-available", { version: state.latestVersion }) }}</UiStatus>
        <span class="ui-field__hint">{{ localizedNotes }}</span>
        <span v-if="releaseDate" class="ui-field__hint">{{ t("release-date") }} {{ releaseDate }}</span>
      </div>
      <div class="global-settings__control global-settings__control--editor">
        <UiButton data-testid="release-open-download" variant="primary" @click="openDownload">
          <IconExternalLink size="sm" />
          {{ t("release-open-download") }}
        </UiButton>
        <span v-if="state.platformArtifact" class="ui-field__hint">
          {{ state.platformArtifact.fileName }} · SHA-256 {{ artifactHash }}
        </span>
      </div>
    </div>

    <div v-else-if="state?.status === 'unavailable'" class="global-settings__row">
      <div class="global-settings__row-meta">
        <UiStatus tone="success">{{ t("release-up-to-date") }}</UiStatus>
      </div>
    </div>

    <div v-else-if="state?.status === 'error'" class="global-settings__row">
      <div class="global-settings__row-meta">
        <UiStatus tone="danger">{{ t("release-check-failed") }}</UiStatus>
        <span class="ui-field__hint">{{ state.error?.message }}</span>
      </div>
    </div>
  </section>
</template>
```

The script section must compute `state`, `checking`, `currentVersion`, `autoCheckUpdates`, `localizedNotes`, `releaseDate`, and `artifactHash` from the store. Use `store.updateGlobalSetting("autoCheckUpdates", value)` for the switch.

- [ ] **Step 5: Mount the component and add icon support**

In `apps/desktop-app/src/renderer/components/settings/SettingsGlobal.vue`, import and render `SettingsReleaseUpdate` after the General group and before Network.

In `apps/desktop-app/src/renderer/components/icons/index.ts`, import `ExternalLink` from `@lucide/vue` and export:

```ts
export const IconExternalLink = icon(ExternalLink);
```

- [ ] **Step 6: Add locale keys**

Add these English keys to `apps/desktop-app/src/renderer/locales/en.json`:

```json
"global-updates": "Updates",
"release-current-version": "Current version",
"release-auto-check": "Auto check",
"release-auto-check-hint": "Checks once per day after startup.",
"release-check": "Check for updates",
"release-checking": "Checking",
"release-update-available": "Version {version} available",
"release-up-to-date": "Up to date",
"release-check-failed": "Update check failed",
"release-open-download": "Open download page"
```

Add matching Chinese keys to `apps/desktop-app/src/renderer/locales/zh.json`:

```json
"global-updates": "更新",
"release-current-version": "当前版本",
"release-auto-check": "自动检查",
"release-auto-check-hint": "启动后每天最多检查一次。",
"release-check": "检查更新",
"release-checking": "检查中",
"release-update-available": "发现版本 {version}",
"release-up-to-date": "已是最新版本",
"release-check-failed": "检查更新失败",
"release-open-download": "打开下载页"
```

- [ ] **Step 7: Update SettingsGlobal group expectation**

In `apps/desktop-app/src/renderer/components/settings/SettingsGlobal.test.ts`, update the group title assertion:

```ts
expect(groups.map((group) => group.get(".global-settings__group-title").text())).toEqual([
  "General",
  "Updates",
  "Network",
  "Shortcuts",
  "Cache"
]);
```

- [ ] **Step 8: Run renderer tests**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app exec vitest run src/renderer/components/settings/SettingsReleaseUpdate.test.ts src/renderer/components/settings/SettingsGlobal.test.ts src/renderer/stores/desktop.test.ts --project jsdom
```

Expected: PASS.

- [ ] **Step 9: Run renderer typecheck**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app typecheck:renderer
```

Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add apps/desktop-app/src/renderer/stores/desktop/actions/releaseActions.ts apps/desktop-app/src/renderer/stores/desktop.ts apps/desktop-app/src/renderer/stores/desktop/types.ts apps/desktop-app/src/renderer/stores/desktop/actions/initActions.ts apps/desktop-app/src/renderer/components/settings/SettingsReleaseUpdate.vue apps/desktop-app/src/renderer/components/settings/SettingsReleaseUpdate.test.ts apps/desktop-app/src/renderer/components/settings/SettingsGlobal.vue apps/desktop-app/src/renderer/components/settings/SettingsGlobal.test.ts apps/desktop-app/src/renderer/locales/en.json apps/desktop-app/src/renderer/locales/zh.json apps/desktop-app/src/renderer/components/icons/index.ts
git commit -m "feat: add release update settings UI"
```

## Task 5: Release Scripts

**Files:**
- Create: `scripts/release/utils.mjs`
- Create: `scripts/release/prepare.mjs`
- Create: `scripts/release/check.mjs`
- Create: `scripts/release/collect-desktop-artifact.mjs`
- Create: `scripts/release/zip-extension.mjs`
- Create: `scripts/release/manifest.mjs`
- Create: `scripts/release/release-scripts.test.mjs`
- Modify: `package.json`

- [ ] **Step 1: Write release script tests**

Create `scripts/release/release-scripts.test.mjs` using Node's built-in test runner:

```js
import assert from "node:assert/strict";
import test from "node:test";
import {
  buildReleaseManifest,
  compareVersions,
  normalizeVersion,
  platformKeyFromArtifactName
} from "./utils.mjs";

const checksum = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

test("normalizeVersion accepts X.Y.Z and vX.Y.Z", () => {
  assert.equal(normalizeVersion("1.2.0"), "1.2.0");
  assert.equal(normalizeVersion("v1.2.0"), "1.2.0");
});

test("compareVersions compares product versions", () => {
  assert.equal(compareVersions("1.2.0", "1.2.0"), 0);
  assert.equal(compareVersions("1.2.1", "1.2.0"), 1);
  assert.equal(compareVersions("1.2.0", "1.3.0"), -1);
});

test("platformKeyFromArtifactName maps supported desktop artifact names", () => {
  assert.equal(platformKeyFromArtifactName("Immersive-Subs-Prompter-1.2.0-darwin-arm64.dmg"), "darwin-arm64");
  assert.equal(platformKeyFromArtifactName("Immersive-Subs-Prompter-1.2.0-win32-x64.exe"), "win32-x64");
  assert.equal(platformKeyFromArtifactName("Immersive-Subs-Prompter-1.2.0-linux-x64.AppImage"), "linux-x64");
  assert.equal(platformKeyFromArtifactName("readme.txt"), null);
});

test("buildReleaseManifest creates current schema", () => {
  const manifest = buildReleaseManifest({
    version: "1.2.0",
    releasedAt: "2026-06-10T12:00:00Z",
    releaseUrl: "https://github.com/XiiTang/Immersive-Subs-Prompter/releases/tag/v1.2.0",
    notes: { en: "English notes", zh: "中文说明" },
    desktopArtifacts: [
      {
        fileName: "Immersive-Subs-Prompter-1.2.0-darwin-arm64.dmg",
        url: "https://github.com/XiiTang/Immersive-Subs-Prompter/releases/download/v1.2.0/mac.dmg",
        sha256: checksum,
        signed: false
      },
      {
        fileName: "Immersive-Subs-Prompter-1.2.0-win32-x64.exe",
        url: "https://github.com/XiiTang/Immersive-Subs-Prompter/releases/download/v1.2.0/win.exe",
        sha256: checksum,
        signed: false
      },
      {
        fileName: "Immersive-Subs-Prompter-1.2.0-linux-x64.deb",
        url: "https://github.com/XiiTang/Immersive-Subs-Prompter/releases/download/v1.2.0/linux.deb",
        sha256: checksum,
        signed: false
      }
    ],
    extensionArtifacts: {
      chrome: {
        version: "1.2.0",
        artifactUrl: "https://github.com/XiiTang/Immersive-Subs-Prompter/releases/download/v1.2.0/chrome.zip",
        sha256: checksum,
        storeStatus: "manual-review"
      },
      firefox: {
        version: "1.2.0",
        artifactUrl: "https://github.com/XiiTang/Immersive-Subs-Prompter/releases/download/v1.2.0/firefox.zip",
        sha256: checksum,
        storeStatus: "manual-review"
      }
    }
  });

  assert.equal(manifest.schemaVersion, 1);
  assert.equal(manifest.desktop["darwin-arm64"].sha256, checksum);
  assert.equal(manifest.extension.chrome.version, "1.2.0");
});
```

- [ ] **Step 2: Run the failing script tests**

Run:

```bash
node --test scripts/release/release-scripts.test.mjs
```

Expected: FAIL because `scripts/release/utils.mjs` does not exist.

- [ ] **Step 3: Implement `scripts/release/utils.mjs`**

Create helpers with these exports:

```js
export function normalizeVersion(input) {}
export function compareVersions(left, right) {}
export function readJson(filePath) {}
export function writeJson(filePath, value) {}
export function readPackageVersions(workspaceRoot) {}
export function assertUnifiedPackageVersions(workspaceRoot, expectedVersion) {}
export function updatePackageVersions(workspaceRoot, version) {}
export function sha256File(filePath) {}
export function platformKeyFromArtifactName(fileName) {}
export function buildReleaseManifest(options) {}
```

Implement `normalizeVersion` with `/^v?(\d+)\.(\d+)\.(\d+)$/`. Implement `sha256File` with `node:crypto`. Implement `platformKeyFromArtifactName` by matching `darwin-arm64`, `darwin-x64`, `win32-arm64`, `win32-x64`, `linux-arm64`, and `linux-x64` inside the artifact name.

`buildReleaseManifest` must produce schema version 1, reject duplicate platform keys, reject missing Chrome or Firefox extension artifacts, and reject non-HTTPS URLs.

- [ ] **Step 4: Implement `release:prepare`**

Create `scripts/release/prepare.mjs`:

```js
import { execFileSync } from "node:child_process";
import { normalizeVersion, updatePackageVersions } from "./utils.mjs";

const versionArg = process.argv[2];
if (!versionArg) {
  throw new Error("Usage: pnpm release:prepare <version>");
}

const version = normalizeVersion(versionArg);
updatePackageVersions(process.cwd(), version);
execFileSync("pnpm", ["install", "--lockfile-only"], { stdio: "inherit", shell: process.platform === "win32" });
console.log(`Prepared release version ${version}`);
```

This script updates only `package.json`, `apps/desktop-app/package.json`, `apps/extension/package.json`, and lockfile metadata.

- [ ] **Step 5: Implement extension ZIP packaging**

Create `scripts/release/zip-extension.mjs`. It must:

- read the unified version
- run after extension builds have produced `apps/extension/dist/chrome` and `apps/extension/dist/firefox`
- zip each target directory with deterministic timestamps
- write to `release-artifacts/extension/immersive-subs-prompter-chrome-vX.Y.Z.zip`
- write to `release-artifacts/extension/immersive-subs-prompter-firefox-vX.Y.Z.zip`

Use `fflate.zipSync` as the repository already does in `scripts/package-plugins.mjs`.

- [ ] **Step 6: Implement manifest generation**

Create `scripts/release/manifest.mjs`. It must accept:

```bash
node scripts/release/manifest.mjs --tag v1.2.0 --artifacts release-artifacts --out releases/latest.json --notes-en "English notes" --notes-zh "中文说明"
```

The script scans artifacts, computes SHA-256, builds GitHub Release asset URLs, and writes `releases/latest.json`. Extension store status defaults to `manual-review`. Desktop `signed` defaults to `false`, and generation fails unless macOS, Windows, and Linux desktop artifact families are all present.

- [ ] **Step 7: Implement release preflight**

Create `scripts/release/check.mjs`. It must:

- verify the three package versions match
- verify the version matches `--tag` when a tag is provided
- validate `releases/latest.json` when it exists

- [ ] **Step 8: Wire root package scripts**

Modify root `package.json` scripts:

```json
"release:prepare": "node ./scripts/release/prepare.mjs",
"release:check": "node ./scripts/release/check.mjs",
"release:collect-desktop": "node ./scripts/release/collect-desktop-artifact.mjs",
"release:manifest": "node ./scripts/release/manifest.mjs",
"release:zip-extension": "node ./scripts/release/zip-extension.mjs",
"test:release-scripts": "node --test scripts/release/release-scripts.test.mjs"
```

Update root `test` so release script tests run before existing tests:

```json
"test": "pnpm test:release-scripts && node ./scripts/check-silent-catches.mjs && pnpm --filter @immersive-subs/contracts test && pnpm --filter @immersive-subs/desktop-app test:app && pnpm --filter @immersive-subs/extension test:app"
```

- [ ] **Step 9: Run script tests and preflight**

Run:

```bash
pnpm test:release-scripts
pnpm release:check
```

Expected: both commands PASS.

- [ ] **Step 10: Commit**

```bash
git add scripts/release package.json pnpm-lock.yaml
git commit -m "feat: add release automation scripts"
```

## Task 6: GitHub Release Workflow

**Files:**
- Create: `.github/workflows/release.yml`

- [ ] **Step 1: Create the release workflow**

Create `.github/workflows/release.yml` with this structure:

```yaml
name: Release

on:
  push:
    tags:
      - "v*"
  workflow_dispatch:
    inputs:
      tag:
        description: "Release tag such as v1.2.0"
        required: true
        type: string

permissions:
  contents: write
  pull-requests: write

jobs:
  validate:
    runs-on: ubuntu-latest
    outputs:
      tag: ${{ steps.meta.outputs.tag }}
      version: ${{ steps.meta.outputs.version }}
    steps:
      - uses: actions/checkout@v6
      - uses: actions/setup-node@v6
        with:
          node-version: "24"
      - uses: pnpm/action-setup@v6
      - run: pnpm install
      - id: meta
        shell: bash
        run: |
          if [ "${{ github.event_name }}" = "workflow_dispatch" ]; then
            TAG="${{ github.event.inputs.tag }}"
          else
            TAG="${GITHUB_REF#refs/tags/}"
          fi
          VERSION="${TAG#v}"
          echo "tag=$TAG" >> "$GITHUB_OUTPUT"
          echo "version=$VERSION" >> "$GITHUB_OUTPUT"
      - run: pnpm release:check -- --tag "${{ steps.meta.outputs.tag }}"
      - run: pnpm typecheck
      - run: pnpm test

  desktop:
    needs: validate
    strategy:
      fail-fast: false
      matrix:
        include:
          - os: macos-latest
            command: pnpm --filter @immersive-subs/desktop-app dist:mac
            name: desktop-macos
          - os: windows-latest
            command: pnpm --filter @immersive-subs/desktop-app dist:win
            name: desktop-windows
          - os: ubuntu-latest
            command: pnpm --filter @immersive-subs/desktop-app dist:linux
            name: desktop-linux
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@v6
      - uses: actions/setup-node@v6
        with:
          node-version: "24"
      - uses: pnpm/action-setup@v6
      - run: pnpm install
      - if: matrix.os == 'ubuntu-latest'
        run: sudo apt-get update && sudo apt-get install -y rpm
      - run: ${{ matrix.command }}
      - uses: actions/upload-artifact@v4
        with:
          name: ${{ matrix.name }}
          path: apps/desktop-app/out

  extension:
    needs: validate
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - uses: actions/setup-node@v6
        with:
          node-version: "24"
      - uses: pnpm/action-setup@v6
      - run: pnpm install
      - run: pnpm --filter @immersive-subs/extension build:chrome
      - run: pnpm --filter @immersive-subs/extension build:firefox
      - run: pnpm release:zip-extension
      - uses: actions/upload-artifact@v4
        with:
          name: extension-zips
          path: release-artifacts/extension

  publish:
    needs:
      - validate
      - desktop
      - extension
    runs-on: ubuntu-latest
    env:
      GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
    steps:
      - uses: actions/checkout@v6
        with:
          fetch-depth: 0
      - uses: actions/setup-node@v6
        with:
          node-version: "24"
      - uses: pnpm/action-setup@v6
      - run: pnpm install
      - uses: actions/download-artifact@v4
        with:
          path: release-artifacts
      - run: pnpm release:manifest -- --tag "${{ needs.validate.outputs.tag }}" --artifacts release-artifacts --out releases/latest.json --notes-en "See the GitHub Release for details." --notes-zh "请查看 GitHub Release 获取更新内容。"
      - run: |
          TAG="${{ needs.validate.outputs.tag }}"
          gh release view "$TAG" >/dev/null 2>&1 || gh release create "$TAG" --draft --title "$TAG" --notes "Release $TAG"
          find release-artifacts -type f -print0 | xargs -0 gh release upload "$TAG" --clobber
      - run: |
          BRANCH="chore/publish-release-manifest-${{ needs.validate.outputs.tag }}"
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git checkout -b "$BRANCH"
          git add releases/latest.json
          git commit -m "chore: publish release manifest ${{ needs.validate.outputs.tag }}"
          git push origin "$BRANCH"
          gh pr create --title "chore: publish release manifest ${{ needs.validate.outputs.tag }}" --body "Publishes releases/latest.json for ${{ needs.validate.outputs.tag }}." --base main --head "$BRANCH"
```

- [ ] **Step 2: Validate workflow syntax locally**

Run:

```bash
node -e "const fs=require('node:fs'); if (!fs.existsSync('.github/workflows/release.yml')) process.exit(1)"
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/release.yml
git commit -m "ci: add release workflow"
```

## Task 7: Deployment Documentation

**Files:**
- Modify: `DEPLOYMENT.md`

- [ ] **Step 1: Update the release section**

In `DEPLOYMENT.md`, add a final release section that states:

```md
## Product Release

Desktop and extension releases use one product version. Before creating a tag, run:

```bash
pnpm release:prepare 1.2.0
pnpm release:check
pnpm typecheck
pnpm test
```

Create and push a release tag:

```bash
git tag v1.2.0
git push origin v1.2.0
```

The release workflow builds desktop installers on macOS, Windows, and Linux, builds Chrome and Firefox extension ZIP files, creates a draft GitHub Release, uploads release assets, and opens a pull request updating `releases/latest.json`.

The desktop app reads `releases/latest.json` for update checks. The manifest becomes active only after the release-manifest pull request is reviewed and merged.

Chrome Web Store and Firefox AMO submission remain manual. Update `extension.chrome.storeStatus` and `extension.firefox.storeStatus` in a follow-up manifest pull request when store review status changes.
```

- [ ] **Step 2: Remove contradictory wording**

In `DEPLOYMENT.md`, keep the existing plugin note that GitHub Releases are not used for plugin packages. Do not add plugin packages to the product release section.

- [ ] **Step 3: Commit**

```bash
git add DEPLOYMENT.md
git commit -m "docs: document product release workflow"
```

## Task 8: Final Verification

**Files:**
- All files changed by Tasks 1 through 7.

- [ ] **Step 1: Run focused desktop tests**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app exec vitest run src/main/releases/releaseManifest.test.ts src/main/appReleaseService.test.ts src/main/settings/SettingsStore.test.ts src/renderer/components/settings/SettingsReleaseUpdate.test.ts src/renderer/components/settings/SettingsGlobal.test.ts src/renderer/stores/desktop.test.ts --project main --project jsdom
```

Expected: PASS.

- [ ] **Step 2: Run extension tests**

Run:

```bash
pnpm --filter @immersive-subs/extension test
```

Expected: PASS.

- [ ] **Step 3: Run release script tests**

Run:

```bash
pnpm test:release-scripts
```

Expected: PASS.

- [ ] **Step 4: Run repository checks**

Run:

```bash
pnpm typecheck
pnpm test
pnpm build
```

Expected: all commands PASS.

- [ ] **Step 5: Validate extension ZIP creation**

Run:

```bash
pnpm --filter @immersive-subs/extension build:chrome
pnpm --filter @immersive-subs/extension build:firefox
pnpm release:zip-extension
ls release-artifacts/extension
```

Expected output includes:

```text
immersive-subs-prompter-chrome-v1.0.0.zip
immersive-subs-prompter-firefox-v1.0.0.zip
```

Use the current package version in the expected filenames if it is not `1.0.0`.

- [ ] **Step 6: Validate manifest generation with local artifacts**

Run:

```bash
mkdir -p release-artifacts/desktop-local
printf darwin > release-artifacts/desktop-local/Immersive-Subs-Prompter-1.0.0-darwin-arm64.dmg
printf win32 > release-artifacts/desktop-local/Immersive-Subs-Prompter-1.0.0-win32-x64.exe
printf linux > release-artifacts/desktop-local/Immersive-Subs-Prompter-1.0.0-linux-x64.deb
pnpm release:manifest -- --tag v1.0.0 --artifacts release-artifacts --out releases/latest.json --notes-en "Local release verification." --notes-zh "本地发布验证。"
node -e "const fs=require('node:fs'); const m=JSON.parse(fs.readFileSync('releases/latest.json','utf8')); if (m.schemaVersion !== 1) process.exit(1); console.log(m.version)"
```

Expected: prints the generated manifest version.

- [ ] **Step 7: Clean generated local release artifacts before final commit**

Run:

```bash
rm -rf release-artifacts
git status --short
```

If `releases/latest.json` was generated only for local verification and there is no real GitHub Release for it, remove it before the final implementation commit:

```bash
rm -f releases/latest.json
```

- [ ] **Step 8: Final status**

Run:

```bash
git status --short
```

Expected: clean after all task commits, or only intentional documentation and source changes staged for a final commit.
