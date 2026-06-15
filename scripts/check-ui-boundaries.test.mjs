import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import assert from "node:assert/strict";

const repoRoot = path.resolve(import.meta.dirname, "..");
const scriptPath = path.join(repoRoot, "scripts/check-ui-boundaries.mjs");

test("fails when desktop product CSS defines shared tokens", () => {
  const cwd = createFixture({
    "packages/ui/src/index.css": '@import "./tokens.css";\n@import "./base.css";\n@import "./primitives.css";\n',
    "packages/ui/src/tokens.css": ":root { --ui-bg: #fff; }\n",
    "packages/ui/src/base.css": "*, *::before, *::after { box-sizing: border-box; }\n",
    "packages/ui/src/primitives.css": ".ui-button { border: 1px solid var(--ui-border); }\n",
    "apps/desktop-app/src/renderer/style.css": `
      /* Product surfaces */
      .window {
        --ui-bg: #141414;
      }
    `,
    "apps/extension/src/popup-layout.css": ".popup-main { display: flex; }\n"
  });

  const result = runBoundaryCheck(cwd);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /defines shared UI token/);
  assert.match(result.stderr, /apps\/desktop-app\/src\/renderer\/style\.css/);
});

test("fails when extension popup layout defines primitive chrome", () => {
  const cwd = createFixture({
    "packages/ui/src/index.css": '@import "./tokens.css";\n@import "./base.css";\n@import "./primitives.css";\n',
    "packages/ui/src/tokens.css": ":root { --ui-bg: #fff; }\n",
    "packages/ui/src/base.css": "*, *::before, *::after { box-sizing: border-box; }\n",
    "packages/ui/src/primitives.css": ".ui-button { border: 1px solid var(--ui-border); }\n",
    "apps/desktop-app/src/renderer/style.css": "/* Product surfaces */\n.window { display: flex; }\n",
    "apps/extension/src/popup-layout.css": `
      .toolbar .ui-button {
        border: 0;
      }
    `
  });

  const result = runBoundaryCheck(cwd);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /overrides shared UI control chrome/);
  assert.match(result.stderr, /apps\/extension\/src\/popup-layout\.css/);
});

test("fails when desktop product CSS overrides a class passed to UiButton", () => {
  const cwd = createFixture({
    "packages/ui/src/index.css": '@import "./tokens.css";\n@import "./base.css";\n@import "./primitives.css";\n',
    "packages/ui/src/tokens.css": ":root { --ui-bg: #fff; }\n",
    "packages/ui/src/base.css": "*, *::before, *::after { box-sizing: border-box; }\n",
    "packages/ui/src/primitives.css": ".ui-button { border: 1px solid var(--ui-border); }\n",
    "apps/desktop-app/src/renderer/style.css": ".settings-nav__item { border: 0; background: transparent; padding: 0; }\n",
    "apps/desktop-app/src/renderer/components/settings/SettingsNav.vue": `
      <template>
        <UiButton class="settings-nav__item">General</UiButton>
      </template>
    `,
    "apps/extension/src/popup-layout.css": ".popup-main { display: flex; }\n",
    "apps/extension/dist/chrome/popup.css": ":root { --ui-bg: #fff; }\n.ui-button { border: 1px solid var(--ui-border); }\n.popup-main { display: flex; }\n",
    "apps/extension/dist/firefox/popup.css": ":root { --ui-bg: #fff; }\n.ui-button { border: 1px solid var(--ui-border); }\n.popup-main { display: flex; }\n"
  });

  const result = runBoundaryCheck(cwd);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /overrides shared UI control chrome through shared primitive class/);
  assert.match(result.stderr, /settings-nav__item/);
});

test("fails when desktop product CSS overrides a class passed to any shared Vue primitive", () => {
  const cwd = createFixture({
    "packages/ui/src/index.css": '@import "./tokens.css";\n@import "./base.css";\n@import "./primitives.css";\n',
    "packages/ui/src/tokens.css": ":root { --ui-bg: #fff; }\n",
    "packages/ui/src/base.css": "*, *::before, *::after { box-sizing: border-box; }\n",
    "packages/ui/src/primitives.css": ".ui-list-item { border: 1px solid var(--ui-border); }\n",
    "apps/desktop-app/src/renderer/style.css": ".profile-list__item { border-color: red; }\n",
    "apps/desktop-app/src/renderer/components/settings/ProfileList.vue": `
      <template>
        <UiListItem class="profile-list__item">Profile</UiListItem>
      </template>
    `,
    "apps/extension/src/popup-layout.css": ".popup-main { display: flex; }\n",
    "apps/extension/dist/chrome/popup.css": ":root { --ui-bg: #fff; }\n.ui-button { border: 1px solid var(--ui-border); }\n.popup-main { display: flex; }\n",
    "apps/extension/dist/firefox/popup.css": ":root { --ui-bg: #fff; }\n.ui-button { border: 1px solid var(--ui-border); }\n.popup-main { display: flex; }\n"
  });

  const result = runBoundaryCheck(cwd);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /overrides shared UI structure chrome through shared primitive class/);
  assert.match(result.stderr, /profile-list__item/);
});

test("fails when extension product CSS overrides a class composed with native shared primitives", () => {
  const cwd = createFixture({
    "packages/ui/src/index.css": '@import "./tokens.css";\n@import "./base.css";\n@import "./primitives.css";\n',
    "packages/ui/src/tokens.css": ":root { --ui-bg: #fff; }\n",
    "packages/ui/src/base.css": "*, *::before, *::after { box-sizing: border-box; }\n",
    "packages/ui/src/primitives.css": ".ui-list-item { border: 1px solid var(--ui-border); }\n.ui-chip { border: 1px solid var(--ui-border); }\n",
    "apps/desktop-app/src/renderer/style.css": "/* Product surfaces */\n.window { display: flex; }\n",
    "apps/extension/src/popup-layout.css": `
      .media-row.playing {
        border-color: var(--ui-accent);
        background: var(--ui-surface-muted);
      }
      .server-pill--connected {
        border-color: green;
      }
    `,
    "apps/extension/src/popup.html": `
      <article class="ui-list-item media-row"></article>
    `,
    "apps/extension/src/popup.ts": `
      const pill = document.createElement("span");
      pill.className = "ui-chip server-pill server-pill--connected";
    `,
    "apps/extension/dist/chrome/popup.css": ":root { --ui-bg: #fff; }\n.ui-button { border: 1px solid var(--ui-border); }\n.popup-main { display: flex; }\n",
    "apps/extension/dist/firefox/popup.css": ":root { --ui-bg: #fff; }\n.ui-button { border: 1px solid var(--ui-border); }\n.popup-main { display: flex; }\n"
  });

  const result = runBoundaryCheck(cwd);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /media-row/);
  assert.match(result.stderr, /server-pill--connected/);
});

test("allows shared package owned tokens and primitive chrome", () => {
  const cwd = createFixture({
    "packages/ui/src/index.css": '@import "./tokens.css";\n@import "./base.css";\n@import "./primitives.css";\n',
    "packages/ui/src/tokens.css": ":root { --ui-bg: #fff; }\n:root[data-theme=\"dark\"] { --ui-bg: #111; }\n",
    "packages/ui/src/base.css": "*, *::before, *::after { box-sizing: border-box; }\n",
    "packages/ui/src/primitives.css": ".ui-button { border: 1px solid var(--ui-border); }\n",
    "apps/desktop-app/src/renderer/style.css": "/* Product surfaces */\n.window { display: flex; }\n",
    "apps/extension/src/popup-layout.css": ".popup-main { display: flex; }\n",
    "apps/extension/dist/chrome/popup.css": ":root { --ui-bg: #fff; }\n.ui-button { border: 1px solid var(--ui-border); }\n.popup-main { display: flex; }\n",
    "apps/extension/dist/firefox/popup.css": ":root { --ui-bg: #fff; }\n.ui-button { border: 1px solid var(--ui-border); }\n.popup-main { display: flex; }\n"
  });

  const result = runBoundaryCheck(cwd);

  assert.equal(result.status, 0);
  assert.match(result.stdout, /Project UI boundary check passed/);
});

test("fails when a built extension popup stylesheet is missing", () => {
  const cwd = createFixture({
    "packages/ui/src/index.css": '@import "./tokens.css";\n@import "./base.css";\n@import "./primitives.css";\n',
    "packages/ui/src/tokens.css": ":root { --ui-bg: #fff; }\n",
    "packages/ui/src/base.css": "*, *::before, *::after { box-sizing: border-box; }\n",
    "packages/ui/src/primitives.css": ".ui-button { border: 1px solid var(--ui-border); }\n",
    "apps/desktop-app/src/renderer/style.css": "/* Product surfaces */\n.window { display: flex; }\n",
    "apps/extension/src/popup-layout.css": ".popup-main { display: flex; }\n",
    "apps/extension/dist/chrome/popup.css": ":root { --ui-bg: #fff; }\n.ui-button { border: 1px solid var(--ui-border); }\n.popup-main { display: flex; }\n"
  });

  const result = runBoundaryCheck(cwd);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /apps\/extension\/dist\/firefox\/popup\.css/);
  assert.match(result.stderr, /built extension popup CSS is missing/);
});

test("fails when built extension popup CSS does not include shared CSS before popup layout", () => {
  const cwd = createFixture({
    "packages/ui/src/index.css": '@import "./tokens.css";\n@import "./base.css";\n@import "./primitives.css";\n',
    "packages/ui/src/tokens.css": ":root { --ui-bg: #fff; }\n",
    "packages/ui/src/base.css": "*, *::before, *::after { box-sizing: border-box; }\n",
    "packages/ui/src/primitives.css": ".ui-button { border: 1px solid var(--ui-border); }\n",
    "apps/desktop-app/src/renderer/style.css": "/* Product surfaces */\n.window { display: flex; }\n",
    "apps/extension/src/popup-layout.css": ".popup-main { display: flex; }\n",
    "apps/extension/dist/chrome/popup.css": ".popup-main { display: flex; }\n.ui-button { border: 1px solid var(--ui-border); }\n",
    "apps/extension/dist/firefox/popup.css": ":root { --ui-bg: #fff; }\n.ui-button { border: 1px solid var(--ui-border); }\n.popup-main { display: flex; }\n"
  });

  const result = runBoundaryCheck(cwd);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /built extension popup CSS must include shared UI before popup layout/);
});

function createFixture(files) {
  const cwd = mkdtempSync(path.join(tmpdir(), "project-ui-boundary-"));
  for (const directory of [
    "packages/ui/src",
    "apps/desktop-app/src/renderer/components/settings",
    "apps/desktop-app/src/renderer/components/top-panel",
    "apps/desktop-app/src/renderer/components/subtitle",
    "apps/extension/src",
    "apps/extension/dist/chrome",
    "apps/extension/dist/firefox"
  ]) {
    mkdirSync(path.join(cwd, directory), { recursive: true });
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
