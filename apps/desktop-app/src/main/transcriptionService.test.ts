import { describe, expect, it } from "vitest";
import { TranscriptionService } from "./transcriptionService.js";
import type { SubtitleTrack } from "./types.js";

describe("TranscriptionService", () => {
  it("uses transcription config yt-dlp args when provided", () => {
    const service = new TranscriptionService(async () => "yt-dlp");
    const buildArgs = (service as unknown as {
      buildArgs(config: { ytDlpArgs: string }, videoUrl: string, baseOutput: string): string[];
    }).buildArgs.bind(service);

    expect(buildArgs(
      { ytDlpArgs: "--extract-audio --audio-format mp3" },
      "https://video.example.test/watch",
      "/tmp/out"
    )).toEqual([
      "--extract-audio",
      "--audio-format",
      "mp3",
      "-o",
      "/tmp/out",
      "https://video.example.test/watch"
    ]);
  });

  it("uses configured Faster-Whisper executable path", () => {
    const service = new TranscriptionService(async () => "yt-dlp");
    const resolveFasterWhisperBinary = (service as unknown as {
      resolveFasterWhisperBinary(config: { fasterWhisperBinary: string }): string;
    }).resolveFasterWhisperBinary.bind(service);

    expect(resolveFasterWhisperBinary({
      fasterWhisperBinary: "/app/bin/faster-whisper"
    })).toBe("/app/bin/faster-whisper");
  });

  it("does not invent a Faster-Whisper executable path", () => {
    const service = new TranscriptionService(async () => "yt-dlp");
    const resolveFasterWhisperBinary = (service as unknown as {
      resolveFasterWhisperBinary(config: { fasterWhisperBinary: string }): string;
    }).resolveFasterWhisperBinary.bind(service);

    expect(resolveFasterWhisperBinary({
      fasterWhisperBinary: " "
    })).toBe("");
  });

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
