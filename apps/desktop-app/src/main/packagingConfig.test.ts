import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const desktopAppRoot = path.resolve(import.meta.dirname, "..", "..");

function readBuilderConfig(): string {
  return readFileSync(path.join(desktopAppRoot, "electron-builder.yml"), "utf8");
}

describe("desktop packaging config", () => {
  it("uses electron-builder with updater metadata and required resources", () => {
    const source = readBuilderConfig();

    expect(source).toContain("appId: com.sheixunixitang3.immersivesubsprompter");
    expect(source).toContain("productName: Immersive Subs Prompter");
    expect(source).toContain("provider: github");
    expect(source).toContain("owner: XiiTang");
    expect(source).toContain("repo: Immersive-Subs-Prompter");
    expect(source).toContain("artifactName: Immersive-Subs-Prompter-${version}-darwin-${arch}.${ext}");
    expect(source).toContain("artifactName: Immersive-Subs-Prompter-${version}-win32-${arch}-setup.${ext}");
    expect(source).toContain("artifactName: Immersive-Subs-Prompter-${version}-linux-${arch}.${ext}");
    expect(source).not.toContain("artifactName: ${productName}-");
    expect(source).toContain("target: dmg");
    expect(source).toContain("target: zip");
    expect(source).toContain("target: nsis");
    expect(source).toContain("target: AppImage");
    expect(source).toContain("node_modules/get-windows/**");
    expect(source).toContain("electronFuses:");
    expect(source).toContain("enableEmbeddedAsarIntegrityValidation: true");
    expect(source).toContain("onlyLoadAppFromAsar: true");

    for (const resource of ["icon.ico", "icon.icns", "icon.png", "trayTemplate.png", "trayTemplate@2x.png"]) {
      expect(source).toContain(resource);
      expect(existsSync(path.join(desktopAppRoot, "resources", resource))).toBe(true);
    }
  });
});
