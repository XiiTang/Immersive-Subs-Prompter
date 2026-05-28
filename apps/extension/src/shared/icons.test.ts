import { describe, expect, it } from "vitest";
import { createAddIcon, createArrowLeftIcon, createCloseIcon, createDeleteIcon } from "./icons";

describe("extension inline icons", () => {
  it("creates add icons with explicit sizing, classes, and stroke attributes", () => {
    const icon = createAddIcon({ size: 20, className: "icon icon--add" });

    expect(icon.tagName.toLowerCase()).toBe("svg");
    expect(icon.getAttribute("width")).toBe("20");
    expect(icon.getAttribute("height")).toBe("20");
    expect(icon.getAttribute("viewBox")).toBe("0 0 16 16");
    expect(icon.getAttribute("aria-hidden")).toBe("true");
    expect(icon.getAttribute("class")).toBe("icon icon--add");
    expect(icon.getAttribute("fill")).toBe("none");
    expect(icon.getAttribute("stroke")).toBe("currentColor");
    expect(icon.getAttribute("stroke-width")).toBe("1.5");
    expect(icon.querySelectorAll("circle")).toHaveLength(1);
    expect(icon.querySelectorAll("line")).toHaveLength(2);
  });

  it("creates delete icons with trash can segments", () => {
    const icon = createDeleteIcon();

    expect(icon.getAttribute("width")).toBe("16");
    expect(icon.getAttribute("height")).toBe("16");
    expect(icon.getAttribute("viewBox")).toBe("0 0 16 16");
    expect(Array.from(icon.querySelectorAll("path")).map((path) => path.getAttribute("d"))).toEqual([
      "M4 5h8",
      "M6 5V4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1",
      "M5 5v7a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1V5"
    ]);
    expect(icon.querySelectorAll("line")).toHaveLength(2);
  });

  it("creates close icons with x segments", () => {
    const icon = createCloseIcon({ size: 14, className: "icon icon--close" });

    expect(icon.getAttribute("width")).toBe("14");
    expect(icon.getAttribute("height")).toBe("14");
    expect(icon.getAttribute("viewBox")).toBe("0 0 16 16");
    expect(icon.getAttribute("class")).toBe("icon icon--close");
    expect(Array.from(icon.querySelectorAll("line")).map((line) => ({
      x1: line.getAttribute("x1"),
      y1: line.getAttribute("y1"),
      x2: line.getAttribute("x2"),
      y2: line.getAttribute("y2")
    }))).toEqual([
      { x1: "5", y1: "5", x2: "11", y2: "11" },
      { x1: "11", y1: "5", x2: "5", y2: "11" }
    ]);
    expect(icon.querySelectorAll("path")).toHaveLength(0);
  });

  it("creates arrow-left icons for back navigation", () => {
    const icon = createArrowLeftIcon({ size: 14, className: "icon icon--arrow-left" });

    expect(icon.getAttribute("width")).toBe("14");
    expect(icon.getAttribute("height")).toBe("14");
    expect(icon.getAttribute("viewBox")).toBe("0 0 16 16");
    expect(icon.getAttribute("class")).toBe("icon icon--arrow-left");
    expect(Array.from(icon.querySelectorAll("path")).map((path) => path.getAttribute("d"))).toEqual([
      "M10 3 5 8l5 5",
      "M5 8h8"
    ]);
  });
});
