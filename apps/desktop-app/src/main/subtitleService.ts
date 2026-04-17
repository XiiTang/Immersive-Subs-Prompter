import { spawn } from "child_process";
import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import * as iconv from "iconv-lite";
import { tmpdir } from "os";
import path from "path";
import { DEFAULT_PROFILE_SETTINGS, DEFAULT_YTDLP_ARGS } from "./settings/index.js";
import { parseSubtitle } from "./subtitleParser.js";
import { ProfileSettings, SubtitleLoadResult, SubtitleTrack } from "./types.js";
import { createLogger } from "./logger.js";
import { swallow } from "./errors.js";
import { SubtitleCacheManager } from "./subtitleCacheManager.js";

const SUBTITLE_EXTENSIONS = ["vtt", "srt"];

type BinaryResolver = () => Promise<string>;
type SettingsProvider = () => Pick<ProfileSettings, "ytDlpArgs">;

export class SubtitleService {
  private inflight = new Map<string, Promise<SubtitleLoadResult>>();
  private readonly log = createLogger("subtitle-service");

  constructor(
    private readonly binaryResolver: BinaryResolver = async () => "yt-dlp",
    private readonly settingsProvider: SettingsProvider = () => DEFAULT_PROFILE_SETTINGS,
    private readonly cacheManager?: SubtitleCacheManager
  ) {}

  async getSubtitles(videoUrl: string): Promise<SubtitleLoadResult> {
    // Check cache first
    if (this.cacheManager) {
      const cached = await this.cacheManager.get(videoUrl, "ytdlp");
      if (cached) {
        this.log.debug("Cache hit for:", videoUrl);
        return cached;
      }
    }

    const inProgress = this.inflight.get(videoUrl);
    if (inProgress) {
      return inProgress;
    }

    const job = this.downloadSubtitles(videoUrl);
    this.inflight.set(videoUrl, job);

    try {
      const result = await job;
      // Save to cache
      if (this.cacheManager) {
        await this.cacheManager.set(videoUrl, "ytdlp", result);
      }
      return result;
    } finally {
      this.inflight.delete(videoUrl);
    }
  }

  private async downloadSubtitles(videoUrl: string): Promise<SubtitleLoadResult> {
    const workingDir = await fs.mkdtemp(path.join(tmpdir(), "usp-"));
    const baseOutput = path.join(workingDir, randomUUID());
    const args = this.buildArgs(videoUrl, baseOutput);
    let binaryPath: string | null = null;
    let commandLine = "";
    let commandResult: CommandResult | null = null;

    try {
      binaryPath = await this.binaryResolver();
      this.log.info(`Starting yt-dlp for: ${videoUrl}`);
      if (binaryPath) {
        commandLine = formatCommandLine(binaryPath, args);
      }

      commandResult = await runCommand(binaryPath, args, workingDir, "yt-dlp");
      this.log.info("yt-dlp command completed successfully");
      
      const subtitleFiles = (await fs.readdir(workingDir))
        .filter((file) => SUBTITLE_EXTENSIONS.some((ext) => file.toLowerCase().endsWith(`.${ext}`)))
        .map((file) => path.join(workingDir, file));

      if (subtitleFiles.length === 0) {
        throw new Error("No subtitles were found. Please confirm if subtitles are provided for this video.");
      }

      this.log.info(`Found ${subtitleFiles.length} subtitle file(s)`);

      const tracks: SubtitleTrack[] = [];
      for (const filePath of subtitleFiles) {
        const content = await fs.readFile(filePath, "utf-8");
        const ext = path.extname(filePath).slice(1).toLowerCase();
        const cues = parseSubtitle(content, ext);
        if (!cues.length) continue;

        tracks.push({
          id: randomUUID(),
          sourceFile: path.basename(filePath),
          cues
        });
      }

      if (!tracks.length) {
        throw new Error("Failed to parse subtitle files or files are empty.");
      }

      this.log.info(`Successfully parsed ${tracks.length} subtitle track(s)`);

      return {
        tracks
      };
    } catch (error) {
      if (error instanceof CommandExecutionError) {
        this.log.error("yt-dlp command failed", {
          command: commandLine,
          exitCode: error.info.exitCode,
          stderr: error.info.stderr,
          stdout: error.info.stdout
        });
      } else {
        this.log.error("yt-dlp invocation failed", error);
      }
      const detailedMessage = formatCommandError(error, commandLine, commandResult);
      throw new Error(`[yt-dlp] ${detailedMessage}`);
    } finally {
      await fs.rm(workingDir, { recursive: true, force: true });
    }
  }

  private buildArgs(videoUrl: string, baseOutput: string): string[] {
    const settings = this.settingsProvider ? this.settingsProvider() : DEFAULT_PROFILE_SETTINGS;
    const customLine = settings?.ytDlpArgs?.trim() || DEFAULT_YTDLP_ARGS;
    const customArgs = splitArgs(customLine);
    return [
      ...customArgs,
      "-o",
      baseOutput,
      videoUrl
    ];
  }
}

export type CommandResult = {
  stdout: string;
  stderr: string;
};

type CommandErrorInfo = CommandResult & {
  exitCode: number | null;
  command: string;
  args: string[];
};

export class CommandExecutionError extends Error {
  info: CommandErrorInfo;
  constructor(message: string, info: CommandErrorInfo) {
    super(message);
    this.name = "CommandExecutionError";
    this.info = info;
  }
}

export async function runCommand(
  cmd: string,
  args: string[],
  cwd: string,
  displayName?: string
): Promise<CommandResult> {
  return new Promise<CommandResult>((resolve, reject) => {
    const name = displayName ?? cmd;
    const child = spawn(cmd, args, { cwd });
    const info: CommandErrorInfo = {
      command: cmd,
      args,
      exitCode: null,
      stdout: "",
      stderr: ""
    };

    // On Windows, yt-dlp output may be in GBK encoding
    // Try to decode with GBK first, fall back to UTF-8 if it fails
    const decodeBuffer = (chunk: Buffer): string => {
      if (process.platform === "win32") {
        try {
          return iconv.decode(chunk, "gbk");
        } catch (decodeError) {
          swallow(decodeError, "subtitle.decode.gbk", "falling back to UTF-8");
        }
      }
      return chunk.toString("utf8");
    };

    child.stdout?.on("data", (chunk: Buffer) => {
      info.stdout += decodeBuffer(chunk);
    });

    child.stderr?.on("data", (chunk: Buffer) => {
      info.stderr += decodeBuffer(chunk);
    });

    child.on("error", (err) => {
      const enoent = (err as NodeJS.ErrnoException).code === "ENOENT";
      const message = enoent
        ? `${name} executable not found. Please install ${name} and ensure it's in your PATH.`
        : err?.message || `${name} invocation failed.`;
      reject(new CommandExecutionError(message, info));
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout: info.stdout, stderr: info.stderr });
      } else {
        info.exitCode = code ?? null;
        reject(
          new CommandExecutionError(
            info.stderr || `${name} exited with code ${code}`,
            info
          )
        );
      }
    });
  });
}

export function splitArgs(input: string): string[] {
  const result: string[] = [];
  let current = "";
  let quote: string | null = null;

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    if (quote) {
      if (char === quote) {
        quote = null;
      } else if (char === "\\" && input[i + 1] === quote) {
        current += quote;
        i += 1;
      } else {
        current += char;
      }
      continue;
    }

    if (char === "\"" || char === "'") {
      quote = char;
      continue;
    }

    if (/\s/.test(char)) {
      if (current) {
        result.push(current);
        current = "";
      }
      continue;
    }

    current += char;
  }

  if (current) {
    result.push(current);
  }

  return result;
}

export function formatCommandLine(binary: string, args: string[]): string {
  return [binary, ...args]
    .map((part) => {
      if (/["\s]/.test(part)) {
        return `"${part.replace(/(["\\])/g, "\\$1")}"`;
      }
      return part;
    })
    .join(" ");
}

export function formatCommandError(
  error: unknown,
  commandLine: string,
  fallbackOutput?: CommandResult | null
): string {
  const baseMessage =
    error && typeof error === "object" && "message" in error
      ? (error as Error).message
      : "Unknown error";

  const info = error instanceof CommandExecutionError ? error.info : null;
  const output = info ?? fallbackOutput ?? null;
  const stdoutText = output?.stdout?.trim() ?? "";
  const stderrText = output?.stderr?.trim() ?? "";
  const parts = [baseMessage];

  if (commandLine) {
    parts.push(`Command: ${commandLine}`);
  }
  if (stdoutText) {
    parts.push(`Stdout:\n${stdoutText}`);
  }
  if (stderrText) {
    parts.push(`Stderr:\n${stderrText}`);
  }

  return parts.join("\n\n");
}
