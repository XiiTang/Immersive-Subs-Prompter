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
      resizable: true
    });
  });
});
