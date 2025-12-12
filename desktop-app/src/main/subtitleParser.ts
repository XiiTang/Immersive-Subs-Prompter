import { SubtitleCue } from "./types.js";

type RawVttCue = {
  start: number;
  end: number;
  lines: string[];
};

const VTT_TIMESTAMP_TAG = /<\d{2}:\d{2}:\d{2}\.\d{3}>/;
const VTT_CLASS_TAG = /<c(?:\.[^>]*)?>/i;
const YOUTUBE_SHORT_CUE_THRESHOLD = 150; // milliseconds (was 0.15 seconds)

/**
 * Enhanced sanitization for subtitle text - removes HTML tags and entities
 * Migrated from jellyfinemby-desktop-client for better compatibility
 */
function sanitizeCueText(text: string): string {
  return text
    .replace(/<\/?[bi]>/gi, '')      // Remove <b>, <i>, </b>, </i>
    .replace(/<\/?u>/gi, '')         // Remove <u>, </u>
    .replace(/<\/?font[^>]*>/gi, '') // Remove <font> tags with attributes
    .replace(/&nbsp;/gi, ' ')        // HTML entity: non-breaking space
    .replace(/&lt;/gi, '<')          // HTML entity: less than
    .replace(/&gt;/gi, '>')          // HTML entity: greater than
    .replace(/&amp;/gi, '&')         // HTML entity: ampersand
    .replace(/&quot;/gi, '"')        // HTML entity: quote
    .replace(/&apos;/gi, "'")        // HTML entity: apostrophe
    .trim();
}

export function parseSubtitle(content: string, extension: string): SubtitleCue[] {
  // Remove BOM (Byte Order Mark) if present - common in UTF-8 files
  const normalized = content.replace(/\ufeff/g, '');
  
  if (extension === "srt") {
    return parseSrt(normalized);
  }
  return parseVtt(normalized);
}

function parseVtt(content: string): SubtitleCue[] {
  const rawCues = readRawVttCues(content);
  if (!rawCues.length) {
    return [];
  }

  if (isYoutubeWordLevelVtt(rawCues)) {
    return collapseYoutubeWordLevelCues(rawCues);
  }

  const cues: SubtitleCue[] = [];
  for (const cue of rawCues) {
    const text = formatCueText(cue.lines);
    if (!text) continue;
    cues.push({ start: cue.start, end: cue.end, text });
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

function collapseYoutubeWordLevelCues(rawCues: RawVttCue[]): SubtitleCue[] {
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
      cues.push({ start: current.start, end: current.end, text });
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

function parseSrt(content: string): SubtitleCue[] {
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
    // Apply enhanced sanitization to text content
    const text = sanitizeCueText(lines.slice(cursor + 1).map(stripTags).join("\n"));
    if (!Number.isNaN(start) && !Number.isNaN(end) && text) {
      cues.push({ start, end, text });
    }
  }

  return cues;
}

function formatCueText(lines: string[]): string {
  // Apply sanitization to VTT cue text as well
  return sanitizeCueText(lines.map((line) => stripTags(line)).join("\n"));
}

function stripTags(input: string): string {
  // Remove HTML tags: <tag>, </tag>, <tag attr="value">
  let cleaned = input.replace(/<\/?[^>]+>/g, "");
  // Remove ASS/SSA style tags: {\tag}, {\tag value}, {\fnArial}, etc.
  cleaned = cleaned.replace(/\{\\[^}]*\}/g, "");
  return cleaned;
}

export function parseTimestamp(value: string): number {
  const normalized = value.replace(/,/g, ".");
  const match = normalized.match(/(?:(\d+):)?(\d{2}):(\d{2}(?:\.\d+)?)/);
  if (!match) {
    return Number.NaN;
  }
  const hours = match[1] ? Number(match[1]) : 0;
  const minutes = Number(match[2]);
  const seconds = Number(match[3]);
  // Convert to milliseconds
  return (hours * 3600 + minutes * 60 + seconds) * 1000;
}
