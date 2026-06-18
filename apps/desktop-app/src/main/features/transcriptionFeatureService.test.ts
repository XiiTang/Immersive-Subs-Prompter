import { describe, expect, it, vi } from "vitest";
import { buildFeatureTranscriptionConfig } from "./transcriptionFeatureConfig.js";
import { startFeatureTranscription } from "./transcriptionFeatureService.js";

function createRuntimeConfig(overrides: Partial<import("../types.js").TranscriptionConfig> = {}) {
  return {
    id: "config-a",
    name: "Config A",
    provider: "whisper-api" as const,
    baseUrl: "https://api.example.test",
    apiKey: "secret",
    model: "whisper-1",
    language: "en",
    prompt: "technical terms",
    enableWordTimestamps: true,
    extraParams: { temperature: "0" },
    ytDlpArgs: "--extract-audio --audio-format=wav",
    fasterWhisperBinary: "faster-whisper",
    fasterWhisperModel: "base",
    fasterWhisperModelDir: "",
    fasterWhisperDevice: "cpu" as const,
    fasterWhisperVadFilter: true,
    fasterWhisperVadThreshold: 0.5,
    fasterWhisperVadMethod: "",
    fasterWhisperUseKim2: false,
    ...overrides
  };
}

function createFeatureSettings(overrides: Partial<import("../types.js").TranscriptionFeatureSettings> = {}) {
  const config = createRuntimeConfig();
  return {
    enabled: true,
    activeConfigId: config.id,
    configs: [config],
    ...overrides
  };
}

function createStateManager(overrides: Record<string, unknown> = {}) {
  const state = {
    activeSource: "extension",
    videoUrl: "https://video.example.test/watch",
    ...overrides
  };
  return {
    getState: vi.fn(() => state),
    setTranscriptionStatus: vi.fn(),
    addOrReplaceSubtitleTrack: vi.fn(),
    updateState: vi.fn((updater: (draft: Record<string, unknown>) => void) => updater(state))
  };
}

describe("buildFeatureTranscriptionConfig", () => {
  it("builds a typed runtime config from feature settings", () => {
    expect(buildFeatureTranscriptionConfig(createFeatureSettings())).toMatchObject({
      id: "config-a",
      name: "Config A",
      provider: "whisper-api",
      extraParams: { temperature: "0" }
    });
  });

  it("resolves the active config by id", () => {
    const inactive = createRuntimeConfig({ id: "config-b", name: "Config B", model: "other-model" });
    expect(buildFeatureTranscriptionConfig({
      enabled: true,
      activeConfigId: "config-b",
      configs: [createRuntimeConfig(), inactive]
    })).toMatchObject({
      id: "config-b",
      name: "Config B",
      model: "other-model"
    });
  });

  it("rejects missing active transcription config", () => {
    expect(() =>
      buildFeatureTranscriptionConfig({
        enabled: true,
        activeConfigId: "missing",
        configs: [createRuntimeConfig()]
      })
    ).toThrow("Active transcription config is not available.");
  });

  it("rejects a missing active transcription config id instead of using the first config", () => {
    expect(() =>
      buildFeatureTranscriptionConfig({
        enabled: true,
        activeConfigId: null as never,
        configs: [createRuntimeConfig()]
      })
    ).toThrow("Active transcription config is not available.");
  });

  it("clones the active config without a second runtime schema validation layer", () => {
    const active = createRuntimeConfig({
      baseUrl: "http://localhost:8080/v1",
      extraParams: { temperature: "0" }
    });
    const result = buildFeatureTranscriptionConfig(createFeatureSettings({ configs: [active] }));

    expect(result).toEqual(active);
    expect(result).not.toBe(active);
    expect(result.extraParams).toEqual(active.extraParams);
    expect(result.extraParams).not.toBe(active.extraParams);
  });
});

describe("startFeatureTranscription", () => {
  it("rejects when the transcription feature is disabled", async () => {
    const stateManager = createStateManager();
    const result = await startFeatureTranscription({
      stateManager: stateManager as never,
      cacheManager: { get: vi.fn(), set: vi.fn() } as never,
      transcriptionService: { transcribe: vi.fn() } as never,
      getSettings: () => createFeatureSettings({ enabled: false })
    });

    expect(result).toEqual({ ok: false, error: "Speech Transcription feature is disabled." });
    expect(stateManager.setTranscriptionStatus).toHaveBeenCalledWith(
      "error",
      "Speech Transcription feature is disabled.",
      "Speech Transcription"
    );
  });

  it("passes the active config to the transcription service without duplicate settings validation", async () => {
    const stateManager = createStateManager();
    const cacheManager = { get: vi.fn().mockResolvedValue(null), set: vi.fn() };
    const transcriptionService = { transcribe: vi.fn().mockRejectedValue(new Error("service rejected config")) };
    const config = createRuntimeConfig({
      provider: "faster-whisper",
      fasterWhisperBinary: ""
    });

    await expect(startFeatureTranscription({
      stateManager: stateManager as never,
      cacheManager: cacheManager as never,
      transcriptionService: transcriptionService as never,
      getSettings: () => createFeatureSettings({
        configs: [config]
      })
    })).resolves.toEqual({
      ok: false,
      error: "service rejected config"
    });
    expect(stateManager.setTranscriptionStatus).toHaveBeenCalledWith(
      "error",
      "service rejected config",
      "Config A"
    );
    expect(cacheManager.get).toHaveBeenCalled();
    expect(transcriptionService.transcribe).toHaveBeenCalledWith(
      "https://video.example.test/watch",
      expect.objectContaining({ fasterWhisperBinary: "" })
    );
  });

  it("runs transcription and caches by fixed feature identity", async () => {
    const stateManager = createStateManager();
    const cacheManager = { get: vi.fn().mockResolvedValue(null), set: vi.fn().mockResolvedValue(undefined) };
    const track = { id: "track-1", sourceFile: "transcription", cues: [{ start: 0, end: 1000, text: "hello" }] };
    const transcriptionService = { transcribe: vi.fn().mockResolvedValue(track) };

    const result = await startFeatureTranscription({
      stateManager: stateManager as never,
      cacheManager: cacheManager as never,
      transcriptionService: transcriptionService as never,
      getSettings: () => createFeatureSettings({
        configs: [
          createRuntimeConfig({
            apiKey: "",
            language: "",
            prompt: "",
            enableWordTimestamps: false,
            extraParams: {}
          })
        ]
      })
    });

    expect(result).toEqual({ ok: true, trackId: "track-1" });
    expect(transcriptionService.transcribe).toHaveBeenCalledWith(
      "https://video.example.test/watch",
      expect.objectContaining({ id: "config-a" })
    );
    expect(cacheManager.set.mock.calls[0][2]).toEqual({ tracks: [track] });
    expect(cacheManager.set.mock.calls[0][3]).toMatch(/^feature-transcription:/);
  });
});
