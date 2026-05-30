import { describe, expect, it } from "vitest";
import { createArrowLeftIcon, createCloseIcon } from "./icons";

describe("extension inline icons", () => {
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
