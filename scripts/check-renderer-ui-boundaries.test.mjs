import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import assert from "node:assert/strict";

const repoRoot = path.resolve(import.meta.dirname, "..");
const scriptPath = path.join(repoRoot, "scripts/check-renderer-ui-boundaries.mjs");

test("fails when product CSS overrides foundation control chrome", () => {
  const cwd = createFixture({
    "apps/desktop-app/src/renderer/style.css": `
      .profile-list-sidebar .settings-split__sidebar-buttons .ui-icon-button {
        width: 24px;
      }

      .pill-list-editor__input.ui-input {
        border: 0;
      }
    `,
    "apps/desktop-app/src/renderer/components/ui/UiInput.vue": `
      <template><input class="ui-input" /></template>
    `
  });

  const result = runBoundaryCheck(cwd);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /overrides foundation control chrome/);
  assert.match(result.stderr, /style\.css/);
});

test("fails when product CSS overrides foundation feedback chrome", () => {
  const cwd = createFixture({
    "apps/desktop-app/src/renderer/style.css": `
      /* Product surfaces */

      .status-row .local-status-message.ui-status {
        padding: 4px 8px;
        background: var(--ui-surface-muted);
      }
    `,
    "apps/desktop-app/src/renderer/components/ui/UiStatus.vue": `
      <template><span class="ui-status" /></template>
    `
  });

  const result = runBoundaryCheck(cwd);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /overrides foundation feedback chrome/);
  assert.match(result.stderr, /style\.css/);
});

test("allows foundation-owned UI control styling", () => {
  const cwd = createFixture({
    "apps/desktop-app/src/renderer/style.css": `
      .ui-input {
        border: 1px solid var(--ui-border);
      }

      /* Product surfaces */
    `,
    "apps/desktop-app/src/renderer/components/ui/UiInput.vue": `
      <template><input class="ui-input" /></template>
    `
  });

  const result = runBoundaryCheck(cwd);

  assert.equal(result.status, 0);
  assert.match(result.stdout, /Renderer UI boundary check passed/);
});

function createFixture(files) {
  const cwd = mkdtempSync(path.join(tmpdir(), "renderer-ui-boundary-"));
  for (const productRoot of [
    "apps/desktop-app/src/renderer/components/settings",
    "apps/desktop-app/src/renderer/components/top-panel",
    "apps/desktop-app/src/renderer/components/subtitle"
  ]) {
    mkdirSync(path.join(cwd, productRoot), { recursive: true });
  }

  for (const [filePath, contents] of Object.entries(files)) {
    const fullPath = path.join(cwd, filePath);
    mkdirSync(path.dirname(fullPath), { recursive: true });
    writeFileSync(fullPath, contents, "utf8");
  }
  return cwd;
}

function runBoundaryCheck(cwd) {
  return spawnSync(process.execPath, [scriptPath], {
    cwd,
    encoding: "utf8"
  });
}
