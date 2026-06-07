import path from "node:path";
import { describe, expect, it } from "vitest";
import { getPluginInstallPath, getPluginVersionsPath } from "./pluginPaths.js";

describe("pluginPaths", () => {
  it("expands plugin keys into author and plugin install directories", () => {
    const root = path.join("tmp", "plugins");

    expect(getPluginInstallPath(root, "xiitang/word-lookup", "1.0.0")).toBe(
      path.join(root, "installed", "xiitang", "word-lookup", "1.0.0")
    );
    expect(getPluginVersionsPath(root, "xiitang/word-lookup")).toBe(
      path.join(root, "installed", "xiitang", "word-lookup")
    );
  });
});
