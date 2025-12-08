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
      commandResult = await runCommand(binaryPath, args, workingDir, "yt-dlp");
      this.log.info("Audio download completed");

      const audioFile = await this.pickAudioFile(workingDir);
      const provider = config.provider === "faster-whisper" ? "faster-whisper" : "whisper-api";

      if (provider === "faster-whisper") {
        this.log.info(`Running Faster-Whisper transcription (${config.name || config.fasterWhisperModel})`);
        const track = await this.submitToFasterWhisper(audioFile, config);
        this.log.info(`Transcription received with ${track.cues.length} cue(s)`);
        return track;
      }

      this.log.info(`Sending audio to Whisper API (${config.name || config.model})`);
      const track = await this.submitToWhisperApi(audioFile, config);
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

  private async submitToWhisperApi(audioPath: string, config: TranscriptionConfig): Promise<SubtitleTrack> {
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
    const sourceFile = this.composeSourceFileName(audioPath, config);

    if (contentType.includes("application/json")) {
      const data = await response.json();
      return this.buildTrackFromJson(data, config, sourceFile);
    }

    const text = await response.text();
    return this.buildTrackFromText(text, config, sourceFile);
  }

  private async submitToFasterWhisper(audioPath: string, config: TranscriptionConfig): Promise<SubtitleTrack> {
    const binary =
      (config.fasterWhisperBinary || "").trim() ||
      (config.fasterWhisperDevice === "cuda" ? "faster-whisper-xxl" : "faster-whisper");
    const model = (config.fasterWhisperModel || "").trim();
    if (!binary) {
      throw new Error("Faster-Whisper executable is not set.");
    }
    if (!model) {
      throw new Error("Faster-Whisper model is not set.");
    }

    const args = this.buildFasterWhisperArgs(audioPath, config, model);
    const commandLine = formatCommandLine(binary, args);
    let commandResult: CommandResult | null = null;

    this.log.info(`Faster-Whisper command: ${commandLine}`);
    try {
      commandResult = await runCommand(binary, args, path.dirname(audioPath), path.basename(binary));
    } catch (error) {
      if (error instanceof CommandExecutionError) {
        const detailed = formatCommandError(error, commandLine, commandResult);
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
    const modelDir = (config.fasterWhisperModelDir || "").trim();
    if (modelDir) {
      args.push("--model_dir", modelDir);
    }

    const language = (config.language || "auto").trim() || "auto";
    const device = config.fasterWhisperDevice === "cuda" ? "cuda" : "cpu";
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
      const threshold = Number.isFinite(config.fasterWhisperVadThreshold)
        ? config.fasterWhisperVadThreshold
        : 0.5;
      args.push("--vad_filter", "true", "--vad_threshold", threshold.toFixed(2));
      const vadMethod = (config.fasterWhisperVadMethod || "").trim();
      if (vadMethod) {
        args.push("--vad_method", vadMethod);
      }
    } else {
      args.push("--vad_filter", "false");
    }

    if (config.fasterWhisperUseKim2 && device === "cuda") {
      args.push("--ff_mdx_kim2");
    }

    if (config.enableWordTimestamps) {
      args.push("--one_word", "1");
    } else {
      args.push("--sentence");
    }

    const prompt = (config.prompt || "").trim();
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
        const content = await fs.readFile(candidate, "utf-8");
        return { path: candidate, content };
      } catch (error) {
        const err = error as NodeJS.ErrnoException;
        if (err?.code && err.code !== "ENOENT") {
          throw error;
        }
      }
    }

    throw new Error("Faster-Whisper did not produce an SRT subtitle file.");
  }

  private composeSourceFileName(audioPath: string, config: TranscriptionConfig, modelOverride?: string): string {
    const baseFile = path.basename(audioPath);
    const providerName =
      (config.name || (config.provider === "faster-whisper" ? "Faster-Whisper" : "Whisper API")).trim() || "Transcription";
    const modelName =
      (modelOverride ||
        (config.provider === "faster-whisper" ? config.fasterWhisperModel : config.model) ||
        "model")
        .trim() || "model";
    const language = (config.language || "unknown").trim() || "unknown";
    return `${baseFile}.${providerName}.${modelName}.${language}`;
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
      throw new Error("Transcription service returned no segments.");
    }

    return {
      id: randomUUID(),
      sourceFile,
      cues
    };
  }

  private buildTrackFromText(content: string, config: TranscriptionConfig, sourceFile: string): SubtitleTrack {
    const trimmed = content?.trim() ?? "";
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
