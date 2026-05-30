import { describe, expect, it } from "vitest";
import { TranscriptionService } from "./transcriptionService.js";
import type { SubtitleTrack } from "./types.js";

describe("TranscriptionService", () => {
  it("rejects Whisper JSON without timestamped segments", () => {
    const service = new TranscriptionService(async () => "yt-dlp");
    const buildTrackFromJson = (service as unknown as {
      buildTrackFromJson(payload: unknown, sourceFile: string): SubtitleTrack;
    }).buildTrackFromJson.bind(service);

    expect(() =>
      buildTrackFromJson(
        {
          text: "plain transcript text"
        },
        "source.wav.Whisper API.whisper-1.unknown"
      )
    ).toThrow("timestamped segments");
  });

  it("rejects Whisper JSON segments without finite timestamps", () => {
    const service = new TranscriptionService(async () => "yt-dlp");
    const buildTrackFromJson = (service as unknown as {
      buildTrackFromJson(payload: unknown, sourceFile: string): SubtitleTrack;
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
        "source.wav.Whisper API.whisper-1.unknown"
      )
    ).toThrow("timestamped segments");
  });

  it("rejects Whisper JSON segments whose timestamps are not numbers", () => {
    const service = new TranscriptionService(async () => "yt-dlp");
    const buildTrackFromJson = (service as unknown as {
      buildTrackFromJson(payload: unknown, sourceFile: string): SubtitleTrack;
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
        "source.wav.Whisper API.whisper-1.unknown"
      )
    ).toThrow("timestamped segments");
  });
});
