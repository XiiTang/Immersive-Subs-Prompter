import { describe, expect, it } from "vitest";
import { resolveSubtitleTranslate } from "./translate";

describe("subtitle translate helper", () => {
  it("returns the key when no translator is provided", () => {
    const translate = resolveSubtitleTranslate();

    expect(translate("cue-play-label", { time: "00:00 - 00:01" })).toBe("cue-play-label");
  });

  it("uses the provided translator", () => {
    const translate = resolveSubtitleTranslate((key, params = {}) => {
      const text = key === "cue-loop-label" ? "循环 {time}" : key;
      return text.replace("{time}", String(params.time));
    });

    expect(translate("cue-loop-label", { time: "00:00 - 00:01" })).toBe(
      "循环 00:00 - 00:01"
    );
  });
});
