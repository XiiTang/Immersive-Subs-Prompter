import { describe, expect, it } from "vitest";
import { buildExtensionManifest, type ExtensionBuildTarget } from "./manifest";

const version = "9.8.7";

function pickSharedContract(target: ExtensionBuildTarget) {
  const manifest = buildExtensionManifest(target, version);
  return {
    manifest_version: manifest.manifest_version,
    name: manifest.name,
    default_locale: manifest.default_locale,
    description: manifest.description,
    author: manifest.author,
    version: manifest.version,
    permissions: manifest.permissions,
    host_permissions: manifest.host_permissions,
    content_scripts: manifest.content_scripts,
    action: manifest.action,
    icons: manifest.icons
  };
}

describe("extension manifest builder", () => {
  it("generates browser-specific background declarations", () => {
    const chromeManifest = buildExtensionManifest("chrome", version);
    const firefoxManifest = buildExtensionManifest("firefox", version);

    expect(chromeManifest.background).toEqual({
      service_worker: "dist/background.js",
      type: "module"
    });
    expect(firefoxManifest.background).toEqual({
      scripts: ["dist/background.js"],
      type: "module"
    });
  });

  it("keeps shared manifest fields identical between targets", () => {
    expect(pickSharedContract("chrome")).toEqual(pickSharedContract("firefox"));
  });

  it("keeps localized manifest metadata and package version in generated output", () => {
    const manifest = buildExtensionManifest("chrome", version);

    expect(manifest.name).toBe("__MSG_extensionName__");
    expect(manifest.description).toBe("__MSG_extensionDescription__");
    expect(manifest.default_locale).toBe("en");
    expect(manifest.action.default_title).toBe("__MSG_extensionName__");
    expect(manifest.version).toBe(version);
  });

  it("keeps Firefox-only publishing and CSP fields out of Chrome output", () => {
    const chromeManifest = buildExtensionManifest("chrome", version);
    const firefoxManifest = buildExtensionManifest("firefox", version);

    expect(chromeManifest).not.toHaveProperty("browser_specific_settings");
    expect(chromeManifest).not.toHaveProperty("content_security_policy");
    expect(firefoxManifest.browser_specific_settings?.gecko.id).toBe("sheixunixitang3@gmail.com");
    expect(firefoxManifest.browser_specific_settings?.gecko.strict_min_version).toBe("109.0");
    expect(firefoxManifest.content_security_policy?.extension_pages).toContain("connect-src ws: http: https:");
  });
});
