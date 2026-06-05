import { createPinia, setActivePinia } from "pinia";
import { mount } from "@vue/test-utils";
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

function expectBorderless(element: HTMLElement) {
  const style = getComputedStyle(element);
  expect(style.borderTopWidth).toBe("0px");
  expect(style.borderRightWidth).toBe("0px");
  expect(style.borderBottomWidth).toBe("0px");
  expect(style.borderLeftWidth).toBe("0px");
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

  it("removes borders from the compact panel controls", async () => {
    const { host, wrapper } = mountTopControlPanelInNarrowHost(520, {
      transcriptionEnabled: true,
      transcriptionConfigs: [{ id: "fast", name: "Fast local" }],
      activeTranscriptionId: "fast",
      canTranscribe: true
    });

    await nextFrame();

    const borderedControls = Array.from(
      host.querySelectorAll<HTMLElement>(
        ".control-panel .ui-select, .status-banner, .top-control-panel__actions .ui-icon-button, .playback-row .ui-icon-button, .transcription-controls .ui-icon-button"
      )
    );
    expect(borderedControls.length).toBeGreaterThan(0);
    for (const control of borderedControls) {
      expectBorderless(control);
    }

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
