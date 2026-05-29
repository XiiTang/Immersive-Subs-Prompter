import { describe, expect, it } from "vitest";
import { fallbackSubtitleTranslate, resolveSubtitleTranslate } from "./translate";

describe("subtitle translate helper", () => {
  it("formats fallback text when no translator is provided", () => {
    const translate = resolveSubtitleTranslate();

    expect(translate("cue-play-label", "Play from cue {time}", { time: "00:00 - 00:01" })).toBe(
      "Play from cue 00:00 - 00:01"
    );
  });

  it("uses the provided translator before fallback formatting", () => {
    const translate = resolveSubtitleTranslate((key, fallback = "", params = {}) => {
      const text = key === "cue-loop-label" ? "循环 {time}" : fallback;
      return fallbackSubtitleTranslate(key, text, params);
    });

    expect(translate("cue-loop-label", "Loop cue {time}", { time: "00:00 - 00:01" })).toBe(
      "循环 00:00 - 00:01"
    );
  });
});
