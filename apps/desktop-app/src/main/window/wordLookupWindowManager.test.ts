import { describe, expect, it, vi } from "vitest";
import {
  computeWordLookupWindowBounds,
  WordLookupWindowManager
} from "./wordLookupWindowManager.js";
import type { AppSettings } from "../types.js";

const workArea = { x: 0, y: 24, width: 1440, height: 876 };

describe("computeWordLookupWindowBounds", () => {
  it("places the panel at the token lower-right side by default", () => {
    const bounds = computeWordLookupWindowBounds({
      anchorRect: { left: 100, top: 120, right: 150, bottom: 140, width: 50, height: 20 },
      panelSize: { width: 360, height: 300 },
      workArea,
      gap: 8,
      margin: 12,
      minSize: { width: 260, height: 180 }
    });

    expect(bounds).toEqual({ x: 158, y: 148, width: 360, height: 300, placement: "lower-right" });
  });

  it("uses lower-left placement when lower-right would overflow horizontally", () => {
    const bounds = computeWordLookupWindowBounds({
      anchorRect: { left: 1320, top: 120, right: 1370, bottom: 140, width: 50, height: 20 },
      panelSize: { width: 360, height: 300 },
      workArea,
      gap: 8,
      margin: 12,
      minSize: { width: 260, height: 180 }
    });

    expect(bounds).toEqual({ x: 952, y: 148, width: 360, height: 300, placement: "lower-left" });
  });

  it("clamps vertical position and panel size to the work area", () => {
    const bounds = computeWordLookupWindowBounds({
      anchorRect: { left: 120, top: 820, right: 180, bottom: 850, width: 60, height: 30 },
      panelSize: { width: 2000, height: 2000 },
      workArea,
      gap: 8,
      margin: 12,
      minSize: { width: 260, height: 180 }
    });

    expect(bounds).toEqual({ x: 12, y: 36, width: 1416, height: 852, placement: "lower-left" });
  });
});

describe("WordLookupWindowManager", () => {
  function createManager() {
    const destroyed = vi.fn();
    const close = vi.fn(() => destroyed());
    const window = {
      isDestroyed: vi.fn(() => false),
      close,
      destroy: destroyed,
      setBounds: vi.fn(),
      setAlwaysOnTop: vi.fn(),
      showInactive: vi.fn(),
      loadFile: vi.fn(async () => undefined),
      webContents: {
        send: vi.fn(),
        once: vi.fn()
      },
      on: vi.fn()
    };
    const mainWindow = {
      isDestroyed: vi.fn(() => false),
      isVisible: vi.fn(() => true),
      isMinimized: vi.fn(() => false),
      getBounds: vi.fn(() => ({ x: 40, y: 80, width: 460, height: 640 })),
      on: vi.fn()
    };
    const manager = new WordLookupWindowManager({
      getMainWindow: () => mainWindow as any,
      getSettings: () => ({
        global: { alwaysOnTop: "screen-saver" }
      }) as AppSettings,
      updateWordLookupPanelSize: vi.fn(),
      getRendererHtmlPath: () => "/app/word-lookup.html",
      createWindow: vi.fn(() => window as any),
      getDisplayWorkArea: vi.fn(() => workArea),
      logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() } as any
    });
    return { manager, window, mainWindow };
  }

  it("opens a floating window using screen-space anchor coordinates", async () => {
    const { manager, window } = createManager();

    await manager.open({
      anchorRect: { left: 100, top: 120, right: 150, bottom: 140, width: 50, height: 20 },
      panelSize: { width: 360, height: 300 },
      matches: [{ word: "alpha", content: "first", aliases: [], fileOrder: 0, matchQuality: 0 }]
    });

    expect(window.setBounds).toHaveBeenCalledWith({ x: 198, y: 228, width: 360, height: 300 });
    expect(window.setAlwaysOnTop).toHaveBeenCalledWith(true, "screen-saver");
    expect(window.webContents.send).toHaveBeenCalledWith("word-lookup-window:payload", {
      matches: [{ word: "alpha", content: "first", aliases: [], fileOrder: 0, matchQuality: 0 }]
    });
    expect(window.showInactive).toHaveBeenCalled();
  });

  it("keeps the window through trigger leave when the pointer enters during the handoff delay", async () => {
    vi.useFakeTimers();
    const { manager, window } = createManager();

    await manager.open({
      anchorRect: { left: 100, top: 120, right: 150, bottom: 140, width: 50, height: 20 },
      panelSize: { width: 360, height: 300 },
      matches: [{ word: "alpha", content: "first", aliases: [], fileOrder: 0, matchQuality: 0 }]
    });
    manager.handleTriggerLeave();
    manager.handlePointerEnter();
    vi.advanceTimersByTime(200);

    expect(window.close).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("closes after trigger leave when the pointer never enters the floating window", async () => {
    vi.useFakeTimers();
    const { manager, window } = createManager();

    await manager.open({
      anchorRect: { left: 100, top: 120, right: 150, bottom: 140, width: 50, height: 20 },
      panelSize: { width: 360, height: 300 },
      matches: [{ word: "alpha", content: "first", aliases: [], fileOrder: 0, matchQuality: 0 }]
    });
    manager.handleTriggerLeave();
    vi.advanceTimersByTime(200);

    expect(window.close).toHaveBeenCalled();
    vi.useRealTimers();
  });
});
