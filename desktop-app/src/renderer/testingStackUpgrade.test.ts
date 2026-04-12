import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const rendererRoot = path.resolve(import.meta.dirname);
const desktopAppRoot = path.resolve(rendererRoot, "..", "..");
const repoRoot = path.resolve(desktopAppRoot, "..");
const extensionRoot = path.resolve(repoRoot, "extension");

function readJson<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, "utf8")) as T;
}

function readText(filePath: string) {
  return readFileSync(filePath, "utf8");
}

describe("testing stack upgrade", () => {
  it("pins desktop renderer tests and runtime helpers to the final exact package versions", () => {
    const packageJson = readJson<{
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
      scripts?: Record<string, string>;
    }>(path.join(desktopAppRoot, "package.json"));
    const vitestConfig = readText(path.join(desktopAppRoot, "vitest.config.ts"));

    expect(packageJson.dependencies?.["iconv-lite"]).toBe("0.7.2");
    expect(packageJson.dependencies?.ws).toBe("8.20.0");
    expect(packageJson.devDependencies?.vitest).toBe("4.1.4");
    expect(packageJson.devDependencies?.jsdom).toBe("29.0.2");
    expect(packageJson.devDependencies?.["@vitest/browser-playwright"]).toBe("4.1.4");
    expect(packageJson.devDependencies?.playwright).toBe("1.59.1");
    expect(packageJson.scripts?.["test:renderer"]).toContain("vitest run");
    expect(vitestConfig).toContain("projects:");
    expect(vitestConfig).toContain("name: \"browser\"");
    expect(vitestConfig).toContain("provider: playwright(");
    expect(vitestConfig).toContain("instances:");
    expect(vitestConfig).toContain("browser: \"chromium\"");
    expect(vitestConfig).toContain("mode: \"retain-on-failure\"");
    expect(vitestConfig).toContain("tracesDir: \"./.vitest-traces\"");
  });

  it("pins extension tests to the final exact package versions", () => {
    const packageJson = readJson<{
      devDependencies?: Record<string, string>;
      scripts?: Record<string, string>;
    }>(path.join(extensionRoot, "package.json"));
    const vitestConfig = readText(path.join(extensionRoot, "vitest.config.js"));

    expect(packageJson.devDependencies?.vitest).toBe("4.1.4");
    expect(packageJson.devDependencies?.jsdom).toBe("29.0.2");
    expect(packageJson.scripts?.test).toBe("vitest run");
    expect(vitestConfig).toContain('environment: "jsdom"');
    expect(vitestConfig).not.toContain("workspace");
  });

  it("documents the final Playwright and jsdom package baselines in the repository README", () => {
    const readme = readText(path.join(repoRoot, "README.md"));

    expect(readme).toContain("Node.js 24");
    expect(readme).toContain("Vitest Browser Mode");
    expect(readme).toContain("Playwright 1.59.1");
    expect(readme).toContain("jsdom 29.0.2");
    expect(readme).toContain("visual regression");
  });

  it("ignores Vitest browser-mode failure artifacts in git", () => {
    const gitignore = readText(path.join(repoRoot, ".gitignore"));

    expect(gitignore).toContain(".vitest-a/");
    expect(gitignore).toContain(".vitest-traces/");
  });

  it("documents the settings window preload and main-process wiring", () => {
    const preload = readText(path.join(desktopAppRoot, "src/preload.cts"));
    const windowHandlers = readText(path.join(desktopAppRoot, "src/main/ipc/handlers/windowHandlers.ts"));
    const windowController = readText(path.join(desktopAppRoot, "src/main/window/windowController.ts"));

    expect(preload).toContain("openSettingsWindow");
    expect(windowHandlers).toContain("usp:open-settings-window");
    expect(windowController).toContain("openSettingsWindow()");
    expect(windowController).toContain("settingsWindowManager");
  });

  it("keeps the subtitle window free of embedded settings rendering", () => {
    const appVue = readText(path.join(desktopAppRoot, "src/renderer/App.vue"));

    expect(appVue).not.toContain("SettingsPanel");
    expect(appVue).not.toContain("window--settings-open");
  });

  it("removes settings migration leftovers once the dedicated window is in place", () => {
    const preload = readText(path.join(desktopAppRoot, "src/preload.cts"));
    const ipcRouter = readText(path.join(desktopAppRoot, "src/main/ipc/ipcRouter.ts"));
    const windowController = readText(path.join(desktopAppRoot, "src/main/window/windowController.ts"));
    const shell = readText(path.join(desktopAppRoot, "src/renderer/components/settings/SettingsWindowShell.vue"));

    expect(existsSync(path.join(desktopAppRoot, "src/renderer/components/SettingsPanel.vue"))).toBe(false);
    expect(preload).not.toContain("getWindowKind");
    expect(ipcRouter).not.toContain("getSettingsWindow");
    expect(windowController).not.toContain("getSettingsWindow:");
    expect(shell).toContain("currentSection === 'cache'");
    expect(shell).not.toContain("<SettingsCache v-else />");
  });
});
