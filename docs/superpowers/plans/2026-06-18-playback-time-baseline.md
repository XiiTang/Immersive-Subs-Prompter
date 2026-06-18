# Playback Time Baseline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make browser-extension, desktop, and Jellyfin / Emby playback snapshots share one timestamp projection contract so desktop playback prediction starts from a correct baseline.

**Architecture:** Add one deterministic projection helper to `@immersive-subs/contracts`, then call it at every cache, replay, and main-process application boundary. Keep the existing renderer prediction loop unchanged; fix the data entering it.

**Tech Stack:** TypeScript, pnpm workspace, Vitest, Electron main process tests, browser-extension background tests, `@immersive-subs/contracts`.

---

## File Structure

- Modify: `packages/contracts/src/core/playback.ts`
  - Owns `projectPlaybackSnapshot()` and its input/output types.
- Modify: `packages/contracts/src/contracts.test.ts`
  - Covers the shared timestamp projection contract.
- Modify: `apps/extension/src/background/tabs/MediaStateSelectors.ts`
  - Adds `projectMediaStateRecord()` so extension background callers reuse one wrapper around the contracts helper.
- Modify: `apps/extension/src/background/tabs/MediaStateStore.ts`
  - Stores media records with a current background-side playback baseline.
- Modify: `apps/extension/src/background/tabs/MediaStateStore.test.ts`
  - Verifies stored records project stale content snapshots to the store handling time.
- Modify: `apps/extension/src/background/messaging/SnapshotBuilder.ts`
  - Builds popup/dashboard media info from projected media records.
- Modify: `apps/extension/src/background/messaging/ContentMessageRouter.test.ts`
  - Verifies forwarded media info uses projected current time.
- Modify: `apps/extension/src/background/desktop/reconnectMediaSync.ts`
  - Projects cached media state before reconnect replay.
- Modify: `apps/extension/src/background/desktop/reconnectMediaSync.test.ts`
  - Verifies playing cached snapshots advance and paused snapshots do not.
- Modify: `apps/desktop-app/src/main/stateManager.ts`
  - Preserves explicit `lastUpdate` when callers have already projected playback.
- Modify: `apps/desktop-app/src/main/stateManager.test.ts`
  - Verifies explicit and implicit playback baselines.
- Modify: `apps/desktop-app/src/main/connectionManager.ts`
  - Projects extension playback messages before writing desktop playback state.
- Modify: `apps/desktop-app/src/main/connectionManager.test.ts`
  - Verifies extension `video-context` and `time-update` messages use `updatedAt`.
- Modify: `apps/desktop-app/src/main/mediaSources/mediaSourceTypes.ts`
  - Adds `updatedAt` to built-in media-source playback events.
- Modify: `apps/desktop-app/src/main/mediaSources/mediaSourceController.ts`
  - Projects built-in media-source playback snapshots before applying them.
- Modify: `apps/desktop-app/src/main/mediaSources/mediaSourceController.test.ts`
  - Verifies playing and paused built-in media-source snapshots project correctly.
- Modify: `apps/desktop-app/src/main/features/jellyfinEmbyMediaSource.ts`
  - Caches Jellyfin / Emby sessions with `fetchedAt` and emits `updatedAt` in playback snapshots.
- Modify: `apps/desktop-app/src/main/features/jellyfinEmbyMediaSource.test.ts`
  - Verifies cache hits keep `fetchedAt` semantics.

## Task 1: Contracts Playback Projection Helper

**Files:**
- Modify: `packages/contracts/src/core/playback.ts`
- Modify: `packages/contracts/src/contracts.test.ts`

- [ ] **Step 1: Add failing contracts tests**

Append these tests inside `describe("@immersive-subs/contracts", ...)` in `packages/contracts/src/contracts.test.ts`:

```ts
  it("projects a playing playback snapshot from its sample timestamp", () => {
    const projected = projectPlaybackSnapshot(
      {
        currentTime: 12000,
        updatedAt: 1000,
        playbackRate: 1.25,
        paused: false,
        duration: 20000
      },
      3000
    );

    expect(projected).toEqual({
      currentTime: 14500,
      updatedAt: 3000,
      playbackRate: 1.25
    });
  });

  it("keeps paused playback snapshots fixed while moving the timestamp baseline", () => {
    const projected = projectPlaybackSnapshot(
      {
        currentTime: 12000,
        updatedAt: 1000,
        playbackRate: 2,
        paused: true,
        duration: 20000
      },
      4000
    );

    expect(projected).toEqual({
      currentTime: 12000,
      updatedAt: 4000,
      playbackRate: 0
    });
  });

  it("clamps negative elapsed time and projected time beyond duration", () => {
    expect(
      projectPlaybackSnapshot(
        {
          currentTime: 9000,
          updatedAt: 5000,
          playbackRate: 1,
          paused: false,
          duration: 10000
        },
        3000
      )
    ).toEqual({
      currentTime: 9000,
      updatedAt: 3000,
      playbackRate: 1
    });

    expect(
      projectPlaybackSnapshot(
        {
          currentTime: 9000,
          updatedAt: 1000,
          playbackRate: 2,
          paused: false,
          duration: 10000
        },
        3000
      )
    ).toEqual({
      currentTime: 10000,
      updatedAt: 3000,
      playbackRate: 2
    });
  });

  it("normalizes invalid playback projection input to current contract defaults", () => {
    expect(
      projectPlaybackSnapshot(
        {
          currentTime: Number.NaN,
          updatedAt: "bad",
          playbackRate: "bad",
          paused: false,
          duration: null
        },
        7000
      )
    ).toEqual({
      currentTime: 0,
      updatedAt: 7000,
      playbackRate: 1
    });
  });
```

Update the import list at the top of `packages/contracts/src/contracts.test.ts` to include `projectPlaybackSnapshot`:

```ts
import type {
  ControlLoopCommandMessage,
  ControlSeekCommandMessage,
  FromExtensionMessage,
  LoopSession,
  LoopSnapshot,
  LoopStartedMessage,
  PlaybackSnapshot,
  ToExtensionMessage,
  VideoStateSnapshot
} from "./index.js";
import { projectPlaybackSnapshot } from "./index.js";
```

- [ ] **Step 2: Run contracts tests and verify they fail**

Run:

```bash
pnpm --filter @immersive-subs/contracts test
```

Expected: FAIL because `projectPlaybackSnapshot` is not exported.

- [ ] **Step 3: Implement the shared projection helper**

Replace `packages/contracts/src/core/playback.ts` with:

```ts
import type { LoopSnapshot } from "./loop.js";

export interface PlaybackSnapshot {
  playbackRate: number;
  currentTime: number;
  duration: number | null;
  paused: boolean;
  muted: boolean;
  volume: number;
  readyState: number;
  updatedAt: number;
  loop: LoopSnapshot | null;
}

export interface PlaybackProjectionInput {
  currentTime: unknown;
  updatedAt: unknown;
  playbackRate: unknown;
  paused: unknown;
  duration?: unknown;
}

export interface PlaybackProjection {
  currentTime: number;
  updatedAt: number;
  playbackRate: number;
}

export function projectPlaybackSnapshot(input: PlaybackProjectionInput, now = Date.now()): PlaybackProjection {
  const targetTime = normalizeTimestamp(now, Date.now());
  const sampleTime = normalizeTimestamp(input.updatedAt, targetTime);
  const paused = input.paused === true;
  const playbackRate = paused ? 0 : normalizePlaybackRate(input.playbackRate);
  const currentTime = normalizeNonNegativeNumber(input.currentTime, 0);
  const elapsed = Math.max(0, targetTime - sampleTime);
  const projectedTime = paused ? currentTime : currentTime + elapsed * playbackRate;
  const duration = normalizePositiveDuration(input.duration);

  return {
    currentTime: clampPlaybackTime(projectedTime, duration),
    updatedAt: targetTime,
    playbackRate
  };
}

function normalizeTimestamp(value: unknown, defaultValue: number): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : defaultValue;
}

function normalizePlaybackRate(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 1;
}

function normalizeNonNegativeNumber(value: unknown, defaultValue: number): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : defaultValue;
}

function normalizePositiveDuration(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

function clampPlaybackTime(value: number, duration: number | null): number {
  const lowerClamped = Math.max(0, value);
  return duration === null ? lowerClamped : Math.min(lowerClamped, duration);
}
```

`packages/contracts/src/index.ts` already exports `./core/playback.js`, so no index change is needed.

- [ ] **Step 4: Run contracts tests and verify they pass**

Run:

```bash
pnpm --filter @immersive-subs/contracts test
```

Expected: PASS.

- [ ] **Step 5: Commit contracts change**

Run:

```bash
git add packages/contracts/src/core/playback.ts packages/contracts/src/contracts.test.ts
git commit -m "feat: add playback snapshot projection contract"
```

## Task 2: Extension Background Projection

**Files:**
- Modify: `apps/extension/src/background/tabs/MediaStateSelectors.ts`
- Modify: `apps/extension/src/background/tabs/MediaStateStore.ts`
- Modify: `apps/extension/src/background/tabs/MediaStateStore.test.ts`
- Modify: `apps/extension/src/background/messaging/SnapshotBuilder.ts`
- Modify: `apps/extension/src/background/messaging/ContentMessageRouter.test.ts`
- Modify: `apps/extension/src/background/desktop/reconnectMediaSync.ts`
- Modify: `apps/extension/src/background/desktop/reconnectMediaSync.test.ts`

- [ ] **Step 1: Add failing extension background tests**

Append this test to `apps/extension/src/background/desktop/reconnectMediaSync.test.ts`:

```ts
  it("projects a cached playing media state before reconnect replay", () => {
    const connection = { send: vi.fn() };

    sendCurrentMediaContext(
      connection,
      {
        list: () => [
          mediaState({
            tabId: 2,
            currentTime: 12000,
            updatedAt: 1000,
            playbackRate: 1.5,
            paused: false,
            duration: 20000
          })
        ]
      },
      3000
    );

    expect(connection.send).toHaveBeenCalledWith({
      tabId: 2,
      type: "video-context",
      payload: expect.objectContaining({
        currentTime: 15000,
        updatedAt: 3000,
        playbackRate: 1.5
      })
    });
  });

  it("does not advance a paused cached media state before reconnect replay", () => {
    const connection = { send: vi.fn() };

    sendCurrentMediaContext(
      connection,
      {
        list: () => [
          mediaState({
            tabId: 3,
            currentTime: 12000,
            updatedAt: 1000,
            playbackRate: 2,
            paused: true,
            duration: 20000
          })
        ]
      },
      5000
    );

    expect(connection.send).toHaveBeenCalledWith({
      tabId: 3,
      type: "video-context",
      payload: expect.objectContaining({
        currentTime: 12000,
        updatedAt: 5000,
        playbackRate: 0
      })
    });
  });
```

Append this test to `apps/extension/src/background/tabs/MediaStateStore.test.ts`:

```ts
  it("stores media snapshots with a current background playback baseline", () => {
    vi.useFakeTimers();
    vi.setSystemTime(5000);
    try {
      const store = new MediaStateStore();

      const result = store.setState(
        4,
        {
          pageUrl: "https://example.com/watch",
          site: "unknown",
          videoSrc: "https://cdn.example.com/video.mp4",
          videoWidth: 1920,
          videoHeight: 1080,
          pictureInPicture: false,
          playbackRate: 1.5,
          currentTime: 1000,
          duration: 10000,
          paused: false,
          muted: false,
          volume: 1,
          readyState: 4,
          title: "Episode",
          updatedAt: 3000,
          loop: null
        },
        "time-update"
      );

      expect(result).toEqual(
        expect.objectContaining({
          currentTime: 4000,
          playbackRate: 1.5,
          updatedAt: 5000
        })
      );
    } finally {
      vi.useRealTimers();
    }
  });
```

Append this test to `apps/extension/src/background/messaging/ContentMessageRouter.test.ts`:

```ts
  it("broadcasts projected media info instead of stale stored playback time", () => {
    const { connectionPool, router } = createRouter();

    router.handleMessage(7, 0, {
      type: "time-update",
      payload: {
        pageUrl: "https://example.com/watch",
        site: "unknown",
        videoSrc: "https://cdn.example.com/video.mp4",
        videoWidth: 1920,
        videoHeight: 1080,
        pictureInPicture: false,
        playbackRate: 1,
        currentTime: 1000,
        duration: 10000,
        paused: false,
        muted: false,
        volume: 1,
        readyState: 4,
        title: "Example",
        updatedAt: 1000,
        loop: null
      }
    });

    expect(connectionPool.broadcast).toHaveBeenCalledWith({
      tabId: 7,
      type: "time-update",
      payload: expect.objectContaining({
        currentTime: 999
      })
    });
  });
```

Then replace the `createRouter()` mock `mediaStateStore.get` and `snapshotBuilder.buildMediaInfo` in the same test file with a deterministic projection-oriented pair:

```ts
        get: vi.fn(() => ({
          pageUrl: "https://example.com/watch",
          site: "unknown",
          videoSrc: "https://cdn.example.com/video.mp4",
          videoWidth: 1920,
          videoHeight: 1080,
          pictureInPicture: false,
          playbackRate: 1,
          currentTime: 1000,
          duration: 10000,
          paused: false,
          muted: false,
          volume: 1,
          readyState: 4,
          title: "Example",
          updatedAt: Date.now(),
          loop: null,
          tabId: 7
        }))
```

```ts
        buildMediaInfo: vi.fn((state: any) => ({
          ...state,
          currentTime: state.currentTime,
          duration: state.duration,
          updatedAgo: 0,
          progress: state.duration ? state.currentTime / state.duration : null,
          isPlaying: true
        }))
```

- [ ] **Step 2: Run extension tests and verify they fail**

Run:

```bash
pnpm --filter @immersive-subs/extension test:app -- src/background/desktop/reconnectMediaSync.test.ts src/background/tabs/MediaStateStore.test.ts src/background/messaging/ContentMessageRouter.test.ts
```

Expected: FAIL because reconnect sync has no `now` parameter and no extension background projection helper exists.

- [ ] **Step 3: Add the extension media-state projection helper**

Update `apps/extension/src/background/tabs/MediaStateSelectors.ts` to:

```ts
import { projectPlaybackSnapshot } from "@immersive-subs/contracts";
import type { MediaStateRecord } from "../../shared/types";

export function isMediaStatePlaying(state: MediaStateRecord): boolean {
  return !state.paused && (state.readyState || 0) >= 2;
}

export function projectMediaStateRecord(state: MediaStateRecord, now = Date.now()): MediaStateRecord {
  const projected = projectPlaybackSnapshot(state, now);
  return {
    ...state,
    currentTime: projected.currentTime,
    playbackRate: projected.playbackRate,
    updatedAt: projected.updatedAt
  };
}

export function sortMediaStatesByPriority(states: MediaStateRecord[]): MediaStateRecord[] {
  return [...states].sort((a, b) => {
    const aPlaying = isMediaStatePlaying(a);
    const bPlaying = isMediaStatePlaying(b);
    if (aPlaying !== bPlaying) {
      return aPlaying ? -1 : 1;
    }
    return (b.updatedAt || 0) - (a.updatedAt || 0);
  });
}

export function selectCurrentMediaState(states: MediaStateRecord[]): MediaStateRecord | null {
  return sortMediaStatesByPriority(states)[0] ?? null;
}
```

- [ ] **Step 4: Project records when storing extension background media state**

In `apps/extension/src/background/tabs/MediaStateStore.ts`, add the import:

```ts
import { projectMediaStateRecord } from "./MediaStateSelectors";
```

Replace the `const next: MediaStateRecord = { ... }` block in `setState()` with:

```ts
    const now = Date.now();
    const sampleUpdatedAt =
      typeof patch.updatedAt === "number" && Number.isFinite(patch.updatedAt) && patch.updatedAt > 0
        ? patch.updatedAt
        : now;
    const merged: MediaStateRecord = {
      ...base,
      ...patch,
      tabId,
      lastEventType: lastEventType || base.lastEventType || "video-context",
      updatedAt: sampleUpdatedAt
    };
    const next = projectMediaStateRecord(merged, now);
```

- [ ] **Step 5: Project popup/dashboard media info**

In `apps/extension/src/background/messaging/SnapshotBuilder.ts`, update the import:

```ts
import { isMediaStatePlaying, projectMediaStateRecord, sortMediaStatesByPriority } from "../tabs/MediaStateSelectors";
```

Replace `buildMediaInfo()` with:

```ts
  buildMediaInfo(state: MediaStateRecord, now = Date.now()): MediaInfo {
    const projected = projectMediaStateRecord(state, now);
    const duration =
      typeof projected.duration === "number" && Number.isFinite(projected.duration) ? projected.duration : null;
    const currentTime =
      typeof projected.currentTime === "number" && Number.isFinite(projected.currentTime) ? projected.currentTime : 0;
    const progress =
      duration && duration > 0 ? Math.min(Math.max(currentTime / duration, 0), 1) : null;
    return {
      ...projected,
      duration,
      currentTime,
      progress,
      isPlaying: isMediaStatePlaying(projected),
      updatedAgo: now - (state.updatedAt || now)
    };
  }
```

- [ ] **Step 6: Project cached media before reconnect replay**

Replace `apps/extension/src/background/desktop/reconnectMediaSync.ts` with:

```ts
import type { MediaStateRecord } from "../../shared/types";
import { projectMediaStateRecord, selectCurrentMediaState } from "../tabs/MediaStateSelectors";
import type { DesktopConnectionSendPayload } from "./DesktopConnection";

type MediaStateSource = {
  list(): MediaStateRecord[];
};

type DesktopMediaSender = {
  send(payload: DesktopConnectionSendPayload): void;
};

export function sendCurrentMediaContext(
  connection: DesktopMediaSender,
  mediaStateStore: MediaStateSource,
  now = Date.now()
) {
  const current = selectCurrentMediaState(mediaStateStore.list());

  if (!current) {
    return;
  }

  connection.send({
    tabId: current.tabId,
    type: "video-context",
    payload: projectMediaStateRecord(current, now)
  });
}
```

- [ ] **Step 7: Run extension tests and verify they pass**

Run:

```bash
pnpm --filter @immersive-subs/extension test:app -- src/background/desktop/reconnectMediaSync.test.ts src/background/tabs/MediaStateStore.test.ts src/background/messaging/ContentMessageRouter.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit extension projection change**

Run:

```bash
git add apps/extension/src/background/tabs/MediaStateSelectors.ts apps/extension/src/background/tabs/MediaStateStore.ts apps/extension/src/background/tabs/MediaStateStore.test.ts apps/extension/src/background/messaging/SnapshotBuilder.ts apps/extension/src/background/messaging/ContentMessageRouter.test.ts apps/extension/src/background/desktop/reconnectMediaSync.ts apps/extension/src/background/desktop/reconnectMediaSync.test.ts
git commit -m "feat: project extension media state baselines"
```

## Task 3: Desktop Extension Playback Ingress

**Files:**
- Modify: `apps/desktop-app/src/main/stateManager.ts`
- Modify: `apps/desktop-app/src/main/stateManager.test.ts`
- Modify: `apps/desktop-app/src/main/connectionManager.ts`
- Modify: `apps/desktop-app/src/main/connectionManager.test.ts`

- [ ] **Step 1: Add failing StateManager tests**

Append these tests inside `describe("StateManager profile URL matching", ...)` in `apps/desktop-app/src/main/stateManager.test.ts`:

```ts
  it("preserves an explicit playback lastUpdate supplied by a projected source", () => {
    const settings = makeSettings();
    const bus = new AppEventBus();
    const manager = new StateManager(bus, () => settings);

    manager.updatePlayback({
      currentTime: 4200,
      playbackRate: 1,
      lastUpdate: 12345
    });

    expect(manager.getState().playback).toEqual(
      expect.objectContaining({
        currentTime: 4200,
        playbackRate: 1,
        lastUpdate: 12345
      })
    );
  });

  it("uses local time as playback lastUpdate when callers do not provide one", () => {
    vi.useFakeTimers();
    vi.setSystemTime(23456);
    try {
      const settings = makeSettings();
      const manager = new StateManager(new AppEventBus(), () => settings);

      manager.updatePlayback({
        currentTime: 1000,
        playbackRate: 1
      });

      expect(manager.getState().playback.lastUpdate).toBe(23456);
    } finally {
      vi.useRealTimers();
    }
  });
```

Update the import at the top of the file:

```ts
import { describe, expect, it, vi } from "vitest";
```

- [ ] **Step 2: Add failing ConnectionManager playback projection tests**

Append these tests inside `describe("ConnectionManager network listeners", ...)` in `apps/desktop-app/src/main/connectionManager.test.ts`:

```ts
  it("projects extension time-update payloads from updatedAt before applying playback", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(10_000);
    try {
      const network: NetworkSettings = {
        endpoints: [{ id: "loopback", host: "127.0.0.1", port: 44501 }],
        authToken: "0123456789abcdef0123456789abcdef"
      };
      const stateManager = createStateManager();
      stateManager.state.activeTabId = 1;
      const manager = new ConnectionManager({
        getNetworkSettings: () => network,
        getSettings: () => makeSettings(network),
        subtitleService: {} as never,
        stateManager: stateManager as never,
        bus: new AppEventBus(),
        createWebSocketServer: () => new FakeWebSocketServer() as never
      });
      const handleMessage = (manager as unknown as {
        handleMessage(message: unknown, resolvedUrl: string | null): Promise<void>;
      }).handleMessage.bind(manager);

      await handleMessage(
        {
          source: "usp-extension",
          type: "time-update",
          tabId: 1,
          payload: {
            pageUrl: "https://example.test/watch",
            videoSrc: "https://cdn.example.test/video.mp4",
            site: "unknown",
            title: "Example",
            currentTime: 1000,
            updatedAt: 4000,
            playbackRate: 1.5,
            duration: 12000,
            paused: false,
            loop: null
          }
        },
        null
      );

      expect(stateManager.updatePlayback).toHaveBeenCalledWith({
        currentTime: 10000,
        playbackRate: 1.5,
        duration: 12000,
        loop: null,
        lastUpdate: 10000
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("projects extension video-context playback before subtitle loading", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(8000);
    try {
      const network: NetworkSettings = {
        endpoints: [{ id: "loopback", host: "127.0.0.1", port: 44501 }],
        authToken: "0123456789abcdef0123456789abcdef"
      };
      const stateManager = createStateManager();
      const manager = new ConnectionManager({
        getNetworkSettings: () => network,
        getSettings: () => makeSettings(network),
        subtitleService: {
          getSubtitles: vi.fn(async () => ({ tracks: [] }))
        } as never,
        stateManager: stateManager as never,
        bus: new AppEventBus(),
        createWebSocketServer: () => new FakeWebSocketServer() as never
      });
      const handleMessage = (manager as unknown as {
        handleMessage(message: unknown, resolvedUrl: string | null): Promise<void>;
      }).handleMessage.bind(manager);

      await handleMessage(
        {
          source: "usp-extension",
          type: "video-context",
          tabId: 1,
          payload: {
            pageUrl: "https://example.test/watch",
            videoSrc: "https://cdn.example.test/video.mp4",
            site: "unknown",
            title: "Example",
            currentTime: 2000,
            updatedAt: 5000,
            playbackRate: 2,
            duration: 10000,
            paused: false,
            loop: null
          }
        },
        "https://cdn.example.test/video.mp4"
      );

      expect(stateManager.updatePlayback).toHaveBeenCalledWith({
        currentTime: 8000,
        playbackRate: 2,
        duration: 10000,
        loop: null,
        lastUpdate: 8000
      });
    } finally {
      vi.useRealTimers();
    }
  });
```

- [ ] **Step 3: Run focused desktop tests and verify they fail**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app exec vitest run src/main/stateManager.test.ts src/main/connectionManager.test.ts --project main
```

Expected: FAIL because explicit `lastUpdate` is overwritten and extension playback is not projected.

- [ ] **Step 4: Preserve explicit playback baseline in StateManager**

In `apps/desktop-app/src/main/stateManager.ts`, replace `updatePlayback()` with:

```ts
  updatePlayback(updates: Partial<PlaybackState>) {
    const next = clone(this.state);
    const lastUpdate =
      typeof updates.lastUpdate === "number" && Number.isFinite(updates.lastUpdate)
        ? updates.lastUpdate
        : Date.now();
    next.playback = {
      ...next.playback,
      ...updates,
      lastUpdate
    };
    this.state = next;
    this.bus.emit("state:playback", next.playback);
    return next;
  }
```

- [ ] **Step 5: Project extension playback messages in ConnectionManager**

In `apps/desktop-app/src/main/connectionManager.ts`, update the contracts import:

```ts
import {
  AppSettings,
  NetworkEndpoint,
  NetworkListenerStatus,
  SubtitleTrack,
  VideoControlCommand
} from "./types.js";
import { projectPlaybackSnapshot } from "@immersive-subs/contracts";
```

Add this private method near `normalizeDuration()`:

```ts
  private projectExtensionPlayback(
    payload: Extract<FromExtensionBroadcastMessage, { type: "video-context" | "time-update" | "playback-rate" }>["payload"],
    existingDuration: number | null
  ) {
    const durationUpdate = this.normalizeDuration(payload.duration);
    const duration = durationUpdate !== null ? durationUpdate : existingDuration;
    const projected = projectPlaybackSnapshot(
      {
        currentTime: payload.currentTime,
        updatedAt: payload.updatedAt,
        playbackRate: payload.playbackRate,
        paused: payload.paused,
        duration
      },
      Date.now()
    );
    return {
      currentTime: projected.currentTime,
      playbackRate: projected.playbackRate,
      duration,
      lastUpdate: projected.updatedAt
    };
  }
```

Replace the initial playback calculation in the `"video-context"` branch with:

```ts
        const initialPlayback = this.projectExtensionPlayback(
          message.payload,
          this.options.stateManager.getState().playback.duration ?? null
        );
        this.options.stateManager.updatePlayback({
          ...initialPlayback,
          loop: message.payload.loop ?? null
        });
```

Replace the playback calculation in the `"time-update"` / `"playback-rate"` branch with:

```ts
        const projectedPlayback = this.projectExtensionPlayback(
          message.payload,
          state.playback.duration ?? null
        );

        this.options.stateManager.updatePlayback({
          ...projectedPlayback,
          loop: message.payload.loop ?? null
        });
```

- [ ] **Step 6: Run focused desktop tests and verify they pass**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app exec vitest run src/main/stateManager.test.ts src/main/connectionManager.test.ts --project main
```

Expected: PASS.

- [ ] **Step 7: Commit desktop extension-ingress change**

Run:

```bash
git add apps/desktop-app/src/main/stateManager.ts apps/desktop-app/src/main/stateManager.test.ts apps/desktop-app/src/main/connectionManager.ts apps/desktop-app/src/main/connectionManager.test.ts
git commit -m "feat: project extension playback at desktop ingress"
```

## Task 4: Built-In Jellyfin / Emby Playback Baseline

**Files:**
- Modify: `apps/desktop-app/src/main/mediaSources/mediaSourceTypes.ts`
- Modify: `apps/desktop-app/src/main/mediaSources/mediaSourceController.ts`
- Modify: `apps/desktop-app/src/main/mediaSources/mediaSourceController.test.ts`
- Modify: `apps/desktop-app/src/main/features/jellyfinEmbyMediaSource.ts`
- Modify: `apps/desktop-app/src/main/features/jellyfinEmbyMediaSource.test.ts`

- [ ] **Step 1: Add failing MediaSourceController tests**

In `apps/desktop-app/src/main/mediaSources/mediaSourceController.test.ts`, update existing `playbackSnapshot` test fixtures to include `updatedAt`. For example, replace the event in `"projects source, subtitle, session, and playback events into host state"` with:

```ts
            {
              type: "playbackSnapshot",
              sessionId: "session-1",
              positionMs: 5000,
              durationMs: 10000,
              playbackRate: 1,
              paused: false,
              updatedAt: 1000
            }
```

Append these tests inside `describe("MediaSourceController", ...)`:

```ts
  it("projects built-in media-source playback snapshots from updatedAt", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(5000);
    try {
      const bus = new AppEventBus();
      const stateManager = createStateManager();
      stateManager.state.activeSource = "mediaserver";
      stateManager.state.mediaServer.selectedSessionId = "session-1";
      const controller = new MediaSourceController({
        bus,
        stateManager: stateManager as never,
        getSources: () => [
          {
            sourceId: "jellyfinEmby",
            handleConnectionMessage: vi.fn(async () => [
              {
                type: "playbackSnapshot",
                sessionId: "session-1",
                positionMs: 1000,
                durationMs: 10000,
                playbackRate: 2,
                paused: false,
                updatedAt: 3000
              }
            ])
          }
        ]
      });
      controller.start();

      bus.emit("connection:message", {
        message: { source: "usp-extension", type: "time-update", tabId: 7, payload: {} },
        resolvedUrl: null,
        handled: false,
        markHandled() {
          this.handled = true;
        }
      } as any);

      await vi.waitFor(() => {
        expect(stateManager.state.playback).toEqual(
          expect.objectContaining({
            currentTime: 5000,
            playbackRate: 2,
            duration: 10000,
            lastUpdate: 5000
          })
        );
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps paused built-in media-source playback fixed while moving lastUpdate", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(6000);
    try {
      const bus = new AppEventBus();
      const stateManager = createStateManager();
      stateManager.state.activeSource = "mediaserver";
      stateManager.state.mediaServer.selectedSessionId = "session-1";
      const controller = new MediaSourceController({
        bus,
        stateManager: stateManager as never,
        getSources: () => [
          {
            sourceId: "jellyfinEmby",
            handleConnectionMessage: vi.fn(async () => [
              {
                type: "playbackSnapshot",
                sessionId: "session-1",
                positionMs: 3000,
                durationMs: 10000,
                playbackRate: 2,
                paused: true,
                updatedAt: 1000
              }
            ])
          }
        ]
      });
      controller.start();

      bus.emit("connection:message", {
        message: { source: "usp-extension", type: "time-update", tabId: 7, payload: {} },
        resolvedUrl: null,
        handled: false,
        markHandled() {
          this.handled = true;
        }
      } as any);

      await vi.waitFor(() => {
        expect(stateManager.state.playback).toEqual(
          expect.objectContaining({
            currentTime: 3000,
            playbackRate: 0,
            duration: 10000,
            lastUpdate: 6000
          })
        );
      });
    } finally {
      vi.useRealTimers();
    }
  });
```

- [ ] **Step 2: Add failing Jellyfin / Emby cache timestamp tests**

Append this test inside `describe("JellyfinEmbyMediaSource", ...)` in `apps/desktop-app/src/main/features/jellyfinEmbyMediaSource.test.ts`:

```ts
  it("emits cached playback snapshots with the original fetchedAt sample timestamp", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1000);
    try {
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
                  RunTimeTicks: 20_000_000,
                  MediaSources: [{ Id: "media-1", MediaStreams: [] }]
                },
                PlayState: { MediaSourceId: "media-1", PositionTicks: 2_000_000, IsPaused: false, PlaybackRate: 1 }
              }
            ]
          };
        }
        return {
          ok: true,
          text: async () => ""
        };
      });
      const source = new JellyfinEmbyMediaSource({ getSettings: () => createSettings(), fetch: fetch as never });

      await source.handleConnectionMessage({
        type: "video-context",
        tabId: 1,
        payload: {
          pageUrl: "https://media.example.test/web/index.html#!/details?id=item-1",
          videoSrc: null,
          title: "Episode",
          site: "Jellyfin"
        }
      });

      vi.setSystemTime(2500);
      const result = await source.handleConnectionMessage({
        type: "time-update",
        tabId: 1,
        payload: {
          pageUrl: "https://media.example.test/web/index.html#!/details?id=item-1",
          videoSrc: null,
          title: "Episode",
          site: "Jellyfin"
        }
      });

      expect(fetch).toHaveBeenCalledTimes(2);
      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: "playbackSnapshot",
            sessionId: "server-1:session-1",
            positionMs: 200,
            playbackRate: 1,
            paused: false,
            updatedAt: 1000
          })
        ])
      );
    } finally {
      vi.useRealTimers();
    }
  });
```

- [ ] **Step 3: Run focused media-source tests and verify they fail**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app exec vitest run src/main/mediaSources/mediaSourceController.test.ts src/main/features/jellyfinEmbyMediaSource.test.ts --project main
```

Expected: FAIL because `playbackSnapshot` has no `updatedAt` and controller does not project it.

- [ ] **Step 4: Add `updatedAt` to media-source playback events**

In `apps/desktop-app/src/main/mediaSources/mediaSourceTypes.ts`, replace the `playbackSnapshot` member with:

```ts
  | {
      type: "playbackSnapshot";
      sessionId: string | null;
      positionMs: number | null;
      durationMs: number | null;
      playbackRate: number;
      paused: boolean;
      updatedAt: number;
    }
```

- [ ] **Step 5: Project built-in media-source playback in controller**

In `apps/desktop-app/src/main/mediaSources/mediaSourceController.ts`, add the import:

```ts
import { projectPlaybackSnapshot } from "@immersive-subs/contracts";
```

Replace `applyPlaybackSnapshot()` with:

```ts
  private applyPlaybackSnapshot(event: Extract<MediaSourceAdapterEvent, { type: "playbackSnapshot" }>): void {
    const state = this.options.stateManager.getState();
    if (state.activeSource !== "mediaserver") {
      return;
    }
    if (event.sessionId && state.mediaServer.selectedSessionId && event.sessionId !== state.mediaServer.selectedSessionId) {
      return;
    }
    const duration = typeof event.durationMs === "number" && event.durationMs >= 0 ? event.durationMs : state.playback.duration;
    const projected = projectPlaybackSnapshot(
      {
        currentTime: event.positionMs,
        updatedAt: event.updatedAt,
        playbackRate: event.playbackRate,
        paused: event.paused,
        duration
      },
      Date.now()
    );
    const playback: Partial<PlaybackState> = {
      currentTime: projected.currentTime,
      duration,
      playbackRate: projected.playbackRate,
      lastUpdate: projected.updatedAt
    };
    this.options.stateManager.updatePlayback(playback);
  }
```

- [ ] **Step 6: Preserve Jellyfin / Emby session fetchedAt timestamps**

In `apps/desktop-app/src/main/features/jellyfinEmbyMediaSource.ts`, add this type below `NormalizedServer`:

```ts
type SessionCacheEntry = {
  sessions: MediaServerSessionSummary[];
  fetchedAt: number;
};
```

Replace the two cache fields:

```ts
  private readonly sessionsByServer = new Map<string, SessionCacheEntry>();
```

Remove:

```ts
  private readonly lastFetchByServer = new Map<string, number>();
```

Replace `getSessions()` with:

```ts
  private async getSessions(
    server: NormalizedServer,
    forceRefresh: boolean
  ): Promise<SessionCacheEntry> {
    const cached = this.sessionsByServer.get(server.id);
    if (!forceRefresh && cached && Date.now() - cached.fetchedAt < SESSION_REFRESH_MS) {
      return cached;
    }
    const fetchedAt = Date.now();
    const sessions = await fetchSessions(this.fetchImpl, server);
    const entry = { sessions, fetchedAt };
    this.sessionsByServer.set(server.id, entry);
    return entry;
  }
```

In `handleConnectionMessage()`, replace:

```ts
    let sessions: MediaServerSessionSummary[];
```

with:

```ts
    let sessionBatch: SessionCacheEntry;
```

Replace:

```ts
      sessions = await this.getSessions(server, isVideoContext);
```

with:

```ts
      sessionBatch = await this.getSessions(server, isVideoContext);
```

After the `try/catch`, add:

```ts
    const { sessions, fetchedAt } = sessionBatch;
```

Replace both calls to `sessionPlaybackEvent(selected)` with:

```ts
sessionPlaybackEvent(selected, fetchedAt)
```

Replace `clearState()` with:

```ts
  private clearState(): void {
    this.sessionsByServer.clear();
  }
```

Replace `sessionPlaybackEvent()` with:

```ts
function sessionPlaybackEvent(session: MediaServerSessionSummary, updatedAt: number): MediaSourceAdapterEvent {
  return {
    type: "playbackSnapshot",
    sessionId: session.id,
    positionMs: session.positionTicks ? Math.round(session.positionTicks / 10000) : null,
    durationMs: session.runTimeTicks ? Math.round(session.runTimeTicks / 10000) : null,
    playbackRate: session.playbackRate ?? 1,
    paused: session.isPaused,
    updatedAt
  };
}
```

- [ ] **Step 7: Run focused media-source tests and verify they pass**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app exec vitest run src/main/mediaSources/mediaSourceController.test.ts src/main/features/jellyfinEmbyMediaSource.test.ts --project main
```

Expected: PASS.

- [ ] **Step 8: Commit built-in media-source baseline change**

Run:

```bash
git add apps/desktop-app/src/main/mediaSources/mediaSourceTypes.ts apps/desktop-app/src/main/mediaSources/mediaSourceController.ts apps/desktop-app/src/main/mediaSources/mediaSourceController.test.ts apps/desktop-app/src/main/features/jellyfinEmbyMediaSource.ts apps/desktop-app/src/main/features/jellyfinEmbyMediaSource.test.ts
git commit -m "feat: project built-in media source playback"
```

## Task 5: Final Verification And Scope Audit

**Files:**
- Read-only verification across the workspace.

- [ ] **Step 1: Run focused playback baseline tests**

Run:

```bash
pnpm --filter @immersive-subs/contracts test
pnpm --filter @immersive-subs/extension test:app -- src/background/desktop/reconnectMediaSync.test.ts src/background/tabs/MediaStateStore.test.ts src/background/messaging/ContentMessageRouter.test.ts
pnpm --filter @immersive-subs/desktop-app exec vitest run src/main/stateManager.test.ts src/main/connectionManager.test.ts src/main/mediaSources/mediaSourceController.test.ts src/main/features/jellyfinEmbyMediaSource.test.ts --project main
```

Expected: all commands PASS.

- [ ] **Step 2: Run typechecks for changed packages**

Run:

```bash
pnpm --filter @immersive-subs/contracts typecheck
pnpm --filter @immersive-subs/extension typecheck:app
pnpm --filter @immersive-subs/desktop-app typecheck:app
```

Expected: all commands PASS.

- [ ] **Step 3: Audit that no old plugin framework was restored**

Run:

```bash
test ! -d plugins
test ! -d plugin-repository
test ! -d apps/desktop-app/src/main/plugins
rg -n "pluginRepository|PluginManager|pluginSandbox|plugin manifest|usp-plugin|legacy|migration|compatibility" apps packages docs/superpowers/specs/2026-06-18-playback-time-baseline-design.md
```

Expected:

- The three `test ! -d ...` commands exit successfully.
- `rg` has no matches in implementation files under `apps` or `packages`.
- The spec file may contain explicit out-of-scope statements about no compatibility or migration code.

- [ ] **Step 4: Run whitespace check**

Run:

```bash
git diff --check
```

Expected: no output and exit code 0.

- [ ] **Step 5: Commit verification-only adjustments if any**

If verification required small test command or type-only fixes, commit them:

```bash
git add apps packages docs/superpowers/plans/2026-06-18-playback-time-baseline.md
git commit -m "test: verify playback time baseline"
```

If no files changed after Task 4, skip this commit.

## Plan Self-Review

- Spec coverage: The plan covers shared contracts projection, extension content/background cache and reconnect, popup/dashboard media info, desktop extension ingress, Jellyfin / Emby session cache timestamps, desktop media-source application, tests, typechecks, and plugin-restoration audit.
- Placeholder scan: The plan contains no placeholder sections and every code-changing step includes concrete code.
- Type consistency: `projectPlaybackSnapshot()` returns `updatedAt`, extension `projectMediaStateRecord()` maps that to media records, desktop `StateManager.updatePlayback()` preserves explicit `lastUpdate`, and media-source `playbackSnapshot.updatedAt` is consumed by `MediaSourceController`.
