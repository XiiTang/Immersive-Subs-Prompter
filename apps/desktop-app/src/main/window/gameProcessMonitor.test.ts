import { describe, expect, it } from "vitest";
import { resolveGetWindowsModuleSpecifier } from "./gameProcessMonitor.js";

describe("GameProcessMonitor get-windows loading", () => {
  it("loads get-windows from the unpacked app resources in packaged macOS builds", () => {
    expect(
      resolveGetWindowsModuleSpecifier({
        isPackaged: true,
        platform: "darwin",
        resourcesPath: "/Applications/Immersive.app/Contents/Resources"
      })
    ).toBe(
      "file:///Applications/Immersive.app/Contents/Resources/app.asar.unpacked/node_modules/get-windows/index.js"
    );
  });

  it("uses normal package resolution outside packaged macOS builds", () => {
    expect(
      resolveGetWindowsModuleSpecifier({
        isPackaged: false,
        platform: "darwin",
        resourcesPath: "/Applications/Immersive.app/Contents/Resources"
      })
    ).toBe("get-windows");
  });
});
