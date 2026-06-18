export const MAX_SUBTITLE_TEXT_BYTES = 100 * 1024 * 1024;
export const MAX_SUBTITLE_LINE_COUNT = 1_000_000;
export const MAX_SUBTITLE_CUE_COUNT = 1_000_000;
export const MAX_PROCESS_STDOUT_BYTES = 8 * 1024 * 1024;
export const MAX_PROCESS_STDERR_BYTES = 8 * 1024 * 1024;

export interface SubtitleParserLimits {
  maxInputBytes: number;
  maxLineCount: number;
  maxCueCount: number;
}

export const DEFAULT_SUBTITLE_PARSER_LIMITS: SubtitleParserLimits = {
  maxInputBytes: MAX_SUBTITLE_TEXT_BYTES,
  maxLineCount: MAX_SUBTITLE_LINE_COUNT,
  maxCueCount: MAX_SUBTITLE_CUE_COUNT
};

export function utf8ByteLength(value: string): number {
  return Buffer.byteLength(value, "utf8");
}
