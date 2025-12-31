/**
 * Shared SVG icons for use across the extension
 * These icons use currentColor for styling and are compatible with both light and dark themes
 */

/**
 * Creates an Add icon SVG element
 * @param {Object} options - Configuration options
 * @param {number} [options.size=16] - Icon size in pixels
 * @param {string} [options.className=''] - Additional CSS classes
 * @returns {SVGElement} The SVG element
 */
export function createAddIcon({ size = 16, className = "" } = {}) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", String(size));
  svg.setAttribute("height", String(size));
  svg.setAttribute("viewBox", "0 0 16 16");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "1.5");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  if (className) {
    svg.setAttribute("class", className);
  }

  svg.innerHTML = `
    <circle cx="8" cy="8" r="6" />
    <line x1="8" y1="5" x2="8" y2="11" />
    <line x1="5" y1="8" x2="11" y2="8" />
  `;

  return svg;
}

/**
 * Creates a Delete icon SVG element
 * @param {Object} options - Configuration options
 * @param {number} [options.size=16] - Icon size in pixels
 * @param {string} [options.className=''] - Additional CSS classes
 * @returns {SVGElement} The SVG element
 */
export function createDeleteIcon({ size = 16, className = "" } = {}) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", String(size));
  svg.setAttribute("height", String(size));
  svg.setAttribute("viewBox", "0 0 16 16");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "1.5");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  if (className) {
    svg.setAttribute("class", className);
  }

  svg.innerHTML = `
    <path d="M4 5h8" />
    <path d="M6 5V4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1" />
    <path d="M5 5v7a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1V5" />
    <line x1="7" y1="8" x2="7" y2="11" />
    <line x1="9" y1="8" x2="9" y2="11" />
  `;

  return svg;
}
