import { describe, expect, it } from "vitest";
import { TranscriptionService } from "./transcriptionService.js";
import { createDefaultTranscriptionConfig } from "../common/transcriptionDefaults.js";
import type { SubtitleTrack, TranscriptionConfig } from "./types.js";

describe("TranscriptionService", () => {
  it("rejects Whisper JSON without timestamped segments", () => {
    const service = new TranscriptionService(async () => "yt-dlp");
    const buildTrackFromJson = (service as unknown as {
      buildTrackFromJson(payload: unknown, config: TranscriptionConfig, sourceFile: string): SubtitleTrack;
    }).buildTrackFromJson.bind(service);

    expect(() =>
      buildTrackFromJson(
        {
          text: "plain transcript text"
        },
        createDefaultTranscriptionConfig(),
        "source.wav.Whisper API.whisper-1.unknown"
      )
    ).toThrow("timestamped segments");
  });

  it("rejects Whisper JSON segments without finite timestamps", () => {
    const service = new TranscriptionService(async () => "yt-dlp");
    const buildTrackFromJson = (service as unknown as {
      buildTrackFromJson(payload: unknown, config: TranscriptionConfig, sourceFile: string): SubtitleTrack;
    }).buildTrackFromJson.bind(service);

    expect(() =>
      buildTrackFromJson(
        {
          segments: [
            {
              text: "segment without timestamps"
            }
          ]
        },
        createDefaultTranscriptionConfig(),
        "source.wav.Whisper API.whisper-1.unknown"
      )
    ).toThrow("timestamped segments");
  });

  it("rejects Whisper JSON segments whose timestamps are not numbers", () => {
    const service = new TranscriptionService(async () => "yt-dlp");
    const buildTrackFromJson = (service as unknown as {
      buildTrackFromJson(payload: unknown, config: TranscriptionConfig, sourceFile: string): SubtitleTrack;
    }).buildTrackFromJson.bind(service);

    expect(() =>
      buildTrackFromJson(
        {
          segments: [
            {
              start: null,
              end: 1,
              text: "coerced timestamp"
            }
          ]
        },
        createDefaultTranscriptionConfig(),
        "source.wav.Whisper API.whisper-1.unknown"
      )
    ).toThrow("timestamped segments");
  });
});
