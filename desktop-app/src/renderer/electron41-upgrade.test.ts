import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const rendererRoot = path.resolve(import.meta.dirname);
const desktopAppRoot = path.resolve(rendererRoot, "..", "..");

function readDesktopFile(...segments: string[]) {
  return readFileSync(path.join(desktopAppRoot, ...segments), "utf8");
}

describe("Electron 41 upgrade", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.doUnmock("electron");
  });

  it("pins desktop dependencies to Electron 41 and switches desktop packaging to Electron Forge", () => {
    const packageJson = JSON.parse(readDesktopFile("package.json")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
      overrides?: Record<string, string>;
      scripts?: Record<string, string>;
    };

    expect(packageJson.dependencies?.["get-windows"]).toMatch(/\^9\./);
    expect(packageJson.dependencies?.["active-win"]).toBeUndefined();
    expect(packageJson.devDependencies?.electron).toMatch(/\^41\./);
    expect(packageJson.devDependencies?.["electron-builder"]).toBeUndefined();
    expect(packageJson.devDependencies?.["@electron-forge/cli"]).toBeDefined();
    expect(packageJson.devDependencies?.["@electron-forge/plugin-fuses"]).toBeDefined();
    expect(packageJson.scripts?.["dist:win"]).toContain("electron-forge make");
    expect(packageJson.scripts?.["dist:mac"]).toContain("electron-forge make");
    expect(packageJson.scripts?.["dist:linux"]).toContain("electron-forge make");
    expect(packageJson.overrides).toMatchObject({
      "@mapbox/node-pre-gyp": "^2.0.3",
      "node-gyp": "^12.2.0",
      "make-fetch-happen": "^15.0.5",
      cacache: "^20.0.4",
      tar: "^7.5.13"
    });
  });

  it("targets Chromium 146 in the renderer build", () => {
    const source = readDesktopFile("vite.config.ts");

    expect(source).toContain("target: \"chrome146\"");
  });

  it("configures Electron Forge makers and fuses for ASAR integrity", () => {
    const source = readDesktopFile("forge.config.mjs");

    expect(source).toContain("EnableEmbeddedAsarIntegrityValidation");
    expect(source).toContain("OnlyLoadAppFromAsar");
    expect(source).toContain("icon: path.join(__dirname, \"resources\", \"icon\")");
    expect(source).toContain("extraResource");
    expect(source).toContain("\"resources\", \"icon.ico\"");
    expect(source).toContain("\"resources\", \"icon.icns\"");
    expect(source).toContain("\"resources\", \"icon.png\"");
    expect(source).toContain("\"resources\", \"yt-dlp\"");
    expect(source).toContain("@electron-forge/maker-squirrel");
    expect(source).toContain("@electron-forge/maker-dmg");
    expect(source).toContain("@electron-forge/maker-deb");
    expect(source).toContain("@electron-forge/maker-rpm");
    expect(source).toContain("icon: path.join(__dirname, \"resources\", \"icon.icns\")");
  });

  it("ships a macOS app icon asset for Forge packaging", () => {
    const icon = readFileSync(path.join(desktopAppRoot, "resources", "icon.icns"));

    expect(icon.byteLength).toBeGreaterThan(0);
  });

  it("resolves bundled resources through a cross-platform helper", async () => {
    vi.doMock("electron", () => ({
      app: {
        isPackaged: false,
        getAppPath: () => "/workspace/desktop-app"
      }
    }));

    const { resolveBundledResource } = await import("../main/resourcePaths.js");
    expect(resolveBundledResource("icon.ico")).toBe(path.join("/workspace/desktop-app", "resources", "icon.ico"));

    vi.resetModules();
    vi.doMock("electron", () => ({
      app: {
        isPackaged: true,
        getAppPath: () => "/workspace/desktop-app"
      }
    }));

    const originalResourcesPath = process.resourcesPath;
    Object.defineProperty(process, "resourcesPath", {
      value: "/Applications/Immersive Subs Prompter.app/Contents/Resources",
      configurable: true
    });

    const packaged = await import("../main/resourcePaths.js");
    expect(packaged.resolveBundledResource("icon.ico")).toBe(
      path.join("/Applications/Immersive Subs Prompter.app/Contents/Resources", "icon.ico")
    );

    Object.defineProperty(process, "resourcesPath", {
      value: originalResourcesPath,
      configurable: true
    });
  });

  it("separates window and tray icon paths while still using the shared bundled-resource helper", () => {
    const source = readDesktopFile("src/main/window/windowController.ts");

    expect(source).toContain("getWindowIconPath()");
    expect(source).toContain("getTrayIconPath()");
    expect(source).toContain("getWindowIconName()");
    expect(source).toContain("getTrayIconName()");
    expect(source).toContain("process.platform");
    expect(source).toContain("resolveBundledResource(this.getWindowIconName())");
    expect(source).toContain("resolveBundledResource(this.getTrayIconName())");
    expect(source).not.toContain("app.getPath(\"assets\")");
  });

  it("creates the tray with a stable GUID", () => {
    const source = readDesktopFile("src/main/window/trayManager.ts");

    expect(source).toMatch(/const TRAY_GUID = "[^"]{36}"/);
    expect(source).toContain("new Tray(icon, TRAY_GUID)");
  });

  it("keeps the overlay window fully frameless on Wayland and respects snapped quick-show windows", () => {
    const windowManagerSource = readDesktopFile("src/main/window/windowManager.ts");
    const controllerSource = readDesktopFile("src/main/window/windowController.ts");

    expect(windowManagerSource).toContain("hasShadow: false");
    expect(controllerSource).toContain("window.isSnapped()");
  });

  it("documents per-host-platform Forge packaging instead of cross-platform dist:all builds", () => {
    const packageJson = JSON.parse(readDesktopFile("package.json")) as {
      scripts?: Record<string, string>;
    };
    const readme = readDesktopFile("..", "README.md");
    const deployment = readDesktopFile("..", "DEPLOYMENT.md");

    expect(packageJson.scripts?.["dist:all"]).toBeUndefined();
    expect(readme).not.toContain("dist:all");
    expect(readme).toContain("run on the matching host platform");
    expect(deployment).not.toContain("dist:all");
    expect(deployment).toContain("Build each target on its matching host platform");
  });
});
