import { createPinia, setActivePinia } from "pinia";
import { mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TopControlPanel from "./TopControlPanel.vue";
import { createTopControlPanelProps, createTopPanelDesktopState, createTopPanelSettings } from "../../test/topPanelTestData";
import { useDesktopStore } from "../../stores/desktop";
import "../../style.css";

function mountTopControlPanelInNarrowHost(widthPx: number) {
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
    props: createTopControlPanelProps({ autoHideEnabled: false })
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
});
