import { beforeEach, describe, expect, it, vi } from "vitest";
import { ShortcutManager } from "./shortcutManager.js";

const electronMock = vi.hoisted(() => ({
  suspended: false,
  globalShortcut: {
    register: vi.fn(() => true),
    unregisterAll: vi.fn(),
    setSuspended: vi.fn((suspended: boolean) => {
      electronMock.suspended = suspended;
    }),
    isSuspended: vi.fn(() => electronMock.suspended)
  }
}));

vi.mock("electron", () => ({
  globalShortcut: electronMock.globalShortcut
}));

describe("ShortcutManager", () => {
  beforeEach(() => {
    electronMock.suspended = false;
    vi.clearAllMocks();
    electronMock.globalShortcut.register.mockReturnValue(true);
  });

  it("suspends registered shortcuts for a blacklisted foreground game without unregistering them", () => {
    const manager = new ShortcutManager();

    manager.applyShortcut("CommandOrControl+Shift+S", vi.fn());
    vi.clearAllMocks();

    manager.blockForGame();

    expect(electronMock.globalShortcut.setSuspended).toHaveBeenCalledWith(true);
    expect(electronMock.globalShortcut.unregisterAll).not.toHaveBeenCalled();

    manager.unblockAfterGame();

    expect(electronMock.globalShortcut.setSuspended).toHaveBeenCalledWith(false);
    expect(electronMock.globalShortcut.register).not.toHaveBeenCalled();
  });

  it("defers shortcut rebinding until game blacklist suspension is lifted", () => {
    const manager = new ShortcutManager();

    manager.applyShortcut("CommandOrControl+Shift+S", vi.fn());
    manager.blockForGame();
    vi.clearAllMocks();

    manager.applyShortcut("CommandOrControl+Alt+S", vi.fn());

    expect(electronMock.globalShortcut.register).not.toHaveBeenCalled();

    manager.unblockAfterGame();

    expect(electronMock.globalShortcut.setSuspended).toHaveBeenCalledWith(false);
    expect(electronMock.globalShortcut.unregisterAll).toHaveBeenCalledTimes(1);
    expect(electronMock.globalShortcut.register).toHaveBeenCalledWith(
      "CommandOrControl+Alt+S",
      expect.any(Function)
    );
  });
});
