import { ICON_ADD, ICON_DELETE, ICON_STROKE_PROPS } from "../../../desktop-app/src/renderer/shared/iconDefs";

type IconAttrs = Record<string, string | number | boolean>;
type IconSegment = { tag: string; attrs: IconAttrs };
type IconDef = { viewBox: string; segments: IconSegment[] };
type IconOptions = { size?: number; className?: string };

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
  return createIcon(ICON_ADD as IconDef, options);
}

export function createDeleteIcon(options?: IconOptions) {
  return createIcon(ICON_DELETE as IconDef, options);
}
