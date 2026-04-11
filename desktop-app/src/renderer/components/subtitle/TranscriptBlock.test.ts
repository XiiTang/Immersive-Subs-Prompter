import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import TranscriptBlock from "./TranscriptBlock.vue";

function lineStyle(top: number, height: number, extra?: Record<string, string>): Record<string, string> {
  return {
    top: `${top}px`,
    height: `${height}px`,
    lineHeight: `${height}px`,
    fontFamily: "Arial",
    fontSize: "16px",
    color: "#fff",
    ...extra
  };
}

describe("TranscriptBlock", () => {
  const defaultProps = {
    blockId: "block-0",
    start: 0,
    end: 1000,
    lines: [
      { key: "line-0", kind: "primary" as const, text: "hello world", style: lineStyle(24, 24) },
      { key: "line-1", kind: "secondary" as const, text: "你好世界", style: lineStyle(54, 18, { color: "#ccc" }) }
    ],
    isActive: false,
    isLooping: false,
    isAbLoopStart: false,
    abLoopPending: false,
    showSelectionActions: false,
    autoHideMetaRow: false
  };

  it("keeps cue controls and transcript text inside the same left-aligned body", () => {
    const wrapper = mount(TranscriptBlock, {
      props: { ...defaultProps, isActive: true }
    });

    const body = wrapper.get('[data-testid="transcript-block-body"]');

    expect(body.find('[data-testid="transcript-cue-actions"]').exists()).toBe(true);
    expect(body.find(".transcript-block__text").exists()).toBe(true);
  });

  it("always renders a block-internal meta row", () => {
    const wrapper = mount(TranscriptBlock, {
      props: defaultProps
    });

    expect(wrapper.get('[data-testid="transcript-meta-row"]').exists()).toBe(true);
    expect(wrapper.get('[data-testid="transcript-cue-actions"]').exists()).toBe(true);
    expect(wrapper.get('[data-testid="transcript-meta-row"]').attributes("data-meta-state")).toBe("quiet");
    expect(wrapper.get('[data-testid="transcript-meta-row"]').attributes("data-auto-hide-quiet")).toBe("false");
  });

  it("renders a timestamp and inline cue controls in the meta row", () => {
    const wrapper = mount(TranscriptBlock, {
      props: { ...defaultProps, isActive: true }
    });

    expect(wrapper.get('[data-testid="transcript-cue-actions"]').text()).toContain("00:00 - 00:01");
    expect(wrapper.get('[data-testid="cue-action-play"]').text()).toBe("▶");
    expect(wrapper.get('[data-testid="cue-action-ab"]').text()).toBe("A");
    expect(wrapper.get('[data-testid="cue-action-loop"]').text()).toBe("↻");
    expect(wrapper.get('[data-testid="cue-action-play"]').attributes("aria-label")).toBe("Play from cue 00:00 - 00:01");
    expect(wrapper.get('[data-testid="cue-action-ab"]').attributes("aria-label")).toBe("Set A point at cue 00:00 - 00:01");
    expect(wrapper.get('[data-testid="cue-action-loop"]').attributes("aria-label")).toBe("Loop cue 00:00 - 00:01");
  });

  it("promotes the meta row when the block is active", () => {
    const wrapper = mount(TranscriptBlock, {
      props: { ...defaultProps, isActive: true }
    });

    expect(wrapper.get('[data-testid="transcript-meta-row"]').attributes("data-meta-state")).toBe("active");
  });

  it("does not change line positioning when the block enters hover state", async () => {
    const wrapper = mount(TranscriptBlock, {
      props: {
        ...defaultProps,
        blockId: "block-1",
        start: 1000,
        end: 2000,
        lines: [{ key: "line-0", kind: "primary", text: "next line", style: lineStyle(24, 24) }]
      }
    });

    const before = wrapper.get(".transcript-block__line").attributes("style");
    await wrapper.get("article").trigger("mouseenter");
    const after = wrapper.get(".transcript-block__line").attributes("style");

    expect(wrapper.get('[data-testid="transcript-meta-row"]').attributes("data-meta-state")).toBe("hover");
    expect(after).toBe(before);
  });

  it("keeps the selected A marker visible even when the block is inactive", () => {
    const wrapper = mount(TranscriptBlock, {
      props: {
        ...defaultProps,
        lines: [{ key: "line-0", kind: "primary", text: "hello world", style: lineStyle(24, 24) }],
        isAbLoopStart: true
      }
    });

    expect(wrapper.get('[data-testid="transcript-meta-row"]').attributes("data-meta-state")).toBe("ab-pending");
    expect(wrapper.get('[data-testid="cue-action-ab"]').text()).toBe("A");
    expect(wrapper.get('[data-testid="cue-action-ab"]').attributes("aria-label")).toBe("A point selected at cue 00:00 - 00:01, choose B");
  });

  it("keeps the single-cue loop rail visible when the looped block is inactive", () => {
    const wrapper = mount(TranscriptBlock, {
      props: {
        ...defaultProps,
        lines: [{ key: "line-0", kind: "primary", text: "hello world", style: lineStyle(24, 24) }],
        isLooping: true
      }
    });

    expect(wrapper.get('[data-testid="transcript-meta-row"]').attributes("data-meta-state")).toBe("looping");
    expect(wrapper.get('[data-testid="cue-action-loop"]').classes()).toContain("transcript-block__loop-btn--active");
  });

  it("shows selection state without changing the mounted structure", () => {
    const wrapper = mount(TranscriptBlock, {
      props: {
        ...defaultProps,
        blockId: "block-1",
        start: 1000,
        end: 2000,
        lines: [{ key: "line-0", kind: "primary", text: "next line", style: lineStyle(24, 24) }],
        showSelectionActions: true
      }
    });

    expect(wrapper.get('[data-testid="transcript-meta-row"]').attributes("data-meta-state")).toBe("selection");
    expect(wrapper.get('[data-testid="transcript-cue-actions"]').exists()).toBe(true);
  });

  it("positions text lines from pretext geometry instead of normal document flow", () => {
    const wrapper = mount(TranscriptBlock, {
      props: {
        ...defaultProps,
        lines: [
          { key: "line-0", kind: "primary", text: "hello world", style: lineStyle(24, 24, { fontFamily: "Georgia, serif", fontSize: "20px", color: "#ff0" }) },
          { key: "line-1", kind: "secondary", text: "你好世界", style: lineStyle(54, 20, { fontFamily: "Georgia, serif", fontSize: "19px", color: "#ee0" }) }
        ],
        isActive: true
      }
    });

    const lines = wrapper.findAll(".transcript-block__line");

    expect(lines[0]?.attributes("style")).toContain("top: 24px;");
    expect(lines[0]?.attributes("style")).toContain("height: 24px;");
    expect(lines[1]?.attributes("style")).toContain("top: 54px;");
    expect(lines[1]?.attributes("style")).toContain("height: 20px;");
  });

  it("does not shift the meta row upward on hover or focus-within", () => {
    const stylesheet = readFileSync(resolve(process.cwd(), "src/renderer/style.css"), "utf8");
    const metaRowHoverRule = /\.transcript-block__meta-row\[data-meta-state="hover"\],[\s\S]*?\.transcript-block__meta-row\[data-meta-state="focus-within"\]\s*\{([\s\S]*?)\}/m.exec(
      stylesheet
    );

    expect(metaRowHoverRule?.[1]).not.toContain("translateY(-1px)");
  });

  it("marks quiet meta rows for full hiding when auto-hide is enabled", () => {
    const wrapper = mount(TranscriptBlock, {
      props: {
        ...defaultProps,
        autoHideMetaRow: true
      }
    });
    const stylesheet = readFileSync(resolve(process.cwd(), "src/renderer/style.css"), "utf8");

    expect(wrapper.get('[data-testid="transcript-meta-row"]').attributes("data-auto-hide-quiet")).toBe("true");
    expect(stylesheet).toContain('.transcript-block__meta-row[data-auto-hide-quiet="true"][data-meta-state="quiet"] .transcript-block__cue-actions');
    expect(stylesheet).toContain("opacity: 0;");
    expect(stylesheet).toContain("visibility: hidden;");
  });
});
