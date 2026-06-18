import { SubtitleCue } from "./types.js";
import {
  DEFAULT_SUBTITLE_PARSER_LIMITS,
  type SubtitleParserLimits,
  utf8ByteLength
} from "./resourceLimits.js";

type RawVttCue = {
  start: number;
  end: number;
  lines: string[];
};

const VTT_TIMESTAMP_TAG = /<\d{2}:\d{2}:\d{2}\.\d{3}>/;
const VTT_CLASS_TAG = /<c(?:\.[^>]*)?>/i;
const YOUTUBE_SHORT_CUE_THRESHOLD = 150;

function sanitizeCueText(text: string): string {
  return text
    .replace(/<\/?[bi]>/gi, '')
    .replace(/<\/?u>/gi, '')
    .replace(/<\/?font[^>]*>/gi, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .trim();
}

export function parseSubtitle(
  content: string,
  extension: string,
  limits: SubtitleParserLimits = DEFAULT_SUBTITLE_PARSER_LIMITS
): SubtitleCue[] {
  assertParserInputWithinLimits(content, limits);
  const normalized = content.replace(/\ufeff/g, '');
  const normalizedExtension = extension.toLowerCase();

  if (normalizedExtension === "srt") {
    return parseSrt(normalized, limits);
  }
  if (normalizedExtension === "vtt") {
    return parseVtt(normalized, limits);
  }
  throw new Error(`Unsupported subtitle extension: ${extension}`);
}

function assertParserInputWithinLimits(content: string, limits: SubtitleParserLimits): void {
  const byteLength = utf8ByteLength(content);
  if (byteLength > limits.maxInputBytes) {
    throw new Error(`Subtitle parser input exceeds ${limits.maxInputBytes} bytes.`);
  }
  const lineCount = countLines(content);
  if (lineCount > limits.maxLineCount) {
    throw new Error(`Subtitle parser input exceeds ${limits.maxLineCount} lines.`);
  }
}

function countLines(content: string): number {
  if (!content.length) {
    return 0;
  }
  let count = 1;
  for (let index = 0; index < content.length; index += 1) {
    if (content.charCodeAt(index) === 10) {
      count += 1;
    }
  }
  return count;
}

function pushCue(cues: SubtitleCue[], cue: SubtitleCue, limits: SubtitleParserLimits): void {
  if (cues.length >= limits.maxCueCount) {
    throw new Error(`Subtitle parser cue count exceeds ${limits.maxCueCount}.`);
  }
  cues.push(cue);
}

function parseVtt(content: string, limits: SubtitleParserLimits): SubtitleCue[] {
  const rawCues = readRawVttCues(content);
  if (!rawCues.length) {
    return [];
  }

  if (isYoutubeWordLevelVtt(rawCues)) {
    return collapseYoutubeWordLevelCues(rawCues, limits);
  }

  const cues: SubtitleCue[] = [];
  for (const cue of rawCues) {
    const text = formatCueText(cue.lines);
    if (!text) continue;
    pushCue(cues, { start: cue.start, end: cue.end, text }, limits);
  }
  return cues;
}

function readRawVttCues(content: string): RawVttCue[] {
  const lines = content.replace(/\r/g, "").split("\n");
  const cues: RawVttCue[] = [];
  let i = 0;

  while (i < lines.length) {
    const trimmed = lines[i].trim();
    if (!trimmed || trimmed.startsWith("WEBVTT") || trimmed.startsWith("NOTE")) {
      i += 1;
      continue;
    }

    if (trimmed.includes("-->")) {
      const [startRaw, endRaw] = trimmed.split("-->");
      const start = parseTimestamp(startRaw.trim());
      const end = parseTimestamp(endRaw.trim());
      i += 1;

      const textLines: string[] = [];
      while (i < lines.length && lines[i].trim() !== "") {
        textLines.push(lines[i]);
        i += 1;
      }

      if (!Number.isNaN(start) && !Number.isNaN(end)) {
        cues.push({ start, end, lines: textLines });
      }

      while (i < lines.length && lines[i].trim() === "") {
        i += 1;
      }
      continue;
    }

    i += 1;
  }

  return cues;
}

function isYoutubeWordLevelVtt(cues: RawVttCue[]): boolean {
  if (cues.length < 10) {
    return false;
  }

  const shortIndices: number[] = [];
  for (let i = 0; i < cues.length; i += 1) {
    if (cueDuration(cues[i]) <= YOUTUBE_SHORT_CUE_THRESHOLD) {
      shortIndices.push(i);
    }
  }

  if (!shortIndices.length) {
    return false;
  }

  const shortRatio = shortIndices.length / cues.length;
  if (shortRatio < 0.35) {
    return false;
  }

  const pairedShortCount = shortIndices.filter((index) => {
    if (index === 0) return false;
    return cueDuration(cues[index - 1]) > YOUTUBE_SHORT_CUE_THRESHOLD;
  }).length;
  if (!pairedShortCount || pairedShortCount / shortIndices.length < 0.85) {
    return false;
  }

  const shortSet = new Set(shortIndices);
  const longCueCount = cues.length - shortIndices.length;
  if (longCueCount <= 0) {
    return false;
  }

  const timestampRich = cues.filter((cue, index) => {
    if (shortSet.has(index)) {
      return false;
    }
    return cue.lines.some((line) => VTT_TIMESTAMP_TAG.test(line) && VTT_CLASS_TAG.test(line));
  }).length;

  return timestampRich / longCueCount >= 0.5;
}

function collapseYoutubeWordLevelCues(rawCues: RawVttCue[], limits: SubtitleParserLimits): SubtitleCue[] {
  const cues: SubtitleCue[] = [];
  for (let i = 0; i < rawCues.length; i += 1) {
    const current = rawCues[i];
    if (cueDuration(current) <= YOUTUBE_SHORT_CUE_THRESHOLD) {
      continue;
    }

    const next = rawCues[i + 1];
    const hasShortPartner = Boolean(next && cueDuration(next) <= YOUTUBE_SHORT_CUE_THRESHOLD);
    let text = formatCueText(hasShortPartner ? next!.lines : current.lines);
    if (!text && hasShortPartner) {
      text = formatCueText(current.lines);
    }
    if (text) {
      pushCue(cues, { start: current.start, end: current.end, text }, limits);
    }
    if (hasShortPartner) {
      i += 1;
    }
  }
  return cues;
}

function cueDuration(cue: RawVttCue): number {
  return Math.max(0, cue.end - cue.start);
}

function parseSrt(content: string, limits: SubtitleParserLimits): SubtitleCue[] {
  const blocks = content.replace(/\r/g, "").split(/\n\s*\n/);
  const cues: SubtitleCue[] = [];

  for (const block of blocks) {
    const lines = block
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    if (!lines.length) continue;

    let cursor = 0;
    if (/^\d+$/.test(lines[cursor])) {
      cursor += 1;
    }
    if (cursor >= lines.length) continue;

    const timingLine = lines[cursor];
    const match = timingLine.match(/(.+?)\s+-->\s+(.+)/);
    if (!match) continue;

    const start = parseTimestamp(match[1].trim());
    const end = parseTimestamp(match[2].trim());
    const text = sanitizeCueText(lines.slice(cursor + 1).map(stripTags).join("\n"));
    if (!Number.isNaN(start) && !Number.isNaN(end) && text) {
      pushCue(cues, { start, end, text }, limits);
    }
  }

  return cues;
}

function formatCueText(lines: string[]): string {
  return sanitizeCueText(lines.map((line) => stripTags(line)).join("\n"));
}

function stripTags(input: string): string {
  let cleaned = input.replace(/<\/?[^>]+>/g, "");
  cleaned = cleaned.replace(/\{\\[^}]*\}/g, "");
  return cleaned;
}

function parseTimestamp(value: string): number {
  const normalized = value.replace(/,/g, ".");
  const match = normalized.match(/(?:(\d+):)?(\d{2}):(\d{2}(?:\.\d+)?)/);
  if (!match) {
    return Number.NaN;
  }
  const hours = match[1] ? Number(match[1]) : 0;
  const minutes = Number(match[2]);
  const seconds = Number(match[3]);
  return (hours * 3600 + minutes * 60 + seconds) * 1000;
}
