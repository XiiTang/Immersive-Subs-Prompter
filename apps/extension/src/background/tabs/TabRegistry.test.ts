import { describe, expect, it, vi } from "vitest";
import { TabRegistry } from "./TabRegistry";

describe("TabRegistry", () => {
  it("does not route desktop controls to an arbitrary subframe when no preferred frame is set", () => {
    const registry = new TabRegistry({});
    const subframePort = { postMessage: vi.fn() } as unknown as chrome.runtime.Port;

    registry.registerPort(7, 12, subframePort);

    expect(registry.getPort(7, null)).toBeNull();
  });

  it("falls back to the top frame port when no preferred frame is set", () => {
    const registry = new TabRegistry({});
    const topFramePort = { postMessage: vi.fn() } as unknown as chrome.runtime.Port;

    registry.registerPort(7, 0, topFramePort);

    expect(registry.getPort(7, null)).toBe(topFramePort);
  });
});
