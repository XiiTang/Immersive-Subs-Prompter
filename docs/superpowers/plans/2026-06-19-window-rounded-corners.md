# Window Rounded Corners Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the desktop main window and settings window use rounded visible outer corners on macOS, Windows, and Linux packaged builds.

**Architecture:** Keep BrowserWindow instances as carrier windows and make renderer shells own the visible rounded boundary. The main window already uses a transparent frameless carrier; settings becomes a transparent carrier while preserving the current hidden-titlebar/control-overlay behavior. A single renderer token supplies the shared `10px` outer radius.

**Tech Stack:** Electron, Vue 3, TypeScript, CSS, Vitest jsdom/browser projects, pnpm workspace.

---

## File Structure

- Modify: `apps/desktop-app/src/renderer/style.css`
  - Owns the shared window radius token and visible rounded/clipped renderer shells.
- Modify: `apps/desktop-app/src/renderer/components/top-panel/TopControlPanel.test.ts`
  - Replaces the square-border assertion with the rounded main-window shell contract.
- Modify: `apps/desktop-app/src/renderer/components/top-panel/TopControlPanel.browser.test.ts`
  - Verifies the top panel computes to a `10px` clipped rounded surface in the browser renderer.
- Modify: `apps/desktop-app/src/renderer/components/settings/SettingsWindowShell.test.ts`
  - Adds the settings renderer-owned rounded shell CSS contract.
- Modify: `apps/desktop-app/src/renderer/components/settings/SettingsWindowShell.browser.test.ts`
  - Verifies settings shell computed radius, transparent outer host, and clipped overflow in the browser renderer.
- Modify: `apps/desktop-app/src/main/window/windowManager.ts`
  - Adds Electron's rounded-corner native hint to the existing transparent frameless main carrier.
- Modify: `apps/desktop-app/src/main/window/windowManager.test.ts`
  - Locks the main carrier options.
- Modify: `apps/desktop-app/src/main/window/settingsWindowManager.ts`
  - Makes settings a transparent renderer-owned carrier and keeps non-mac titlebar overlay controls available.
- Modify: `apps/desktop-app/src/main/window/settingsWindowManager.test.ts`
  - Locks settings carrier options for macOS, Windows, and Linux.

## Task 1: Lock Renderer Window Boundary Tests

**Files:**
- Modify: `apps/desktop-app/src/renderer/components/top-panel/TopControlPanel.test.ts`
- Modify: `apps/desktop-app/src/renderer/components/top-panel/TopControlPanel.browser.test.ts`
- Modify: `apps/desktop-app/src/renderer/components/settings/SettingsWindowShell.test.ts`
- Modify: `apps/desktop-app/src/renderer/components/settings/SettingsWindowShell.browser.test.ts`

- [ ] **Step 1: Replace the square top-panel CSS assertion**

In `apps/desktop-app/src/renderer/components/top-panel/TopControlPanel.test.ts`, replace the existing test named `"keeps the top control panel border square"` with:

```ts
  it("uses the shared rounded window boundary", () => {
    expect(rendererStylesheet).toContain("--window-boundary-radius: 10px;");
    expect(rendererStylesheet).toMatch(
      /\.window\s*\{[^}]*border-radius:\s*var\(--window-boundary-radius\);/s
    );
    expect(rendererStylesheet).toMatch(
      /\.top-control-panel__surface\s*\{[^}]*border-radius:\s*var\(--window-boundary-radius\);[^}]*overflow:\s*hidden;/s
    );
    expect(rendererStylesheet).not.toMatch(
      /\.top-control-panel__surface\s*\{[^}]*border-radius:\s*0;/s
    );
  });
```

- [ ] **Step 2: Add a browser computed-style test for the main rounded surface**

In `apps/desktop-app/src/renderer/components/top-panel/TopControlPanel.browser.test.ts`, add this test after `"keeps the top header and right action buttons compact"`:

```ts
  it("renders the top panel as a clipped rounded window surface", async () => {
    const { host, wrapper } = mountTopControlPanelInNarrowHost(480);

    await nextFrame();

    const surface = host.querySelector<HTMLElement>('[data-testid="top-control-panel-surface"]');
    expect(surface).not.toBeNull();

    const style = getComputedStyle(surface!);
    expect(style.borderTopLeftRadius).toBe("10px");
    expect(style.borderTopRightRadius).toBe("10px");
    expect(style.borderBottomLeftRadius).toBe("10px");
    expect(style.borderBottomRightRadius).toBe("10px");
    expect(style.overflow).toBe("hidden");

    wrapper.unmount();
    host.remove();
  });
```

- [ ] **Step 3: Add the settings renderer shell CSS contract**

In `apps/desktop-app/src/renderer/components/settings/SettingsWindowShell.test.ts`, add this test after `"keeps settings controls outside Electron drag regions"`:

```ts
  it("uses a renderer-owned rounded settings shell boundary", () => {
    expect(rendererStylesheet).toContain("--window-boundary-radius: 10px;");
    expect(rendererStylesheet).toMatch(
      /\.settings-window\s*\{[^}]*background:\s*transparent;[^}]*border-radius:\s*var\(--window-boundary-radius\);[^}]*overflow:\s*hidden;/s
    );
    expect(rendererStylesheet).toMatch(
      /\.settings-window-shell\s*\{[^}]*background:\s*var\(--ui-bg\);[^}]*border-radius:\s*var\(--window-boundary-radius\);[^}]*overflow:\s*hidden;/s
    );
  });
```

- [ ] **Step 4: Add a browser computed-style test for the settings rounded shell**

In `apps/desktop-app/src/renderer/components/settings/SettingsWindowShell.browser.test.ts`, add this test after `"keeps a fixed nav and one active section column"`:

```ts
  it("renders settings with a transparent host and clipped rounded shell", () => {
    const wrapper = shallowMount(SettingsWindowShell, {
      attachTo: document.body,
      global: {
        stubs: {
          SettingsNav: sectionStub("settings-nav-content"),
          SettingsGlobal: sectionStub("settings-section-general-content"),
          SettingsProfiles: sectionStub("settings-section-profiles-content"),
          SettingsFeatures: sectionStub("settings-section-features-content")
        }
      }
    });

    const host = document.createElement("div");
    host.className = "settings-window";
    host.appendChild(wrapper.element);
    document.body.appendChild(host);

    const hostStyle = getComputedStyle(host);
    const shellStyle = getComputedStyle(wrapper.get('[data-testid="settings-shell"]').element);

    expect(hostStyle.backgroundColor).toBe("rgba(0, 0, 0, 0)");
    expect(hostStyle.borderTopLeftRadius).toBe("10px");
    expect(hostStyle.overflow).toBe("hidden");
    expect(shellStyle.borderTopLeftRadius).toBe("10px");
    expect(shellStyle.borderTopRightRadius).toBe("10px");
    expect(shellStyle.borderBottomLeftRadius).toBe("10px");
    expect(shellStyle.borderBottomRightRadius).toBe("10px");
    expect(shellStyle.overflow).toBe("hidden");

    wrapper.unmount();
    host.remove();
  });
```

- [ ] **Step 5: Run jsdom renderer tests and verify they fail**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app exec vitest run src/renderer/components/top-panel/TopControlPanel.test.ts src/renderer/components/settings/SettingsWindowShell.test.ts --project jsdom
```

Expected: FAIL. The failures should mention the missing `--window-boundary-radius` token or the old `border-radius: 0` top-panel surface.

- [ ] **Step 6: Run browser renderer tests and verify they fail**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app exec vitest run src/renderer/components/top-panel/TopControlPanel.browser.test.ts src/renderer/components/settings/SettingsWindowShell.browser.test.ts --project browser
```

Expected: FAIL. The failures should show the computed radius is not `10px`, or the settings host is still painting `var(--ui-bg)` instead of transparent.

## Task 2: Implement Renderer-Owned Rounded Shells

**Files:**
- Modify: `apps/desktop-app/src/renderer/style.css`

- [ ] **Step 1: Add the shared window radius token**

In `apps/desktop-app/src/renderer/style.css`, update the product-surface `:root` block to:

```css
/* Product surfaces */
:root {
  --panel-opacity-factor: 1;
  --top-panel-collapsed-offset: 0px;
  --window-boundary-radius: 10px;
}
```

- [ ] **Step 2: Clip the main root window by the shared radius**

In the `.window` block, keep the existing declarations and add the radius:

```css
.window {
  width: 100%;
  height: 100vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: transparent;
  border: 0;
  border-radius: var(--window-boundary-radius);
  position: relative;
}
```

- [ ] **Step 3: Replace the square top-panel surface radius**

In the `.top-control-panel__surface` block, replace `border-radius: 0;` with the shared radius. The block should read:

```css
.top-control-panel__surface {
  position: absolute;
  inset: 0 0 auto 0;
  display: flex;
  flex-direction: column;
  border-bottom: 1px solid var(--ui-border);
  border-radius: var(--window-boundary-radius);
  background: var(--ui-surface);
  overflow: hidden;
  transform: translate3d(0, 0, 0);
  transform-origin: top;
  transition: transform 180ms ease, opacity 160ms ease;
  pointer-events: auto;
}
```

- [ ] **Step 4: Make the settings host transparent and clipped**

Replace the `.settings-window` block with:

```css
.settings-window {
  height: 100vh;
  min-height: 100vh;
  background: transparent;
  color: var(--ui-text);
  border-radius: var(--window-boundary-radius);
  overflow: hidden;
  -webkit-app-region: no-drag;
}
```

- [ ] **Step 5: Make the settings shell the only visible settings background**

Replace the `.settings-window-shell` block with:

```css
.settings-window-shell {
  display: grid;
  grid-template-rows: 48px minmax(0, 1fr);
  height: 100vh;
  min-height: 0;
  background: var(--ui-bg);
  border-radius: var(--window-boundary-radius);
  overflow: hidden;
}
```

- [ ] **Step 6: Run focused renderer tests and verify they pass**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app exec vitest run src/renderer/components/top-panel/TopControlPanel.test.ts src/renderer/components/settings/SettingsWindowShell.test.ts --project jsdom
pnpm --filter @immersive-subs/desktop-app exec vitest run src/renderer/components/top-panel/TopControlPanel.browser.test.ts src/renderer/components/settings/SettingsWindowShell.browser.test.ts --project browser
```

Expected: PASS for both commands.

- [ ] **Step 7: Commit renderer boundary changes**

Run:

```bash
git add apps/desktop-app/src/renderer/style.css \
  apps/desktop-app/src/renderer/components/top-panel/TopControlPanel.test.ts \
  apps/desktop-app/src/renderer/components/top-panel/TopControlPanel.browser.test.ts \
  apps/desktop-app/src/renderer/components/settings/SettingsWindowShell.test.ts \
  apps/desktop-app/src/renderer/components/settings/SettingsWindowShell.browser.test.ts
git commit -m "fix: round renderer window shells"
```

Expected: Commit succeeds.

## Task 3: Lock BrowserWindow Carrier Options

**Files:**
- Modify: `apps/desktop-app/src/main/window/windowManager.test.ts`
- Modify: `apps/desktop-app/src/main/window/settingsWindowManager.test.ts`

- [ ] **Step 1: Lock the main transparent rounded carrier options**

In `apps/desktop-app/src/main/window/windowManager.test.ts`, update the first test's final `toMatchObject()` expectation to:

```ts
    expect(createdOptions[0]).toMatchObject({
      width: MAIN_WINDOW_DEFAULT_WIDTH,
      height: MAIN_WINDOW_DEFAULT_HEIGHT,
      frame: false,
      hasShadow: false,
      transparent: true,
      backgroundColor: "#00000000",
      roundedCorners: true,
      resizable: true
    });
```

- [ ] **Step 2: Replace settings window tests with platform carrier tests**

Replace `apps/desktop-app/src/main/window/settingsWindowManager.test.ts` with:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";

async function createSettingsWindowForPlatform(platform: NodeJS.Platform) {
  const originalPlatform = process.platform;
  Object.defineProperty(process, "platform", { value: platform });

  const createdOptions: Array<Record<string, unknown>> = [];

  class BrowserWindowMock {
    readonly webContents = {
      once: vi.fn()
    };
    readonly loadFile = vi.fn();
    readonly on = vi.fn();

    constructor(options: Record<string, unknown>) {
      createdOptions.push(options);
    }

    isDestroyed() {
      return false;
    }

    isMinimized() {
      return false;
    }

    restore() {}
    show() {}
    focus() {}
  }

  vi.doMock("electron", () => ({
    BrowserWindow: BrowserWindowMock
  }));

  try {
    const { SettingsWindowManager } = await import("./settingsWindowManager.js");
    const manager = new SettingsWindowManager({
      getWindowIconPath: () => "/tmp/icon.png"
    });

    manager.openSettingsWindow();
  } finally {
    Object.defineProperty(process, "platform", { value: originalPlatform });
  }

  expect(createdOptions).toHaveLength(1);
  return createdOptions[0]!;
}

describe("SettingsWindowManager", () => {
  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it("opens the fixed settings window as a transparent rounded carrier", async () => {
    const options = await createSettingsWindowForPlatform(process.platform);

    expect(options).toMatchObject({
      width: 880,
      height: 760,
      resizable: false,
      fullscreenable: false,
      titleBarStyle: "hidden",
      transparent: true,
      backgroundColor: "#00000000",
      hasShadow: false,
      roundedCorners: true
    });
    expect(options).not.toHaveProperty("minWidth");
    expect(options).not.toHaveProperty("minHeight");
    expect(options).not.toHaveProperty("maxWidth");
    expect(options).not.toHaveProperty("maxHeight");
  });

  it("uses a frameless titlebar overlay carrier on Windows", async () => {
    const options = await createSettingsWindowForPlatform("win32");

    expect(options).toMatchObject({
      frame: false,
      titleBarOverlay: {
        color: "#0d1117",
        symbolColor: "#e5e5e5",
        height: 48
      }
    });
  });

  it("uses a frameless titlebar overlay carrier on Linux", async () => {
    const options = await createSettingsWindowForPlatform("linux");

    expect(options).toMatchObject({
      frame: false,
      titleBarOverlay: {
        color: "#0d1117",
        symbolColor: "#e5e5e5",
        height: 48
      }
    });
  });

  it("keeps macOS hidden-titlebar controls without forcing a frame override", async () => {
    const options = await createSettingsWindowForPlatform("darwin");

    expect(options).not.toHaveProperty("frame");
    expect(options).not.toHaveProperty("titleBarOverlay");
  });
});
```

- [ ] **Step 3: Run focused main-process tests and verify they fail**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app exec vitest run src/main/window/windowManager.test.ts src/main/window/settingsWindowManager.test.ts --project main
```

Expected: FAIL. The main window should be missing `roundedCorners: true`; settings should still have the opaque `backgroundColor: "#101418"` and should not yet set transparent carrier options.

## Task 4: Implement Transparent Rounded Carrier Options

**Files:**
- Modify: `apps/desktop-app/src/main/window/windowManager.ts`
- Modify: `apps/desktop-app/src/main/window/settingsWindowManager.ts`

- [ ] **Step 1: Add the native rounded-corner hint to the main window**

In `apps/desktop-app/src/main/window/windowManager.ts`, add `roundedCorners: true` immediately after the transparent background:

```ts
      frame: false,
      hasShadow: false,
      transparent: true,
      backgroundColor: "#00000000",
      roundedCorners: true,
      resizable: true,
```

- [ ] **Step 2: Make settings a transparent carrier with non-mac titlebar overlay controls**

In `apps/desktop-app/src/main/window/settingsWindowManager.ts`, replace the BrowserWindow option section with:

```ts
    this.settingsWindow = new BrowserWindow({
      width: SETTINGS_WINDOW_WIDTH,
      height: SETTINGS_WINDOW_HEIGHT,
      resizable: false,
      fullscreenable: false,
      titleBarStyle: "hidden",
      ...(process.platform !== "darwin" && {
        frame: false,
        titleBarOverlay: {
          color: "#0d1117",
          symbolColor: "#e5e5e5",
          height: 48
        }
      }),
      transparent: true,
      backgroundColor: "#00000000",
      hasShadow: false,
      roundedCorners: true,
      webPreferences: {
        preload: path.join(this.__dirname, "../../preload.cjs"),
        contextIsolation: true,
        nodeIntegration: false
      },
      icon: this.options.getWindowIconPath()
    });
```

- [ ] **Step 3: Run focused main-process tests and verify they pass**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app exec vitest run src/main/window/windowManager.test.ts src/main/window/settingsWindowManager.test.ts --project main
```

Expected: PASS.

- [ ] **Step 4: Run all focused rounded-window tests together**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app exec vitest run src/main/window/windowManager.test.ts src/main/window/settingsWindowManager.test.ts --project main
pnpm --filter @immersive-subs/desktop-app exec vitest run src/renderer/components/top-panel/TopControlPanel.test.ts src/renderer/components/settings/SettingsWindowShell.test.ts --project jsdom
pnpm --filter @immersive-subs/desktop-app exec vitest run src/renderer/components/top-panel/TopControlPanel.browser.test.ts src/renderer/components/settings/SettingsWindowShell.browser.test.ts --project browser
```

Expected: PASS for all three commands.

- [ ] **Step 5: Commit carrier option changes**

Run:

```bash
git add apps/desktop-app/src/main/window/windowManager.ts \
  apps/desktop-app/src/main/window/settingsWindowManager.ts \
  apps/desktop-app/src/main/window/windowManager.test.ts \
  apps/desktop-app/src/main/window/settingsWindowManager.test.ts
git commit -m "fix: use rounded transparent window carriers"
```

Expected: Commit succeeds.

## Task 5: Final Verification

**Files:**
- Verify: repository root

- [ ] **Step 1: Run desktop app tests**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app test:app
```

Expected: PASS.

- [ ] **Step 2: Run typecheck**

Run:

```bash
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 3: Run UI boundary lint**

Run:

```bash
pnpm lint:ui-boundaries
```

Expected: PASS.

- [ ] **Step 4: Run full repository tests**

Run:

```bash
pnpm test
```

Expected: PASS.

- [ ] **Step 5: Check whitespace and final diff**

Run:

```bash
git diff --check
git status --short
```

Expected: `git diff --check` exits 0. `git status --short` shows only the intentional implementation commits relative to the branch base, with no generated browser screenshots or trace artifacts left in the working tree.

- [ ] **Step 6: Confirm final-state scope**

Run:

```bash
rg -n "compat|legacy|migration|fallback" \
  apps/desktop-app/src/main/window/windowManager.ts \
  apps/desktop-app/src/main/window/settingsWindowManager.ts \
  apps/desktop-app/src/renderer/style.css \
  apps/desktop-app/src/renderer/components/top-panel/TopControlPanel.test.ts \
  apps/desktop-app/src/renderer/components/top-panel/TopControlPanel.browser.test.ts \
  apps/desktop-app/src/renderer/components/settings/SettingsWindowShell.test.ts \
  apps/desktop-app/src/renderer/components/settings/SettingsWindowShell.browser.test.ts
```

Expected: No output for this rounded-window change. Do not add compatibility, migration, legacy, or fallback code for the previous square-window behavior.
