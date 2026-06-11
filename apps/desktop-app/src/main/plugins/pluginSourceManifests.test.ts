import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readPluginManifest(pluginFolder: string) {
  const manifestPath = fileURLToPath(new URL(`../../../../../plugins/${pluginFolder}/manifest.json`, import.meta.url));
  return JSON.parse(readFileSync(manifestPath, "utf-8")) as {
    id?: string;
    author?: { id?: string; name?: string; url?: string };
    package?: unknown;
    contributions?: {
      settings?: Array<{
        id?: string;
        schema?: Array<{ id: string; type: string; defaultValue?: unknown }>;
      }>;
    };
  };
}

function readPluginMain(pluginFolder: string): string {
  const mainPath = fileURLToPath(new URL(`../../../../../plugins/${pluginFolder}/main.js`, import.meta.url));
  return readFileSync(mainPath, "utf-8");
}

function pluginFolders(): string[] {
  const pluginRoot = fileURLToPath(new URL("../../../../../plugins/", import.meta.url));
  return readdirSync(pluginRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

function settingFieldIds(pluginFolder: string): string[] {
  const manifest = readPluginManifest(pluginFolder);
  return manifest.contributions?.settings?.flatMap((section) => section.schema ?? []).map((field) => field.id) ?? [];
}

describe("downloadable plugin source manifests", () => {
  it("uses short source ids and the repository author", () => {
    for (const pluginFolder of pluginFolders()) {
      const manifest = readPluginManifest(pluginFolder);

      expect(manifest.id).toBe(pluginFolder);
      expect(manifest.author).toEqual({
        id: "xiitang",
        name: "XiiTang",
        url: "https://github.com/XiiTang"
      });
      expect(manifest.package).toBeUndefined();
    }
  });

  it("exposes only user-owned transcription options through the transcription plugin schema", () => {
    expect(settingFieldIds("transcription")).toEqual([
      "provider",
      "baseUrl",
      "apiKey",
      "model",
      "language",
      "prompt",
      "enableWordTimestamps",
      "extraParamsJson",
      "fasterWhisperModel",
      "fasterWhisperModelDir",
      "fasterWhisperDevice",
      "fasterWhisperVadFilter",
      "fasterWhisperVadThreshold",
      "fasterWhisperVadMethod",
      "fasterWhisperUseKim2"
    ]);
    expect(readPluginMain("transcription")).not.toContain("ytDlpArgs");
    expect(readPluginMain("transcription")).not.toContain("fasterWhisperBinary");
  });

  it("uses structured server-list settings for Jellyfin / Emby instead of JSON text blobs", () => {
    const manifest = readPluginManifest("jellyfinemby");
    const fields = manifest.contributions?.settings?.flatMap((section) => section.schema ?? []) ?? [];

    expect(fields).toEqual([
      {
        id: "servers",
        label: "Servers",
        type: "serverList",
        defaultValue: []
      }
    ]);
    expect(readPluginMain("jellyfinemby")).not.toContain("webSocketPath");
  });

  it("declares settings schemas only in manifests", () => {
    for (const pluginFolder of pluginFolders()) {
      expect(readPluginMain(pluginFolder), pluginFolder).not.toContain("registerSettings");
    }
  });
});
