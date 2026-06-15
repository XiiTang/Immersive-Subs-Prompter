import { describe, expect, it, vi } from "vitest";
import { buildFeatureTranscriptionConfig } from "./transcriptionFeatureConfig.js";
import { startFeatureTranscription } from "./transcriptionFeatureService.js";

function createFeatureConfig() {
  return {
    provider: "whisper-api" as const,
    baseUrl: "https://api.example.test",
    apiKey: "secret",
    model: "whisper-1",
    language: "en",
    prompt: "technical terms",
    enableWordTimestamps: true,
    extraParamsJson: "{\"temperature\":\"0\"}",
    fasterWhisperModel: "base",
    fasterWhisperModelDir: "",
    fasterWhisperDevice: "cpu" as const,
    fasterWhisperVadFilter: true,
    fasterWhisperVadThreshold: 0.5,
    fasterWhisperVadMethod: "",
    fasterWhisperUseKim2: false
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
    expect(buildFeatureTranscriptionConfig(createFeatureConfig())).toMatchObject({
      id: "feature-transcription",
      name: "Speech Transcription",
      provider: "whisper-api",
      extraParams: { temperature: "0" }
    });
  });

  it("rejects invalid extra params JSON", () => {
    expect(() =>
      buildFeatureTranscriptionConfig({
        ...createFeatureConfig(),
        extraParamsJson: "{"
      })
    ).toThrow("Transcription extra params must be valid JSON");
  });

  it("rejects incomplete feature config instead of applying implicit defaults", () => {
    const { baseUrl: _baseUrl, ...missingBaseUrl } = createFeatureConfig();

    expect(() => buildFeatureTranscriptionConfig(missingBaseUrl as never)).toThrow(
      "Transcription API base URL must be a string."
    );

    expect(() =>
      buildFeatureTranscriptionConfig({
        ...createFeatureConfig(),
        fasterWhisperVadThreshold: null
      } as never)
    ).toThrow("Transcription faster-whisper VAD threshold must be a finite number.");
  });

  it("rejects provider-specific empty values before runtime transcription", () => {
    expect(() =>
      buildFeatureTranscriptionConfig({
        ...createFeatureConfig(),
        baseUrl: ""
      })
    ).toThrow("Transcription API base URL is required.");

    expect(() =>
      buildFeatureTranscriptionConfig({
        ...createFeatureConfig(),
        baseUrl: "ftp://api.example.test"
      })
    ).toThrow("Transcription API base URL must be a valid HTTP(S) URL.");

    expect(() =>
      buildFeatureTranscriptionConfig({
        ...createFeatureConfig(),
        model: " "
      })
    ).toThrow("Transcription model is required.");

    expect(() =>
      buildFeatureTranscriptionConfig({
        ...createFeatureConfig(),
        provider: "faster-whisper",
        fasterWhisperModel: ""
      })
    ).toThrow("Transcription faster-whisper model is required.");
  });
});

describe("startFeatureTranscription", () => {
  it("rejects when the transcription feature is disabled", async () => {
    const stateManager = createStateManager();
    const result = await startFeatureTranscription({
      stateManager: stateManager as never,
      cacheManager: { get: vi.fn(), set: vi.fn() } as never,
      transcriptionService: { transcribe: vi.fn() } as never,
      getSettings: () => ({ enabled: false, config: createFeatureConfig() })
    });

    expect(result).toEqual({ ok: false, error: "Speech Transcription feature is disabled." });
    expect(stateManager.setTranscriptionStatus).toHaveBeenCalledWith(
      "error",
      "Speech Transcription feature is disabled.",
      "Speech Transcription"
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
      getSettings: () => ({
        enabled: true,
        config: {
          ...createFeatureConfig(),
          apiKey: "",
          language: "",
          prompt: "",
          enableWordTimestamps: false,
          extraParamsJson: "{}"
        }
      })
    });

    expect(result).toEqual({ ok: true, trackId: "track-1" });
    expect(transcriptionService.transcribe).toHaveBeenCalledWith(
      "https://video.example.test/watch",
      expect.objectContaining({ id: "feature-transcription" })
    );
    expect(cacheManager.set.mock.calls[0][2]).toEqual({ tracks: [track] });
    expect(cacheManager.set.mock.calls[0][3]).toMatch(/^feature-transcription:/);
  });
});
