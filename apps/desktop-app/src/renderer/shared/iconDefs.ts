export type IconSegment = {
  tag: "circle" | "line" | "path";
  attrs: Record<string, string | number>;
};

export type IconDefinition = {
  viewBox: string;
  segments: IconSegment[];
};

/**
 * Common SVG stroke attributes used by all inline icons.
 * Keep these in sync between desktop renderer and browser extension.
 */
export const ICON_STROKE_PROPS: Record<string, string | number> = {
  fill: "none",
  stroke: "currentColor",
  "stroke-width": 1.5,
  "stroke-linecap": "round",
  "stroke-linejoin": "round"
};

export const ICON_ADD: IconDefinition = {
  viewBox: "0 0 16 16",
  segments: [
    { tag: "circle", attrs: { cx: 8, cy: 8, r: 6 } },
    { tag: "line", attrs: { x1: 8, y1: 5, x2: 8, y2: 11 } },
    { tag: "line", attrs: { x1: 5, y1: 8, x2: 11, y2: 8 } }
  ]
};

export const ICON_DELETE: IconDefinition = {
  viewBox: "0 0 16 16",
  segments: [
    { tag: "path", attrs: { d: "M4 5h8" } },
    { tag: "path", attrs: { d: "M6 5V4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1" } },
    { tag: "path", attrs: { d: "M5 5v7a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1V5" } },
    { tag: "line", attrs: { x1: 7, y1: 8, x2: 7, y2: 11 } },
    { tag: "line", attrs: { x1: 9, y1: 8, x2: 9, y2: 11 } }
  ]
};

export const ICON_CHECK: IconDefinition = {
  viewBox: "0 0 16 16",
  segments: [
    { tag: "path", attrs: { d: "M3.5 8.5 6.5 11.5 12.5 4.5" } }
  ]
};

export const ICON_FOLDER: IconDefinition = {
  viewBox: "0 0 16 16",
  segments: [
    { tag: "path", attrs: { d: "M2.5 5.5V12a1.5 1.5 0 0 0 1.5 1.5h8a1.5 1.5 0 0 0 1.5-1.5V6.5A1.5 1.5 0 0 0 12 5H7.25L6 3.5H4A1.5 1.5 0 0 0 2.5 5v.5Z" } },
    { tag: "path", attrs: { d: "M2.5 6h11" } }
  ]
};

export const ICON_REFRESH: IconDefinition = {
  viewBox: "0 0 16 16",
  segments: [
    { tag: "path", attrs: { d: "M13 8a5 5 0 0 1-8.4 3.65" } },
    { tag: "path", attrs: { d: "M3 8a5 5 0 0 1 8.4-3.65" } },
    { tag: "path", attrs: { d: "M11 2.5h1v3" } },
    { tag: "path", attrs: { d: "M5 13.5H4v-3" } }
  ]
};

export const ICON_CHEVRON_DOWN: IconDefinition = {
  viewBox: "0 0 16 16",
  segments: [{ tag: "path", attrs: { d: "M4.5 6.5 8 10l3.5-3.5" } }]
};

export const ICON_CHEVRON_UP: IconDefinition = {
  viewBox: "0 0 16 16",
  segments: [{ tag: "path", attrs: { d: "M4.5 9.5 8 6l3.5 3.5" } }]
};

export const ICON_FULLSCREEN: IconDefinition = {
  viewBox: "0 0 16 16",
  segments: [
    { tag: "path", attrs: { d: "M5.5 2.5h-3v3" } },
    { tag: "path", attrs: { d: "M10.5 2.5h3v3" } },
    { tag: "path", attrs: { d: "M13.5 10.5v3h-3" } },
    { tag: "path", attrs: { d: "M2.5 10.5v3h3" } }
  ]
};

export const ICON_LOCK: IconDefinition = {
  viewBox: "0 0 16 16",
  segments: [
    { tag: "path", attrs: { d: "M4.5 7.5h7v5h-7z" } },
    { tag: "path", attrs: { d: "M5.75 7.5v-2.25a2.25 2.25 0 0 1 4.5 0V7.5" } }
  ]
};

export const ICON_PAUSE: IconDefinition = {
  viewBox: "0 0 16 16",
  segments: [
    { tag: "line", attrs: { x1: 6, y1: 4, x2: 6, y2: 12 } },
    { tag: "line", attrs: { x1: 10, y1: 4, x2: 10, y2: 12 } }
  ]
};

export const ICON_PIN: IconDefinition = {
  viewBox: "0 0 16 16",
  segments: [
    { tag: "path", attrs: { d: "M5 2.5h6l-1.5 4 2 2-3 3-2-2-4 1.5 1.5-4-2-2 3-3Z" } },
    { tag: "line", attrs: { x1: 7.5, y1: 10.5, x2: 4, y2: 14 } }
  ]
};

export const ICON_PLAY: IconDefinition = {
  viewBox: "0 0 16 16",
  segments: [{ tag: "path", attrs: { d: "M5.5 3.5v9l7-4.5-7-4.5Z" } }]
};

export const ICON_SETTINGS: IconDefinition = {
  viewBox: "0 0 16 16",
  segments: [
    { tag: "line", attrs: { x1: 3, y1: 4.5, x2: 13, y2: 4.5 } },
    { tag: "circle", attrs: { cx: 6, cy: 4.5, r: 1.2 } },
    { tag: "line", attrs: { x1: 3, y1: 8, x2: 13, y2: 8 } },
    { tag: "circle", attrs: { cx: 10, cy: 8, r: 1.2 } },
    { tag: "line", attrs: { x1: 3, y1: 11.5, x2: 13, y2: 11.5 } },
    { tag: "circle", attrs: { cx: 7.5, cy: 11.5, r: 1.2 } }
  ]
};
