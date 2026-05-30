import { describe, expect, it, vi } from "vitest";
import { PluginHost } from "./pluginHost.js";
import type { PluginRegistryStore } from "./pluginRegistryStore.js";

describe("PluginHost", () => {
  it("rejects enabled registry records without bundled plugin code", async () => {
    const registryStore = {
      listPlugins: vi.fn(async () => [
        {
          id: "official.missing",
          enabled: true,
          error: null
        }
      ])
    } as unknown as PluginRegistryStore;
    const host = new PluginHost(registryStore);

    await expect(host.loadEnabledPlugins()).rejects.toThrow(
      'Plugin "official.missing" has no bundled code.'
    );
  });
});
