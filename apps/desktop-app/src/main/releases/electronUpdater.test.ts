import { spawnSync } from "node:child_process";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

const desktopAppRoot = path.resolve(import.meta.dirname, "..", "..", "..");

describe("Electron updater runtime adapter", () => {
  it("loads with Node's native ESM loader without initializing Electron's updater", () => {
    const build = spawnSync("pnpm", ["run", "build:main"], {
      cwd: desktopAppRoot,
      encoding: "utf8",
      shell: process.platform === "win32"
    });

    expect(build.status, build.stdout + build.stderr).toBe(0);

    const adapterUrl = pathToFileURL(path.join(desktopAppRoot, "dist", "main", "releases", "electronUpdater.js"));
    const load = spawnSync(
      process.execPath,
      [
        "--input-type=module",
        "--eval",
        `
          const adapter = await import(${JSON.stringify(adapterUrl.href)});
          if (typeof adapter.getElectronAutoUpdater !== "function") {
            throw new Error("getElectronAutoUpdater is not exported");
          }
        `
      ],
      {
        cwd: desktopAppRoot,
        encoding: "utf8"
      }
    );

    expect(load.status, load.stdout + load.stderr).toBe(0);
  }, 30_000);
});
