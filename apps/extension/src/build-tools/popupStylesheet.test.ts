import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildPopupStylesheet } from "./popupStylesheet";

describe("popup stylesheet build", () => {
  it("builds popup CSS from the shared package entrypoint before popup layout CSS", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "usp-popup-css-"));
    const uiRoot = path.join(root, "ui");
    mkdirSync(uiRoot, { recursive: true });
    const layoutPath = path.join(root, "popup-layout.css");

    writeFileSync(path.join(uiRoot, "index.css"), '@import "./tokens.css";\n@import "./base.css";\n@import "./primitives.css";\n');
    writeFileSync(path.join(uiRoot, "tokens.css"), "/* tokens */\n:root { --ui-bg: #fff; }\n");
    writeFileSync(path.join(uiRoot, "base.css"), "/* base */\n*, *::before, *::after { box-sizing: border-box; }\n");
    writeFileSync(path.join(uiRoot, "primitives.css"), "/* primitives */\n.ui-button { border: 1px solid var(--ui-bg); }\n");
    writeFileSync(layoutPath, "/* popup layout */\n.popup-main { display: flex; }\n");

    const css = await buildPopupStylesheet({
      sharedUiEntrypoint: path.join(uiRoot, "index.css"),
      popupLayoutPath: layoutPath
    });

    expect(css).not.toContain("@import");
    expect(css.indexOf("/* tokens */")).toBeLessThan(css.indexOf("/* base */"));
    expect(css.indexOf("/* base */")).toBeLessThan(css.indexOf("/* primitives */"));
    expect(css.indexOf("/* primitives */")).toBeLessThan(css.indexOf("/* popup layout */"));
  });
});
