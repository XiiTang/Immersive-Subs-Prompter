import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { tmpdir } from "os";
import {
  CommandExecutionError,
  CommandResult,
  formatCommandError,
  formatCommandLine,
  runCommand,
  splitArgs
} from "./subtitleService.js";
import { parseSubtitle } from "./subtitleParser.js";
import { createLogger } from "./logger.js";
import { DEFAULT_TRANSCRIPTION_YTDLP_ARGS } from "./settings.js";
import { SubtitleTrack, TranscriptionConfig } from "./types.js";

const AUDIO_EXTENSIONS = ["mp3", "m4a", "aac", "webm", "wav", "flac", "opus", "ogg"];

type BinaryResolver = () => Promise<string>;

export class TranscriptionService {
  private readonly log = createLogger("transcription-service");

  constructor(private readonly binaryResolver: BinaryResolver) { }

  async transcribe(videoUrl: string, config: TranscriptionConfig): Promise<SubtitleTrack> {
    const workingDir = await fs.mkdtemp(path.join(tmpdir(), "usp-transcribe-"));
    const baseOutput = path.join(workingDir, randomUUID());
    const args = this.buildArgs(config, videoUrl, baseOutput);
    let commandLine = "";
    let commandResult: CommandResult | null = null;

    try {
      const binaryPath = await this.binaryResolver();
      commandLine = formatCommandLine(binaryPath, args);
      this.log.info(`Starting yt-dlp audio download for: ${videoUrl}`);
      commandResult = await runCommand(binaryPath, args, workingDir);
      this.log.info("Audio download completed");

      const audioFile = await this.pickAudioFile(workingDir);
      this.log.info(`Sending audio to Whisper API (${config.name || config.model})`);

      const track = await this.submitToWhisper(audioFile, config);
      this.log.info(`Transcription received with ${track.cues.length} cue(s)`);
      return track;
    } catch (error) {
      if (error instanceof CommandExecutionError) {
        const detailed = formatCommandError(error, commandLine, commandResult);
        this.log.error("yt-dlp command failed", detailed);
        throw new Error(detailed);
      }
      this.log.error("Transcription failed", error);
      throw error;
    } finally {
      await fs.rm(workingDir, { recursive: true, force: true });
    }
  }

  private buildArgs(config: TranscriptionConfig, videoUrl: string, baseOutput: string): string[] {
    const customLine = config.ytDlpArgs?.trim() || DEFAULT_TRANSCRIPTION_YTDLP_ARGS;
    const args = splitArgs(customLine);
    return [...args, "-o", baseOutput, videoUrl];
  }

  private async pickAudioFile(workingDir: string): Promise<string> {
    const files = await fs.readdir(workingDir);
    const candidates = await Promise.all(
      files.map(async (name) => {
        const fullPath = path.join(workingDir, name);
        const stats = await fs.stat(fullPath);
        return { name, fullPath, stats };
      })
    );

    const audioFiles = candidates.filter(
      (entry) => entry.stats.isFile() && AUDIO_EXTENSIONS.some((ext) => entry.name.toLowerCase().endsWith(`.${ext}`))
    );

    if (!audioFiles.length) {
      throw new Error("No audio file was downloaded by yt-dlp.");
    }

    audioFiles.sort((a, b) => b.stats.mtimeMs - a.stats.mtimeMs);
    return audioFiles[0].fullPath;
  }

  private async submitToWhisper(audioPath: string, config: TranscriptionConfig): Promise<SubtitleTrack> {
    if (!config.baseUrl) {
      throw new Error("Whisper API base URL is not set.");
    }

    const endpoint = buildTranscriptionUrl(config.baseUrl);
    const audioBuffer = await fs.readFile(audioPath);
    const form = new FormData();
    const fileName = path.basename(audioPath);

    form.append("file", new Blob([audioBuffer]), fileName);
    form.append("model", config.model || "whisper-1");

    if (config.prompt) {
      form.append("prompt", config.prompt);
    }
    if (config.language) {
      form.append("language", config.language);
    }
    if (config.enableWordTimestamps) {
      form.append("timestamp_granularities[]", "word");
      form.append("timestamp_granularities[]", "segment");
    }

    const extraParams = config.extraParams ?? {};
    const hasCustomResponseFormat = "response_format" in extraParams;
    for (const [key, value] of Object.entries(extraParams)) {
      if (value === undefined || value === null) {
        continue;
      }
      form.append(key, String(value));
    }
    if (!hasCustomResponseFormat) {
      form.append("response_format", "verbose_json");
    }

    const headers: Record<string, string> = {};
    if (config.apiKey) {
      headers.Authorization = `Bearer ${config.apiKey}`;
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: form
    });

    if (!response.ok) {
      const bodyText = await response.text().catch(() => "");
      throw new Error(
        `Whisper API request failed: ${response.status} ${response.statusText}${bodyText ? ` - ${bodyText}` : ""
        }`
      );
    }

    const contentType = response.headers.get("content-type") ?? "";

    if (contentType.includes("application/json")) {
      const data = await response.json();
      return this.buildTrackFromJson(data, config, fileName);
    }

    const text = await response.text();
    return this.buildTrackFromText(text, config, fileName);
  }

  private buildTrackFromJson(payload: any, config: TranscriptionConfig, sourceFile: string): SubtitleTrack {
    const segments = Array.isArray(payload?.segments) ? payload.segments : [];
    const cues =
      segments.length > 0
        ? segments
          .map((segment: any) => ({
            start: Math.round(Number(segment.start || 0) * 1000),
            end: Math.round(Number(segment.end || 0) * 1000),
            text: typeof segment.text === "string" ? segment.text.trim() : ""
          }))
          .filter((entry: any) => entry.text.length > 0)
        : [];

    if (!cues.length && typeof payload?.text === "string" && payload.text.trim()) {
      cues.push({
        start: 0,
        end: Math.max(1000, payload.text.trim().length * 20),
        text: payload.text.trim()
      });
    }

    if (!cues.length) {
      throw new Error("Whisper API returned no segments.");
    }

    const language =
      (typeof payload?.language === "string" && payload.language.trim()) || config.language || "unknown";

    return {
      id: randomUUID(),
      language,
      sourceFile,
      cues
    };
  }

  private buildTrackFromText(content: string, config: TranscriptionConfig, sourceFile: string): SubtitleTrack {
    const trimmed = content?.trim() ?? "";
    if (!trimmed) {
      throw new Error("Empty subtitle content returned by Whisper API.");
    }

    const attempts = ["vtt", "srt"] as const;
    let cues: SubtitleTrack["cues"] = [];
    for (const ext of attempts) {
      cues = parseSubtitle(trimmed, ext);
      if (cues.length) {
        break;
      }
    }

    if (!cues.length) {
      throw new Error("Unable to parse subtitle content returned by Whisper API.");
    }

    const language = config.language || "unknown";

    return {
      id: randomUUID(),
      language,
      sourceFile,
      cues
    };
  }
}

function buildTranscriptionUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/+$/, "");
  return `${trimmed}/audio/transcriptions`;
}
