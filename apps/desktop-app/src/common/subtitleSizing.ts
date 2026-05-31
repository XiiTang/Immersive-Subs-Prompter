export const MIN_SUBTITLE_FONT_SIZE = 3;
export const MAX_SUBTITLE_FONT_SIZE = 96;
export const MIN_TIMESTAMP_FONT_SIZE = 6;
export const MAX_TIMESTAMP_FONT_SIZE = 24;

function normalizeFontSize(value: number | null | undefined, fallback: number, min: number, max: number): number {
  const numeric = Number(value);
  const finiteValue = Number.isFinite(numeric) ? numeric : fallback;
  return Math.min(max, Math.max(min, Math.round(finiteValue)));
}

export function normalizeSubtitleFontSize(value: number | null | undefined, fallback: number): number {
  return normalizeFontSize(value, fallback, MIN_SUBTITLE_FONT_SIZE, MAX_SUBTITLE_FONT_SIZE);
}

export function normalizeTimestampFontSize(value: number | null | undefined, fallback: number): number {
  return normalizeFontSize(value, fallback, MIN_TIMESTAMP_FONT_SIZE, MAX_TIMESTAMP_FONT_SIZE);
}
