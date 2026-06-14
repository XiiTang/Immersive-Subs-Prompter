import { createPinia, setActivePinia } from "pinia";
import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TopControlPanel from "./TopControlPanel.vue";
import { createTopControlPanelProps, createTopPanelDesktopState, createTopPanelSettings } from "../../test/topPanelTestData";
import { useDesktopStore } from "../../stores/desktop";
import "../../style.css";

function mountTopControlPanelInNarrowHost(widthPx: number, propsOverrides: Record<string, unknown> = {}) {
  const host = document.createElement("div");
  host.style.position = "relative";
  host.style.width = `${widthPx}px`;
  host.style.height = "240px";
  document.body.appendChild(host);

  Object.defineProperty(window, "usp", {
    configurable: true,
    value: {
      openSettingsWindow: vi.fn().mockResolvedValue({ success: true }),
      getWindowPointerState: vi.fn().mockResolvedValue({ insideWindow: false, x: null, y: null })
    }
  });

  const store = useDesktopStore();
  store.settings = createTopPanelSettings(false);
  store.desktopState = createTopPanelDesktopState();
  store.playback = store.desktopState.playback;

  const wrapper = mount(TopControlPanel, {
    attachTo: host,
    props: createTopControlPanelProps({ autoHideEnabled: false, ...propsOverrides })
  });

  return { host, wrapper };
}

async function nextFrame() {
  await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
}

describe("TopControlPanel browser layout", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    document.body.innerHTML = "";
    document.body.style.margin = "0";
    document.body.style.padding = "0";
  });

  it("keeps primary and secondary subtitle selectors on the same row in a narrow panel", async () => {
    const { host, wrapper } = mountTopControlPanelInNarrowHost(240);

    await nextFrame();

    const trackPickers = Array.from(
      host.querySelectorAll<HTMLElement>('[data-testid="top-control-panel-track-row"] > .track-picker')
    );
    expect(trackPickers).toHaveLength(2);

    const [primaryTrackPicker, secondaryTrackPicker] = trackPickers;
    expect(primaryTrackPicker.getBoundingClientRect().top).toBe(secondaryTrackPicker.getBoundingClientRect().top);

    wrapper.unmount();
    host.remove();
  });

  it("keeps the top header and right action buttons compact", async () => {
    const { host, wrapper } = mountTopControlPanelInNarrowHost(480);

    await nextFrame();

    const header = host.querySelector<HTMLElement>('[data-testid="top-control-panel-header"]');
    expect(header).not.toBeNull();
    expect(header!.getBoundingClientRect().height).toBeLessThanOrEqual(36);

    const actionButtons = Array.from(
      host.querySelectorAll<HTMLElement>('[data-testid="top-control-panel-actions"] .ui-icon-button')
    );
    expect(actionButtons).toHaveLength(3);

    for (const button of actionButtons) {
      const rect = button.getBoundingClientRect();
      expect(rect.width).toBeLessThanOrEqual(28);
      expect(rect.height).toBeLessThanOrEqual(28);
    }

    wrapper.unmount();
    host.remove();
  });

  it("opens header tooltips and updates opacity through the header slider", async () => {
    const { host, wrapper } = mountTopControlPanelInNarrowHost(480);
    const store = useDesktopStore();
    const updateGlobalSpy = vi.spyOn(store, "updateGlobalSetting").mockImplementation(() => undefined);

    await nextFrame();

    const opacityTooltipTrigger = host.querySelector<HTMLElement>(
      '[data-testid="top-control-panel-actions"] .ui-tooltip-trigger'
    );
    expect(opacityTooltipTrigger).not.toBeNull();
    opacityTooltipTrigger!.dispatchEvent(new PointerEvent("pointerenter", { pointerId: 1, pointerType: "mouse" }));
    await new Promise((resolve) => window.setTimeout(resolve, 260));
    await nextTick();

    expect(document.body.querySelector('[role="tooltip"]')?.textContent).toBe("panel-background-opacity");

    const opacitySlider = host.querySelector<HTMLInputElement>(".header-slider");
    expect(opacitySlider).not.toBeNull();
    opacitySlider!.value = "64";
    opacitySlider!.dispatchEvent(new Event("input", { bubbles: true }));
    await nextTick();

    expect(updateGlobalSpy).toHaveBeenCalledWith("panelOpacity", 64);

    wrapper.unmount();
    host.remove();
  });

  it("keeps the main controls compact across selectors, transcription, status, and playback", async () => {
    const { host, wrapper } = mountTopControlPanelInNarrowHost(520, {
      transcriptionEnabled: true,
      transcriptionConfigs: [{ id: "fast", name: "Fast local" }],
      activeTranscriptionId: "fast",
      canTranscribe: true
    });

    await nextFrame();

    const selectors = Array.from(
      host.querySelectorAll<HTMLElement>(".control-panel .ui-select")
    );
    expect(selectors.length).toBeGreaterThanOrEqual(3);
    for (const selector of selectors) {
      expect(selector.getBoundingClientRect().height).toBeLessThanOrEqual(30);
    }

    const compactButtons = Array.from(
      host.querySelectorAll<HTMLElement>(".playback-row .ui-icon-button, .transcription-controls .ui-icon-button")
    );
    expect(compactButtons).toHaveLength(3);
    for (const button of compactButtons) {
      const rect = button.getBoundingClientRect();
      expect(rect.width).toBeLessThanOrEqual(28);
      expect(rect.height).toBeLessThanOrEqual(28);
    }

    const statusBanner = host.querySelector<HTMLElement>(".status-banner");
    expect(statusBanner).not.toBeNull();
    expect(statusBanner!.getBoundingClientRect().height).toBeLessThanOrEqual(26);

    const playbackSlider = host.querySelector<HTMLElement>(".playback-slider");
    expect(playbackSlider).not.toBeNull();
    expect(playbackSlider!.getBoundingClientRect().height).toBeLessThanOrEqual(16);

    wrapper.unmount();
    host.remove();
  });

  it("uses foundation controls for compact panel chrome", async () => {
    const { host, wrapper } = mountTopControlPanelInNarrowHost(520, {
      transcriptionEnabled: true,
      transcriptionConfigs: [{ id: "fast", name: "Fast local" }],
      activeTranscriptionId: "fast",
      canTranscribe: true
    });

    await nextFrame();

    expect(host.querySelectorAll<HTMLElement>('[data-slot="toolbar"]').length).toBeGreaterThanOrEqual(1);
    expect(host.querySelectorAll<HTMLElement>('[data-slot="icon-button"]').length).toBeGreaterThanOrEqual(3);
    expect(host.querySelectorAll<HTMLElement>('[data-slot="select-trigger"]').length).toBeGreaterThanOrEqual(1);
    expect(host.querySelectorAll<HTMLElement>('[data-slot="slider"]').length).toBeGreaterThanOrEqual(1);

    wrapper.unmount();
    host.remove();
  });

  it("adds a little breathing room between the status title and profile line", async () => {
    const { host, wrapper } = mountTopControlPanelInNarrowHost(520, {
      title: "Waiting for video",
      profileLabel: "Profile: Default"
    });

    await nextFrame();

    const profileLine = host.querySelector<HTMLElement>(".top-control-panel__info-profile");
    expect(profileLine).not.toBeNull();
    expect(getComputedStyle(profileLine!).marginTop).toBe("2px");

    wrapper.unmount();
    host.remove();
  });
});
