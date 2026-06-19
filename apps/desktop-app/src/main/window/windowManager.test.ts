import { afterEach, describe, expect, it, vi } from "vitest";

describe("WindowManager", () => {
  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it("opens the main subtitle window at the shared default preview size", async () => {
    const createdOptions: Array<Record<string, unknown>> = [];

    class BrowserWindowMock {
      readonly webContents = {
        once: vi.fn(),
        openDevTools: vi.fn()
      };
      readonly loadFile = vi.fn();
      readonly on = vi.fn();
      readonly setAlwaysOnTop = vi.fn();

      constructor(options: Record<string, unknown>) {
        createdOptions.push(options);
      }
    }

    vi.doMock("electron", () => ({
      app: {
        isActive: () => true
      },
      BrowserWindow: BrowserWindowMock
    }));

    const { MAIN_WINDOW_DEFAULT_HEIGHT, MAIN_WINDOW_DEFAULT_WIDTH } = await import(
      "../../common/windowDimensions.js"
    );
    const { WindowManager } = await import("./windowManager.js");
    const manager = new WindowManager({
      getSettings: () => ({ global: { alwaysOnTop: "off" } }) as never,
      getWindowIconPath: () => "/tmp/icon.png"
    });

    manager.createWindow();

    expect(createdOptions).toHaveLength(1);
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
  });

  it("focuses a visible macOS window instead of hiding it when the app is not active", async () => {
    const originalPlatform = process.platform;
    Object.defineProperty(process, "platform", { value: "darwin" });

    const hide = vi.fn();
    const show = vi.fn();
    const focus = vi.fn();

    class BrowserWindowMock {
      readonly webContents = {
        once: vi.fn(),
        openDevTools: vi.fn()
      };
      readonly loadFile = vi.fn();
      readonly on = vi.fn();
      readonly setAlwaysOnTop = vi.fn();
      readonly isVisible = vi.fn(() => true);
      readonly isMinimized = vi.fn(() => false);
      readonly restore = vi.fn();
      readonly hide = hide;
      readonly show = show;
      readonly focus = focus;
    }

    vi.doMock("electron", () => ({
      app: {
        isActive: () => false
      },
      BrowserWindow: BrowserWindowMock
    }));

    try {
      const { WindowManager } = await import("./windowManager.js");
      const manager = new WindowManager({
        getSettings: () => ({ global: { alwaysOnTop: "off" } }) as never,
        getWindowIconPath: () => "/tmp/icon.png"
      });

      manager.createWindow();
      manager.toggleWindow();

      expect(hide).not.toHaveBeenCalled();
      expect(show).toHaveBeenCalledTimes(1);
      expect(focus).toHaveBeenCalledTimes(1);
    } finally {
      Object.defineProperty(process, "platform", { value: originalPlatform });
    }
  });
});
