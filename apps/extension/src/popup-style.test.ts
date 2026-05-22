import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const popupCssPath = join(process.cwd(), "popup.css");
const popupHtmlPath = join(process.cwd(), "popup.html");
const css = readFileSync(popupCssPath, "utf8");
const html = readFileSync(popupHtmlPath, "utf8");

describe("extension popup visual convergence", () => {
  it("does not use decorative effects", () => {
    expect(css).not.toMatch(/box-shadow\s*:/);
    expect(css).not.toMatch(/linear-gradient|radial-gradient|backdrop-filter|filter:\s*blur/i);
    expect(css).not.toMatch(/color-mix\(/);
    expect(css).not.toMatch(/rgba\(/);
  });

  it("does not use legacy popup visual class families", () => {
    expect(css).not.toMatch(/\.usp-/);
    expect(css).not.toMatch(/\.media-card|\.server-card/);
    expect(css).not.toMatch(/pill/i);
    expect(html).not.toMatch(/usp-|media-card|server-card/);
  });

  it("uses the agreed semantic color tokens", () => {
    for (const token of [
      "--ui-bg",
      "--ui-surface",
      "--ui-surface-muted",
      "--ui-text",
      "--ui-text-muted",
      "--ui-border",
      "--ui-accent",
      "--ui-success",
      "--ui-warning",
      "--ui-danger",
      "--ui-info"
    ]) {
      expect(css).toContain(token);
    }
    expect(css).not.toContain("--ui-accent-soft");
  });
});
