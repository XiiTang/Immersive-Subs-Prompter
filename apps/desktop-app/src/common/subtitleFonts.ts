export type SubtitleFontOption = {
  label: string;
  value: string;
};

export const SUBTITLE_FONT_OPTIONS: SubtitleFontOption[] = [
  {
    label: "PingFang SC",
    value: '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif'
  },
  {
    label: "Helvetica Neue",
    value: '"Helvetica Neue", Helvetica, Arial, sans-serif'
  },
  {
    label: "Arial",
    value: 'Arial, "Helvetica Neue", Helvetica, sans-serif'
  },
  {
    label: "Georgia",
    value: 'Georgia, "Times New Roman", serif'
  },
  {
    label: "Times New Roman",
    value: '"Times New Roman", Times, serif'
  }
];

export const DEFAULT_SUBTITLE_FONT_FAMILY = SUBTITLE_FONT_OPTIONS[0]!.value;

export function normalizeSubtitleFontFamily(value: string | null | undefined): string {
  const normalized = (value ?? "").trim();
  if (!normalized) {
    return DEFAULT_SUBTITLE_FONT_FAMILY;
  }
  return SUBTITLE_FONT_OPTIONS.some((option) => option.value === normalized)
    ? normalized
    : DEFAULT_SUBTITLE_FONT_FAMILY;
}
