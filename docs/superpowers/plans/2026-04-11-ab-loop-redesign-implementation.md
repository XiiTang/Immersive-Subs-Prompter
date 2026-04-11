# A-B Loop Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild A-B loop behavior across the extension and desktop renderer so `AB/A/B` endpoint selection, loop-wrap playback, predicted-time highlighting, and auto-follow pause rules all behave deterministically.

**Architecture:** Keep the existing “extension time updates + desktop predicted playback” model, but add a shared loop-session payload so the extension can mark `loop-wrap` boundaries explicitly. On the renderer side, split A-B endpoint UI state from loop playback state, add a focused helper for `AB/A/B` label resolution, and treat auto-follow pause as an intent-based state machine instead of a generic DOM side effect.

**Tech Stack:** Electron main/renderer, Vue 3, TypeScript, Pinia, Vitest, Vue Test Utils, browser extension ES modules, jsdom

---

## File Structure

### New Files

- `extension/vitest.config.js`
  Purpose: add a minimal jsdom-based unit-test harness for extension modules.
- `extension/src/test/setup.js`
  Purpose: provide stable browser-like globals and timer cleanup for extension unit tests.
- `extension/src/video/LoopController.test.js`
  Purpose: lock in loop session creation, loop-wrap emission, and cleanup behavior.
- `extension/src/background/messaging/ContentMessageRouter.test.js`
  Purpose: lock in loop metadata forwarding from content scripts to desktop clients.
- `desktop-app/src/renderer/components/subtitle/abLoopSelection.ts`
  Purpose: hold pure `AB/A/B` endpoint-selection state transitions so `SubtitleView.vue` does not own the whole state machine inline.
- `desktop-app/src/renderer/components/subtitle/abLoopSelection.test.ts`
  Purpose: verify first-click, second-click, reverse-order selection, and cancel behavior.
- `desktop-app/src/renderer/components/subtitle/composables/useTranscriptSelection.test.ts`
  Purpose: verify only reading interactions pause auto-follow and control interactions do not.

### Modified Files

- `extension/package.json`
  Purpose: add a test script and dev dependencies for the extension test harness.
- `extension/package-lock.json`
  Purpose: record the extension test harness dependency updates.
- `extension/src/content/state.js`
  Purpose: expand loop runtime state to store loop mode, endpoint metadata, and programmatic seek reason.
- `extension/src/video/LoopController.js`
  Purpose: manage loop sessions, emit `loop-wrap` metadata, and keep time updates flowing during loop playback.
- `extension/src/video/ControlHandler.js`
  Purpose: pass loop mode / endpoint payload from desktop commands into the loop controller.
- `extension/src/video/VideoStateGatherer.js`
  Purpose: attach loop metadata and boundary-transition reason to outgoing `time-update` payloads.
- `extension/src/background/messaging/ContentMessageRouter.js`
  Purpose: preserve loop metadata while forwarding media updates to the desktop app.
- `desktop-app/src/main/types.ts`
  Purpose: define shared loop-session and boundary-transition types for desktop runtime and renderer code.
- `desktop-app/src/main/stateManager.ts`
  Purpose: extend playback state with loop-session metadata.
- `desktop-app/src/main/connectionManager.ts`
  Purpose: send richer loop commands to the extension and ingest `loop-wrap` playback updates without losing predicted-time semantics.
- `desktop-app/src/renderer/components/subtitle/transcript/types.ts`
  Purpose: add the `loop-wrap-follow` viewport anchor reason used by the renderer.
- `desktop-app/src/renderer/components/subtitle/loopPlayback.ts`
  Purpose: centralize loop-window display helpers and boundary handling for predicted playback.
- `desktop-app/src/renderer/components/subtitle/loopPlayback.test.ts`
  Purpose: verify A-B wrap handling never leaks to neighboring cues.
- `desktop-app/src/renderer/components/subtitle/CueAnchorRail.vue`
  Purpose: render `AB`, `A`, and `B` button labels and endpoint styling.
- `desktop-app/src/renderer/components/subtitle/TranscriptBlock.vue`
  Purpose: expose per-block A-B endpoint label/state to the cue action rail.
- `desktop-app/src/renderer/components/subtitle/TranscriptBlock.test.ts`
  Purpose: verify button-label rendering and click emission for `AB/A/B`.
- `desktop-app/src/renderer/components/subtitle/TranscriptSurface.vue`
  Purpose: resolve per-block `AB/A/B` labels, consume control-interaction intent, and switch follow-anchor handling to respect `loop-wrap-follow`.
- `desktop-app/src/renderer/components/subtitle/TranscriptSurface.test.ts`
  Purpose: verify scroll/highlight move directly from `B` back to `A`.
- `desktop-app/src/renderer/components/subtitle/SubtitleView.vue`
  Purpose: coordinate endpoint selection, loop session playback state, and control interactions.
- `desktop-app/src/renderer/components/subtitle/SubtitleView.test.ts`
  Purpose: verify end-to-end UI state, reverse selection, and renderer loop-wrap handling.
- `desktop-app/src/renderer/components/subtitle/composables/useTranscriptSelection.ts`
  Purpose: change auto-follow pause from generic pointer/DOM behavior to intent-based rules.
- `desktop-app/src/renderer/components/subtitle/PlaybackControls.vue`
  Purpose: mark scrub and playback interactions as control actions.
- `desktop-app/src/renderer/components/subtitle/VideoInfoSection.vue`
  Purpose: forward control-interaction events from playback controls into `SubtitleView.vue`.
- `desktop-app/src/renderer/stores/desktop.test.ts`
  Purpose: verify enriched playback payloads retain loop-session metadata in the renderer store.

## Task 1: Add Extension Test Harness

**Files:**
- Create: `extension/vitest.config.js`
- Create: `extension/src/test/setup.js`
- Modify: `extension/package.json`
- Modify: `extension/package-lock.json`
- Test: `extension/src/video/LoopController.test.js`

- [ ] **Step 1: Add a failing extension smoke test**

Create `extension/src/video/LoopController.test.js`:

```js
import { describe, expect, it } from "vitest";

describe("LoopController", () => {
  it("runs extension unit tests in jsdom", () => {
    expect(globalThis.location.href).toContain("http");
  });
});
```

- [ ] **Step 2: Run the extension test command and confirm it fails because the script does not exist yet**

Run: `npm --prefix extension run test -- LoopController`

Expected: FAIL with npm reporting a missing `test` script.

- [ ] **Step 3: Add the extension Vitest harness**

Update `extension/package.json`:

```json
{
  "scripts": {
    "build": "npm run build:chrome && npm run build:firefox",
    "build:chrome": "node ./build.js chrome",
    "build:firefox": "node ./build.js firefox",
    "build:all": "npm run build:chrome && npm run build:firefox",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "esbuild": "^0.24.0",
    "jsdom": "^24.1.0",
    "vitest": "^2.1.1"
  }
}
```

Create `extension/vitest.config.js`:

```js
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    include: ["src/**/*.test.js"],
    setupFiles: ["./src/test/setup.js"]
  }
});
```

Create `extension/src/test/setup.js`:

```js
import { afterEach, beforeEach, vi } from "vitest";

beforeEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});
```

Then run: `npm --prefix extension install`

- [ ] **Step 4: Re-run the extension smoke test**

Run: `npm --prefix extension run test -- LoopController`

Expected: PASS with one green smoke test.

- [ ] **Step 5: Commit**

```bash
git add extension/package.json extension/package-lock.json extension/vitest.config.js extension/src/test/setup.js extension/src/video/LoopController.test.js
git commit -m "test: add extension vitest harness"
```

## Task 2: Add Extension Loop Session Metadata And `loop-wrap` Emission

**Files:**
- Modify: `extension/src/content/state.js`
- Modify: `extension/src/video/LoopController.js`
- Modify: `extension/src/video/ControlHandler.js`
- Modify: `extension/src/video/VideoStateGatherer.js`
- Test: `extension/src/video/LoopController.test.js`

- [ ] **Step 1: Replace the smoke test with failing loop-session tests**

Update `extension/src/video/LoopController.test.js`:

```js
import { beforeEach, describe, expect, it, vi } from "vitest";
import { state } from "../content/state.js";
import * as gatherer from "./VideoStateGatherer.js";
import * as sender from "../connection/MessageSender.js";
import { clearLoopState, startLoop } from "./LoopController.js";

describe("LoopController", () => {
  beforeEach(() => {
    state.loop = {
      mode: null,
      startMs: null,
      endMs: null,
      startCueIndex: null,
      endCueIndex: null,
      anchorCueIndex: null,
      isLooping: false,
      programmaticSeekReason: "none",
      boundaryTransition: "none",
      checkTimer: null
    };
    state.monitoringActive = true;
    vi.spyOn(gatherer, "handleTimeUpdate").mockImplementation(() => {});
    vi.spyOn(sender, "send").mockImplementation(() => {});
    vi.useFakeTimers();
  });

  it("records A-B loop session metadata when a range loop starts", () => {
    const video = { currentTime: 8, paused: false, play: vi.fn(() => Promise.resolve()) };

    startLoop(video, {
      mode: "ab",
      startMs: 1000,
      endMs: 4000,
      startCueIndex: 1,
      endCueIndex: 4,
      anchorCueIndex: 4,
      origin: "ab-loop"
    });

    expect(state.loop.mode).toBe("ab");
    expect(state.loop.startCueIndex).toBe(1);
    expect(state.loop.endCueIndex).toBe(4);
    expect(sender.send).toHaveBeenCalledWith("loop-started", expect.objectContaining({
      mode: "ab",
      startMs: 1000,
      endMs: 4000,
      startCueIndex: 1,
      endCueIndex: 4
    }));
  });

  it("marks boundaryTransition as loop-wrap before reporting a B-to-A jump", () => {
    const video = { currentTime: 4.2, paused: false, play: vi.fn(() => Promise.resolve()) };

    startLoop(video, {
      mode: "ab",
      startMs: 1000,
      endMs: 4000,
      startCueIndex: 1,
      endCueIndex: 4,
      anchorCueIndex: 4,
      origin: "ab-loop"
    });

    vi.advanceTimersByTime(100);

    expect(state.loop.boundaryTransition).toBe("loop-wrap");
    expect(state.loop.programmaticSeekReason).toBe("loop-wrap");
    expect(gatherer.handleTimeUpdate).toHaveBeenCalled();
  });

  it("clears loop metadata when stopLoop runs", () => {
    state.loop.mode = "ab";
    state.loop.startMs = 1000;
    state.loop.endMs = 4000;
    state.loop.startCueIndex = 1;
    state.loop.endCueIndex = 4;
    state.loop.anchorCueIndex = 4;
    state.loop.isLooping = true;

    clearLoopState();

    expect(state.loop.mode).toBe(null);
    expect(state.loop.startCueIndex).toBe(null);
    expect(state.loop.endCueIndex).toBe(null);
    expect(state.loop.boundaryTransition).toBe("none");
    expect(sender.send).toHaveBeenCalledWith("loop-cleared", {});
  });
});
```

- [ ] **Step 2: Run the extension loop tests and confirm they fail**

Run: `npm --prefix extension run test -- LoopController`

Expected: FAIL because `state.loop` does not yet store endpoint metadata, `startLoop()` still accepts positional arguments, and `loop-wrap` is not surfaced.

- [ ] **Step 3: Implement loop session metadata in extension runtime**

Update `extension/src/content/state.js`:

```js
  loop: {
    mode: null,
    startMs: null,
    endMs: null,
    startCueIndex: null,
    endCueIndex: null,
    anchorCueIndex: null,
    origin: null,
    isLooping: false,
    programmaticSeekReason: "none",
    boundaryTransition: "none",
    checkTimer: null
  },
```

Update `extension/src/video/LoopController.js`:

```js
function applyLoopWrap(video) {
  state.loop.programmaticSeekReason = "loop-wrap";
  state.loop.boundaryTransition = "loop-wrap";
  video.currentTime = state.loop.startMs / 1000;
  handleTimeUpdate(video);
  state.loop.boundaryTransition = "none";
  state.loop.programmaticSeekReason = "none";
}

export function startLoop(target, session) {
  state.loop.mode = session.mode;
  state.loop.startMs = session.startMs;
  state.loop.endMs = session.endMs;
  state.loop.startCueIndex = session.startCueIndex ?? null;
  state.loop.endCueIndex = session.endCueIndex ?? null;
  state.loop.anchorCueIndex = session.anchorCueIndex ?? null;
  state.loop.origin = session.origin ?? null;
  state.loop.isLooping = true;
  state.loop.programmaticSeekReason = "manual-control";
  state.loop.boundaryTransition = "none";

  target.currentTime = session.startMs / 1000;
  handleTimeUpdate(target);
  state.loop.programmaticSeekReason = "none";

  send("loop-started", {
    mode: session.mode,
    startMs: session.startMs,
    endMs: session.endMs,
    startCueIndex: session.startCueIndex ?? null,
    endCueIndex: session.endCueIndex ?? null,
    anchorCueIndex: session.anchorCueIndex ?? null,
    origin: session.origin ?? null
  });
}
```

Update the interval branch:

```js
    if (currentTimeMs >= state.loop.endMs) {
      applyLoopWrap(video);
    }
```

Update `clearLoopState()` so every loop field resets to `null` or `"none"`.

Update `extension/src/video/ControlHandler.js`:

```js
    case "loop":
      if (typeof payload.start === "number" && typeof payload.end === "number") {
        startLoop(target, {
          mode: payload.mode === "ab" ? "ab" : "single",
          startMs: payload.start,
          endMs: payload.end,
          startCueIndex: payload.startCueIndex ?? payload.cueIndex ?? null,
          endCueIndex: payload.endCueIndex ?? payload.cueIndex ?? null,
          anchorCueIndex: payload.anchorCueIndex ?? payload.cueIndex ?? null,
          origin: payload.origin === "ab-loop" ? "ab-loop" : "single-loop"
        });
      }
```

Update `extension/src/video/VideoStateGatherer.js` so `gatherVideoState()` includes loop metadata:

```js
    loopMode: state.loop.mode,
    loopStartMs: state.loop.startMs,
    loopEndMs: state.loop.endMs,
    loopStartCueIndex: state.loop.startCueIndex,
    loopEndCueIndex: state.loop.endCueIndex,
    loopAnchorCueIndex: state.loop.anchorCueIndex,
    loopOrigin: state.loop.origin,
    loopBoundaryTransition: state.loop.boundaryTransition,
    programmaticSeekReason: state.loop.programmaticSeekReason,
```

- [ ] **Step 4: Re-run the extension loop tests**

Run: `npm --prefix extension run test -- LoopController`

Expected: PASS with the three loop-session tests green.

- [ ] **Step 5: Commit**

```bash
git add extension/src/content/state.js extension/src/video/LoopController.js extension/src/video/ControlHandler.js extension/src/video/VideoStateGatherer.js extension/src/video/LoopController.test.js
git commit -m "feat: add extension loop session metadata"
```

## Task 3: Forward Loop Metadata Into Desktop Playback State

**Files:**
- Modify: `extension/src/background/messaging/ContentMessageRouter.js`
- Create: `extension/src/background/messaging/ContentMessageRouter.test.js`
- Modify: `desktop-app/src/main/types.ts`
- Modify: `desktop-app/src/main/stateManager.ts`
- Modify: `desktop-app/src/main/connectionManager.ts`

- [ ] **Step 1: Add failing router and desktop-state tests**

Create `extension/src/background/messaging/ContentMessageRouter.test.js`:

```js
import { describe, expect, it, vi } from "vitest";
import { ContentMessageRouter } from "./ContentMessageRouter.js";

describe("ContentMessageRouter", () => {
  it("forwards loop metadata from time-update payloads", () => {
    const connectionPool = { broadcast: vi.fn() };
    const mediaStateStore = {
      isValidMedia: () => true,
      setState: vi.fn(),
      has: () => true,
      get: () => ({ currentTime: 1000, duration: 9000, readyState: 4 })
    };
    const snapshotBuilder = { buildMediaInfo: vi.fn((state) => state) };
    const router = new ContentMessageRouter({ tabRegistry: { rememberActiveFrame: vi.fn() }, mediaStateStore, connectionPool, snapshotBuilder });

    router.handleMessage(7, 0, {
      type: "time-update",
      payload: {
        currentTime: 1200,
        duration: 9000,
        readyState: 4,
        loopMode: "ab",
        loopStartMs: 1000,
        loopEndMs: 4000,
        loopStartCueIndex: 1,
        loopEndCueIndex: 4,
        loopBoundaryTransition: "loop-wrap"
      }
    });

    expect(mediaStateStore.setState).toHaveBeenCalledWith(7, expect.objectContaining({
      loopMode: "ab",
      loopBoundaryTransition: "loop-wrap"
    }), "time-update");
    expect(connectionPool.broadcast).toHaveBeenCalledWith(expect.objectContaining({
      type: "time-update",
      payload: expect.objectContaining({
        loopMode: "ab",
        loopBoundaryTransition: "loop-wrap"
      })
    }));
  });
});
```

Add this test to `desktop-app/src/renderer/stores/desktop.test.ts`:

```ts
  it("stores loop session metadata inside playback updates", () => {
    const store = useDesktopStore();
    store.desktopState = createDesktopState();
    store.playback = store.desktopState.playback;

    window.usp.onPlayback.mock.calls[0][0]({
      ...store.playback,
      currentTime: 1000,
      loopSession: {
        mode: "ab",
        startMs: 1000,
        endMs: 4000,
        startCueIndex: 1,
        endCueIndex: 4,
        anchorCueIndex: 4,
        origin: "ab-loop"
      },
      loopBoundaryTransition: "loop-wrap"
    });

    expect(store.playback?.loopSession?.mode).toBe("ab");
    expect(store.playback?.loopBoundaryTransition).toBe("loop-wrap");
  });
```

- [ ] **Step 2: Run the router and desktop-store tests and confirm they fail**

Run: `npm --prefix extension run test -- ContentMessageRouter`

Expected: FAIL because the forwarded payload does not yet preserve loop metadata assertions.

Run: `npm --prefix desktop-app run test:renderer -- desktop.test.ts`

Expected: FAIL because `PlaybackState` does not yet expose `loopSession` or `loopBoundaryTransition`.

- [ ] **Step 3: Add loop-session types and preserve them through message handling**

Update `desktop-app/src/main/types.ts`:

```ts
export type LoopMode = "single" | "ab";
export type LoopOrigin = "single-loop" | "ab-loop";
export type LoopBoundaryTransition = "none" | "loop-wrap";

export interface LoopSessionState {
  mode: LoopMode;
  startMs: number;
  endMs: number;
  startCueIndex: number | null;
  endCueIndex: number | null;
  anchorCueIndex: number | null;
  origin: LoopOrigin;
}

export interface PlaybackState {
  currentTime: number;
  duration: number | null;
  playbackRate: number;
  lastUpdate: number | null;
  isLooping: boolean;
  loopCueIndex: number | null;
  loopSession: LoopSessionState | null;
  loopBoundaryTransition: LoopBoundaryTransition;
}
```

Extend `ExtensionPayload` and `VideoControlCommand`:

```ts
  loopMode?: LoopMode | null;
  loopStartMs?: number | null;
  loopEndMs?: number | null;
  loopStartCueIndex?: number | null;
  loopEndCueIndex?: number | null;
  loopAnchorCueIndex?: number | null;
  loopOrigin?: LoopOrigin | null;
  loopBoundaryTransition?: LoopBoundaryTransition | null;
```

```ts
  | {
      type: "loop";
      start: number;
      end: number;
      cueIndex: number;
      mode: LoopMode;
      startCueIndex: number | null;
      endCueIndex: number | null;
      anchorCueIndex: number | null;
      origin: LoopOrigin;
    }
```

Update `extension/src/background/messaging/ContentMessageRouter.js` so `setState()` and `broadcast()` keep loop metadata in the media patch.

Update the `PlaybackState` defaults in `desktop-app/src/main/stateManager.ts`:

```ts
      playback: {
        currentTime: 0,
        duration: null,
        playbackRate: 1,
        lastUpdate: null,
        isLooping: false,
        loopCueIndex: null,
        loopSession: null,
        loopBoundaryTransition: "none"
      },
```

Update `desktop-app/src/main/connectionManager.ts`:

```ts
    } else if (command.type === "loop") {
      this.options.stateManager.updateState((draft) => {
        draft.playback.loopCueIndex = command.cueIndex;
        draft.playback.loopSession = {
          mode: command.mode,
          startMs: command.start,
          endMs: command.end,
          startCueIndex: command.startCueIndex,
          endCueIndex: command.endCueIndex,
          anchorCueIndex: command.anchorCueIndex,
          origin: command.origin
        };
        draft.playback.loopBoundaryTransition = "none";
      });
      payload = {
        start: command.start,
        end: command.end,
        cueIndex: command.cueIndex,
        mode: command.mode,
        startCueIndex: command.startCueIndex,
        endCueIndex: command.endCueIndex,
        anchorCueIndex: command.anchorCueIndex,
        origin: command.origin
      };
    }
```

In the `"time-update"` branch, map incoming payload into playback state:

```ts
        const loopSession =
          message.payload.loopMode && typeof message.payload.loopStartMs === "number" && typeof message.payload.loopEndMs === "number"
            ? {
                mode: message.payload.loopMode,
                startMs: message.payload.loopStartMs,
                endMs: message.payload.loopEndMs,
                startCueIndex: message.payload.loopStartCueIndex ?? null,
                endCueIndex: message.payload.loopEndCueIndex ?? null,
                anchorCueIndex: message.payload.loopAnchorCueIndex ?? null,
                origin: message.payload.loopOrigin === "ab-loop" ? "ab-loop" : "single-loop"
              }
            : state.playback.loopSession;

        this.options.stateManager.updatePlayback({
          currentTime,
          playbackRate,
          duration,
          loopSession,
          loopBoundaryTransition: message.payload.loopBoundaryTransition === "loop-wrap" ? "loop-wrap" : "none"
        });
```

On `loop-cleared`, clear `loopSession` and `loopBoundaryTransition`.

- [ ] **Step 4: Re-run the router and desktop-store tests**

Run: `npm --prefix extension run test -- ContentMessageRouter`

Expected: PASS with loop metadata preserved through broadcast.

Run: `npm --prefix desktop-app run test:renderer -- desktop.test.ts`

Expected: PASS with renderer store retaining `loopSession` and `loopBoundaryTransition`.

- [ ] **Step 5: Commit**

```bash
git add extension/src/background/messaging/ContentMessageRouter.js extension/src/background/messaging/ContentMessageRouter.test.js desktop-app/src/main/types.ts desktop-app/src/main/stateManager.ts desktop-app/src/main/connectionManager.ts desktop-app/src/renderer/stores/desktop.test.ts
git commit -m "feat: forward loop metadata into desktop playback"
```

## Task 4: Implement `AB/A/B` Endpoint Selection In The Renderer

**Files:**
- Create: `desktop-app/src/renderer/components/subtitle/abLoopSelection.ts`
- Create: `desktop-app/src/renderer/components/subtitle/abLoopSelection.test.ts`
- Modify: `desktop-app/src/renderer/components/subtitle/CueAnchorRail.vue`
- Modify: `desktop-app/src/renderer/components/subtitle/TranscriptBlock.vue`
- Modify: `desktop-app/src/renderer/components/subtitle/TranscriptBlock.test.ts`
- Modify: `desktop-app/src/renderer/components/subtitle/TranscriptSurface.vue`
- Modify: `desktop-app/src/renderer/components/subtitle/SubtitleView.vue`
- Modify: `desktop-app/src/renderer/components/subtitle/SubtitleView.test.ts`

- [ ] **Step 1: Add failing pure-state tests for endpoint selection**

Create `desktop-app/src/renderer/components/subtitle/abLoopSelection.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { getAbLoopButtonLabel, selectAbLoopEndpoint } from "./abLoopSelection";

describe("abLoopSelection", () => {
  it("marks only the first clicked cue as A while waiting for the second endpoint", () => {
    const result = selectAbLoopEndpoint({ kind: "idle" }, 3);

    expect(result.nextState).toEqual({ kind: "selecting-second", anchorCueIndex: 3 });
    expect(getAbLoopButtonLabel(3, result.nextState)).toBe("A");
    expect(getAbLoopButtonLabel(2, result.nextState)).toBe("AB");
    expect(getAbLoopButtonLabel(4, result.nextState)).toBe("AB");
  });

  it("reorders endpoints so the earlier cue becomes A", () => {
    const pending = { kind: "selecting-second", anchorCueIndex: 4 } as const;
    const result = selectAbLoopEndpoint(pending, 1);

    expect(result.createdRange).toEqual({ startCueIndex: 1, endCueIndex: 4, anchorCueIndex: 4 });
    expect(result.nextState).toEqual({ kind: "active", startCueIndex: 1, endCueIndex: 4 });
    expect(getAbLoopButtonLabel(1, result.nextState)).toBe("A");
    expect(getAbLoopButtonLabel(4, result.nextState)).toBe("B");
    expect(getAbLoopButtonLabel(2, result.nextState)).toBe("AB");
  });

  it("cancels selection when the same A cue is clicked twice", () => {
    const pending = { kind: "selecting-second", anchorCueIndex: 2 } as const;
    const result = selectAbLoopEndpoint(pending, 2);

    expect(result.nextState).toEqual({ kind: "idle" });
    expect(result.createdRange).toBeNull();
  });
});
```

Add these UI-level assertions to `desktop-app/src/renderer/components/subtitle/TranscriptBlock.test.ts`:

```ts
  it("renders an AB label for non-endpoint cues", () => {
    const wrapper = mount(TranscriptBlock, {
      props: {
        blockId: "block-0",
        start: 0,
        end: 1000,
        lines: [{ key: "line-0", kind: "primary", text: "hello", style: { top: "0px", height: "24px" } }],
        autoHideMetaRow: false,
        isActive: false,
        isLooping: false,
        abLoopLabel: "AB",
        showSelectionActions: false
      }
    });

    expect(wrapper.get('[data-testid="cue-action-ab"]').text()).toBe("AB");
  });
```

- [ ] **Step 2: Run the renderer tests and confirm they fail**

Run: `npm --prefix desktop-app run test:renderer -- abLoopSelection TranscriptBlock SubtitleView`

Expected: FAIL because `abLoopSelection.ts` does not exist and `TranscriptBlock` still expects the old pending-A prop shape.

- [ ] **Step 3: Add the pure selection helper and wire the UI labels**

Create `desktop-app/src/renderer/components/subtitle/abLoopSelection.ts`:

```ts
export type AbLoopSelectionState =
  | { kind: "idle" }
  | { kind: "selecting-second"; anchorCueIndex: number }
  | { kind: "active"; startCueIndex: number; endCueIndex: number };

export type AbLoopButtonLabel = "AB" | "A" | "B";

export function getAbLoopButtonLabel(index: number, state: AbLoopSelectionState): AbLoopButtonLabel {
  if (state.kind === "selecting-second") {
    return state.anchorCueIndex === index ? "A" : "AB";
  }
  if (state.kind === "active") {
    if (state.startCueIndex === index) return "A";
    if (state.endCueIndex === index) return "B";
  }
  return "AB";
}

export function selectAbLoopEndpoint(state: AbLoopSelectionState, index: number) {
  if (state.kind === "idle") {
    return { nextState: { kind: "selecting-second", anchorCueIndex: index } as const, createdRange: null };
  }
  if (state.kind === "selecting-second") {
    if (state.anchorCueIndex === index) {
      return { nextState: { kind: "idle" } as const, createdRange: null };
    }
    const startCueIndex = Math.min(state.anchorCueIndex, index);
    const endCueIndex = Math.max(state.anchorCueIndex, index);
    return {
      nextState: { kind: "active", startCueIndex, endCueIndex } as const,
      createdRange: { startCueIndex, endCueIndex, anchorCueIndex: state.anchorCueIndex }
    };
  }
  return { nextState: { kind: "selecting-second", anchorCueIndex: index } as const, createdRange: null };
}
```

Update `desktop-app/src/renderer/components/subtitle/CueAnchorRail.vue`:

```vue
const props = defineProps<{
  state: "quiet" | "hover" | "active" | "selection" | "looping" | "ab-pending" | "focus-within";
  start: number;
  end: number;
  abLabel: "AB" | "A" | "B";
  isLooping: boolean;
  isAbEndpoint: boolean;
}>();
```

```vue
    <button
      class="transcript-block__ab-btn"
      :class="{
        'transcript-block__ab-btn--endpoint-a': abLabel === 'A',
        'transcript-block__ab-btn--endpoint-b': abLabel === 'B'
      }"
      data-testid="cue-action-ab"
      type="button"
      @click.stop="$emit('loop-range')"
    >
      {{ abLabel }}
    </button>
```

Update `desktop-app/src/renderer/components/subtitle/TranscriptBlock.vue`:

```vue
const props = defineProps<{
  blockId: string;
  start: number;
  end: number;
  lines: Array<{ key: string; kind: TranscriptLayoutLineKind; text: string; style: Record<string, string> }>;
  autoHideMetaRow: boolean;
  isActive: boolean;
  isLooping: boolean;
  abLoopLabel: "AB" | "A" | "B";
  showSelectionActions: boolean;
}>();
```

```vue
        <CueAnchorRail
          :state="metaRowState"
          :start="start"
          :end="end"
          :ab-label="abLoopLabel"
          :is-looping="isLooping"
          :is-ab-endpoint="abLoopLabel !== 'AB'"
          @play="$emit('play')"
          @loop="$emit('loop')"
          @loop-range="$emit('loop-range')"
        />
```

Update `desktop-app/src/renderer/components/subtitle/SubtitleView.vue`:

```ts
import {
  getAbLoopButtonLabel,
  selectAbLoopEndpoint,
  type AbLoopSelectionState
} from "./abLoopSelection";

const abLoopSelection = ref<AbLoopSelectionState>({ kind: "idle" });

function handleAbLoop(index: number) {
  const result = selectAbLoopEndpoint(abLoopSelection.value, index);
  abLoopSelection.value = result.nextState;

  if (!result.createdRange) {
    if (result.nextState.kind === "selecting-second" && playback.value?.isLooping) {
      store.controlVideo({ type: "stopLoop" });
    }
    return;
  }

  const startCue = primaryCues.value[result.createdRange.startCueIndex];
  const endCue = primaryCues.value[result.createdRange.endCueIndex];
  if (!startCue || !endCue) {
    abLoopSelection.value = { kind: "idle" };
    return;
  }

  store.controlVideo({
    type: "loop",
    start: startCue.start,
    end: endCue.end,
    cueIndex: result.createdRange.anchorCueIndex,
    mode: "ab",
    startCueIndex: result.createdRange.startCueIndex,
    endCueIndex: result.createdRange.endCueIndex,
    anchorCueIndex: result.createdRange.anchorCueIndex,
    origin: "ab-loop"
  });
}
```

Update `desktop-app/src/renderer/components/subtitle/TranscriptSurface.vue` props:

```ts
  abLoopSelectionState: AbLoopSelectionState;
```

and resolve labels inside `renderedBlocks`:

```ts
      const cueIndex = block.block.sourceCueRefs.primaryCueIndex;
      const abLoopLabel = getAbLoopButtonLabel(cueIndex, props.abLoopSelectionState);
```

```vue
          :ab-loop-label="abLoopLabel"
```

Update `desktop-app/src/renderer/components/subtitle/SubtitleView.vue` to pass the new prop:

```vue
      :ab-loop-selection-state="abLoopSelection"
```

- [ ] **Step 4: Re-run the renderer selection tests**

Run: `npm --prefix desktop-app run test:renderer -- abLoopSelection TranscriptBlock SubtitleView`

Expected: PASS with reverse-order A/B selection and cancel behavior green.

- [ ] **Step 5: Commit**

```bash
git add desktop-app/src/renderer/components/subtitle/abLoopSelection.ts desktop-app/src/renderer/components/subtitle/abLoopSelection.test.ts desktop-app/src/renderer/components/subtitle/CueAnchorRail.vue desktop-app/src/renderer/components/subtitle/TranscriptBlock.vue desktop-app/src/renderer/components/subtitle/TranscriptBlock.test.ts desktop-app/src/renderer/components/subtitle/TranscriptSurface.vue desktop-app/src/renderer/components/subtitle/SubtitleView.vue desktop-app/src/renderer/components/subtitle/SubtitleView.test.ts
git commit -m "feat: add AB endpoint selection state"
```

## Task 5: Protect Predicted Playback, Highlighting, And Auto-Follow At `loop-wrap`

**Files:**
- Modify: `desktop-app/src/renderer/components/subtitle/transcript/types.ts`
- Modify: `desktop-app/src/renderer/components/subtitle/loopPlayback.ts`
- Modify: `desktop-app/src/renderer/components/subtitle/loopPlayback.test.ts`
- Modify: `desktop-app/src/renderer/components/subtitle/composables/useTranscriptSelection.ts`
- Create: `desktop-app/src/renderer/components/subtitle/composables/useTranscriptSelection.test.ts`
- Modify: `desktop-app/src/renderer/components/subtitle/PlaybackControls.vue`
- Modify: `desktop-app/src/renderer/components/subtitle/VideoInfoSection.vue`
- Modify: `desktop-app/src/renderer/components/subtitle/TranscriptSurface.vue`
- Modify: `desktop-app/src/renderer/components/subtitle/TranscriptSurface.test.ts`
- Modify: `desktop-app/src/renderer/components/subtitle/SubtitleView.vue`
- Modify: `desktop-app/src/renderer/components/subtitle/SubtitleView.test.ts`

- [ ] **Step 1: Add failing playback-boundary and pause-reason tests**

Update `desktop-app/src/renderer/components/subtitle/loopPlayback.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { applyLoopBoundaryTransition } from "./loopPlayback";

describe("applyLoopBoundaryTransition", () => {
  it("pins display time to A when loop-wrap occurs", () => {
    expect(applyLoopBoundaryTransition({
      displayTime: 4050,
      boundaryTransition: "loop-wrap",
      loopWindow: { start: 1000, end: 4000, mode: "ab" }
    })).toBe(1000);
  });
});
```

Create `desktop-app/src/renderer/components/subtitle/composables/useTranscriptSelection.test.ts`:

```ts
import { computed, ref } from "vue";
import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import { useTranscriptSelection } from "./useTranscriptSelection";

describe("useTranscriptSelection", () => {
  it("does not pause auto-follow for control interactions", async () => {
    const onResume = vi.fn();
    const root = document.createElement("div");
    document.body.appendChild(root);
    const rootRef = ref(root);

    const component = mount({
      template: "<div />",
      setup() {
        return useTranscriptSelection({
          rootEl: rootRef,
          autoScrollDelayMs: computed(() => 50),
          onResume
        });
      }
    });

    component.vm.registerControlInteraction("ab-anchor-first-click");

    expect(component.vm.isAutoFollowPaused).toBe(false);
  });
});
```

Add this `TranscriptSurface` test:

```ts
  it("uses loop-wrap-follow to jump directly back to A", async () => {
    restoreSize = mockViewportSize(140, 160);
    const wrapper = mount(TranscriptSurface, {
      attachTo: document.body,
      props: defaultProps({
        blocks: [...blocks, ...extraBlocks],
        currentTime: 3900,
        activeAbLoopRange: { startCueIndex: 1, endCueIndex: 3 },
        loopBoundaryTransition: "loop-wrap"
      })
    });

    await nextTick();
    await nextTick();

    expect(wrapper.get(".transcript-block--active").attributes("data-transcript-block-id")).toBe("block-1");
  });
```

- [ ] **Step 2: Run the playback and selection tests and confirm they fail**

Run: `npm --prefix desktop-app run test:renderer -- loopPlayback useTranscriptSelection TranscriptSurface SubtitleView`

Expected: FAIL because `loop-wrap` is not modeled in renderer playback helpers, `useTranscriptSelection` has no control-intent API, and `TranscriptSurface` does not know about `loop-wrap-follow`.

- [ ] **Step 3: Implement loop-wrap display handling and intent-based auto-follow pause**

Update `desktop-app/src/renderer/components/subtitle/transcript/types.ts`:

```ts
export type TranscriptViewportAnchorReason =
  | "playback-follow"
  | "seek-recenter"
  | "resize-reproject"
  | "loop-wrap-follow";
```

Update `desktop-app/src/renderer/components/subtitle/loopPlayback.ts`:

```ts
export function applyLoopBoundaryTransition({
  displayTime,
  boundaryTransition,
  loopWindow
}: {
  displayTime: number;
  boundaryTransition: "none" | "loop-wrap";
  loopWindow: { start: number; end: number; mode: "single" | "ab" } | null;
}): number {
  if (boundaryTransition === "loop-wrap" && loopWindow?.mode === "ab") {
    return loopWindow.start;
  }
  return loopWindow
    ? keepTimeInsideLoopWindow({
        time: displayTime,
        start: loopWindow.start,
        end: loopWindow.end,
        mode: loopWindow.mode
      })
    : displayTime;
}
```

Update `desktop-app/src/renderer/components/subtitle/composables/useTranscriptSelection.ts`:

```ts
type ControlInteractionReason =
  | "play-toggle"
  | "single-loop-toggle"
  | "ab-anchor-first-click"
  | "ab-anchor-second-click"
  | "slider-scrub"
  | "programmatic-seek"
  | "loop-wrap";

const lastControlInteraction = ref<ControlInteractionReason | null>(null);

function registerControlInteraction(reason: ControlInteractionReason) {
  lastControlInteraction.value = reason;
  clearResumeTimer();
  isAutoFollowPaused.value = false;
  isSelectionPaused.value = false;
}
```

Return it:

```ts
  return {
    isSelectionPaused,
    isAutoFollowPaused,
    clearAutoFollowPause,
    registerControlInteraction
  };
```

Update `desktop-app/src/renderer/components/subtitle/PlaybackControls.vue` to emit a control marker before playback and scrub actions:

```vue
      @pointerdown="$emit('control-interaction', 'slider-scrub')"
      @click="$emit('control-interaction', 'play-toggle')"
```

Add the emit signature:

```ts
  (e: "control-interaction", reason: string): void;
```

Update `desktop-app/src/renderer/components/subtitle/VideoInfoSection.vue` to forward the new event:

```vue
      @control-interaction="$emit('control-interaction', $event)"
```

```ts
  (e: "control-interaction", reason: string): void;
```

Update `desktop-app/src/renderer/components/subtitle/SubtitleView.vue` to convert control interactions into a token consumed by `TranscriptSurface.vue`:

```ts
const controlInteractionToken = ref(0);
const controlInteractionReason = ref<string | null>(null);

function registerControlInteraction(reason: string) {
  controlInteractionToken.value += 1;
  controlInteractionReason.value = reason;
}
```

```ts
function togglePlayback() {
  registerControlInteraction("play-toggle");
  ...
}

function seekToCue(index: number) {
  registerControlInteraction("programmatic-seek");
  ...
}

function handleAbLoop(index: number) {
  registerControlInteraction(
    abLoopSelection.value.kind === "idle" ? "ab-anchor-first-click" : "ab-anchor-second-click"
  );
  ...
}
```

Pass the token and reason into `TranscriptSurface`:

```vue
      :loop-boundary-transition="playback?.loopBoundaryTransition ?? 'none'"
      :control-interaction-token="controlInteractionToken"
      :control-interaction-reason="controlInteractionReason"
```

Change `displayedPlaybackTime` calculation:

```ts
  const boundedBase = applyLoopBoundaryTransition({
    displayTime: safeBase,
    boundaryTransition: playback.value?.loopBoundaryTransition ?? "none",
    loopWindow
  });
```

Update `desktop-app/src/renderer/components/subtitle/TranscriptSurface.vue` so loop-wrap selects the A block directly:

```ts
  loopBoundaryTransition?: "none" | "loop-wrap";
  controlInteractionToken?: number;
  controlInteractionReason?: string | null;
```

Consume control interactions with the existing hook:

```ts
const playbackFollowAnchor = computed<TranscriptViewportAnchor | null>(() => {
  const blockId = playbackActiveBlockId.value;
  if (!blockId) return null;
  return {
    blockId,
    reason: props.loopBoundaryTransition === "loop-wrap" ? "loop-wrap-follow" : "playback-follow",
    anchorBias: 0.5
  };
});
```

```ts
watch(
  () => props.controlInteractionToken,
  () => {
    if (props.controlInteractionReason) {
      registerControlInteraction(props.controlInteractionReason as any);
    }
  }
);
```

When a `loop-wrap-follow` anchor is active, call `scrollToProjectedPosition("auto")` instead of `"smooth"`.

- [ ] **Step 4: Re-run the playback and pause tests**

Run: `npm --prefix desktop-app run test:renderer -- loopPlayback useTranscriptSelection TranscriptSurface SubtitleView`

Expected: PASS with `loop-wrap` jumping directly from `B` to `A` and control interactions never pausing auto-follow.

- [ ] **Step 5: Commit**

```bash
git add desktop-app/src/renderer/components/subtitle/transcript/types.ts desktop-app/src/renderer/components/subtitle/loopPlayback.ts desktop-app/src/renderer/components/subtitle/loopPlayback.test.ts desktop-app/src/renderer/components/subtitle/composables/useTranscriptSelection.ts desktop-app/src/renderer/components/subtitle/composables/useTranscriptSelection.test.ts desktop-app/src/renderer/components/subtitle/PlaybackControls.vue desktop-app/src/renderer/components/subtitle/VideoInfoSection.vue desktop-app/src/renderer/components/subtitle/TranscriptSurface.vue desktop-app/src/renderer/components/subtitle/TranscriptSurface.test.ts desktop-app/src/renderer/components/subtitle/SubtitleView.vue desktop-app/src/renderer/components/subtitle/SubtitleView.test.ts
git commit -m "feat: protect loop-wrap playback in renderer"
```

## Task 6: Run Full Verification And Final Cleanup

**Files:**
- Modify: `desktop-app/src/renderer/components/subtitle/SubtitleView.test.ts`
- Modify: `desktop-app/src/renderer/components/subtitle/TranscriptSurface.test.ts`
- Modify: `extension/src/video/LoopController.test.js`
- Modify: `extension/src/background/messaging/ContentMessageRouter.test.js`

- [ ] **Step 1: Add end-to-end verification tests for the approved acceptance criteria**

Append this test to `desktop-app/src/renderer/components/subtitle/SubtitleView.test.ts`:

```ts
  it("keeps all non-endpoint buttons labeled AB after an active reverse-order range loop is created", async () => {
    const store = useDesktopStore();
    store.settings = createSettings();
    store.desktopState = createDesktopState();
    store.playback = {
      ...store.desktopState.playback,
      isLooping: true,
      loopSession: {
        mode: "ab",
        startMs: 1000,
        endMs: 4000,
        startCueIndex: 1,
        endCueIndex: 4,
        anchorCueIndex: 4,
        origin: "ab-loop"
      },
      loopBoundaryTransition: "none"
    };
    store.desktopState = { ...store.desktopState, playback: store.playback };

    const wrapper = mount(SubtitleView, {
      attachTo: document.body,
      global: {
        stubs: {
          VideoInfoSection: { template: "<div class='video-info-section-stub'></div>" }
        }
      }
    });

    await nextTick();
    await nextTick();

    const labels = wrapper.findAll('[data-testid="cue-action-ab"]').map((node) => node.text());
    expect(labels.filter((label) => label === "A")).toHaveLength(1);
    expect(labels.filter((label) => label === "B")).toHaveLength(1);
    expect(labels.filter((label) => label === "AB").length).toBeGreaterThan(0);
  });
```

Append this extension integration-style assertion to `extension/src/video/LoopController.test.js`:

```js
  it("keeps emitting plain time updates after a loop-wrap frame", () => {
    const video = { currentTime: 4.2, paused: false, play: vi.fn(() => Promise.resolve()) };
    const gatherSpy = vi.spyOn(gatherer, "handleTimeUpdate").mockImplementation(() => {});

    startLoop(video, {
      mode: "ab",
      startMs: 1000,
      endMs: 4000,
      startCueIndex: 1,
      endCueIndex: 4,
      anchorCueIndex: 4,
      origin: "ab-loop"
    });

    vi.advanceTimersByTime(100);
    state.loop.boundaryTransition = "none";
    gatherer.handleTimeUpdate(video);

    expect(gatherSpy).toHaveBeenCalledTimes(2);
    expect(state.loop.isLooping).toBe(true);
  });
```

- [ ] **Step 2: Run the full test suites**

Run: `npm --prefix extension run test`

Expected: PASS with `LoopController` and `ContentMessageRouter` green.

Run: `npm --prefix desktop-app run test:renderer -- SubtitleView TranscriptSurface TranscriptBlock loopPlayback abLoopSelection useTranscriptSelection desktop.test.ts`

Expected: PASS with all renderer loop tests green.

- [ ] **Step 3: Run the desktop build**

Run: `npm --prefix desktop-app run build`

Expected: PASS with TypeScript and Vite build completing without new errors.

- [ ] **Step 4: Commit**

```bash
git add extension/src/video/LoopController.test.js extension/src/background/messaging/ContentMessageRouter.test.js desktop-app/src/renderer/components/subtitle/SubtitleView.test.ts desktop-app/src/renderer/components/subtitle/TranscriptSurface.test.ts
git commit -m "test: verify AB loop redesign end to end"
```

## Self-Review

### Spec Coverage

- Shared loop-session model: Task 2 and Task 3
- `AB/A/B` endpoint UI: Task 4
- Predicted-time highlighting and `loop-wrap` boundary protection: Task 5
- Auto-follow pause redesign: Task 5
- Reset / cleanup / mismatch handling: Tasks 2, 3, and 6
- Extension-side ongoing time updates during A-B loop: Tasks 2 and 6

No spec requirements are intentionally omitted.

### Placeholder Scan

- No `TODO`, `TBD`, “handle appropriately,” or “similar to previous task” placeholders remain.
- Every task includes concrete file paths, commands, and code snippets.

### Type Consistency

- `LoopMode`, `LoopOrigin`, `LoopBoundaryTransition`, and `LoopSessionState` are introduced in Task 3 and reused consistently in later renderer tasks.
- `AbLoopSelectionState` and `AbLoopButtonLabel` are introduced in Task 4 and reused consistently in `CueAnchorRail.vue`, `TranscriptBlock.vue`, and `SubtitleView.vue`.
