import { readFileSync } from "node:fs";
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
  it("pins desktop renderer tests to exact Vitest 4 and jsdom 29 versions", () => {
    const packageJson = readJson<{
      devDependencies?: Record<string, string>;
      scripts?: Record<string, string>;
    }>(path.join(desktopAppRoot, "package.json"));
    const vitestConfig = readText(path.join(desktopAppRoot, "vitest.config.ts"));

    expect(packageJson.devDependencies?.vitest).toBe("4.1.4");
    expect(packageJson.devDependencies?.jsdom).toBe("29.0.0");
    expect(packageJson.devDependencies?.["@vitest/browser-playwright"]).toBe("4.1.4");
    expect(packageJson.devDependencies?.playwright).toBe("1.55.1");
    expect(packageJson.scripts?.["test:renderer"]).toContain("vitest run");
    expect(vitestConfig).toContain("projects:");
    expect(vitestConfig).toContain("name: \"browser\"");
    expect(vitestConfig).toContain("provider: playwright(");
    expect(vitestConfig).toContain("instances:");
    expect(vitestConfig).toContain("browser: \"chromium\"");
    expect(vitestConfig).toContain("mode: \"retain-on-failure\"");
    expect(vitestConfig).toContain("tracesDir: \"./.vitest-traces\"");
  });

  it("pins extension tests to exact Vitest 4 and jsdom 29 versions", () => {
    const packageJson = readJson<{
      devDependencies?: Record<string, string>;
      scripts?: Record<string, string>;
    }>(path.join(extensionRoot, "package.json"));
    const vitestConfig = readText(path.join(extensionRoot, "vitest.config.js"));

    expect(packageJson.devDependencies?.vitest).toBe("4.1.4");
    expect(packageJson.devDependencies?.jsdom).toBe("29.0.0");
    expect(packageJson.scripts?.test).toBe("vitest run");
    expect(vitestConfig).toContain('environment: "jsdom"');
    expect(vitestConfig).not.toContain("workspace");
  });

  it("documents Node 24 and browser-mode visual regression testing in the repository README", () => {
    const readme = readText(path.join(repoRoot, "README.md"));

    expect(readme).toContain("Node.js 24");
    expect(readme).toContain("Vitest Browser Mode");
    expect(readme).toContain("Playwright");
    expect(readme).toContain("visual regression");
  });

  it("ignores Vitest browser-mode failure artifacts in git", () => {
    const gitignore = readText(path.join(repoRoot, ".gitignore"));

    expect(gitignore).toContain(".vitest-a/");
    expect(gitignore).toContain(".vitest-traces/");
  });
});
