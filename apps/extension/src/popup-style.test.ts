import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const popupCssPath = join(process.cwd(), "popup.css");
const popupHtmlPath = join(process.cwd(), "popup.html");
const popupTsPath = join(process.cwd(), "src/popup.ts");
const css = readFileSync(popupCssPath, "utf8");
const html = readFileSync(popupHtmlPath, "utf8");
const popupTs = readFileSync(popupTsPath, "utf8");
const popupMarkup = `${html}\n${popupTs}`;

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

  it("matches the desktop typography and dark color token contract", () => {
    expect(css).toContain(
      'font-family: "Inter", "PingFang SC", "Microsoft YaHei", system-ui, -apple-system, BlinkMacSystemFont, sans-serif;'
    );
    expect(css).toContain("font-size: 14px;");

    for (const declaration of [
      "--ui-bg: #141414;",
      "--ui-surface: #181818;",
      "--ui-surface-muted: #242424;",
      "--ui-text: #f2f2f2;",
      "--ui-text-muted: #a6a6a6;",
      "--ui-border: #363636;",
      "--ui-accent: #d6d6d6;",
      "--ui-success: #c7c7c7;",
      "--ui-warning: #b8b8b8;",
      "--ui-danger: #e0e0e0;",
      "--ui-info: #cfcfcf;"
    ]) {
      expect(css).toContain(declaration);
    }
  });

  it("uses desktop primitive class names for equivalent popup controls", () => {
    for (const className of [
      "ui-button",
      "ui-icon-button",
      "ui-input",
      "ui-list",
      "ui-list-item",
      "ui-badge",
      "ui-status",
      "ui-segmented",
      "ui-segmented__item",
      "ui-progress",
      "ui-progress__bar",
      "ui-empty-state"
    ]) {
      expect(popupMarkup).toContain(className);
    }

    expect(popupMarkup).not.toMatch(/\bpopup-icon-button\b|\bicon-btn\b|\bserver-input\b|\bappearance-option\b/);
  });

  it("merges extension configuration entries into one settings panel", () => {
    expect(html).toContain('id="settings-btn"');
    expect(html).toContain('id="settings-panel"');
    expect(html).toContain('data-settings-section="appearance"');
    expect(html).toContain('data-settings-section="connections"');
    expect(html).toContain('data-settings-section="blacklist"');

    expect(html).not.toMatch(/\bid="appearance-btn"\b|\bid="connections-btn"\b|\bid="blacklist-btn"\b/);
    expect(html).not.toMatch(/\bid="appearance-panel"\b|\bid="connections-panel"\b|\bid="blacklist-panel"\b/);
    expect(popupTs).not.toMatch(/setActivePanel\("appearance"\)|setActivePanel\("connections"\)|setActivePanel\("blacklist"\)/);
  });

  it("uses the desktop pill-list editor shape for blacklist rules", () => {
    for (const className of [
      "pill-list-editor",
      "pill-list-editor__list",
      "pill-list-editor__item",
      "pill-list-editor__display",
      "pill-list-editor__remove",
      "pill-list-editor__draft",
      "pill-list-editor__input"
    ]) {
      expect(popupMarkup).toContain(className);
    }

    expect(popupMarkup).toContain("blacklist-draft-input");
    expect(popupMarkup).toContain('createCloseIcon({ size: 14, className: "icon icon--close" })');
    expect(popupMarkup).toContain("youtube.com, *.site.com/path/*, =full URL, re:pattern");
    expect(popupMarkup).not.toMatch(
      /\bblacklist-item__select\b|\bblacklist-item__input\b|\bblacklist-add\b|add-blacklist-rule|No rules added yet/
    );
  });

  it("uses the desktop pill-list editor shape for connection endpoints", () => {
    expect(popupMarkup).toContain("server-pill-list-editor");
    expect(popupMarkup).toContain("server-draft-input");
    expect(popupMarkup).toContain("server-status-dot");
    expect(popupMarkup).toContain("server-pill--connected");
    expect(popupMarkup).toContain("server-pill--connecting");
    expect(popupMarkup).toContain("server-pill--error");
    expect(popupMarkup).toContain("server-pill--disconnected");
    expect(popupMarkup).toContain('createCloseIcon({ size: 14, className: "icon icon--close" })');
    expect(popupMarkup).not.toMatch(/\bserver-add\b|\bserver-row\b|\bserver-empty\b|No servers configured|createAddIcon|createDeleteIcon/);
  });
});
