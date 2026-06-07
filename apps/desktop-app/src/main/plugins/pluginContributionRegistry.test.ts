import { describe, expect, it, vi } from "vitest";
import { PluginContributionRegistry } from "./pluginContributionRegistry.js";

describe("PluginContributionRegistry", () => {
  it("routes word lookup calls to the enabled provider and unregisters by plugin id", async () => {
    const registry = new PluginContributionRegistry();
    const lookup = vi.fn(async (token: string) => ({ token, matches: [] }));

    registry.registerWordLookupProvider("xiitang/word-lookup", {
      lookup
    });

    await expect(registry.lookupWord("hello")).resolves.toEqual({ token: "hello", matches: [] });
    registry.unregisterPlugin("xiitang/word-lookup");
    await expect(registry.lookupWord("hello")).rejects.toThrow("No enabled word lookup provider.");
  });
});
