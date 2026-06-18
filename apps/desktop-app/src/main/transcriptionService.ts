import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { tmpdir } from "os";
import {
  CommandExecutionError,
  formatCommandError,
  formatCommandLine,
  runCommand,
} from "./subtitleService.js";
import { parseSubtitle } from "./subtitleParser.js";
import { createLogger } from "./logger.js";
import { DEFAULT_TRANSCRIPTION_YTDLP_ARGS } from "../common/transcriptionDefaults.js";
import { SubtitleTrack, TranscriptionConfig } from "./types.js";
import { assertHttpUrl, assertPublicHttpUrl } from "./networkUrlSafety.js";
import { parseYtDlpArgs } from "./ytDlpArgPolicy.js";
import { MAX_SUBTITLE_TEXT_BYTES } from "./resourceLimits.js";

const AUDIO_EXTENSIONS = ["mp3", "m4a", "aac", "webm", "wav", "flac", "opus", "ogg"];

type BinaryResolver = () => Promise<string>;

export class TranscriptionService {
  private readonly log = createLogger("transcription-service");

  constructor(private readonly binaryResolver: BinaryResolver) { }

  async transcribe(videoUrl: string, config: TranscriptionConfig): Promise<SubtitleTrack> {
    const safeVideoUrl = assertPublicHttpUrl(videoUrl, "Transcription video URL");
    const ytDlpArgs = this.resolveYtDlpArgs(config);
    const workingDir = await fs.mkdtemp(path.join(tmpdir(), "usp-transcribe-"));
    const baseOutput = path.join(workingDir, randomUUID());
    const args = this.buildArgs(ytDlpArgs, safeVideoUrl, baseOutput);
    let commandLine = "";

    try {
      const binaryPath = await this.binaryResolver();
      commandLine = formatCommandLine(binaryPath, args);
      this.log.info(`Starting yt-dlp audio download for: ${safeVideoUrl}`);
      await runCommand(binaryPath, args, workingDir, "yt-dlp");
      this.log.info("Audio download completed");

      const audioFile = await this.pickAudioFile(workingDir);
      const provider = config.provider;

      if (provider === "faster-whisper") {
        this.log.info(`Running Faster-Whisper transcription (${config.fasterWhisperModel})`);
        const track = await this.submitToFasterWhisper(audioFile, config);
        this.log.info(`Transcription received with ${track.cues.length} cue(s)`);
        return track;
      }

      this.log.info(`Sending audio to Whisper API (${config.model})`);
      const track = await this.submitToWhisperApi(audioFile, config);
      this.log.info(`Transcription received with ${track.cues.length} cue(s)`);
      return track;
    } catch (error) {
      if (error instanceof CommandExecutionError) {
        const detailed = formatCommandError(error, commandLine);
        this.log.error("yt-dlp command failed", detailed);
        throw new Error(detailed);
      }
      this.log.error("Transcription failed", error);
      throw error;
    } finally {
      await fs.rm(workingDir, { recursive: true, force: true });
    }
  }

  private resolveYtDlpArgs(config: Pick<TranscriptionConfig, "ytDlpArgs">): string[] {
    const customLine = config.ytDlpArgs.trim() || DEFAULT_TRANSCRIPTION_YTDLP_ARGS;
    return parseYtDlpArgs(customLine, "transcription", "Transcription yt-dlp args");
  }

  private buildArgs(ytDlpArgs: string[], videoUrl: string, baseOutput: string): string[] {
    return [...ytDlpArgs, "-o", baseOutput, videoUrl];
  }

  private resolveFasterWhisperBinary(
    config: Pick<TranscriptionConfig, "fasterWhisperBinary">
  ): string {
    return config.fasterWhisperBinary.trim();
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

  private async submitToWhisperApi(audioPath: string, config: TranscriptionConfig): Promise<SubtitleTrack> {
    if (!config.baseUrl) {
      throw new Error("Whisper API base URL is not set.");
    }

    const endpoint = buildTranscriptionUrl(assertHttpUrl(config.baseUrl, "Whisper API base URL"));
    const audioBuffer = await fs.readFile(audioPath);
    const form = new FormData();
    const fileName = path.basename(audioPath);

    form.append("file", new Blob([audioBuffer]), fileName);
    const model = config.model.trim();
    if (!model) {
      throw new Error("Whisper API model is not set.");
    }
    form.append("model", model);

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

    const extraParams = config.extraParams;
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
    const sourceFile = this.composeSourceFileName(audioPath, config);

    if (contentType.includes("application/json")) {
      const data = await response.json();
      return this.buildTrackFromJson(data, sourceFile);
    }

    const text = await response.text();
    return this.buildTrackFromText(text, sourceFile);
  }

  private async submitToFasterWhisper(audioPath: string, config: TranscriptionConfig): Promise<SubtitleTrack> {
    const binary = this.resolveFasterWhisperBinary(config);
    const model = config.fasterWhisperModel.trim();
    if (!binary) {
      throw new Error("Faster-Whisper executable is not set.");
    }
    if (!model) {
      throw new Error("Faster-Whisper model is not set.");
    }

    const args = this.buildFasterWhisperArgs(audioPath, config, model);
    const commandLine = formatCommandLine(binary, args);

    this.log.info(`Faster-Whisper command: ${commandLine}`);
    try {
      await runCommand(binary, args, path.dirname(audioPath), path.basename(binary));
    } catch (error) {
      if (error instanceof CommandExecutionError) {
        const detailed = formatCommandError(error, commandLine);
        throw new Error(detailed);
      }
      throw error;
    }

    const { content, path: subtitlePath } = await this.readFasterWhisperOutput(audioPath);
    const sourceFile = this.composeSourceFileName(audioPath, config, model);
    const cues = parseSubtitle(content, "srt");
    if (!cues.length) {
      throw new Error(`Unable to parse subtitles generated by Faster-Whisper (${subtitlePath}).`);
    }

    this.log.info(`Faster-Whisper produced ${cues.length} cue(s) from ${subtitlePath}`);
    return {
      id: randomUUID(),
      sourceFile,
      cues
    };
  }

  private buildFasterWhisperArgs(
    audioPath: string,
    config: TranscriptionConfig,
    model: string
  ): string[] {
    const args: string[] = ["-m", model, "--print_progress"];
    const modelDir = config.fasterWhisperModelDir.trim();
    if (modelDir) {
      args.push("--model_dir", modelDir);
    }

    const language = (config.language || "auto").trim() || "auto";
    const device = config.fasterWhisperDevice;
    args.push(
      audioPath,
      "-l",
      language,
      "-d",
      device,
      "--output_format",
      "srt",
      "-o",
      path.dirname(audioPath)
    );

    if (config.fasterWhisperVadFilter) {
      const threshold = config.fasterWhisperVadThreshold;
      args.push("--vad_filter", "true", "--vad_threshold", threshold.toFixed(2));
      const vadMethod = config.fasterWhisperVadMethod.trim();
      if (vadMethod) {
        args.push("--vad_method", vadMethod);
      }
    } else {
      args.push("--vad_filter", "false");
    }

    if (config.fasterWhisperUseKim2 && device === "cuda") {
      args.push("--ff_mdx_kim2");
    }

    args.push("--sentence");

    const prompt = config.prompt.trim();
    if (prompt) {
      args.push("--initial_prompt", prompt);
    }

    args.push("--beep_off");
    return args;
  }

  private async readFasterWhisperOutput(audioPath: string): Promise<{ path: string; content: string }> {
    const dir = path.dirname(audioPath);
    const parsed = path.parse(audioPath);
    const candidates = Array.from(
      new Set([
        path.join(dir, `${parsed.name}.srt`),
        `${audioPath}.srt`,
        path.join(dir, `${parsed.base}.srt`)
      ])
    );

    for (const candidate of candidates) {
      try {
        const fileStat = await fs.stat(candidate);
        if (fileStat.size > MAX_SUBTITLE_TEXT_BYTES) {
          throw new Error(`Subtitle file exceeds ${MAX_SUBTITLE_TEXT_BYTES} bytes.`);
        }
        const content = await fs.readFile(candidate, "utf-8");
        return { path: candidate, content };
      } catch (error) {
        const err = error as NodeJS.ErrnoException;
        if (err?.code !== "ENOENT") {
          throw error;
        }
      }
    }

    throw new Error("Faster-Whisper did not produce an SRT subtitle file.");
  }

  private composeSourceFileName(audioPath: string, config: TranscriptionConfig, modelOverride?: string): string {
    const baseFile = path.basename(audioPath);
    const providerName = config.name.trim();
    const modelName = (modelOverride === undefined
      ? config.provider === "faster-whisper"
        ? config.fasterWhisperModel
        : config.model
      : modelOverride).trim();
    const language = config.language.trim();
    const languageSegment = language ? language : "auto";
    return `${baseFile}.${providerName}.${modelName}.${languageSegment}`;
  }

  private buildTrackFromJson(payload: any, sourceFile: string): SubtitleTrack {
    const segments = Array.isArray(payload?.segments) ? payload.segments : [];
    const cues: SubtitleTrack["cues"] = [];
    for (const segment of segments) {
      const text = typeof segment?.text === "string" ? segment.text.trim() : "";
      if (!text) {
        continue;
      }
      const startSeconds = segment?.start;
      const endSeconds = segment?.end;
      if (!Number.isFinite(startSeconds) || !Number.isFinite(endSeconds) || endSeconds <= startSeconds) {
        throw new Error("Transcription service returned no timestamped segments.");
      }
      cues.push({
        start: Math.round(startSeconds * 1000),
        end: Math.round(endSeconds * 1000),
        text
      });
    }

    if (!cues.length) {
      throw new Error("Transcription service returned no timestamped segments.");
    }

    return {
      id: randomUUID(),
      sourceFile,
      cues
    };
  }

  private buildTrackFromText(content: string, sourceFile: string): SubtitleTrack {
    const trimmed = content.trim();
    if (!trimmed) {
      throw new Error("Empty subtitle content returned by transcription service.");
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
      throw new Error("Unable to parse subtitle content returned by transcription service.");
    }

    return {
      id: randomUUID(),
      sourceFile,
      cues
    };
  }
}

function buildTranscriptionUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/+$/, "");
  return `${trimmed}/audio/transcriptions`;
}
