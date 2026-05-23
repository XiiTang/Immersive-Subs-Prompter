import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import PlaybackControls from "./PlaybackControls.vue";

function mountPlaybackControls(autoHideEnabled: boolean) {
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
      t: (_key: string, fallback?: string) => fallback ?? _key
    }
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
});
