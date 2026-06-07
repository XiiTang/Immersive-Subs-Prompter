import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";
import type { PluginManifest } from "./pluginManifest.js";
import { PluginRegistryStore } from "./pluginRegistryStore.js";

const tempDirs: string[] = [];

async function createTempPath() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "plugin-registry-store-"));
  tempDirs.push(dir);
  return path.join(dir, "registry.json");
}

const manifest: PluginManifest = {
  id: "word-lookup",
  author: { id: "xiitang", name: "XiiTang", url: "https://github.com/XiiTang" },
  version: "1.0.0",
  displayName: "Word Lookup",
  description: "Looks up words.",
  appCompatibility: { minVersion: "1.0.0" },
  package: {
    url: "https://plugins.example.test/word-lookup.usp-plugin",
    sha256: "a".repeat(64)
  },
  entry: { main: "main.js" },
  permissions: ["wordLookupProvider"]
};

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

  it("throws when the registry file is not the current object shape", async () => {
    const registryPath = await createTempPath();
    await fs.writeFile(registryPath, JSON.stringify({ plugins: [] }), "utf-8");
    const store = new PluginRegistryStore(registryPath);

    await expect(store.read()).rejects.toThrow("plugin registry must use the current object setting");
  });

  it("writes registry records keyed by plugin key", async () => {
    const registryPath = await createTempPath();
    const store = new PluginRegistryStore(registryPath);

    await store.writePlugin({
      pluginKey: "xiitang/word-lookup",
      manifest,
      sourceUrl: "https://raw.githubusercontent.com/XiiTang/Immersive-Subs-Prompter/main/plugin-repository/word-lookup/manifest.json",
      enabled: false,
      status: "disabled",
      error: null,
      installedAt: "2026-06-06T00:00:00.000Z",
      updatedAt: "2026-06-06T00:00:00.000Z"
    });

    await expect(store.read()).resolves.toEqual({
      plugins: {
        "xiitang/word-lookup": {
          pluginKey: "xiitang/word-lookup",
          manifest,
          sourceUrl: "https://raw.githubusercontent.com/XiiTang/Immersive-Subs-Prompter/main/plugin-repository/word-lookup/manifest.json",
          enabled: false,
          status: "disabled",
          error: null,
          installedAt: "2026-06-06T00:00:00.000Z",
          updatedAt: "2026-06-06T00:00:00.000Z"
        }
      }
    });
  });

  it("deletes plugin records by plugin key", async () => {
    const registryPath = await createTempPath();
    const store = new PluginRegistryStore(registryPath);

    await store.writePlugin({
      pluginKey: "xiitang/word-lookup",
      manifest,
      sourceUrl: "https://plugins.example.test/manifest.json",
      enabled: false,
      status: "disabled",
      error: null,
      installedAt: "2026-06-06T00:00:00.000Z",
      updatedAt: "2026-06-06T00:00:00.000Z"
    });
    await store.deletePlugin("xiitang/word-lookup");

    await expect(store.read()).resolves.toEqual({ plugins: {} });
  });

  it("rejects registry records whose author and id do not derive the registry key", async () => {
    const registryPath = await createTempPath();
    await fs.writeFile(
      registryPath,
      JSON.stringify({
        plugins: {
          "xiitang/word-lookup": {
            pluginKey: "xiitang/word-lookup",
            manifest: {
              ...manifest,
              author: { id: "other", name: "Other" }
            },
            sourceUrl: "https://plugins.example.test/manifest.json",
            enabled: false,
            status: "disabled",
            error: null,
            installedAt: "2026-06-06T00:00:00.000Z",
            updatedAt: "2026-06-06T00:00:00.000Z"
          }
        }
      }),
      "utf-8"
    );
    const store = new PluginRegistryStore(registryPath);

    await expect(store.read()).rejects.toThrow(
      "xiitang/word-lookup plugin registry record identity must match the current plugin key"
    );
  });

  it("rejects unreachable registry statuses", async () => {
    const registryPath = await createTempPath();
    await fs.writeFile(
      registryPath,
      JSON.stringify({
        plugins: {
          "xiitang/word-lookup": {
            pluginKey: "xiitang/word-lookup",
            manifest,
            sourceUrl: "https://plugins.example.test/manifest.json",
            enabled: false,
            status: "installing",
            error: null,
            installedAt: "2026-06-05T00:00:00.000Z",
            updatedAt: "2026-06-05T00:00:00.000Z"
          }
        }
      }),
      "utf-8"
    );
    const store = new PluginRegistryStore(registryPath);

    await expect(store.read()).rejects.toThrow("xiitang/word-lookup plugin registry record status must use the current status setting");
  });
});
