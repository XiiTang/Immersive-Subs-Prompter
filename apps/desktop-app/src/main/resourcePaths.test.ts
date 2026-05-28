import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

describe("resolveBundledResource", () => {
  afterEach(() => {
    vi.resetModules();
    vi.doUnmock("electron");
  });

  it("resolves resources from the app resources directory in development", async () => {
    vi.doMock("electron", () => ({
      app: {
        isPackaged: false,
        getAppPath: () => "/workspace/desktop-app"
      }
    }));

    const { resolveBundledResource } = await import("./resourcePaths.js");

    expect(resolveBundledResource("icon.ico")).toBe(path.join("/workspace/desktop-app", "resources", "icon.ico"));
  });

  it("resolves resources from process.resourcesPath in packaged builds", async () => {
    vi.doMock("electron", () => ({
      app: {
        isPackaged: true,
        getAppPath: () => "/workspace/desktop-app"
      }
    }));
    const originalResourcesPath = process.resourcesPath;
    Object.defineProperty(process, "resourcesPath", {
      value: "/Applications/Immersive Subs Prompter.app/Contents/Resources",
      configurable: true
    });

    const { resolveBundledResource } = await import("./resourcePaths.js");

    expect(resolveBundledResource("icon.ico")).toBe(
      path.join("/Applications/Immersive Subs Prompter.app/Contents/Resources", "icon.ico")
    );

    Object.defineProperty(process, "resourcesPath", {
      value: originalResourcesPath,
      configurable: true
    });
  });
});
