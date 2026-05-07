import { mount, VueWrapper } from "@vue/test-utils";
import { nextTick } from "vue";
import { afterEach, describe, expect, it, vi } from "vitest";
import WordLookupWindow from "./WordLookupWindow.vue";

describe("WordLookupWindow", () => {
  const originalUsp = window.usp;
  const originalInnerWidth = window.innerWidth;
  const originalInnerHeight = window.innerHeight;

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = "";
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: originalInnerWidth
    });
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      value: originalInnerHeight
    });
    Object.defineProperty(window, "usp", {
      configurable: true,
      value: originalUsp
    });
  });

  function setupWindowApi(overrides: Partial<typeof originalUsp> = {}) {
    const pointerEnter = vi.fn();
    const pointerLeave = vi.fn();
    const resizeWordLookupWindow = vi.fn();
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
        notifyWordLookupWindowPointerEnter: pointerEnter,
        notifyWordLookupWindowPointerLeave: pointerLeave,
        resizeWordLookupWindow,
        openExternal,
        ...overrides
      }
    });

    return { pointerEnter, pointerLeave, resizeWordLookupWindow, openExternal, payloadListener: () => payloadListener };
  }

  function emitPayload(wrapper: VueWrapper, listener: ((payload: any) => void) | null) {
    listener?.({
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
    return nextTick();
  }

  function defineElementNumber(element: HTMLElement, property: string, value: number) {
    Object.defineProperty(element, property, {
      configurable: true,
      value
    });
  }

  function createPointerEvent(type: string, init: Partial<PointerEvent>) {
    const event = new Event(type, { bubbles: true, cancelable: true }) as PointerEvent;
    for (const [key, value] of Object.entries(init)) {
      Object.defineProperty(event, key, {
        configurable: true,
        value
      });
    }
    return event;
  }

  it("keeps the panel on pointer enter and closes it on pointer leave without Escape handling", async () => {
    const api = setupWindowApi();

    const wrapper = mount(WordLookupWindow, { attachTo: document.body });
    await emitPayload(wrapper, api.payloadListener());

    const panel = wrapper.get('[data-testid="word-lookup-floating-panel"]');
    await panel.trigger("pointerenter");
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await panel.trigger("pointerleave");

    expect(panel.text()).toContain("alpha");
    expect(api.pointerEnter).toHaveBeenCalledTimes(1);
    expect(api.pointerLeave).toHaveBeenCalledTimes(1);
    wrapper.unmount();
  });

  it("opens links externally without navigating the floating window", async () => {
    const api = setupWindowApi();

    const wrapper = mount(WordLookupWindow, { attachTo: document.body });
    await emitPayload(wrapper, api.payloadListener());

    await wrapper.get("a").trigger("click");

    expect(api.openExternal).toHaveBeenCalledWith("https://example.com");
    wrapper.unmount();
  });

  it("uses an auto-hiding custom scrollbar instead of a native visible scrollbar", async () => {
    vi.useFakeTimers();
    const api = setupWindowApi();
    const wrapper = mount(WordLookupWindow, { attachTo: document.body });
    await emitPayload(wrapper, api.payloadListener());
    const scrollArea = wrapper.get('[data-testid="word-lookup-scroll-area"]').element as HTMLElement;
    defineElementNumber(scrollArea, "clientHeight", 100);
    defineElementNumber(scrollArea, "scrollHeight", 400);
    defineElementNumber(scrollArea, "scrollTop", 0);

    await wrapper.get('[data-testid="word-lookup-scroll-area"]').trigger("scroll");
    await nextTick();

    const scrollbar = wrapper.get('[data-testid="word-lookup-scrollbar"]');
    expect(scrollbar.classes()).toContain("word-lookup-scrollbar--visible");
    expect(wrapper.get('[data-testid="word-lookup-scrollbar-thumb"]').attributes("style")).toContain("height:");

    vi.advanceTimersByTime(900);
    await nextTick();

    expect(scrollbar.classes()).not.toContain("word-lookup-scrollbar--visible");
    wrapper.unmount();
  });

  it("drags the custom scrollbar thumb to update the hidden native scroll position", async () => {
    const api = setupWindowApi();
    const wrapper = mount(WordLookupWindow, { attachTo: document.body });
    await emitPayload(wrapper, api.payloadListener());
    const scrollArea = wrapper.get('[data-testid="word-lookup-scroll-area"]').element as HTMLElement;
    defineElementNumber(scrollArea, "clientHeight", 100);
    defineElementNumber(scrollArea, "scrollHeight", 400);
    scrollArea.scrollTop = 0;

    await wrapper.get('[data-testid="word-lookup-scroll-area"]').trigger("scroll");
    await nextTick();
    wrapper.get('[data-testid="word-lookup-scrollbar-thumb"]').element.dispatchEvent(
      createPointerEvent("pointerdown", { pointerId: 7, clientY: 10 })
    );
    window.dispatchEvent(createPointerEvent("pointermove", { pointerId: 7, clientY: 50 }));

    expect(scrollArea.scrollTop).toBeGreaterThan(0);
    window.dispatchEvent(createPointerEvent("pointerup", { pointerId: 7 }));
    wrapper.unmount();
  });

  it("resizes from the lower-right handle without closing while the pointer leaves during drag", async () => {
    const api = setupWindowApi();
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 360
    });
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      value: 300
    });

    const wrapper = mount(WordLookupWindow, { attachTo: document.body });
    await emitPayload(wrapper, api.payloadListener());

    wrapper.get('[data-testid="word-lookup-resize-handle"]').element.dispatchEvent(
      createPointerEvent("pointerdown", { pointerId: 3, screenX: 360, screenY: 300 })
    );
    window.dispatchEvent(createPointerEvent("pointermove", { pointerId: 3, screenX: 410, screenY: 340 }));
    await wrapper.get('[data-testid="word-lookup-floating-panel"]').trigger("pointerleave");

    expect(api.resizeWordLookupWindow).toHaveBeenCalledWith({ width: 410, height: 340 });
    expect(api.pointerLeave).not.toHaveBeenCalled();
    window.dispatchEvent(createPointerEvent("pointerup", { pointerId: 3 }));
    wrapper.unmount();
  });
});
