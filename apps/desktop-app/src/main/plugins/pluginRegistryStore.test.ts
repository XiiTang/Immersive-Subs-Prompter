import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";
import { PluginRegistryStore } from "./pluginRegistryStore.js";

const tempDirs: string[] = [];

async function createTempPath() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "plugin-registry-store-"));
  tempDirs.push(dir);
  return path.join(dir, "registry.json");
}

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true }))
  );
});

describe("PluginRegistryStore", () => {
  it("returns an empty registry when the file does not exist", async () => {
    const registryPath = await createTempPath();
    const store = new PluginRegistryStore(registryPath);

    await expect(store.read()).resolves.toEqual({ plugins: {} });
  });

  it("throws when the registry file contains invalid JSON", async () => {
    const registryPath = await createTempPath();
    await fs.writeFile(registryPath, "{broken", "utf-8");
    const store = new PluginRegistryStore(registryPath);

    await expect(store.read()).rejects.toThrow();
  });
});
