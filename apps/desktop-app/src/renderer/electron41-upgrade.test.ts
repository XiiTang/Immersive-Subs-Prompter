import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const rendererRoot = path.resolve(import.meta.dirname);
const desktopAppRoot = path.resolve(rendererRoot, "..", "..");
const repoRoot = path.resolve(desktopAppRoot, "..", "..");

function readDesktopFile(...segments: string[]) {
  return readFileSync(path.join(desktopAppRoot, ...segments), "utf8");
}

describe("Electron 41 upgrade", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.doUnmock("electron");
  });

  it("pins desktop dependencies to exact Electron 41 era package versions and uses root pnpm overrides", () => {
    const packageJson = JSON.parse(readDesktopFile("package.json")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
      overrides?: Record<string, string>;
      scripts?: Record<string, string>;
    };
    const pnpmWorkspace = readFileSync(path.join(repoRoot, "pnpm-workspace.yaml"), "utf8");

    expect(packageJson.dependencies?.["get-windows"]).toBe("9.3.0");
    expect(packageJson.dependencies?.["active-win"]).toBeUndefined();
    expect(packageJson.devDependencies?.electron).toBe("41.2.0");
    expect(packageJson.devDependencies?.["@electron/fuses"]).toBe("2.1.1");
    expect(packageJson.devDependencies?.["electron-builder"]).toBeUndefined();
    expect(packageJson.devDependencies?.["@electron-forge/cli"]).toBe("7.11.1");
    expect(packageJson.devDependencies?.["@electron-forge/maker-deb"]).toBe("7.11.1");
    expect(packageJson.devDependencies?.["@electron-forge/maker-dmg"]).toBe("7.11.1");
    expect(packageJson.devDependencies?.["@electron-forge/maker-rpm"]).toBe("7.11.1");
    expect(packageJson.devDependencies?.["@electron-forge/maker-squirrel"]).toBe("7.11.1");
    expect(packageJson.devDependencies?.["@electron-forge/maker-zip"]).toBe("7.11.1");
    expect(packageJson.devDependencies?.["@electron-forge/plugin-auto-unpack-natives"]).toBe("7.11.1");
    expect(packageJson.devDependencies?.["@electron-forge/plugin-fuses"]).toBe("7.11.1");
    expect(packageJson.scripts?.["dist:win"]).toContain("electron-forge make");
    expect(packageJson.scripts?.["dist:mac"]).toContain("electron-forge make");
    expect(packageJson.scripts?.["dist:linux"]).toContain("electron-forge make");
    expect(packageJson.overrides).toBeUndefined();
    expect(pnpmWorkspace).toContain("nodeLinker: hoisted");
    expect(pnpmWorkspace).toContain("peerDependencyRules:");
    expect(pnpmWorkspace).toContain("allowedVersions:");
    expect(pnpmWorkspace).toContain('"@electron/fuses": "2.1.1"');
    expect(pnpmWorkspace).toContain('"@mapbox/node-pre-gyp": "2.0.3"');
    expect(pnpmWorkspace).toContain('"node-gyp": "12.2.0"');
    expect(pnpmWorkspace).toContain('"make-fetch-happen": "15.0.5"');
    expect(pnpmWorkspace).toContain('cacache: "20.0.4"');
    expect(pnpmWorkspace).toContain('tar: "7.5.13"');
    expect(pnpmWorkspace).toContain('"@xmldom/xmldom": "0.8.13"');
    expect(pnpmWorkspace).toContain('"fast-uri": "3.1.2"');
  });

  it("targets Chromium 146 in the renderer build", () => {
    const source = readDesktopFile("vite.config.ts");

    expect(source).toContain("target: \"chrome146\"");
  });

  it("configures Electron Forge makers and fuses for ASAR integrity", () => {
    const source = readDesktopFile("forge.config.mjs");

    expect(source).toContain("strictlyRequireAllFuses: true");
    expect(source).toContain("EnableEmbeddedAsarIntegrityValidation");
    expect(source).toContain("OnlyLoadAppFromAsar");
    expect(source).toContain("icon: path.join(__dirname, \"resources\", \"icon\")");
    expect(source).toContain("extraResource");
    expect(source).toContain("\"resources\", \"icon.ico\"");
    expect(source).toContain("\"resources\", \"icon.icns\"");
    expect(source).toContain("\"resources\", \"icon.png\"");
    expect(source).toContain("\"resources\", \"yt-dlp\"");
    expect(source).toContain("\"resources\", \"trayTemplate.png\"");
    expect(source).toContain("\"resources\", \"trayTemplate@2x.png\"");
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

  it("ships monochrome macOS tray template assets", () => {
    const trayIcon = readFileSync(path.join(desktopAppRoot, "resources", "trayTemplate.png"));
    const trayIcon2x = readFileSync(path.join(desktopAppRoot, "resources", "trayTemplate@2x.png"));

    expect(trayIcon.byteLength).toBeGreaterThan(0);
    expect(trayIcon2x.byteLength).toBeGreaterThan(0);
  });

  it("sets the macOS dock icon explicitly during app startup", () => {
    const source = readDesktopFile("src/main/index.ts");

    expect(source).toContain("process.platform === \"darwin\"");
    expect(source).toContain("app.dock?.setIcon(resolveBundledResource(\"icon.png\"))");
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
    expect(source).toContain("return \"trayTemplate.png\"");
    expect(source).toContain("resolveBundledResource(this.getWindowIconName())");
    expect(source).toContain("resolveBundledResource(this.getTrayIconName())");
    expect(source).not.toContain("app.getPath(\"assets\")");
  });

  it("creates the tray with a stable GUID", () => {
    const source = readDesktopFile("src/main/window/trayManager.ts");

    expect(source).toMatch(/const TRAY_GUID = "[^"]{36}"/);
    expect(source).toContain("new Tray(icon, TRAY_GUID)");
    expect(source).toContain("icon.setTemplateImage(true)");
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
    const readme = readFileSync(path.join(repoRoot, "README.md"), "utf8");
    const deployment = readFileSync(path.join(repoRoot, "DEPLOYMENT.md"), "utf8");

    expect(packageJson.scripts?.["dist:all"]).toBeUndefined();
    expect(readme).not.toContain("dist:all");
    expect(readme).toContain("run on the matching host platform");
    expect(deployment).not.toContain("dist:all");
    expect(deployment).toContain("Build each target on its matching host platform");
  });
});
