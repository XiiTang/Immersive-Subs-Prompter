export type YtDlpArgPolicy = "subtitle" | "transcription";

const DENIED_OPTIONS = new Set([
  "-o",
  "-P",
  "--output",
  "--paths",
  "--exec",
  "--exec-before-download",
  "--config-location",
  "--ignore-config",
  "--external-downloader",
  "--external-downloader-args",
  "--use-postprocessor",
  "--download-archive",
  "--write-info-json",
  "--write-description",
  "--write-thumbnail",
  "--cookies",
  "--cookies-from-browser"
]);

const SUBTITLE_FLAGS = new Set([
  "--skip-download",
  "--write-subs",
  "--write-auto-subs",
  "--all-subs",
  "--no-playlist"
]);

const SUBTITLE_VALUE_OPTIONS = new Set([
  "--sub-lang",
  "--sub-format",
  "--convert-subs"
]);

const TRANSCRIPTION_FLAGS = new Set([
  "--extract-audio",
  "--no-playlist"
]);

const TRANSCRIPTION_VALUE_OPTIONS = new Set([
  "--audio-format",
  "--audio-quality",
  "--postprocessor-args"
]);

const TRANSCRIPTION_AUDIO_FORMATS = new Set(["wav", "mp3", "m4a", "aac", "webm", "flac", "opus", "ogg"]);
const SUBTITLE_CONVERT_FORMATS = new Set(["srt", "vtt"]);
const PRODUCT_POSTPROCESSOR_ARGS = "-ac 1 -ar 16000";

export function parseYtDlpArgs(input: string, policy: YtDlpArgPolicy, context: string): string[] {
  const args = splitArgs(input);
  validateYtDlpArgs(args, policy, context);
  return args;
}

export function validateYtDlpArgLine(input: string, policy: YtDlpArgPolicy, context: string): void {
  parseYtDlpArgs(input, policy, context);
}

function validateYtDlpArgs(args: string[], policy: YtDlpArgPolicy, context: string): void {
  for (let index = 0; index < args.length; index += 1) {
    const token = args[index]!;
    if (!token.startsWith("-")) {
      throw new Error(`${context} cannot include positional yt-dlp argument`);
    }

    const parsed = parseOptionToken(token);
    const option = parsed.option;
    if (DENIED_OPTIONS.has(option)) {
      throw new Error(`${context} cannot use yt-dlp option ${option}`);
    }

    if (isFlagAllowed(option, policy)) {
      if (parsed.value !== null) {
        throw new Error(`${context} cannot pass a value to yt-dlp option ${option}`);
      }
      continue;
    }

    if (!isValueOptionAllowed(option, policy)) {
      throw new Error(`${context} cannot use unrecognized yt-dlp option ${option}`);
    }

    const value = parsed.value ?? args[index + 1];
    if (value === undefined) {
      throw new Error(`${context} must provide a value for yt-dlp option ${option}`);
    }
    if (parsed.value === null) {
      index += 1;
    }
    validateOptionValue(option, value, policy, context);
  }
}

function parseOptionToken(token: string): { option: string; value: string | null } {
  if (!token.startsWith("--")) {
    return { option: token, value: null };
  }
  const separator = token.indexOf("=");
  if (separator < 0) {
    return { option: token, value: null };
  }
  return {
    option: token.slice(0, separator),
    value: token.slice(separator + 1)
  };
}

function isFlagAllowed(option: string, policy: YtDlpArgPolicy): boolean {
  return policy === "subtitle" ? SUBTITLE_FLAGS.has(option) : TRANSCRIPTION_FLAGS.has(option);
}

function isValueOptionAllowed(option: string, policy: YtDlpArgPolicy): boolean {
  return policy === "subtitle" ? SUBTITLE_VALUE_OPTIONS.has(option) : TRANSCRIPTION_VALUE_OPTIONS.has(option);
}

function validateOptionValue(option: string, value: string, policy: YtDlpArgPolicy, context: string): void {
  if (!value) {
    throw new Error(`${context} must provide a non-empty value for yt-dlp option ${option}`);
  }
  if (value.startsWith("-") && option !== "--postprocessor-args") {
    throw new Error(`${context} must provide a value for yt-dlp option ${option}`);
  }
  if (policy === "subtitle" && option === "--convert-subs" && !SUBTITLE_CONVERT_FORMATS.has(value)) {
    throw new Error(`${context} cannot convert subtitles to unsupported format ${value}`);
  }
  if (policy === "transcription" && option === "--audio-format" && !TRANSCRIPTION_AUDIO_FORMATS.has(value)) {
    throw new Error(`${context} cannot use unsupported audio format ${value}`);
  }
  if (policy === "transcription" && option === "--postprocessor-args" && value !== PRODUCT_POSTPROCESSOR_ARGS) {
    throw new Error(`${context} cannot use custom postprocessor arguments`);
  }
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
    } else if (char === "\"" || char === "'") {
      quote = char;
    } else if (/\s/.test(char ?? "")) {
      if (current) {
        result.push(current);
        current = "";
      }
    } else if (char === "\\" && input[i + 1]) {
      current += input[i + 1];
      i += 1;
    } else {
      current += char;
    }
  }

  if (current) {
    result.push(current);
  }
  return result;
}
