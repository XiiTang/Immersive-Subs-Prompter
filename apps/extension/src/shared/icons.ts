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

const ICON_CLOSE: IconDef = {
  viewBox: "0 0 16 16",
  segments: [
    { tag: "line", attrs: { x1: 5, y1: 5, x2: 11, y2: 11 } },
    { tag: "line", attrs: { x1: 11, y1: 5, x2: 5, y2: 11 } }
  ]
};

const ICON_ARROW_LEFT: IconDef = {
  viewBox: "0 0 16 16",
  segments: [
    { tag: "path", attrs: { d: "M10 3 5 8l5 5" } },
    { tag: "path", attrs: { d: "M5 8h8" } }
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

export function createCloseIcon(options?: IconOptions) {
  return createIcon(ICON_CLOSE, options);
}

export function createArrowLeftIcon(options?: IconOptions) {
  return createIcon(ICON_ARROW_LEFT, options);
}
