type IconAttrs = Record<string, string | number | boolean>;
type IconSegment = { tag: string; attrs: IconAttrs };
type IconDef = { viewBox: string; segments: IconSegment[] };
type IconOptions = { size?: number; className?: string };

const ICON_STROKE_PROPS: IconAttrs = {
  fill: "none",
  stroke: "currentColor",
  "stroke-width": 1.5,
  "stroke-linecap": "round",
  "stroke-linejoin": "round"
};

const ICON_ADD: IconDef = {
  viewBox: "0 0 16 16",
  segments: [
    { tag: "circle", attrs: { cx: 8, cy: 8, r: 6 } },
    { tag: "line", attrs: { x1: 8, y1: 5, x2: 8, y2: 11 } },
    { tag: "line", attrs: { x1: 5, y1: 8, x2: 11, y2: 8 } }
  ]
};

const ICON_DELETE: IconDef = {
  viewBox: "0 0 16 16",
  segments: [
    { tag: "path", attrs: { d: "M4 5h8" } },
    { tag: "path", attrs: { d: "M6 5V4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1" } },
    { tag: "path", attrs: { d: "M5 5v7a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1V5" } },
    { tag: "line", attrs: { x1: 7, y1: 8, x2: 7, y2: 11 } },
    { tag: "line", attrs: { x1: 9, y1: 8, x2: 9, y2: 11 } }
  ]
};

function applyAttributes(element: Element, attrs: IconAttrs) {
  Object.entries(attrs).forEach(([key, value]) => {
    element.setAttribute(key, String(value));
  });
}

function createIcon(def: IconDef, { size = 16, className = "" }: IconOptions = {}) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", String(size));
  svg.setAttribute("height", String(size));
  svg.setAttribute("viewBox", def.viewBox);
  svg.setAttribute("aria-hidden", "true");
  if (className) {
    svg.setAttribute("class", className);
  }

  applyAttributes(svg, ICON_STROKE_PROPS);

  def.segments.forEach((segment) => {
    const element = document.createElementNS("http://www.w3.org/2000/svg", segment.tag);
    applyAttributes(element, segment.attrs);
    svg.appendChild(element);
  });

  return svg;
}

export function createAddIcon(options?: IconOptions) {
  return createIcon(ICON_ADD, options);
}

export function createDeleteIcon(options?: IconOptions) {
  return createIcon(ICON_DELETE, options);
}
