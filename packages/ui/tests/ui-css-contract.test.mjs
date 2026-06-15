import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

const packageRoot = path.resolve(import.meta.dirname, "..");
const srcRoot = path.join(packageRoot, "src");

test("index.css imports tokens, base, and primitives in order", () => {
  const css = readCss("index.css");

  assert.equal(css.trim(), '@import "./tokens.css";\n@import "./base.css";\n@import "./primitives.css";');
});

test("tokens.css owns the shared project UI token contract", () => {
  const css = readCss("tokens.css");

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
    "--ui-info",
    "--ui-shadow-floating"
  ]) {
    assert.match(css, new RegExp(`${escapeRegExp(token)}\\s*:`));
  }
  assert.match(css, /:root\[data-theme="dark"\]/);
});

test("base.css owns shared document and form-control baseline styles", () => {
  const css = readCss("base.css");

  assert.match(css, /\*,\s*\*::before,\s*\*::after\s*\{/);
  assert.match(css, /box-sizing:\s*border-box/);
  assert.match(css, /button,\s*input,\s*select,\s*textarea\s*\{/);
  assert.match(css, /font:\s*inherit/);
});

test("primitives.css owns shared primitive chrome", () => {
  const css = readCss("primitives.css");

  for (const selector of [
    ".ui-button",
    ".ui-icon-button",
    ".ui-input",
    ".ui-textarea",
    ".ui-select",
    ".ui-switch",
    ".ui-slider",
    ".ui-segmented",
    ".ui-status",
    ".ui-badge",
    ".ui-message",
    ".ui-empty-state",
    ".ui-progress",
    ".ui-list-item",
    ".ui-chip",
    ".icon"
  ]) {
    assert.match(css, new RegExp(`${escapeRegExp(selector)}(?:\\b|[\\s,{:.#\\[])`));
  }
});

test("primitives.css does not own product list containers or desktop-only button variants", () => {
  const css = readCss("primitives.css");

  for (const selector of [
    ".ui-list",
    ".ui-button--editable",
    ".ui-button--nav",
    ".ui-button--lg",
    ".ui-icon-button--lg"
  ]) {
    assert.doesNotMatch(css, new RegExp(`${escapeRegExp(selector)}(?:$|[\\s,{:.#\\[])`));
  }
});

test("primitives.css does not own desktop Vue component internals", () => {
  const css = readCss("primitives.css");

  for (const selector of [
    ".ui-select-content",
    ".ui-tooltip",
    ".ui-color-input",
    ".ui-field",
    ".ui-section",
    ".ui-surface",
    ".ui-toolbar",
    ".ui-setting-row",
    ".ui-inline-control",
    ".ui-stat",
    ".ui-group",
    ".ui-scrollbar",
    ".ui-resize-handle"
  ]) {
    assert.doesNotMatch(css, new RegExp(`${escapeRegExp(selector)}(?:\\b|[\\s,{:.#\\[])`));
  }
});

function readCss(fileName) {
  return readFileSync(path.join(srcRoot, fileName), "utf8");
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
