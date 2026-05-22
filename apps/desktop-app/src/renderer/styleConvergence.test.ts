import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const stylePath = join(process.cwd(), "src/renderer/style.css");
const css = readFileSync(stylePath, "utf8");

function stripTranscriptBodyStyles(input: string): string {
  return input
    .replace(/\.transcript-surface[\s\S]*?(?=\n\.[a-zA-Z]|\n@media|\n$)/g, "")
    .replace(/\.transcript-block[\s\S]*?(?=\n\.[a-zA-Z]|\n@media|\n$)/g, "");
}

const activeCss = stripTranscriptBodyStyles(css);

describe("desktop CSS convergence", () => {
  it("keeps active chrome free of decorative effects", () => {
    expect(activeCss).not.toMatch(/box-shadow\s*:/);
    expect(activeCss).not.toMatch(/linear-gradient|radial-gradient|backdrop-filter|filter:\s*blur/i);
    expect(activeCss).not.toMatch(/color-mix\(/);
    expect(activeCss).not.toMatch(/rgba\(/);
  });

  it("does not keep feature-specific visual systems active", () => {
    expect(activeCss).not.toMatch(/\.fw-/);
    expect(activeCss).not.toMatch(/\.plugin-card/);
    expect(activeCss).not.toMatch(/\.settings-action-btn/);
    expect(activeCss).not.toMatch(/\.btn-primary|\.btn-secondary|\.settings-surface/);
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
    expect(css).not.toContain("--ui-control-bg");
  });

  it("keeps transcript background opacity wired to the panel opacity setting", () => {
    expect(css).toContain("background: rgb(18 18 18 / var(--panel-opacity-factor));");
  });
});
