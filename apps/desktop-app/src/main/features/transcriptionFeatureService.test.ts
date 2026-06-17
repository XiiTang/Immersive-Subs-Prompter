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
    ytDlpArgs: "--extract-audio --audio-format wav",
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

  it("rejects incomplete feature config instead of applying implicit defaults", () => {
    const { baseUrl: _baseUrl, ...missingBaseUrl } = createRuntimeConfig();

    expect(() => buildFeatureTranscriptionConfig(createFeatureSettings({ configs: [missingBaseUrl as never] }))).toThrow(
      "Transcription API base URL must be a string."
    );

    expect(() =>
      buildFeatureTranscriptionConfig(createFeatureSettings({
        configs: [createRuntimeConfig({ fasterWhisperVadThreshold: null as never })]
      }))
    ).toThrow("Transcription faster-whisper VAD threshold must be a finite number.");
  });

  it("rejects provider-specific empty values before runtime transcription", () => {
    expect(() =>
      buildFeatureTranscriptionConfig(createFeatureSettings({
        configs: [createRuntimeConfig({ baseUrl: "" })]
      }))
    ).toThrow("Transcription API base URL is required.");

    expect(() =>
      buildFeatureTranscriptionConfig(createFeatureSettings({
        configs: [createRuntimeConfig({ baseUrl: "ftp://api.example.test" })]
      }))
    ).toThrow("Transcription API base URL must be a valid HTTP(S) URL.");

    expect(() =>
      buildFeatureTranscriptionConfig(createFeatureSettings({
        configs: [createRuntimeConfig({ model: " " })]
      }))
    ).toThrow("Transcription model is required.");

    expect(() =>
      buildFeatureTranscriptionConfig(createFeatureSettings({
        configs: [createRuntimeConfig({ provider: "faster-whisper", fasterWhisperModel: "" })]
      }))
    ).toThrow("Transcription faster-whisper model is required.");

    expect(() =>
      buildFeatureTranscriptionConfig(createFeatureSettings({
        configs: [createRuntimeConfig({ provider: "faster-whisper", fasterWhisperBinary: "" })]
      }))
    ).toThrow("Transcription faster-whisper executable is required.");
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

  it("returns provider-specific config validation errors without starting side effects", async () => {
    const stateManager = createStateManager();
    const cacheManager = { get: vi.fn(), set: vi.fn() };
    const transcriptionService = { transcribe: vi.fn() };

    await expect(startFeatureTranscription({
      stateManager: stateManager as never,
      cacheManager: cacheManager as never,
      transcriptionService: transcriptionService as never,
      getSettings: () => createFeatureSettings({
        configs: [
          createRuntimeConfig({
            provider: "faster-whisper",
            fasterWhisperBinary: ""
          })
        ]
      })
    })).resolves.toEqual({
      ok: false,
      error: "Transcription faster-whisper executable is required."
    });
    expect(stateManager.setTranscriptionStatus).toHaveBeenCalledWith(
      "error",
      "Transcription faster-whisper executable is required.",
      "Speech Transcription"
    );
    expect(cacheManager.get).not.toHaveBeenCalled();
    expect(transcriptionService.transcribe).not.toHaveBeenCalled();
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
