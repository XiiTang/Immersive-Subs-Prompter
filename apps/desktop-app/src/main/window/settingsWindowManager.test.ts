import { afterEach, describe, expect, it, vi } from "vitest";

describe("SettingsWindowManager", () => {
  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it("opens the fixed settings window without redundant min/max size constraints", async () => {
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

    const { SettingsWindowManager } = await import("./settingsWindowManager.js");
    const manager = new SettingsWindowManager({
      getWindowIconPath: () => "/tmp/icon.png"
    });

    manager.openSettingsWindow();

    expect(createdOptions).toHaveLength(1);
    expect(createdOptions[0]).toMatchObject({
      width: 880,
      height: 760,
      resizable: false
    });
    expect(createdOptions[0]).not.toHaveProperty("minWidth");
    expect(createdOptions[0]).not.toHaveProperty("minHeight");
    expect(createdOptions[0]).not.toHaveProperty("maxWidth");
    expect(createdOptions[0]).not.toHaveProperty("maxHeight");
  });
});
