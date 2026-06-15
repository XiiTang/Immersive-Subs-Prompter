import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const requiredKeys = [
  "panel-background-opacity",
  "panel-open-settings",
  "panel-pin-off",
  "panel-pin-floating",
  "panel-pin-screen-saver",
  "panel-enter-fullscreen",
  "panel-exit-fullscreen",
  "connection-connecting",
  "connection-extension",
  "connection-extension-mediaserver",
  "profile-rule-label",
  "cue-play-label",
  "cue-loop-label",
  "cue-ab-set-label",
  "cue-ab-pending-label",
  "cue-ab-a-label",
  "cue-ab-b-label",
  "section-features",
  "features-section-title",
  "feature-word-lookup-title",
  "feature-transcription-title",
  "feature-transcription-provider",
  "feature-transcription-base-url",
  "feature-transcription-api-key",
  "feature-transcription-model",
  "feature-transcription-language",
  "feature-transcription-prompt",
  "feature-transcription-word-timestamps",
  "feature-transcription-extra-params",
  "feature-transcription-faster-whisper-model",
  "feature-transcription-model-directory",
  "feature-transcription-device",
  "feature-transcription-vad-filter",
  "feature-transcription-vad-threshold",
  "feature-transcription-vad-method",
  "feature-transcription-kim2",
  "feature-jellyfin-emby-title"
];

function readLocale(name: "en" | "zh") {
  return JSON.parse(readFileSync(resolve(process.cwd(), `src/renderer/locales/${name}.json`), "utf8")) as Record<string, string>;
}

describe("renderer i18n coverage", () => {
  it("keeps English and Chinese dictionaries aligned for new UI surfaces", () => {
    const en = readLocale("en");
    const zh = readLocale("zh");

    expect(Object.keys(en).sort()).toEqual(Object.keys(zh).sort());
    for (const key of requiredKeys) {
      expect(en[key]?.trim()).toBeTruthy();
      expect(zh[key]?.trim()).toBeTruthy();
    }
  });
});
