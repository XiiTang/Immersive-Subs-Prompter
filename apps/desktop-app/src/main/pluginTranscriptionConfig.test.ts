import { describe, expect, it } from "vitest";
import { buildPluginTranscriptionConfig } from "./pluginTranscriptionConfig.js";

describe("buildPluginTranscriptionConfig", () => {
  it("drops plugin-controlled process fields from transcription config", () => {
    const config = buildPluginTranscriptionConfig({
      provider: "faster-whisper",
      baseUrl: "https://api.example.test/v1",
      ytDlpArgs: "--exec attack",
      fasterWhisperBinary: "/tmp/attack",
      fasterWhisperModel: "medium",
      fasterWhisperDevice: "cuda"
    });

    expect(config).toMatchObject({
      provider: "faster-whisper",
      baseUrl: "https://api.example.test/v1",
      ytDlpArgs: "",
      fasterWhisperBinary: "",
      fasterWhisperModel: "medium",
      fasterWhisperDevice: "cuda"
    });
  });
});
