import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import { describe, expect, it } from "vitest";
import PlaybackControls from "./PlaybackControls.vue";

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

function mountPlaybackControls(autoHideEnabled: boolean, attachTo?: Element) {
  return mount(PlaybackControls, {
    props: {
      isPlaying: false,
      hasActiveVideo: true,
      displayedPlaybackTime: 1000,
      playbackDuration: 5000,
      sliderMax: 5000,
      sliderStep: 100,
      sliderValue: 1000,
      sliderEnabled: true,
      sliderFillStyle: {},
      autoHideEnabled,
      t: (key: string) => {
        const labels: Record<string, string> = {
          "play-button": "Play",
          "playback-position-label": "Playback Position",
          "auto-hide-toggle-on": "Auto-hide on",
          "auto-hide-toggle-off": "Auto-hide off"
        };
        return labels[key] ?? key;
      }
    },
    attachTo
  });
}

describe("PlaybackControls", () => {
  it("renders auto-hide as a localized secondary state toggle", () => {
    const enabled = mountPlaybackControls(true);
    const enabledToggle = enabled.get(".auto-hide-toggle");

    expect(enabledToggle.attributes("aria-label")).toBe("Auto-hide on");
    expect(enabledToggle.attributes("data-variant")).toBe("secondary");
    expect(enabledToggle.classes()).toContain("is-active");

    const disabled = mountPlaybackControls(false);
    const disabledToggle = disabled.get(".auto-hide-toggle");

    expect(disabledToggle.attributes("aria-label")).toBe("Auto-hide off");
    expect(disabledToggle.attributes("data-variant")).toBe("secondary");
    expect(disabledToggle.classes()).not.toContain("is-active");
  });

  it("opens tooltips and passes slider input/change events through playback controls", async () => {
    const wrapper = mountPlaybackControls(false, document.body);

    wrapper.findAll(".ui-tooltip-trigger")[0]!.element.dispatchEvent(
      createPointerEvent("pointerenter", { pointerId: 1, pointerType: "mouse" })
    );
    await new Promise((resolve) => window.setTimeout(resolve, 260));
    await nextTick();

    expect(document.body.querySelector('[role="tooltip"]')?.textContent).toBe("Play");

    const slider = wrapper.get<HTMLInputElement>(".playback-slider");
    slider.element.value = "2500";
    await slider.trigger("input");
    await slider.trigger("change");

    expect(wrapper.emitted("scrub-input")?.[0]?.[0]).toBeInstanceOf(Event);
    expect(wrapper.emitted("scrub-end")?.[0]?.[0]).toBeInstanceOf(Event);

    wrapper.unmount();
  });
});
