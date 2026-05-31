import { describe, expect, it, vi } from "vitest";
import { WordLookupWindowManager } from "./wordLookupWindowManager.js";
import type { AppSettings } from "../types.js";

const workArea = { x: 0, y: 24, width: 1440, height: 876 };

describe("WordLookupWindowManager", () => {
  function createManager() {
    const destroyed = vi.fn();
    const close = vi.fn(() => destroyed());
    let windowBounds = { x: 198, y: 228, width: 360, height: 300 };
    const updateWordLookupPanelSize = vi.fn();
    const window = {
      isDestroyed: vi.fn(() => false),
      close,
      destroy: destroyed,
      getBounds: vi.fn(() => windowBounds),
      setBounds: vi.fn((bounds: Partial<typeof windowBounds>) => {
        windowBounds = { ...windowBounds, ...bounds };
      }),
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
      updateWordLookupPanelSize,
      getRendererHtmlPath: () => "/app/word-lookup.html",
      createWindow: vi.fn(() => window as any),
      getDisplayWorkArea: vi.fn(() => workArea),
      logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() } as any
    });
    return { manager, window, mainWindow, updateWordLookupPanelSize };
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

  it("resizes the current floating window and persists the clamped panel size", async () => {
    const { manager, window, updateWordLookupPanelSize } = createManager();

    await manager.open({
      anchorRect: { left: 100, top: 120, right: 150, bottom: 140, width: 50, height: 20 },
      panelSize: { width: 360, height: 300 },
      matches: [{ word: "alpha", content: "first", aliases: [], fileOrder: 0, matchQuality: 0 }]
    });
    manager.handleResize({ width: 520, height: 420 });

    expect(window.setBounds).toHaveBeenLastCalledWith({ width: 520, height: 420 });
    expect(updateWordLookupPanelSize).toHaveBeenLastCalledWith({ width: 520, height: 420 });
  });

  it("does not reapply the same size when the renderer reports unchanged bounds", async () => {
    const { manager, window, updateWordLookupPanelSize } = createManager();

    await manager.open({
      anchorRect: { left: 100, top: 120, right: 150, bottom: 140, width: 50, height: 20 },
      panelSize: { width: 360, height: 300 },
      matches: [{ word: "alpha", content: "first", aliases: [], fileOrder: 0, matchQuality: 0 }]
    });
    window.setBounds.mockClear();
    updateWordLookupPanelSize.mockClear();

    manager.handleResize({ width: 360, height: 300 });

    expect(window.setBounds).not.toHaveBeenCalled();
    expect(updateWordLookupPanelSize).not.toHaveBeenCalled();
  });
});
