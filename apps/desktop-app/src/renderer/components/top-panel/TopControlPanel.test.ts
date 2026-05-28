import { createPinia, setActivePinia } from "pinia";
import { mount } from "@vue/test-utils";
import type { VueWrapper } from "@vue/test-utils";
import { nextTick } from "vue";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TopControlPanel from "./TopControlPanel.vue";
import {
  createTopControlPanelProps,
  createTopPanelDesktopState,
  createTopPanelSettings
} from "./topPanelTestData";
import { useDesktopStore } from "../../stores/desktop";

const rendererStylesheet = readFileSync(path.resolve(process.cwd(), "src/renderer/style.css"), "utf8");

type ResizeObserverCallback = (entries: Array<{ target: Element }>) => void;

let resizeObserverCallbacks: ResizeObserverCallback[] = [];
let mountedWrappers: VueWrapper[] = [];

class ResizeObserverMock {
  private readonly callback: ResizeObserverCallback;
  private readonly targets = new Set<Element>();

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
    resizeObserverCallbacks.push(callback);
  }

  observe(target: Element) {
    this.targets.add(target);
  }

  unobserve(target: Element) {
    this.targets.delete(target);
  }

  disconnect() {
    this.targets.clear();
    resizeObserverCallbacks = resizeObserverCallbacks.filter((callback) => callback !== this.callback);
  }
}

function triggerResizeObservers(...targets: Element[]) {
  const entries = targets.map((target) => ({ target }));
  for (const callback of resizeObserverCallbacks) {
    callback(entries);
  }
}

function mountTopControlPanel(options: {
  autoHidePanels?: boolean;
  t?: (key: string, fallback?: string, params?: Record<string, any>) => string;
} = {}) {
  const autoHidePanels = options.autoHidePanels ?? true;
  let pointerState = { insideWindow: false, x: null as number | null, y: null as number | null };
  const getWindowPointerState = vi.fn().mockImplementation(async () => pointerState);

  Object.defineProperty(window, "usp", {
    configurable: true,
    value: {
      openSettingsWindow: vi.fn().mockResolvedValue({ success: true }),
      getWindowPointerState
    }
  });

  const store = useDesktopStore();
  store.settings = createTopPanelSettings(autoHidePanels);
  store.desktopState = createTopPanelDesktopState();
  store.playback = store.desktopState.playback;

  const wrapper = mount(TopControlPanel, {
    props: createTopControlPanelProps({
      autoHideEnabled: autoHidePanels,
      ...(options.t ? { t: options.t } : {})
    }),
    attachTo: document.body,
    global: {
      stubs: {
        PlaybackControls: true,
        StatusBanner: true,
        TrackSelector: true,
        TranscriptionControls: true
      }
    }
  });
  mountedWrappers.push(wrapper);

  return {
    wrapper,
    getWindowPointerState,
    setPointerState(next: typeof pointerState) {
      pointerState = next;
    }
  };
}

function mockPanelGeometry(headerHeight: number, panelHeight: number) {
  vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(function offsetHeight() {
    if (this instanceof HTMLElement && this.dataset.testid === "top-control-panel-header") {
      return headerHeight;
    }
    if (this instanceof HTMLElement && this.dataset.testid === "top-control-panel-surface") {
      return panelHeight;
    }
    return 0;
  });
}

describe("TopControlPanel", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    resizeObserverCallbacks = [];
    mountedWrappers = [];
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);
  });

  afterEach(() => {
    for (const wrapper of mountedWrappers.splice(0)) {
      wrapper.unmount();
    }
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("expands only after entering the transparent top-edge trigger zone", async () => {
    const { wrapper } = mountTopControlPanel({ autoHidePanels: true });

    expect(wrapper.classes()).toContain("top-control-panel--collapsed");

    await wrapper.get('[data-testid="top-control-panel-body"]').trigger("pointerenter");
    expect(wrapper.classes()).toContain("top-control-panel--collapsed");

    await wrapper.get('[data-testid="top-edge-trigger-zone"]').trigger("pointerenter");
    expect(wrapper.classes()).toContain("top-control-panel--expanded");
  });

  it("starts a 200ms collapse timer when pointer leaves the panel", async () => {
    vi.useFakeTimers();
    mockPanelGeometry(28, 112);
    const { wrapper, setPointerState } = mountTopControlPanel({ autoHidePanels: true });

    setPointerState({ insideWindow: true, x: 40, y: 12 });
    await wrapper.get('[data-testid="top-edge-trigger-zone"]').trigger("pointerenter");
    setPointerState({ insideWindow: false, x: null, y: null });

    await vi.advanceTimersByTimeAsync(60);
    expect(wrapper.classes()).toContain("top-control-panel--collapse-pending");

    await vi.advanceTimersByTimeAsync(180);
    expect(wrapper.classes()).toContain("top-control-panel--collapse-pending");

    await vi.advanceTimersByTimeAsync(20);
    expect(wrapper.classes()).toContain("top-control-panel--collapsed");
  });

  it("keeps the panel expanded when the polled cursor stays inside the header geometry", async () => {
    vi.useFakeTimers();
    mockPanelGeometry(28, 112);
    const { wrapper, setPointerState } = mountTopControlPanel({ autoHidePanels: true });

    await wrapper.get('[data-testid="top-edge-trigger-zone"]').trigger("pointerenter");
    setPointerState({ insideWindow: false, x: null, y: null });
    await vi.advanceTimersByTimeAsync(60);
    expect(wrapper.classes()).toContain("top-control-panel--collapse-pending");

    setPointerState({ insideWindow: true, x: 40, y: 12 });
    await vi.advanceTimersByTimeAsync(60);

    expect(wrapper.classes()).toContain("top-control-panel--expanded");
  });

  it("does not expand when pointer enters body content while collapsed", async () => {
    const { wrapper } = mountTopControlPanel({ autoHidePanels: true });

    await wrapper.get('[data-testid="top-control-panel-body"]').trigger("pointerenter");

    expect(wrapper.classes()).toContain("top-control-panel--collapsed");
  });

  it("keeps a dedicated drag handle inside the unified panel surface after expansion", async () => {
    const { wrapper } = mountTopControlPanel({ autoHidePanels: true });

    expect(wrapper.find('[data-testid="top-control-panel-header-drag-region"]').exists()).toBe(false);

    await wrapper.get('[data-testid="top-edge-trigger-zone"]').trigger("pointerenter");

    expect(wrapper.get('[data-testid="top-control-panel-drag-handle"]').classes())
      .toContain("top-control-panel__drag-handle");
  });

  it("keeps header actions out of the drag handle", async () => {
    const { wrapper } = mountTopControlPanel({ autoHidePanels: true });

    await wrapper.get('[data-testid="top-edge-trigger-zone"]').trigger("pointerenter");

    expect(wrapper.get('[data-testid="top-control-panel-actions"]').classes())
      .toContain("top-control-panel__actions");
    expect(wrapper.get('[data-testid="top-control-panel-actions"]').classes())
      .not.toContain("top-control-panel__drag-handle");
  });

  it("renders header and body inside one animated surface", async () => {
    const { wrapper } = mountTopControlPanel({ autoHidePanels: true });

    await wrapper.get('[data-testid="top-edge-trigger-zone"]').trigger("pointerenter");

    const surface = wrapper.get('[data-testid="top-control-panel-surface"]');

    expect(surface.find('[data-testid="top-control-panel-header"]').exists()).toBe(true);
    expect(surface.find('[data-testid="top-control-panel-body"]').exists()).toBe(true);
  });

  it("does not render the static product title in the main window header", async () => {
    const { wrapper } = mountTopControlPanel({ autoHidePanels: false });

    expect(wrapper.find('[data-testid="top-control-panel-title"]').exists()).toBe(false);
    expect(wrapper.text()).not.toContain("Immersive Subs Prompter");
  });

  it("cancels collapse when the pointer re-enters the unified surface before the timer fires", async () => {
    vi.useFakeTimers();
    mockPanelGeometry(28, 112);
    const { wrapper, setPointerState } = mountTopControlPanel({ autoHidePanels: true });

    await wrapper.get('[data-testid="top-edge-trigger-zone"]').trigger("pointerenter");
    setPointerState({ insideWindow: false, x: null, y: null });
    await vi.advanceTimersByTimeAsync(60);

    setPointerState({ insideWindow: true, x: 40, y: 64 });
    await vi.advanceTimersByTimeAsync(60);

    expect(wrapper.classes()).toContain("top-control-panel--expanded");
  });

  it("has no independent trigger-zone interaction concept when auto hide is disabled", async () => {
    const { wrapper } = mountTopControlPanel({ autoHidePanels: false });

    expect(wrapper.classes()).toContain("top-control-panel--force-expanded");
    expect(wrapper.find('[data-testid="top-edge-trigger-zone"]').exists()).toBe(false);
  });

  it("stays force-expanded when auto hide is disabled", async () => {
    const { wrapper } = mountTopControlPanel({ autoHidePanels: false });

    expect(wrapper.classes()).toContain("top-control-panel--force-expanded");
    await nextTick();

    expect(wrapper.classes()).toContain("top-control-panel--force-expanded");
  });

  it("collapses the whole surface as one block", () => {
    expect(rendererStylesheet).toContain(".top-control-panel--collapsed .top-control-panel__surface");
    expect(rendererStylesheet).not.toContain(".top-control-panel--collapsed .top-control-panel__header {\n  opacity:");
  });

  it("enables the Electron drag region only while the panel is expanded", async () => {
    mockPanelGeometry(28, 112);
    const { wrapper, setPointerState } = mountTopControlPanel({ autoHidePanels: true });

    expect(wrapper.classes()).not.toContain("top-control-panel--draggable");
    expect(rendererStylesheet).toContain(".top-control-panel__header {");
    expect(rendererStylesheet).toContain("-webkit-app-region: no-drag;");
    expect(rendererStylesheet).toContain(".top-control-panel--draggable .top-control-panel__header {");
    expect(rendererStylesheet).toContain(".top-control-panel__actions,");

    setPointerState({ insideWindow: true, x: 40, y: 12 });
    await wrapper.get('[data-testid="top-edge-trigger-zone"]').trigger("pointerenter");

    expect(wrapper.classes()).toContain("top-control-panel--draggable");
  });

  it("does not expand when the pointer enters transcript content directly", async () => {
    const { wrapper } = mountTopControlPanel({ autoHidePanels: true });
    await wrapper.trigger("pointermove");
    expect(wrapper.classes()).toContain("top-control-panel--collapsed");
  });

  it("uses measured header and panel heights for trigger geometry and collapsed offset", async () => {
    mockPanelGeometry(28, 112);
    const { wrapper } = mountTopControlPanel({ autoHidePanels: true });
    await vi.waitFor(() => {
      expect(wrapper.attributes("style")).toContain("--top-panel-header-height: 28px");
      expect(wrapper.attributes("style")).toContain("--top-panel-collapsed-offset: 112px");
    });
  });

  it("re-measures geometry on window resize", async () => {
    let geometry = { headerHeight: 24, panelHeight: 96 };
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(function offsetHeight() {
      if (this instanceof HTMLElement && this.dataset.testid === "top-control-panel-header") {
        return geometry.headerHeight;
      }
      if (this instanceof HTMLElement && this.dataset.testid === "top-control-panel-surface") {
        return geometry.panelHeight;
      }
      return 0;
    });

    const { wrapper } = mountTopControlPanel({ autoHidePanels: true });

    await vi.waitFor(() => {
      expect(wrapper.attributes("style")).toContain("--top-panel-header-height: 24px");
      expect(wrapper.attributes("style")).toContain("--top-panel-collapsed-offset: 96px");
    });

    geometry = { headerHeight: 36, panelHeight: 140 };
    window.dispatchEvent(new Event("resize"));

    await vi.waitFor(() => {
      expect(wrapper.attributes("style")).toContain("--top-panel-header-height: 36px");
      expect(wrapper.attributes("style")).toContain("--top-panel-collapsed-offset: 140px");
    });
  });

  it("re-measures geometry when the rendered panel height changes", async () => {
    let geometry = { headerHeight: 24, panelHeight: 96 };
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(function offsetHeight() {
      if (this instanceof HTMLElement && this.dataset.testid === "top-control-panel-header") {
        return geometry.headerHeight;
      }
      if (this instanceof HTMLElement && this.dataset.testid === "top-control-panel-surface") {
        return geometry.panelHeight;
      }
      return 0;
    });

    const { wrapper } = mountTopControlPanel({ autoHidePanels: true });

    await vi.waitFor(() => {
      expect(wrapper.attributes("style")).toContain("--top-panel-collapsed-offset: 96px");
    });

    geometry = { headerHeight: 24, panelHeight: 152 };
    triggerResizeObservers(
      wrapper.get('[data-testid="top-control-panel-header"]').element,
      wrapper.get('[data-testid="top-control-panel-surface"]').element
    );
    await nextTick();

    expect(wrapper.attributes("style")).toContain("--top-panel-collapsed-offset: 152px");
  });

  it("collapses immediately on window blur when auto hide is enabled", async () => {
    mockPanelGeometry(28, 112);
    const { wrapper, setPointerState } = mountTopControlPanel({ autoHidePanels: true });

    setPointerState({ insideWindow: true, x: 40, y: 12 });
    await wrapper.get('[data-testid="top-edge-trigger-zone"]').trigger("pointerenter");
    expect(wrapper.classes()).toContain("top-control-panel--expanded");

    window.dispatchEvent(new FocusEvent("blur"));
    await nextTick();

    expect(wrapper.classes()).toContain("top-control-panel--collapsed");
  });

  it("stays draggable when auto hide is disabled", async () => {
    const { wrapper } = mountTopControlPanel({ autoHidePanels: false });

    await nextTick();

    expect(wrapper.classes()).toContain("top-control-panel--force-expanded");
    expect(wrapper.classes()).toContain("top-control-panel--draggable");
  });

  it("keeps opacity and icon controls in fixed non-overlapping header slots", () => {
    expect(rendererStylesheet).toMatch(/\.header-slider\s*{[\s\S]*width: 64px;[\s\S]*min-width: 64px;[\s\S]*max-width: 64px;[\s\S]*flex: 0 0 64px;/);
    expect(rendererStylesheet).toMatch(/\.top-control-panel__actions \.ui-icon-button\s*{[\s\S]*flex: 0 0 auto;/);
  });

  it("localizes top-panel chrome and connection labels through the provided translator", () => {
    const zh: Record<string, string> = {
      "panel-background-opacity": "背景透明度",
      "panel-open-settings": "打开设置",
      "panel-pin-off": "未置顶",
      "panel-enter-fullscreen": "进入全屏",
      "connection-extension": "扩展：{browser}"
    };
    const t = (key: string, fallback = "", params: Record<string, any> = {}) => {
      let text = zh[key] ?? fallback;
      for (const [name, value] of Object.entries(params)) {
        text = text.split(`{${name}}`).join(String(value));
      }
      return text;
    };

    const { wrapper } = mountTopControlPanel({ autoHidePanels: false, t });

    expect(wrapper.get('[data-testid="top-control-panel-status"]').text()).toBe("扩展：1");
    expect(wrapper.get('[aria-label="背景透明度"]').exists()).toBe(true);
    expect(wrapper.get('[aria-label="未置顶"]').exists()).toBe(true);
    expect(wrapper.get('[aria-label="进入全屏"]').exists()).toBe(true);
    expect(wrapper.get('[aria-label="打开设置"]').exists()).toBe(true);
  });
});
