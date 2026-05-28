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
  "plugin-official-transcription-name",
  "plugin-official-transcription-description",
  "plugin-official-word-lookup-name",
  "plugin-official-word-lookup-description",
  "plugin-official-jellyfinemby-name",
  "plugin-official-jellyfinemby-description"
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
