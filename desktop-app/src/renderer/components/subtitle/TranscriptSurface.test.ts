import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import { afterEach, describe, expect, it, vi } from "vitest";
import TranscriptSurface from "./TranscriptSurface.vue";
import type { TranscriptBlock } from "./transcript/types";

const blocks: TranscriptBlock[] = [
  {
    id: "block-0",
    start: 0,
    end: 1000,
    primaryText: "hello world",
    secondaryText: "你好世界",
    sourceCueRefs: { primaryCueIndex: 0, secondaryCueIndex: 0 }
  },
  {
    id: "block-1",
    start: 1000,
    end: 2000,
    primaryText: "next line",
    secondaryText: null,
    sourceCueRefs: { primaryCueIndex: 1, secondaryCueIndex: null }
  }
];

const extraBlocks: TranscriptBlock[] = [
  {
    id: "block-2",
    start: 2000,
    end: 3000,
    primaryText: "third block with a longer sentence that wraps across multiple lines",
    secondaryText: null,
    sourceCueRefs: { primaryCueIndex: 2, secondaryCueIndex: null }
  },
  {
    id: "block-3",
    start: 3000,
    end: 4000,
    primaryText: "fourth block with another long sentence that should force scrolling on mount",
    secondaryText: null,
    sourceCueRefs: { primaryCueIndex: 3, secondaryCueIndex: null }
  }
];

function defaultProps(overrides: Record<string, unknown> = {}) {
  return {
    blocks,
    currentTime: 300,
    loopCueIndex: null,
    abLoopStartCueIndex: null,
    subtitlePanelStyle: {},
    fontFamily: "Arial",
    fontSize: 16,
    lineHeight: 1.5,
    primarySecondaryGap: 6,
    blockGap: 12,
    primaryColor: "#fff",
    secondaryColor: "#ccc",
    activePrimaryColor: "#ff0",
    activeSecondaryColor: "#ee0",
    autoScrollDelayMs: 500,
    scrollPositionRatio: 0.4,
    ...overrides
  };
}

function mockViewportSize(width: number, height: number) {
  const savedWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientWidth");
  const savedHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientHeight");
  Object.defineProperty(HTMLElement.prototype, "clientWidth", { configurable: true, get: () => width });
  Object.defineProperty(HTMLElement.prototype, "clientHeight", { configurable: true, get: () => height });
  return () => {
    if (savedWidth) Object.defineProperty(HTMLElement.prototype, "clientWidth", savedWidth);
    else delete (HTMLElement.prototype as any).clientWidth;
    if (savedHeight) Object.defineProperty(HTMLElement.prototype, "clientHeight", savedHeight);
    else delete (HTMLElement.prototype as any).clientHeight;
  };
}

describe("TranscriptSurface", () => {
  let restoreSize: (() => void) | null = null;

  afterEach(() => {
    restoreSize?.();
    restoreSize = null;
  });

  it("lays out wrapped lines against the transcript content width instead of the viewport width", async () => {
    const savedWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientWidth");
    const savedHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientHeight");
    Object.defineProperty(HTMLElement.prototype, "clientWidth", {
      configurable: true,
      get() {
        if (this.classList?.contains("transcript-surface__viewport")) return 900;
        if (this.classList?.contains("transcript-surface__content")) return 220;
        return 0;
      }
    });
    Object.defineProperty(HTMLElement.prototype, "clientHeight", { configurable: true, get: () => 240 });
    restoreSize = () => {
      if (savedWidth) Object.defineProperty(HTMLElement.prototype, "clientWidth", savedWidth);
      else delete (HTMLElement.prototype as any).clientWidth;
      if (savedHeight) Object.defineProperty(HTMLElement.prototype, "clientHeight", savedHeight);
      else delete (HTMLElement.prototype as any).clientHeight;
    };

    const wrapper = mount(TranscriptSurface, {
      attachTo: document.body,
      props: defaultProps({
        blocks: [
          {
            id: "block-0",
            start: 0,
            end: 1000,
            primaryText:
              "This transcript line is intentionally long enough to wrap when measured against the content column width.",
            secondaryText: null,
            sourceCueRefs: { primaryCueIndex: 0, secondaryCueIndex: null }
          }
        ],
        currentTime: 0
      })
    });

    await nextTick();
    await nextTick();

    expect(wrapper.findAll(".transcript-block__line--primary").length).toBeGreaterThan(1);

    wrapper.unmount();
  });

  it("includes fixed meta row offset in rendered line geometry", async () => {
    restoreSize = mockViewportSize(220, 240);

    const wrapper = mount(TranscriptSurface, {
      attachTo: document.body,
      props: defaultProps({
        blocks: [
          {
            id: "block-0",
            start: 0,
            end: 1000,
            primaryText: "hello world",
            secondaryText: null,
            sourceCueRefs: { primaryCueIndex: 0, secondaryCueIndex: null }
          }
        ],
        currentTime: 0
      })
    });

    await nextTick();
    await nextTick();

    expect(wrapper.get(".transcript-block__line").attributes("style")).toContain("top: 24px;");

    wrapper.unmount();
  });

  it("scrolls the active block into the reading zone on first mount", async () => {
    restoreSize = mockViewportSize(140, 200);

    const wrapper = mount(TranscriptSurface, {
      attachTo: document.body,
      props: defaultProps({
        blocks: [
          ...blocks,
          ...extraBlocks,
          {
            id: "block-4",
            start: 4000,
            end: 5000,
            primaryText: "fifth block extends the transcript so scroll-position changes are not clamped at the bottom",
            secondaryText: null,
            sourceCueRefs: { primaryCueIndex: 4, secondaryCueIndex: null }
          }
        ],
        currentTime: 2300
      })
    });

    const viewport = wrapper.get(".transcript-surface__viewport").element as HTMLElement;
    await nextTick();
    await nextTick();

    expect(viewport.scrollTop).toBeGreaterThan(0);
    wrapper.unmount();
  });

  it("updates the reading-zone position when scroll position changes on the same active block", async () => {
    restoreSize = mockViewportSize(140, 200);

    const wrapper = mount(TranscriptSurface, {
      attachTo: document.body,
      props: defaultProps({ blocks: [...blocks, ...extraBlocks], currentTime: 3300 })
    });

    const viewport = wrapper.get(".transcript-surface__viewport").element as HTMLElement;
    await nextTick();
    await nextTick();
    const originalTop = viewport.scrollTop;

    await wrapper.setProps({ scrollPositionRatio: 0.8 });
    await nextTick();
    await nextTick();

    expect(viewport.scrollTop).toBeLessThan(originalTop);

    wrapper.unmount();
  });

  it("keeps the same follow target while a looped cue plays through its end boundary", async () => {
    restoreSize = mockViewportSize(140, 200);

    const wrapper = mount(TranscriptSurface, {
      attachTo: document.body,
      props: defaultProps({
        blocks: [...blocks, ...extraBlocks],
        currentTime: 900,
        loopCueIndex: 0
      })
    });

    const viewport = wrapper.get(".transcript-surface__viewport").element as HTMLElement;
    await nextTick();
    await nextTick();
    const initialScrollTop = viewport.scrollTop;

    await wrapper.setProps({ currentTime: 10, loopCueIndex: 0 });
    await nextTick();
    await nextTick();

    expect(viewport.scrollTop).toBe(initialScrollTop);

    wrapper.unmount();
  });

  it("uses a dedicated fixed anchor for A-B loop follow while playback highlighting still advances", async () => {
    restoreSize = mockViewportSize(140, 200);

    const wrapper = mount(TranscriptSurface, {
      attachTo: document.body,
      props: defaultProps({
        blocks: [...blocks, ...extraBlocks],
        currentTime: 1200,
        loopCueIndex: 0,
        activeAbLoopRange: { startCueIndex: 0, endCueIndex: 3 }
      })
    });

    const viewport = wrapper.get(".transcript-surface__viewport").element as HTMLElement;
    await nextTick();
    await nextTick();
    const initialScrollTop = viewport.scrollTop;

    await wrapper.setProps({ currentTime: 3200 });
    await nextTick();
    await nextTick();

    expect(viewport.scrollTop).toBe(initialScrollTop);
    expect(wrapper.get(".transcript-block--active").attributes("data-transcript-block-id")).toBe("block-3");

    wrapper.unmount();
  });

  it("uses the smooth scroll path without a manual scrollTop jump on follow updates", async () => {
    restoreSize = mockViewportSize(140, 200);

    const wrapper = mount(TranscriptSurface, {
      attachTo: document.body,
      props: defaultProps({ blocks: [...blocks, ...extraBlocks], currentTime: 2300 })
    });

    await nextTick();
    await nextTick();

    const viewport = wrapper.get(".transcript-surface__viewport").element as HTMLElement;
    let directScrollAssignments = 0;
    let scrollTopValue = viewport.scrollTop;
    const scrollTo = vi.spyOn(viewport, "scrollTo").mockImplementation(() => {});

    Object.defineProperty(viewport, "scrollTop", {
      configurable: true,
      get: () => scrollTopValue,
      set: (value: number) => {
        directScrollAssignments += 1;
        scrollTopValue = value;
      }
    });

    await wrapper.setProps({ currentTime: 3300 });
    await nextTick();
    await nextTick();

    expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ behavior: "smooth" }));
    expect(directScrollAssignments).toBe(0);

    scrollTo.mockRestore();
    wrapper.unmount();
  });

  it("emits seek and loop actions from the anchor rail", async () => {
    const wrapper = mount(TranscriptSurface, {
      props: defaultProps()
    });

    await wrapper.get('[data-testid="cue-action-play"]').trigger("click");
    await wrapper.get('[data-testid="cue-action-loop"]').trigger("click");

    expect(wrapper.emitted("play-cue")).toEqual([[0]]);
    expect(wrapper.emitted("loop-cue")).toEqual([[0]]);
  });

  it("keeps only the active block's cue actions visible while selecting text", async () => {
    const wrapper = mount(TranscriptSurface, {
      attachTo: document.body,
      props: defaultProps({ autoScrollDelayMs: 10 })
    });

    expect(wrapper.findAll('[data-testid="transcript-cue-actions"]')).toHaveLength(2);

    const viewport = wrapper.get(".transcript-surface__viewport").element;
    const selection = {
      isCollapsed: false,
      anchorNode: viewport,
      focusNode: viewport
    };
    const getSelection = vi.spyOn(window, "getSelection").mockReturnValue(selection as unknown as Selection);

    document.dispatchEvent(new Event("selectionchange"));
    await nextTick();

    // Selection pauses auto-follow but does NOT reveal every block's cue actions —
    // per the spec, only active or hovered blocks reveal actions.
    const actionRows = wrapper.findAll('[data-testid="transcript-meta-row"]');
    expect(actionRows).toHaveLength(2);
    expect(actionRows[0]?.attributes("data-meta-state")).toBe("selection");
    expect(actionRows[1]?.attributes("data-meta-state")).toBe("quiet");

    // Hovering an inactive block during selection still reveals that block's actions.
    const inactiveBlock = wrapper.findAll(".transcript-block")[1]!;
    await inactiveBlock.trigger("mouseenter");
    await nextTick();

    const hoveredActionRows = wrapper.findAll('[data-testid="transcript-meta-row"]');
    expect(hoveredActionRows).toHaveLength(2);
    expect(hoveredActionRows[1]?.attributes("data-meta-state")).toBe("hover");

    getSelection.mockRestore();
    wrapper.unmount();
  });

  it("pauses auto-follow while text is selected and resumes after clear", async () => {
    const wrapper = mount(TranscriptSurface, {
      attachTo: document.body,
      props: defaultProps({ autoScrollDelayMs: 10 })
    });

    const viewport = wrapper.get(".transcript-surface__viewport").element;
    const selection = {
      isCollapsed: false,
      anchorNode: viewport,
      focusNode: viewport
    };
    const getSelection = vi.spyOn(window, "getSelection").mockReturnValue(selection as unknown as Selection);

    document.dispatchEvent(new Event("selectionchange"));
    await nextTick();
    expect(wrapper.get('[data-testid="transcript-surface"]').attributes("data-selection-paused")).toBe("true");

    getSelection.mockReturnValue({
      isCollapsed: true,
      anchorNode: null,
      focusNode: null
    } as unknown as Selection);
    document.dispatchEvent(new Event("selectionchange"));
    await nextTick();
    await new Promise((resolve) => window.setTimeout(resolve, 20));

    expect(wrapper.get('[data-testid="transcript-surface"]').attributes("data-selection-paused")).toBe("false");

    getSelection.mockRestore();
    wrapper.unmount();
  });

  it("reclaims the focus band for an explicit seek even when selection pause is active", async () => {
    const wrapper = mount(TranscriptSurface, {
      attachTo: document.body,
      props: defaultProps({
        autoScrollDelayMs: 10,
        seekRequest: { token: 1, time: 1300 }
      })
    });

    const viewport = wrapper.get(".transcript-surface__viewport").element;
    const getSelection = vi.spyOn(window, "getSelection").mockReturnValue({
      isCollapsed: false,
      anchorNode: viewport,
      focusNode: viewport
    } as unknown as Selection);

    document.dispatchEvent(new Event("selectionchange"));
    await nextTick();

    await wrapper.setProps({
      currentTime: 1300,
      seekRequest: { token: 2, time: 1300 }
    });
    await nextTick();

    expect(wrapper.get('[data-testid="transcript-surface"]').attributes("data-selection-paused")).toBe("false");

    getSelection.mockRestore();
    wrapper.unmount();
  });

  it("uses a single explicit-seek scroll instead of replaying a stale follow step first", async () => {
    restoreSize = mockViewportSize(180, 220);

    const wrapper = mount(TranscriptSurface, {
      attachTo: document.body,
      props: defaultProps({ autoScrollDelayMs: 10, seekRequest: null })
    });

    await nextTick();
    await nextTick();

    const viewport = wrapper.get(".transcript-surface__viewport").element as HTMLElement;
    const scrollTo = vi.spyOn(viewport, "scrollTo").mockImplementation(() => {});

    await wrapper.setProps({
      currentTime: 1300,
      seekRequest: { token: 1, time: 1300 }
    });
    await nextTick();
    await nextTick();

    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ behavior: "auto" }));

    scrollTo.mockRestore();
    wrapper.unmount();
  });

  it("pauses auto-follow while the user scrolls and resumes after the restore delay", async () => {
    vi.useFakeTimers();
    restoreSize = mockViewportSize(140, 200);

    const wrapper = mount(TranscriptSurface, {
      attachTo: document.body,
      props: defaultProps({
        blocks: [...blocks, ...extraBlocks],
        currentTime: 2300,
        autoScrollDelayMs: 50
      })
    });

    await nextTick();
    await nextTick();

    const viewport = wrapper.get(".transcript-surface__viewport").element as HTMLElement;
    const scrollTo = vi.spyOn(viewport, "scrollTo");
    scrollTo.mockClear();

    viewport.dispatchEvent(new WheelEvent("wheel", { deltaY: 120 }));
    await nextTick();

    await wrapper.setProps({ currentTime: 3300 });
    await nextTick();
    await nextTick();

    expect(scrollTo).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(60);
    await nextTick();
    await nextTick();

    expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ behavior: "smooth" }));

    scrollTo.mockRestore();
    wrapper.unmount();
    vi.useRealTimers();
  });

  it("pauses auto-follow while dragging the viewport scrollbar and resumes after mouseup", async () => {
    vi.useFakeTimers();
    restoreSize = mockViewportSize(140, 200);

    const wrapper = mount(TranscriptSurface, {
      attachTo: document.body,
      props: defaultProps({
        blocks: [...blocks, ...extraBlocks],
        currentTime: 2300,
        autoScrollDelayMs: 50
      })
    });

    await nextTick();
    await nextTick();

    const viewport = wrapper.get(".transcript-surface__viewport").element as HTMLElement;
    const scrollTo = vi.spyOn(viewport, "scrollTo");
    scrollTo.mockClear();

    viewport.dispatchEvent(new MouseEvent("mousedown", { button: 0, bubbles: true }));
    await nextTick();

    await wrapper.setProps({ currentTime: 3300 });
    await nextTick();
    await nextTick();

    expect(scrollTo).not.toHaveBeenCalled();

    window.dispatchEvent(new MouseEvent("mouseup", { button: 0 }));
    await nextTick();
    await vi.advanceTimersByTimeAsync(60);
    await nextTick();
    await nextTick();

    expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ behavior: "smooth" }));

    scrollTo.mockRestore();
    wrapper.unmount();
    vi.useRealTimers();
  });

  it("pauses auto-follow while dragging transcript text before selection exists", async () => {
    vi.useFakeTimers();
    restoreSize = mockViewportSize(140, 200);

    const wrapper = mount(TranscriptSurface, {
      attachTo: document.body,
      props: defaultProps({
        blocks: [
          ...blocks,
          {
            id: "block-2",
            start: 2000,
            end: 3000,
            primaryText: "third block with selectable transcript text",
            secondaryText: null,
            sourceCueRefs: { primaryCueIndex: 2, secondaryCueIndex: null }
          },
          {
            id: "block-3",
            start: 3000,
            end: 4000,
            primaryText: "fourth block with another selectable transcript line",
            secondaryText: null,
            sourceCueRefs: { primaryCueIndex: 3, secondaryCueIndex: null }
          }
        ],
        currentTime: 2300,
        autoScrollDelayMs: 50
      })
    });

    await nextTick();
    await nextTick();

    const viewport = wrapper.get(".transcript-surface__viewport").element as HTMLElement;
    const scrollTo = vi.spyOn(viewport, "scrollTo");
    scrollTo.mockClear();

    await wrapper.get(".transcript-block__line").trigger("mousedown", { button: 0 });
    await nextTick();

    await wrapper.setProps({ currentTime: 3300 });
    await nextTick();
    await nextTick();

    expect(scrollTo).not.toHaveBeenCalled();

    window.dispatchEvent(new MouseEvent("mouseup", { button: 0 }));
    await nextTick();
    await vi.advanceTimersByTimeAsync(60);
    await nextTick();
    await nextTick();

    expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ behavior: "smooth" }));

    scrollTo.mockRestore();
    wrapper.unmount();
    vi.useRealTimers();
  });

  it("renders the full transcript instead of trimming to the active playback window", async () => {
    restoreSize = mockViewportSize(320, 100);

    const wrapper = mount(TranscriptSurface, {
      attachTo: document.body,
      props: defaultProps({
        blocks: [
          ...blocks,
          {
            id: "block-2",
            start: 2000,
            end: 3000,
            primaryText: "third block hidden",
            secondaryText: null,
            sourceCueRefs: { primaryCueIndex: 2, secondaryCueIndex: null }
          },
          {
            id: "block-3",
            start: 3000,
            end: 4000,
            primaryText: "fourth block hidden",
            secondaryText: null,
            sourceCueRefs: { primaryCueIndex: 3, secondaryCueIndex: null }
          }
        ]
      })
    });
    await nextTick();
    await nextTick();

    expect(wrapper.text()).toContain("hello world");
    expect(wrapper.text()).toContain("next line");
    expect(wrapper.text()).toContain("third block hidden");
    expect(wrapper.text()).toContain("fourth block hidden");
    wrapper.unmount();
  });

  it("renders only the projected block window instead of every block", async () => {
    restoreSize = mockViewportSize(220, 100);

    const manyBlocks = Array.from({ length: 40 }, (_, index) => ({
      id: `block-${index}`,
      start: index * 1000,
      end: (index + 1) * 1000,
      primaryText: `block ${index} text that wraps enough to produce height`,
      secondaryText: null,
      sourceCueRefs: { primaryCueIndex: index, secondaryCueIndex: null }
    }));

    const wrapper = mount(TranscriptSurface, {
      attachTo: document.body,
      props: defaultProps({
        blocks: manyBlocks,
        currentTime: 0,
        autoScrollDelayMs: 10,
        seekRequest: null
      })
    });

    await nextTick();
    await nextTick();

    expect(wrapper.findAll(".transcript-block").length).toBeLessThan(manyBlocks.length);

    wrapper.unmount();
  });

  it("reprojects the latest anchor on resize instead of preserving stale scrollTop", async () => {
    restoreSize = mockViewportSize(180, 220);

    const wrapper = mount(TranscriptSurface, {
      attachTo: document.body,
      props: defaultProps({
        currentTime: 1300,
        autoScrollDelayMs: 10,
        seekRequest: null
      })
    });

    await nextTick();
    await nextTick();

    const viewport = wrapper.get(".transcript-surface__viewport").element as HTMLElement;
    const scrollTo = vi.spyOn(viewport, "scrollTo").mockImplementation(() => {});

    window.dispatchEvent(new Event("resize"));
    await nextTick();
    await nextTick();

    expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ behavior: "auto" }));

    scrollTo.mockRestore();
    wrapper.unmount();
  });

  it("does not render a permanent focus-band overlay", () => {
    const wrapper = mount(TranscriptSurface, {
      props: defaultProps()
    });

    expect(wrapper.find(".transcript-surface__focus-band").exists()).toBe(false);
  });

  it("positions blocks and lines from pretext geometry instead of stacked DOM flow", async () => {
    restoreSize = mockViewportSize(180, 220);

    const wrapper = mount(TranscriptSurface, {
      attachTo: document.body,
      props: defaultProps()
    });

    await nextTick();
    await nextTick();

    const content = wrapper.get(".transcript-surface__content");
    const blocksRendered = wrapper.findAll(".transcript-block");
    const lines = wrapper.findAll(".transcript-block__line");

    expect(content.attributes("style")).toContain("height:");
    expect(blocksRendered[0]?.attributes("style")).toContain("top:");
    expect(blocksRendered[0]?.attributes("style")).toContain("height:");
    expect(lines[0]?.attributes("style")).toContain("top:");
    expect(lines[0]?.attributes("style")).toContain("height:");

    wrapper.unmount();
  });

  it("renders transcript typography and colors from surface props", async () => {
    restoreSize = mockViewportSize(220, 220);

    const wrapper = mount(TranscriptSurface, {
      attachTo: document.body,
      props: defaultProps({
        blocks: [blocks[0]!],
        fontFamily: "Georgia, serif",
        fontSize: 20,
        lineHeight: 1.6,
        primarySecondaryGap: 4,
        activePrimaryColor: "#778899",
        activeSecondaryColor: "#aabbcc"
      })
    });

    await nextTick();
    await nextTick();

    const lines = wrapper.findAll(".transcript-block__line");
    const primaryLine = lines[0]!.element as HTMLElement;
    const secondaryLine = lines[1]!.element as HTMLElement;
    const initialSecondaryTop = Number.parseFloat(secondaryLine.style.top);
    const initialPrimaryLineHeight = primaryLine.style.lineHeight;

    expect(primaryLine.style.fontFamily).toContain("Georgia");
    expect(primaryLine.style.fontSize).toBe("20px");
    expect(primaryLine.style.color).toBe("rgb(119, 136, 153)");
    expect(secondaryLine.style.color).toBe("rgb(170, 187, 204)");

    await wrapper.setProps({
      fontFamily: '"Courier New", monospace',
      fontSize: 24,
      lineHeight: 2,
      primarySecondaryGap: 18,
      activePrimaryColor: "#ff0000",
      activeSecondaryColor: "#00ff00"
    });
    await nextTick();
    await nextTick();

    const updatedLines = wrapper.findAll(".transcript-block__line");
    const updatedPrimaryLine = updatedLines[0]!.element as HTMLElement;
    const updatedSecondaryLine = updatedLines[1]!.element as HTMLElement;

    expect(updatedPrimaryLine.style.fontFamily).toContain("Courier New");
    expect(updatedPrimaryLine.style.fontSize).toBe("24px");
    expect(updatedPrimaryLine.style.lineHeight).not.toBe(initialPrimaryLineHeight);
    expect(updatedPrimaryLine.style.color).toBe("rgb(255, 0, 0)");
    expect(updatedSecondaryLine.style.color).toBe("rgb(0, 255, 0)");
    expect(Number.parseFloat(updatedSecondaryLine.style.top)).toBeGreaterThan(initialSecondaryTop);

    wrapper.unmount();
  });
});
