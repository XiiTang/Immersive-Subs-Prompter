import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import { afterEach, describe, expect, it, vi } from "vitest";
import WordLookupWindow from "./WordLookupWindow.vue";

describe("WordLookupWindow", () => {
  const originalUsp = window.usp;
  const originalInnerWidth = window.innerWidth;
  const originalInnerHeight = window.innerHeight;

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
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
        ...overrides
      }
    });

    return { pointerEnter, pointerLeave, resizeWordLookupWindow, payloadListener: () => payloadListener };
  }

  function emitPayload(listener: ((payload: any) => void) | null) {
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

  async function mountWithPayload(api = setupWindowApi()) {
    const wrapper = mount(WordLookupWindow, { attachTo: document.body });
    await emitPayload(api.payloadListener());
    return { wrapper, api };
  }

  function setWindowSize(width: number, height: number) {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: width
    });
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      value: height
    });
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

  function installManualAnimationFrame() {
    const callbacks: FrameRequestCallback[] = [];
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback: FrameRequestCallback) => {
      callbacks.push(callback);
      return callbacks.length;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation((id: number) => {
      callbacks[id - 1] = () => undefined;
    });
    return {
      runNext() {
        callbacks.shift()?.(performance.now());
      },
      runAll() {
        while (callbacks.length) {
          callbacks.shift()?.(performance.now());
        }
      }
    };
  }

  it("keeps the panel on pointer enter and closes it on pointer leave without Escape handling", async () => {
    const { wrapper, api } = await mountWithPayload();

    const panel = wrapper.get('[data-testid="word-lookup-floating-panel"]');
    expect(wrapper.find('[data-slot="surface"]').exists()).toBe(true);
    expect(wrapper.get('[data-testid="word-lookup-resize-handle"]').element.tagName).toBe("BUTTON");
    expect(wrapper.get('[data-testid="word-lookup-resize-handle"]').attributes("aria-label")).toBe("调整单词面板尺寸");

    await panel.trigger("pointerenter");
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await panel.trigger("pointerleave");

    expect(panel.text()).toContain("alpha");
    expect(api.pointerEnter).toHaveBeenCalledTimes(1);
    expect(api.pointerLeave).toHaveBeenCalledTimes(1);
    wrapper.unmount();
  });

  it("keeps word lookup links inert instead of opening them externally", async () => {
    const { wrapper, api } = await mountWithPayload();

    const click = new MouseEvent("click", { bubbles: true, cancelable: true });
    wrapper.get("a").element.dispatchEvent(click);

    expect(click.defaultPrevented).toBe(true);
    expect(api.pointerLeave).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it("does not report a size update on mount or passive window resize", async () => {
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback: FrameRequestCallback) => {
      callback(performance.now());
      return 1;
    });
    const { wrapper, api } = await mountWithPayload();
    window.dispatchEvent(new Event("resize"));
    await nextTick();

    expect(api.resizeWordLookupWindow).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it("uses an auto-hiding custom scrollbar instead of a native visible scrollbar", async () => {
    vi.useFakeTimers();
    const { wrapper } = await mountWithPayload();
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
    const { wrapper } = await mountWithPayload();
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
    const animationFrame = installManualAnimationFrame();
    setWindowSize(360, 300);
    const { wrapper, api } = await mountWithPayload();

    wrapper.get('[data-testid="word-lookup-resize-handle"]').element.dispatchEvent(
      createPointerEvent("pointerdown", { pointerId: 3, screenX: 360, screenY: 300 })
    );
    window.dispatchEvent(createPointerEvent("pointermove", { pointerId: 3, screenX: 410, screenY: 340 }));
    animationFrame.runNext();
    await wrapper.get('[data-testid="word-lookup-floating-panel"]').trigger("pointerleave");

    expect(api.resizeWordLookupWindow).toHaveBeenCalledWith({ width: 410, height: 340 });
    expect(api.pointerLeave).not.toHaveBeenCalled();
    window.dispatchEvent(createPointerEvent("pointerup", { pointerId: 3 }));
    wrapper.unmount();
  });

  it("coalesces resize drag updates to one IPC call per animation frame", async () => {
    const animationFrame = installManualAnimationFrame();
    setWindowSize(360, 300);
    const { wrapper, api } = await mountWithPayload();

    wrapper.get('[data-testid="word-lookup-resize-handle"]').element.dispatchEvent(
      createPointerEvent("pointerdown", { pointerId: 5, screenX: 360, screenY: 300 })
    );
    window.dispatchEvent(createPointerEvent("pointermove", { pointerId: 5, screenX: 390, screenY: 330 }));
    window.dispatchEvent(createPointerEvent("pointermove", { pointerId: 5, screenX: 420, screenY: 360 }));

    expect(api.resizeWordLookupWindow).not.toHaveBeenCalled();
    animationFrame.runNext();

    expect(api.resizeWordLookupWindow).toHaveBeenCalledTimes(1);
    expect(api.resizeWordLookupWindow).toHaveBeenCalledWith({ width: 420, height: 360 });
    window.dispatchEvent(createPointerEvent("pointerup", { pointerId: 5 }));
    animationFrame.runAll();
    wrapper.unmount();
  });

  it("uses primitive-compatible chrome for resize and scroll affordances", () => {
    setupWindowApi();
    const wrapper = mount(WordLookupWindow, { attachTo: document.body });

    expect(wrapper.get('[data-testid="word-lookup-resize-handle"]').classes()).toContain("ui-resize-handle");
    expect(wrapper.get('[data-testid="word-lookup-scrollbar"]').classes()).toContain("ui-scrollbar");
    wrapper.unmount();
  });
});
