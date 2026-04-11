import { defineComponent, h, nextTick, ref } from "vue";
import { mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useTranscriptSelection } from "./useTranscriptSelection";

function mountHarness(autoScrollDelayMs = 200) {
  const onResume = vi.fn();
  const rootRef = ref<HTMLElement | null>(null);
  let api: ReturnType<typeof useTranscriptSelection> | null = null;

  const Harness = defineComponent({
    setup() {
      api = useTranscriptSelection({
        rootEl: rootRef,
        autoScrollDelayMs: ref(autoScrollDelayMs),
        onResume
      });

      return () =>
        h("div", { ref: rootRef }, [
          h("p", { class: "text" }, "hello world"),
          h("button", { type: "button" }, "play")
        ]);
    }
  });

  const wrapper = mount(Harness, { attachTo: document.body });
  return { wrapper, rootRef, api: api!, onResume };
}

describe("useTranscriptSelection", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.useRealTimers();
  });

  it("does not pause auto-follow on a plain pointer click inside the transcript", async () => {
    const { wrapper, api } = mountHarness();

    await wrapper.trigger("mousedown", { button: 0 });
    window.dispatchEvent(new MouseEvent("mouseup", { button: 0 }));
    await nextTick();

    expect(api.isAutoFollowPaused.value).toBe(false);
    expect(api.isSelectionPaused.value).toBe(false);
  });

  it("pauses auto-follow on wheel scrolling and resumes after the timeout", async () => {
    vi.useFakeTimers();
    const { wrapper, api, onResume } = mountHarness(150);

    await wrapper.trigger("wheel");
    expect(api.isAutoFollowPaused.value).toBe(true);

    vi.advanceTimersByTime(150);
    await nextTick();

    expect(api.isAutoFollowPaused.value).toBe(false);
    expect(onResume).toHaveBeenCalledTimes(1);
  });

  it("pauses auto-follow when text selection exists inside the transcript", async () => {
    const { wrapper, api } = mountHarness();
    const textNode = wrapper.get(".text").element.firstChild as Text;
    const range = document.createRange();
    range.setStart(textNode, 0);
    range.setEnd(textNode, 5);

    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    document.dispatchEvent(new Event("selectionchange"));
    await nextTick();

    expect(api.isAutoFollowPaused.value).toBe(true);
    expect(api.isSelectionPaused.value).toBe(true);
  });
});
