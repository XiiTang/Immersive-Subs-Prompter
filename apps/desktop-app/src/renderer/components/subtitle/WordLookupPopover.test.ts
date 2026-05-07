import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import { describe, expect, it } from "vitest";
import WordLookupPopover from "./WordLookupPopover.vue";

const matches = [
  {
    word: "alpha",
    content: "A long definition\n\nwith details.",
    aliases: [],
    fileOrder: 0,
    matchQuality: 0
  }
];

describe("WordLookupPopover", () => {
  it("positions itself at the word anchor's lower-right instead of the mouse pointer", () => {
    const wrapper = mount(WordLookupPopover, {
      props: {
        x: 500,
        y: 500,
        anchorRect: {
          left: 40,
          top: 80,
          right: 92,
          bottom: 104,
          width: 52,
          height: 24
        },
        width: 260,
        height: 180,
        matches
      } as any
    });

    expect(wrapper.get(".word-lookup-popover").attributes("style")).toContain("left: 100px;");
    expect(wrapper.get(".word-lookup-popover").attributes("style")).toContain("top: 112px;");
  });

  it("renders custom scroll and resize controls instead of a native scrolling content area", () => {
    const wrapper = mount(WordLookupPopover, {
      props: {
        x: 120,
        y: 140,
        anchorRect: {
          left: 120,
          top: 140,
          right: 168,
          bottom: 164,
          width: 48,
          height: 24
        },
        width: 360,
        height: 300,
        matches
      } as any
    });

    expect(wrapper.find(".word-lookup-popover__content-clip").exists()).toBe(true);
    expect(wrapper.find(".word-lookup-scrollbar").exists()).toBe(true);
    expect(wrapper.find(".word-lookup-resize-handle").exists()).toBe(true);

    const stylesheet = readFileSync(resolve(process.cwd(), "src/renderer/style.css"), "utf8");
    expect(stylesheet).not.toContain("resize: both;");
    const contentRule = /\.word-lookup-popover__content\s*\{([\s\S]*?)\}/m.exec(stylesheet)?.[1] ?? "";
    expect(contentRule).not.toContain("overflow: auto;");
    expect(stylesheet).toContain(".word-lookup-popover__content-clip");
    expect(stylesheet).toContain("overflow: hidden;");
    expect(stylesheet).not.toContain("linear-gradient(135deg");
    expect(stylesheet).not.toContain(".word-lookup-popover:hover .word-lookup-resize-handle");
  });

  it("keeps the panel origin fixed while resizing and saves only the final size", async () => {
    const wrapper = mount(WordLookupPopover, {
      props: {
        x: 120,
        y: 140,
        anchorRect: {
          left: 120,
          top: 140,
          right: 168,
          bottom: 164,
          width: 48,
          height: 24
        },
        width: 360,
        height: 300,
        matches
      } as any,
      attachTo: document.body
    });
    const popover = wrapper.get(".word-lookup-popover").element as HTMLElement;
    popover.getBoundingClientRect = () => ({
      left: 176,
      top: 70,
      right: 536,
      bottom: 370,
      width: 360,
      height: 300,
      x: 176,
      y: 70,
      toJSON: () => ({})
    } as DOMRect);

    wrapper.get(".word-lookup-resize-handle").element.dispatchEvent(
      new MouseEvent("pointerdown", { clientX: 536, clientY: 370, bubbles: true })
    );
    window.dispatchEvent(new MouseEvent("pointermove", { clientX: 596, clientY: 410 }));
    await nextTick();

    const styleDuringResize = wrapper.get(".word-lookup-popover").attributes("style");
    expect(styleDuringResize).toContain("left: 176px;");
    expect(styleDuringResize).toContain("top: 70px;");
    expect(styleDuringResize).toContain("width: 420px;");
    expect(styleDuringResize).toContain("height: 340px;");
    expect(wrapper.emitted("resize")).toBeUndefined();

    window.dispatchEvent(new MouseEvent("pointerup", { clientX: 596, clientY: 410 }));
    expect(wrapper.emitted("resize")?.at(-1)?.[0]).toEqual({ width: 420, height: 340 });

    wrapper.unmount();
  });
});
