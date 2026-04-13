import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function readJson<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, "utf8")) as T;
}

function readText(filePath: string) {
  return readFileSync(filePath, "utf8");
}

const rendererRoot = path.resolve(import.meta.dirname);
const desktopAppRoot = path.resolve(rendererRoot, "..", "..");
const repoRoot = path.resolve(desktopAppRoot, "..", "..");

describe("root workspace layout", () => {
  it("uses pnpm as the only workspace package manager", () => {
    const rootPackage = readJson<{ packageManager?: string; scripts?: Record<string, string> }>(
      path.join(repoRoot, "package.json")
    );
    const desktopPackage = readJson<{ scripts?: Record<string, string> }>(
      path.join(repoRoot, "apps", "desktop-app", "package.json")
    );
    const workspaceYaml = readText(path.join(repoRoot, "pnpm-workspace.yaml"));

    expect(rootPackage.packageManager).toMatch(/^pnpm@10\./);
    expect(rootPackage.scripts?.build).toBe("pnpm -r build");
    expect(rootPackage.scripts?.test).toBe("pnpm -r test");
    expect(rootPackage.scripts?.typecheck).toBe("pnpm -r typecheck");
    expect(desktopPackage.scripts?.test).toBe("node ./scripts/run-renderer-tests.mjs");
    expect(desktopPackage.scripts?.["test:renderer"]).toBe("node ./scripts/run-renderer-tests.mjs");
    expect(workspaceYaml).toContain("apps/*");
    expect(workspaceYaml).toContain("packages/*");
  });

  it("uses the final apps and packages directory layout", () => {
    expect(existsSync(path.join(repoRoot, "apps", "desktop-app", "package.json"))).toBe(true);
    expect(existsSync(path.join(repoRoot, "apps", "extension", "package.json"))).toBe(true);
    expect(existsSync(path.join(repoRoot, "packages", "contracts", "package.json"))).toBe(true);
    expect(existsSync(path.join(repoRoot, "desktop-app"))).toBe(false);
    expect(existsSync(path.join(repoRoot, "extension"))).toBe(false);
  });

  it("documents root pnpm workflows in the README", () => {
    const readme = readText(path.join(repoRoot, "README.md"));

    expect(readme).toContain("pnpm install");
    expect(readme).toContain("pnpm build");
    expect(readme).toContain("pnpm --filter @immersive-subs/desktop-app");
    expect(readme).toContain("pnpm --filter @immersive-subs/extension");
  });

  it("centralizes the shared TypeScript strictness baseline at the root", () => {
    const baseConfig = readJson<{ compilerOptions?: Record<string, unknown> }>(
      path.join(repoRoot, "tsconfig.base.json")
    );

    expect(baseConfig.compilerOptions?.strict).toBe(true);
    expect(baseConfig.compilerOptions?.noImplicitOverride).toBe(true);
    expect(baseConfig.compilerOptions?.useUnknownInCatchVariables).toBe(true);
  });
});
