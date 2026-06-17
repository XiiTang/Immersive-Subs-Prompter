import { promises as fsp } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { TranscriptionService } from "./transcriptionService.js";
import type { SubtitleTrack, TranscriptionConfig } from "./types.js";

function createConfig(overrides: Partial<TranscriptionConfig> = {}): TranscriptionConfig {
  return {
    id: "config-1",
    name: "Default",
    provider: "whisper-api",
    baseUrl: "https://api.openai.com/v1",
    apiKey: "api-key",
    model: "whisper-1",
    language: "",
    prompt: "",
    enableWordTimestamps: false,
    extraParams: {},
    ytDlpArgs: "--extract-audio --audio-format wav",
    fasterWhisperBinary: "faster-whisper",
    fasterWhisperModel: "base",
    fasterWhisperModelDir: "",
    fasterWhisperDevice: "cpu",
    fasterWhisperVadFilter: true,
    fasterWhisperVadThreshold: 0.5,
    fasterWhisperVadMethod: "",
    fasterWhisperUseKim2: false,
    ...overrides
  };
}

describe("TranscriptionService", () => {
  it("uses transcription config yt-dlp args when provided", () => {
    const service = new TranscriptionService(async () => "yt-dlp");
    const buildArgs = (service as unknown as {
      buildArgs(ytDlpArgs: string[], videoUrl: string, baseOutput: string): string[];
    }).buildArgs.bind(service);
    const resolveYtDlpArgs = (service as unknown as {
      resolveYtDlpArgs(config: { ytDlpArgs: string }): string[];
    }).resolveYtDlpArgs.bind(service);

    expect(buildArgs(
      resolveYtDlpArgs({ ytDlpArgs: "--extract-audio --audio-format mp3" }),
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

  it("rejects unsafe yt-dlp args before resolving or invoking yt-dlp", async () => {
    const binaryResolver = vi.fn(async () => {
      throw new Error("binary resolver reached");
    });
    const service = new TranscriptionService(binaryResolver);

    await expect(
      service.transcribe(
        "https://video.example.test/watch",
        createConfig({ ytDlpArgs: '--extract-audio --exec "sh -c whoami"' })
      )
    ).rejects.toThrow("Transcription yt-dlp args cannot use yt-dlp option --exec");
    expect(binaryResolver).not.toHaveBeenCalled();
  });

  it("rejects unsafe yt-dlp args without creating a temp working directory", async () => {
    const before = new Set((await fsp.readdir(os.tmpdir())).filter((name) => name.startsWith("usp-transcribe-")));
    const binaryResolver = vi.fn(async () => {
      throw new Error("binary resolver reached");
    });
    const service = new TranscriptionService(binaryResolver);

    try {
      await expect(
        service.transcribe(
          "https://video.example.test/watch",
          createConfig({ ytDlpArgs: '--extract-audio --config-location "/tmp/yt-dlp.conf"' })
        )
      ).rejects.toThrow("Transcription yt-dlp args cannot use yt-dlp option --config-location");

      const after = (await fsp.readdir(os.tmpdir())).filter((name) => name.startsWith("usp-transcribe-"));
      const created = after.filter((name) => !before.has(name));
      expect(created).toEqual([]);
      expect(binaryResolver).not.toHaveBeenCalled();
    } finally {
      const after = (await fsp.readdir(os.tmpdir())).filter((name) => name.startsWith("usp-transcribe-"));
      await Promise.all(
        after
          .filter((name) => !before.has(name))
          .map((name) => fsp.rm(path.join(os.tmpdir(), name), { recursive: true, force: true }))
      );
    }
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
