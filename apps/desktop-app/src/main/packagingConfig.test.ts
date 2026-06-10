import { existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { FuseV1Options } from "@electron/fuses";
import { describe, expect, it } from "vitest";

const desktopAppRoot = path.resolve(import.meta.dirname, "..", "..");

async function loadForgeConfig(): Promise<any> {
  const module = await import(pathToFileURL(path.join(desktopAppRoot, "forge.config.mjs")).href);
  return module.default;
}

describe("desktop packaging config", () => {
  it("packages required runtime resources with ASAR integrity fuses enabled", async () => {
    const config = await loadForgeConfig();
    const resources = (config.packagerConfig.extraResource as string[]).map((resourcePath) =>
      path.relative(path.join(desktopAppRoot, "resources"), resourcePath).replaceAll("\\", "/")
    );

    expect(config.packagerConfig.asar).toMatchObject({
      unpackDir: "node_modules/get-windows"
    });
    expect(resources).toEqual(
      expect.arrayContaining([
        "icon.ico",
        "icon.icns",
        "icon.png",
        "trayTemplate.png",
        "trayTemplate@2x.png"
      ])
    );
    expect(resources).not.toContain("yt-dlp");

    for (const resource of resources) {
      expect(existsSync(path.join(desktopAppRoot, "resources", resource))).toBe(true);
    }

    const ignoredPaths = config.packagerConfig.ignore as RegExp[];
    expect(ignoredPaths.some((rule) => rule.test("/.vitest-attachments/trace.zip"))).toBe(true);

    const fusesPlugin = config.plugins.find((plugin: { name?: string }) => plugin.name === "fuses");
    expect(fusesPlugin?.config.strictlyRequireAllFuses).toBe(true);
    expect(fusesPlugin?.config[FuseV1Options.EnableEmbeddedAsarIntegrityValidation]).toBe(true);
    expect(fusesPlugin?.config[FuseV1Options.OnlyLoadAppFromAsar]).toBe(true);
    expect(fusesPlugin?.config[FuseV1Options.LoadBrowserProcessSpecificV8Snapshot]).toBe(false);
  });
});
