import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import { afterEach, describe, expect, it, vi } from "vitest";
import WordLookupWindow from "./WordLookupWindow.vue";

describe("WordLookupWindow", () => {
  const originalUsp = window.usp;

  afterEach(() => {
    Object.defineProperty(window, "usp", {
      configurable: true,
      value: originalUsp
    });
  });

  it("keeps the panel on pointer enter and closes it on pointer leave without Escape handling", async () => {
    const pointerEnter = vi.fn();
    const pointerLeave = vi.fn();
    let payloadListener: ((payload: any) => void) | null = null;

    Object.defineProperty(window, "usp", {
      configurable: true,
      value: {
        ...originalUsp,
        onWordLookupWindowPayload: vi.fn((listener: (payload: any) => void) => {
          payloadListener = listener;
          return vi.fn();
        }),
        notifyWordLookupWindowPointerEnter: pointerEnter,
        notifyWordLookupWindowPointerLeave: pointerLeave,
        resizeWordLookupWindow: vi.fn(),
        openExternal: vi.fn()
      }
    });

    const wrapper = mount(WordLookupWindow, { attachTo: document.body });
    payloadListener?.({
      matches: [
        {
          word: "alpha",
          content: "[open](https://example.com)",
          aliases: [],
          fileOrder: 0,
          matchQuality: 0
        }
      ]
    });
    await nextTick();

    const panel = wrapper.get('[data-testid="word-lookup-floating-panel"]');
    await panel.trigger("pointerenter");
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await panel.trigger("pointerleave");

    expect(panel.text()).toContain("alpha");
    expect(pointerEnter).toHaveBeenCalledTimes(1);
    expect(pointerLeave).toHaveBeenCalledTimes(1);
    wrapper.unmount();
  });

  it("opens links externally without navigating the floating window", async () => {
    const openExternal = vi.fn();
    let payloadListener: ((payload: any) => void) | null = null;

    Object.defineProperty(window, "usp", {
      configurable: true,
      value: {
        ...originalUsp,
        onWordLookupWindowPayload: vi.fn((listener: (payload: any) => void) => {
          payloadListener = listener;
          return vi.fn();
        }),
        notifyWordLookupWindowPointerEnter: vi.fn(),
        notifyWordLookupWindowPointerLeave: vi.fn(),
        resizeWordLookupWindow: vi.fn(),
        openExternal
      }
    });

    const wrapper = mount(WordLookupWindow, { attachTo: document.body });
    payloadListener?.({
      matches: [
        {
          word: "alpha",
          content: "[open](https://example.com)",
          aliases: [],
          fileOrder: 0,
          matchQuality: 0
        }
      ]
    });
    await nextTick();

    await wrapper.get("a").trigger("click");

    expect(openExternal).toHaveBeenCalledWith("https://example.com");
    wrapper.unmount();
  });
});
