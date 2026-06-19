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
