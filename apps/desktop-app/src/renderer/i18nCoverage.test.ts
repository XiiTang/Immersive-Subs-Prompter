import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
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
  "profile-enable",
  "profile-enabled",
  "profile-rule-label",
  "cue-play-label",
  "cue-loop-label",
  "cue-ab-set-label",
  "cue-ab-pending-label",
  "cue-ab-a-label",
  "cue-ab-b-label",
  "section-features",
  "features-section-title",
  "button-select",
  "feature-word-lookup-title",
  "feature-word-lookup-refresh",
  "feature-word-lookup-refreshing",
  "feature-word-lookup-status",
  "feature-word-lookup-status-not-loaded",
  "feature-word-lookup-status-ready",
  "feature-word-lookup-status-error",
  "feature-word-lookup-entry-count",
  "feature-word-lookup-file-modified",
  "feature-word-lookup-loaded-at",
  "feature-transcription-title",
  "feature-transcription-config-actions",
  "feature-transcription-enabled",
  "feature-transcription-enable",
  "feature-transcription-config-name",
  "feature-transcription-provider",
  "feature-transcription-base-url",
  "feature-transcription-api-key",
  "feature-transcription-model",
  "feature-transcription-language",
  "feature-transcription-prompt",
  "feature-transcription-word-timestamps",
  "feature-transcription-extra-params",
  "feature-transcription-extra-params-invalid",
  "feature-transcription-ytdlp-args",
  "feature-transcription-no-config",
  "feature-transcription-faster-whisper-model",
  "feature-transcription-model-directory",
  "feature-transcription-device",
  "feature-transcription-vad-filter",
  "feature-transcription-vad-threshold",
  "feature-transcription-vad-method",
  "feature-transcription-kim2",
  "feature-jellyfin-emby-title",
  "feature-jellyfin-emby-server-list",
  "feature-jellyfin-emby-untitled",
  "feature-jellyfin-emby-no-url",
  "feature-jellyfin-emby-url-count"
];

function readLocale(name: "en" | "zh") {
  return JSON.parse(readFileSync(resolve(process.cwd(), `src/renderer/locales/${name}.json`), "utf8")) as Record<string, string>;
}

function readProductionRendererSource() {
  const sourceRoot = resolve(process.cwd(), "src/renderer");
  const chunks: string[] = [];

  function walk(dir: string) {
    for (const entry of readdirSync(dir)) {
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        if (entry !== "locales" && entry !== "test") {
          walk(fullPath);
        }
        continue;
      }
      if (!/\.(?:vue|ts|html)$/.test(entry) || /\.test\.ts$/.test(entry) || /\.d\.ts$/.test(entry)) {
        continue;
      }
      chunks.push(readFileSync(fullPath, "utf8"));
    }
  }

  walk(sourceRoot);
  return chunks.join("\n");
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

  it("does not keep renderer locale keys that production code never references", () => {
    const en = readLocale("en");
    const source = readProductionRendererSource();

    const unusedKeys = Object.keys(en).filter((key) => !source.includes(`"${key}"`) && !source.includes(`'${key}'`));

    expect(unusedKeys).toEqual([]);
  });
});
