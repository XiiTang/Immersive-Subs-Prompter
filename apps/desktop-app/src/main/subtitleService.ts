import { spawn } from "child_process";
import { createHash, randomUUID } from "crypto";
import { promises as fs } from "fs";
import * as iconv from "iconv-lite";
import { tmpdir } from "os";
import path from "path";
import { DEFAULT_PROFILE_SETTINGS } from "../common/defaultSettings.js";
import { parseSubtitle } from "./subtitleParser.js";
import { ProfileSettings, SubtitleLoadResult, SubtitleTrack } from "./types.js";
import { createLogger } from "./logger.js";
import { SubtitleCacheManager } from "./subtitleCacheManager.js";
import { assertPublicHttpUrl } from "./networkUrlSafety.js";
import { parseYtDlpArgs } from "./ytDlpArgPolicy.js";
import {
  MAX_PROCESS_STDERR_BYTES,
  MAX_PROCESS_STDOUT_BYTES,
  MAX_SUBTITLE_TEXT_BYTES
} from "./resourceLimits.js";

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
    const safeVideoUrl = assertPublicHttpUrl(videoUrl, "Subtitle video URL");
    const ytDlpArgs = this.resolveYtDlpArgs();
    const cacheVariant = createYtDlpArgsVariant(ytDlpArgs);
    const inflightKey = `${cacheVariant}:${safeVideoUrl}`;

    // Check cache first
    if (this.cacheManager) {
      const cached = await this.cacheManager.get(safeVideoUrl, "ytdlp", cacheVariant);
      if (cached) {
        this.log.debug("Cache hit for:", safeVideoUrl);
        return cached;
      }
    }

    const inProgress = this.inflight.get(inflightKey);
    if (inProgress) {
      return inProgress;
    }

    const job = this.downloadSubtitles(safeVideoUrl, ytDlpArgs);
    this.inflight.set(inflightKey, job);

    try {
      const result = await job;
      // Save to cache
      if (this.cacheManager) {
        await this.cacheManager.set(safeVideoUrl, "ytdlp", result, cacheVariant);
      }
      return result;
    } finally {
      this.inflight.delete(inflightKey);
    }
  }

  private async downloadSubtitles(videoUrl: string, ytDlpArgs: string[]): Promise<SubtitleLoadResult> {
    const workingDir = await fs.mkdtemp(path.join(tmpdir(), "usp-"));
    const baseOutput = path.join(workingDir, randomUUID());
    const args = this.buildArgs(videoUrl, baseOutput, ytDlpArgs);
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
        const content = await readSubtitleTextFile(filePath);
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

  private resolveYtDlpArgs(): string[] {
    const customLine = this.settingsProvider().ytDlpArgs.trim();
    if (!customLine) {
      throw new Error("Subtitle yt-dlp args must be non-empty");
    }
    return parseYtDlpArgs(customLine, "subtitle", "Subtitle yt-dlp args");
  }

  private buildArgs(videoUrl: string, baseOutput: string, ytDlpArgs: string[]): string[] {
    return [
      ...ytDlpArgs,
      "-o",
      baseOutput,
      videoUrl
    ];
  }
}

function createYtDlpArgsVariant(args: string[]): string {
  return createHash("sha256").update(JSON.stringify(args)).digest("hex");
}

async function readSubtitleTextFile(filePath: string): Promise<string> {
  const fileStat = await fs.stat(filePath);
  if (fileStat.size > MAX_SUBTITLE_TEXT_BYTES) {
    throw new Error(`Subtitle file exceeds ${MAX_SUBTITLE_TEXT_BYTES} bytes.`);
  }
  return fs.readFile(filePath, "utf-8");
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

    const decodeBuffer = (chunk: Buffer): string => {
      if (process.platform === "win32") {
        return iconv.decode(chunk, "gbk");
      }
      return chunk.toString("utf8");
    };

    let stdoutBytes = 0;
    let stderrBytes = 0;
    let limitError: CommandExecutionError | null = null;

    const failForOutputLimit = (streamName: "stdout" | "stderr", limit: number): void => {
      if (limitError) {
        return;
      }
      limitError = new CommandExecutionError(`${name} ${streamName} exceeded ${limit} bytes.`, info);
      child.kill();
    };

    child.stdout?.on("data", (chunk: Buffer) => {
      stdoutBytes += chunk.length;
      if (stdoutBytes > MAX_PROCESS_STDOUT_BYTES) {
        failForOutputLimit("stdout", MAX_PROCESS_STDOUT_BYTES);
        return;
      }
      info.stdout += decodeBuffer(chunk);
    });

    child.stderr?.on("data", (chunk: Buffer) => {
      stderrBytes += chunk.length;
      if (stderrBytes > MAX_PROCESS_STDERR_BYTES) {
        failForOutputLimit("stderr", MAX_PROCESS_STDERR_BYTES);
        return;
      }
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
      if (limitError) {
        reject(limitError);
        return;
      }
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
