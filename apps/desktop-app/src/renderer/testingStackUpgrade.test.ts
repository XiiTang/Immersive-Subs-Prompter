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
  it("pins current patch versions for the shared build and test toolchain", () => {
    const desktopPackage = readJson<{
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    }>(path.join(desktopAppRoot, "package.json"));
    const extensionPackage = readJson<{
      devDependencies?: Record<string, string>;
    }>(path.join(extensionRoot, "package.json"));
    const contractsPackage = readJson<{
      devDependencies?: Record<string, string>;
    }>(path.join(repoRoot, "packages", "contracts", "package.json"));
    const pluginSdkPackage = readJson<{
      devDependencies?: Record<string, string>;
    }>(path.join(repoRoot, "packages", "plugin-sdk", "package.json"));

    expect(desktopPackage.dependencies?.["@chenglou/pretext"]).toBe("0.0.7");
    expect(desktopPackage.dependencies?.koffi).toBe("2.16.2");
    expect(desktopPackage.devDependencies?.["@types/node"]).toBe("25.6.2");
    expect(desktopPackage.devDependencies?.["@vitejs/plugin-vue"]).toBe("6.0.6");
    expect(desktopPackage.devDependencies?.["@vitest/browser-playwright"]).toBe("4.1.5");
    expect(desktopPackage.devDependencies?.["@vue/test-utils"]).toBe("2.4.10");
    expect(desktopPackage.devDependencies?.jsdom).toBe("29.1.1");
    expect(desktopPackage.devDependencies?.typescript).toBe("6.0.3");
    expect(desktopPackage.devDependencies?.vite).toBe("8.0.11");
    expect(desktopPackage.devDependencies?.vitest).toBe("4.1.5");
    expect(desktopPackage.devDependencies?.["vue-tsc"]).toBe("3.2.8");

    expect(extensionPackage.devDependencies?.["@types/chrome"]).toBe("0.1.42");
    expect(extensionPackage.devDependencies?.["@types/node"]).toBe("25.6.2");
    expect(extensionPackage.devDependencies?.jsdom).toBe("29.1.1");
    expect(extensionPackage.devDependencies?.typescript).toBe("6.0.3");
    expect(extensionPackage.devDependencies?.vitest).toBe("4.1.5");

    expect(contractsPackage.devDependencies?.typescript).toBe("6.0.3");
    expect(contractsPackage.devDependencies?.vitest).toBe("4.1.5");
    expect(pluginSdkPackage.devDependencies?.typescript).toBe("6.0.3");
    expect(pluginSdkPackage.devDependencies?.vitest).toBe("4.1.5");
  });

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
