import { describe, expect, it } from "vitest";
import { createAddIcon, createDeleteIcon } from "./icons";

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
});
