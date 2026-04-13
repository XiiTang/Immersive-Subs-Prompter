import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const rendererRoot = path.resolve(import.meta.dirname);
const desktopAppRoot = path.resolve(rendererRoot, "..", "..");
const repoRoot = path.resolve(desktopAppRoot, "..", "..");
const extensionRoot = path.resolve(repoRoot, "apps", "extension");

function readJson<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, "utf8")) as T;
}

describe("workspace contracts integration", () => {
  it("wires both apps to the shared contracts package from the root workspace", () => {
    const desktopPackage = readJson<{
      dependencies?: Record<string, string>;
      scripts?: Record<string, string>;
    }>(path.join(desktopAppRoot, "package.json"));
    const extensionPackage = readJson<{
      dependencies?: Record<string, string>;
      scripts?: Record<string, string>;
    }>(path.join(extensionRoot, "package.json"));
    const rootPackage = readJson<{
      scripts?: Record<string, string>;
    }>(path.join(repoRoot, "package.json"));

    expect(desktopPackage.dependencies?.["@immersive-subs/contracts"]).toBe("workspace:*");
    expect(extensionPackage.dependencies?.["@immersive-subs/contracts"]).toBe("workspace:*");
    expect(desktopPackage.scripts?.test).toBe("node ./scripts/run-renderer-tests.mjs");
    expect(extensionPackage.scripts?.typecheck).toBe(
      "pnpm --filter @immersive-subs/contracts build && tsc -p tsconfig.json --noEmit"
    );
    expect(rootPackage.scripts?.["build:desktop"]).toBe("pnpm --filter @immersive-subs/desktop-app build");
    expect(rootPackage.scripts?.["build:extension"]).toBe("pnpm --filter @immersive-subs/extension build");
  });

  it("keeps shared TypeScript strictness at the repo root instead of duplicating it per app", () => {
    const baseConfig = readJson<{ compilerOptions?: Record<string, unknown> }>(
      path.join(repoRoot, "tsconfig.base.json")
    );
    const desktopTsconfig = readJson<{ extends?: string }>(path.join(desktopAppRoot, "tsconfig.json"));
    const extensionTsconfig = readJson<{ extends?: string; compilerOptions?: Record<string, unknown> }>(
      path.join(extensionRoot, "tsconfig.json")
    );

    expect(baseConfig.compilerOptions?.strict).toBe(true);
    expect(baseConfig.compilerOptions?.noImplicitOverride).toBe(true);
    expect(desktopTsconfig.extends).toBe("../../tsconfig.base.json");
    expect(extensionTsconfig.extends).toBe("../../tsconfig.base.json");
    expect(extensionTsconfig.compilerOptions?.noEmit).toBe(true);
  });

  it("removes standalone npm lockfiles from both moved apps", () => {
    expect(existsSync(path.join(desktopAppRoot, "package-lock.json"))).toBe(false);
    expect(existsSync(path.join(extensionRoot, "package-lock.json"))).toBe(false);
  });
});
