import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AppSettings } from "../types.js";
import { PluginContributionRegistry } from "./pluginContributionRegistry.js";
import { PluginManager } from "./pluginManager.js";
import { PluginRegistryStore } from "./pluginRegistryStore.js";
import type { PluginManifest } from "./pluginManifest.js";

const tempDirs: string[] = [];
const AUTHOR = { id: "xiitang", name: "XiiTang", url: "https://github.com/XiiTang" };
const OTHER_AUTHOR = { id: "other", name: "Other" };
const PLUGIN_KEY = "xiitang/word-lookup";
const OTHER_PLUGIN_KEY = "other/word-lookup";
const MEDIA_PLUGIN_KEY = "xiitang/media-source";

async function createTempDir() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "plugin-manager-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

function createSettings(): AppSettings {
  return {
    global: {
      autoLaunch: false,
      toggleWindowShortcut: "",
      gameProcessBlacklist: [],
      autoHidePanels: false,
      alwaysOnTop: "off",
      panelOpacity: 100,
      language: "en",
      appearance: { theme: "system" }
    },
    network: { endpoints: [], authToken: "0123456789abcdef0123456789abcdef" },
    profiles: [],
    defaultProfileId: "",
    rules: [],
    plugins: {},
    cache: { enabled: false, path: "", retentionDays: 7 }
  } as AppSettings;
}

const manifest: PluginManifest = {
  id: "word-lookup",
  author: AUTHOR,
  version: "1.2.3",
  displayName: "Community Word Lookup",
  description: "Looks up words.",
  appCompatibility: { minVersion: "1.0.0" },
  package: {
    url: "https://plugins.example.test/word-lookup.usp-plugin",
    sha256: "a".repeat(64)
  },
  entry: { main: "main.js" },
  permissions: ["settingsSchema", "wordLookupProvider"],
  contributions: {
    settings: [
      {
        id: "word-lookup.settings",
        title: "Word Lookup",
        schema: [{ id: "wordListPath", label: "Word List", type: "file", defaultValue: "" }]
      }
    ],
    wordLookup: true
  }
};

const mediaManifest: PluginManifest = {
  id: "media-source",
  author: AUTHOR,
  version: "1.0.0",
  displayName: "Community Media Source",
  description: "Adds media sessions.",
  appCompatibility: { minVersion: "1.0.0" },
  package: {
    url: "https://plugins.example.test/media-source.usp-plugin",
    sha256: "b".repeat(64)
  },
  entry: { main: "main.js" },
  permissions: ["settingsSchema", "mediaSourceAdapter"],
  contributions: {
    settings: [],
    mediaSource: true
  }
};

describe("PluginManager", () => {
  it("installs, enables, and deletes a downloaded plugin without keeping hidden config", async () => {
    const rootDir = await createTempDir();
    const installDir = path.join(rootDir, "installed", "xiitang", manifest.id, manifest.version);
    await fs.mkdir(installDir, { recursive: true });
    await fs.writeFile(path.join(installDir, "manifest.json"), JSON.stringify(manifest), "utf-8");
    await fs.writeFile(path.join(installDir, "main.js"), "", "utf-8");
    let settings = createSettings();
    const runtimeStop = vi.fn(async () => undefined);
    const registryStore = new PluginRegistryStore(path.join(rootDir, "registry.json"));
    const contributions = new PluginContributionRegistry();
    const manager = new PluginManager({
      rootDir,
      registryStore,
      contributionRegistry: contributions,
      installer: {
        preview: vi.fn(async () => manifest),
        install: vi.fn(async () => ({ manifest, installDir }))
      },
      getSettings: () => settings,
      replaceSettings: (next) => {
        settings = next;
      },
      createRuntime: vi.fn(async () => ({
        getWordLookupProvider: () => ({
          lookup: async (token: string) => ({ token, matches: [] })
        }),
        getTranscriptionProvider: () => null,
        getMediaSourceAdapter: () => null,
        updateConfig: vi.fn(async () => undefined),
        stop: runtimeStop
      }))
    });

    await manager.install("https://plugins.example.test/manifest.json", manifest);
    expect(settings.plugins[PLUGIN_KEY]?.config).toEqual({ wordListPath: "" });

    await manager.enable(PLUGIN_KEY);
    await expect(contributions.lookupWord("hello")).resolves.toEqual({ token: "hello", matches: [] });

    await manager.delete(PLUGIN_KEY);
    await expect(registryStore.read()).resolves.toEqual({ plugins: {} });
    expect(settings.plugins[PLUGIN_KEY]).toBeUndefined();
    expect(runtimeStop).toHaveBeenCalledTimes(1);
  });

  it("requires a confirmed manifest before installing a plugin", async () => {
    const rootDir = await createTempDir();
    const installDir = path.join(rootDir, "installed", "xiitang", manifest.id, manifest.version);
    await fs.mkdir(installDir, { recursive: true });
    await fs.writeFile(path.join(installDir, "manifest.json"), JSON.stringify(manifest), "utf-8");
    await fs.writeFile(path.join(installDir, "main.js"), "", "utf-8");
    const installer = {
      preview: vi.fn(async () => manifest),
      install: vi.fn(async () => ({ manifest, installDir }))
    };
    const manager = new PluginManager({
      rootDir,
      registryStore: new PluginRegistryStore(path.join(rootDir, "registry.json")),
      installer,
      getSettings: () => createSettings(),
      replaceSettings: vi.fn()
    });

    await expect(manager.install("https://plugins.example.test/manifest.json", undefined as any)).rejects.toThrow(
      "Plugin install requires a confirmed manifest"
    );
    expect(installer.install).not.toHaveBeenCalled();
  });

  it("restores an enabled runtime when deleting installed files fails", async () => {
    const rootDir = await createTempDir();
    const installDir = path.join(rootDir, "installed", "xiitang", manifest.id, manifest.version);
    const versionsDir = path.join(rootDir, "installed", "xiitang", manifest.id);
    await fs.mkdir(installDir, { recursive: true });
    await fs.writeFile(path.join(installDir, "manifest.json"), JSON.stringify(manifest), "utf-8");
    await fs.writeFile(path.join(installDir, "main.js"), "", "utf-8");
    let settings = createSettings();
    const onPluginContributionsRemoved = vi.fn();
    const registryStore = new PluginRegistryStore(path.join(rootDir, "registry.json"));
    const contributions = new PluginContributionRegistry();
    const runtimeStop = vi.fn(async () => undefined);
    const manager = new PluginManager({
      rootDir,
      registryStore,
      contributionRegistry: contributions,
      installer: {
        preview: vi.fn(async () => manifest),
        install: vi.fn(async () => ({ manifest, installDir }))
      },
      getSettings: () => settings,
      replaceSettings: (next) => {
        settings = next;
      },
      onPluginContributionsRemoved,
      createRuntime: vi.fn(async () => ({
        getWordLookupProvider: () => ({
          lookup: async (token: string) => ({ token })
        }),
        getTranscriptionProvider: () => null,
        getMediaSourceAdapter: () => null,
        updateConfig: vi.fn(async () => undefined),
        stop: runtimeStop
      }))
    });
    const originalRm = fs.rm.bind(fs);
    const rmSpy = vi.spyOn(fs, "rm").mockImplementation(async (targetPath, options) => {
      if (String(targetPath) === versionsDir) {
        throw new Error("remove failed");
      }
      return originalRm(targetPath, options);
    });

    try {
      await manager.install("https://plugins.example.test/manifest.json", manifest);
      await manager.enable(PLUGIN_KEY);

      await expect(manager.delete(PLUGIN_KEY)).rejects.toThrow("remove failed");

      await expect(registryStore.getPlugin(PLUGIN_KEY)).resolves.toMatchObject({
        enabled: true,
        status: "enabled",
        error: null
      });
      await expect(contributions.lookupWord("hello")).resolves.toEqual({ token: "hello" });
      expect(runtimeStop).toHaveBeenCalledTimes(1);
      expect(onPluginContributionsRemoved).not.toHaveBeenCalled();
    } finally {
      rmSpy.mockRestore();
    }
  });

  it("keeps a broken catalog row readable when delete partially removes installed files", async () => {
    const rootDir = await createTempDir();
    const installDir = path.join(rootDir, "installed", "xiitang", manifest.id, manifest.version);
    const versionsDir = path.join(rootDir, "installed", "xiitang", manifest.id);
    await fs.mkdir(installDir, { recursive: true });
    await fs.writeFile(path.join(installDir, "manifest.json"), JSON.stringify(manifest), "utf-8");
    await fs.writeFile(path.join(installDir, "main.js"), "", "utf-8");
    let settings = createSettings();
    const registryStore = new PluginRegistryStore(path.join(rootDir, "registry.json"));
    const manager = new PluginManager({
      rootDir,
      registryStore,
      installer: {
        preview: vi.fn(async () => manifest),
        install: vi.fn(async () => ({ manifest, installDir }))
      },
      getSettings: () => settings,
      replaceSettings: (next) => {
        settings = next;
      },
      createRuntime: vi.fn(async () => ({
        getWordLookupProvider: () => ({
          lookup: async (token: string) => ({ token })
        }),
        getTranscriptionProvider: () => null,
        getMediaSourceAdapter: () => null,
        updateConfig: vi.fn(async () => undefined),
        stop: vi.fn(async () => undefined)
      }))
    });
    const originalRm = fs.rm.bind(fs);
    const rmSpy = vi.spyOn(fs, "rm").mockImplementation(async (targetPath, options) => {
      if (String(targetPath) === versionsDir) {
        await originalRm(targetPath, options);
        throw new Error("partial remove failed");
      }
      return originalRm(targetPath, options);
    });

    try {
      await manager.install("https://plugins.example.test/manifest.json", manifest);
      await manager.enable(PLUGIN_KEY);

      await expect(manager.delete(PLUGIN_KEY)).rejects.toThrow("partial remove failed");

      await expect(manager.listCatalog()).resolves.toEqual([
        expect.objectContaining({
          pluginKey: PLUGIN_KEY,
          displayName: manifest.displayName,
          enabled: false,
          status: "broken",
          error: expect.stringContaining("partial remove failed")
        })
      ]);
    } finally {
      rmSpy.mockRestore();
    }
  });

  it("stops runtimes during shutdown without disabling plugins in the registry", async () => {
    const rootDir = await createTempDir();
    const installDir = path.join(rootDir, "installed", "xiitang", manifest.id, manifest.version);
    await fs.mkdir(installDir, { recursive: true });
    await fs.writeFile(path.join(installDir, "manifest.json"), JSON.stringify(manifest), "utf-8");
    await fs.writeFile(path.join(installDir, "main.js"), "", "utf-8");
    let settings = createSettings();
    const runtimeStop = vi.fn(async () => undefined);
    const registryStore = new PluginRegistryStore(path.join(rootDir, "registry.json"));
    const manager = new PluginManager({
      rootDir,
      registryStore,
      installer: {
        preview: vi.fn(async () => manifest),
        install: vi.fn(async () => ({ manifest, installDir }))
      },
      getSettings: () => settings,
      replaceSettings: (next) => {
        settings = next;
      },
      createRuntime: vi.fn(async () => ({
        getWordLookupProvider: () => null,
        getTranscriptionProvider: () => null,
        getMediaSourceAdapter: () => null,
        updateConfig: vi.fn(async () => undefined),
        stop: runtimeStop
      }))
    });

    await manager.install("https://plugins.example.test/manifest.json", manifest);
    await manager.enable(PLUGIN_KEY);

    await manager.shutdown();

    await expect(registryStore.getPlugin(PLUGIN_KEY)).resolves.toMatchObject({
      enabled: true,
      status: "enabled"
    });
    expect(runtimeStop).toHaveBeenCalledTimes(1);
  });

  it("notifies when plugin contributions are removed during disable and delete", async () => {
    const rootDir = await createTempDir();
    const installDir = path.join(rootDir, "installed", "xiitang", mediaManifest.id, mediaManifest.version);
    await fs.mkdir(installDir, { recursive: true });
    await fs.writeFile(path.join(installDir, "manifest.json"), JSON.stringify(mediaManifest), "utf-8");
    await fs.writeFile(path.join(installDir, "main.js"), "", "utf-8");
    let settings = createSettings();
    const onPluginContributionsRemoved = vi.fn();
    const registryStore = new PluginRegistryStore(path.join(rootDir, "registry.json"));
    const manager = new PluginManager({
      rootDir,
      registryStore,
      installer: {
        preview: vi.fn(async () => mediaManifest),
        install: vi.fn(async () => ({ manifest: mediaManifest, installDir }))
      },
      getSettings: () => settings,
      replaceSettings: (next) => {
        settings = next;
      },
      onPluginContributionsRemoved,
      createRuntime: vi.fn(async () => ({
        getWordLookupProvider: () => null,
        getTranscriptionProvider: () => null,
        getMediaSourceAdapter: () => ({
          handleConnectionMessage: vi.fn(async () => [])
        }),
        updateConfig: vi.fn(async () => undefined),
        stop: vi.fn(async () => undefined)
      }))
    });

    await manager.install("https://plugins.example.test/manifest.json", mediaManifest);
    await manager.enable(MEDIA_PLUGIN_KEY);
    await manager.disable(MEDIA_PLUGIN_KEY);
    await manager.enable(MEDIA_PLUGIN_KEY);
    await manager.delete(MEDIA_PLUGIN_KEY);

    expect(onPluginContributionsRemoved).toHaveBeenCalledTimes(2);
    expect(onPluginContributionsRemoved).toHaveBeenNthCalledWith(1, MEDIA_PLUGIN_KEY);
    expect(onPluginContributionsRemoved).toHaveBeenNthCalledWith(2, MEDIA_PLUGIN_KEY);
  });

  it("keeps the enabled old runtime and registry record when update download fails", async () => {
    const rootDir = await createTempDir();
    const installDir = path.join(rootDir, "installed", "xiitang", manifest.id, manifest.version);
    await fs.mkdir(installDir, { recursive: true });
    await fs.writeFile(path.join(installDir, "manifest.json"), JSON.stringify(manifest), "utf-8");
    await fs.writeFile(path.join(installDir, "main.js"), "", "utf-8");
    const nextManifest: PluginManifest = {
      ...manifest,
      version: "1.2.4",
      package: {
        url: "https://plugins.example.test/word-lookup-1.2.4.usp-plugin",
        sha256: "c".repeat(64)
      }
    };
    let settings = createSettings();
    const runtimeStop = vi.fn(async () => undefined);
    const registryStore = new PluginRegistryStore(path.join(rootDir, "registry.json"));
    const contributions = new PluginContributionRegistry();
    const manager = new PluginManager({
      rootDir,
      registryStore,
      contributionRegistry: contributions,
      installer: {
        preview: vi.fn(async () => nextManifest),
        install: vi
          .fn()
          .mockResolvedValueOnce({ manifest, installDir })
          .mockRejectedValueOnce(new Error("download failed"))
      },
      getSettings: () => settings,
      replaceSettings: (next) => {
        settings = next;
      },
      createRuntime: vi.fn(async () => ({
        getWordLookupProvider: () => ({
          lookup: async (token: string) => ({ token })
        }),
        getTranscriptionProvider: () => null,
        getMediaSourceAdapter: () => null,
        updateConfig: vi.fn(async () => undefined),
        stop: runtimeStop
      }))
    });

    await manager.install("https://plugins.example.test/manifest.json", manifest);
    await manager.enable(PLUGIN_KEY);

    await expect(manager.update(PLUGIN_KEY)).rejects.toThrow("download failed");

    await expect(registryStore.getPlugin(PLUGIN_KEY)).resolves.toMatchObject({
      manifest: expect.objectContaining({ version: manifest.version }),
      enabled: true,
      status: "enabled",
      error: null
    });
    await expect(contributions.lookupWord("hello")).resolves.toEqual({ token: "hello" });
    expect(runtimeStop).not.toHaveBeenCalled();
  });

  it("rejects update manifests that resolve to a different plugin key", async () => {
    const rootDir = await createTempDir();
    const installDir = path.join(rootDir, "installed", "xiitang", manifest.id, manifest.version);
    await fs.mkdir(installDir, { recursive: true });
    await fs.writeFile(path.join(installDir, "manifest.json"), JSON.stringify(manifest), "utf-8");
    await fs.writeFile(path.join(installDir, "main.js"), "", "utf-8");
    const otherManifest: PluginManifest = {
      ...manifest,
      author: OTHER_AUTHOR,
      version: "2.0.0",
      package: {
        url: "https://plugins.example.test/other-word-lookup.usp-plugin",
        sha256: "d".repeat(64)
      }
    };
    const registryStore = new PluginRegistryStore(path.join(rootDir, "registry.json"));
    const originalRecord = {
      pluginKey: PLUGIN_KEY,
      manifest,
      sourceUrl: "https://plugins.example.test/manifest.json",
      enabled: false,
      status: "disabled" as const,
      error: null,
      installedAt: "2026-06-06T00:00:00.000Z",
      updatedAt: "2026-06-06T00:00:00.000Z"
    };
    await registryStore.writePlugin(originalRecord);
    const manager = new PluginManager({
      rootDir,
      registryStore,
      installer: {
        preview: vi.fn(async () => otherManifest),
        install: vi.fn(async () => ({
          manifest: otherManifest,
          installDir: path.join(rootDir, "installed", otherManifest.id, otherManifest.version)
        }))
      },
      getSettings: () => createSettings(),
      replaceSettings: vi.fn()
    });

    await expect(manager.update(PLUGIN_KEY)).rejects.toThrow(
      "Plugin update source for xiitang/word-lookup returned other/word-lookup"
    );

    await expect(registryStore.getPlugin(PLUGIN_KEY)).resolves.toEqual(originalRecord);
  });

  it("rejects reinstalling the same plugin version", async () => {
    const rootDir = await createTempDir();
    const installDir = path.join(rootDir, "installed", "xiitang", manifest.id, manifest.version);
    await fs.mkdir(installDir, { recursive: true });
    await fs.writeFile(path.join(installDir, "manifest.json"), JSON.stringify(manifest), "utf-8");
    await fs.writeFile(path.join(installDir, "main.js"), "", "utf-8");
    const registryStore = new PluginRegistryStore(path.join(rootDir, "registry.json"));
    await registryStore.writePlugin({
      pluginKey: PLUGIN_KEY,
      manifest,
      sourceUrl: "https://plugins.example.test/manifest.json",
      enabled: false,
      status: "disabled",
      error: null,
      installedAt: "2026-06-06T00:00:00.000Z",
      updatedAt: "2026-06-06T00:00:00.000Z"
    });
    const installer = {
      preview: vi.fn(async () => manifest),
      install: vi.fn(async () => ({ manifest, installDir }))
    };
    const manager = new PluginManager({
      rootDir,
      registryStore,
      installer,
      getSettings: () => createSettings(),
      replaceSettings: vi.fn()
    });

    await expect(manager.install("https://plugins.example.test/manifest.json", manifest)).rejects.toThrow(
      "xiitang/word-lookup 1.2.3 is already installed"
    );
    expect(installer.install).not.toHaveBeenCalled();
  });

  it("keeps plugins with the same short id separate by author key", async () => {
    const rootDir = await createTempDir();
    const otherManifest: PluginManifest = {
      ...manifest,
      author: OTHER_AUTHOR,
      displayName: "Other Word Lookup",
      package: {
        url: "https://plugins.example.test/other-word-lookup.usp-plugin",
        sha256: "f".repeat(64)
      }
    };
    const installDir = path.join(rootDir, "installed", "xiitang", manifest.id, manifest.version);
    const otherInstallDir = path.join(rootDir, "installed", "other", otherManifest.id, otherManifest.version);
    await fs.mkdir(installDir, { recursive: true });
    await fs.mkdir(otherInstallDir, { recursive: true });
    await fs.writeFile(path.join(installDir, "manifest.json"), JSON.stringify(manifest), "utf-8");
    await fs.writeFile(path.join(otherInstallDir, "manifest.json"), JSON.stringify(otherManifest), "utf-8");
    await fs.writeFile(path.join(installDir, "main.js"), "", "utf-8");
    await fs.writeFile(path.join(otherInstallDir, "main.js"), "", "utf-8");
    let settings = createSettings();
    const registryStore = new PluginRegistryStore(path.join(rootDir, "registry.json"));
    const manager = new PluginManager({
      rootDir,
      registryStore,
      installer: {
        preview: vi.fn(async (sourceUrl) => sourceUrl.includes("other") ? otherManifest : manifest),
        install: vi.fn(async (sourceUrl) =>
          sourceUrl.includes("other")
            ? { manifest: otherManifest, installDir: otherInstallDir }
            : { manifest, installDir }
        )
      },
      getSettings: () => settings,
      replaceSettings: (next) => {
        settings = next;
      }
    });

    await manager.install("https://plugins.example.test/manifest.json", manifest);
    await manager.install("https://plugins.example.test/other-manifest.json", otherManifest);

    await expect(registryStore.read()).resolves.toMatchObject({
      plugins: {
        [PLUGIN_KEY]: { pluginKey: PLUGIN_KEY, manifest: expect.objectContaining({ id: "word-lookup", author: AUTHOR }) },
        [OTHER_PLUGIN_KEY]: { pluginKey: OTHER_PLUGIN_KEY, manifest: expect.objectContaining({ id: "word-lookup", author: OTHER_AUTHOR }) }
      }
    });
    expect(settings.plugins[PLUGIN_KEY]).toBeDefined();
    expect(settings.plugins[OTHER_PLUGIN_KEY]).toBeDefined();
    await expect(manager.listCatalog()).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ pluginKey: PLUGIN_KEY, id: "word-lookup", author: AUTHOR }),
        expect.objectContaining({ pluginKey: OTHER_PLUGIN_KEY, id: "word-lookup", author: OTHER_AUTHOR })
      ])
    );
  });

  it("keeps a plugin enabled when installing a new package for the same plugin key", async () => {
    const rootDir = await createTempDir();
    const nextManifest: PluginManifest = {
      ...manifest,
      version: "1.2.4",
      package: {
        url: "https://plugins.example.test/word-lookup-1.2.4.usp-plugin",
        sha256: "c".repeat(64)
      }
    };
    const installDir = path.join(rootDir, "installed", "xiitang", manifest.id, manifest.version);
    const nextInstallDir = path.join(rootDir, "installed", "xiitang", nextManifest.id, nextManifest.version);
    await fs.mkdir(installDir, { recursive: true });
    await fs.mkdir(nextInstallDir, { recursive: true });
    await fs.writeFile(path.join(installDir, "manifest.json"), JSON.stringify(manifest), "utf-8");
    await fs.writeFile(path.join(nextInstallDir, "manifest.json"), JSON.stringify(nextManifest), "utf-8");
    await fs.writeFile(path.join(installDir, "main.js"), "", "utf-8");
    await fs.writeFile(path.join(nextInstallDir, "main.js"), "", "utf-8");
    let settings = createSettings();
    const runtimeStop = vi.fn(async () => undefined);
    const registryStore = new PluginRegistryStore(path.join(rootDir, "registry.json"));
    const contributions = new PluginContributionRegistry();
    const manager = new PluginManager({
      rootDir,
      registryStore,
      contributionRegistry: contributions,
      installer: {
        preview: vi.fn(async (sourceUrl) => sourceUrl.includes("next") ? nextManifest : manifest),
        install: vi
          .fn()
          .mockResolvedValueOnce({ manifest, installDir })
          .mockResolvedValueOnce({ manifest: nextManifest, installDir: nextInstallDir })
      },
      getSettings: () => settings,
      replaceSettings: (next) => {
        settings = next;
      },
      createRuntime: vi.fn(async (input) => {
        const version = String((input as { entryPath: string }).entryPath).includes(nextManifest.version)
          ? nextManifest.version
          : manifest.version;
        return {
          getWordLookupProvider: () => ({
            lookup: async (token: string) => ({ token, version })
          }),
          getTranscriptionProvider: () => null,
          getMediaSourceAdapter: () => null,
          updateConfig: vi.fn(async () => undefined),
          stop: runtimeStop
        };
      })
    });

    await manager.install("https://plugins.example.test/manifest.json", manifest);
    await manager.enable(PLUGIN_KEY);
    await expect(contributions.lookupWord("hello")).resolves.toEqual({ token: "hello", version: manifest.version });

    await manager.install("https://plugins.example.test/manifest-next.json", nextManifest);

    await expect(registryStore.getPlugin(PLUGIN_KEY)).resolves.toMatchObject({
      manifest: expect.objectContaining({ version: nextManifest.version }),
      enabled: true,
      status: "enabled",
      error: null
    });
    await expect(contributions.lookupWord("hello")).resolves.toEqual({ token: "hello", version: nextManifest.version });
    expect(runtimeStop).toHaveBeenCalledTimes(1);
  });

  it("restores the previous enabled version when installing a replacement cannot start", async () => {
    const rootDir = await createTempDir();
    const nextManifest: PluginManifest = {
      ...manifest,
      version: "1.2.4",
      package: {
        url: "https://plugins.example.test/word-lookup-1.2.4.usp-plugin",
        sha256: "e".repeat(64)
      }
    };
    const installDir = path.join(rootDir, "installed", "xiitang", manifest.id, manifest.version);
    const nextInstallDir = path.join(rootDir, "installed", "xiitang", nextManifest.id, nextManifest.version);
    await fs.mkdir(installDir, { recursive: true });
    await fs.mkdir(nextInstallDir, { recursive: true });
    await fs.writeFile(path.join(installDir, "manifest.json"), JSON.stringify(manifest), "utf-8");
    await fs.writeFile(path.join(nextInstallDir, "manifest.json"), JSON.stringify(nextManifest), "utf-8");
    await fs.writeFile(path.join(installDir, "main.js"), "", "utf-8");
    await fs.writeFile(path.join(nextInstallDir, "main.js"), "", "utf-8");
    let settings = createSettings();
    const runtimeStop = vi.fn(async () => undefined);
    const registryStore = new PluginRegistryStore(path.join(rootDir, "registry.json"));
    const contributions = new PluginContributionRegistry();
    const manager = new PluginManager({
      rootDir,
      registryStore,
      contributionRegistry: contributions,
      installer: {
        preview: vi.fn(async (sourceUrl) => sourceUrl.includes("next") ? nextManifest : manifest),
        install: vi.fn(async (sourceUrl) =>
          sourceUrl.includes("next")
            ? { manifest: nextManifest, installDir: nextInstallDir }
            : { manifest, installDir }
        )
      },
      getSettings: () => settings,
      replaceSettings: (next) => {
        settings = next;
      },
      createRuntime: vi.fn(async (input) => {
        const version = String((input as { entryPath: string }).entryPath).includes(nextManifest.version)
          ? nextManifest.version
          : manifest.version;
        if (version === nextManifest.version) {
          throw new Error("startup failed");
        }
        return {
          getWordLookupProvider: () => ({
            lookup: async (token: string) => ({ token, version })
          }),
          getTranscriptionProvider: () => null,
          getMediaSourceAdapter: () => null,
          updateConfig: vi.fn(async () => undefined),
          stop: runtimeStop
        };
      })
    });

    await manager.install("https://plugins.example.test/manifest.json", manifest);
    await manager.enable(PLUGIN_KEY);

    await expect(manager.install("https://plugins.example.test/manifest-next.json", nextManifest)).rejects.toThrow("startup failed");

    await expect(registryStore.getPlugin(PLUGIN_KEY)).resolves.toMatchObject({
      manifest: expect.objectContaining({ version: manifest.version }),
      enabled: true,
      status: "enabled",
      error: null
    });
    await expect(contributions.lookupWord("hello")).resolves.toEqual({ token: "hello", version: manifest.version });
  });

  it("marks a plugin broken and clears contributions when its runtime exits", async () => {
    const rootDir = await createTempDir();
    const installDir = path.join(rootDir, "installed", "xiitang", manifest.id, manifest.version);
    await fs.mkdir(installDir, { recursive: true });
    await fs.writeFile(path.join(installDir, "manifest.json"), JSON.stringify(manifest), "utf-8");
    await fs.writeFile(path.join(installDir, "main.js"), "", "utf-8");
    let settings = createSettings();
    let onRuntimeExit: ((error: Error) => void) | undefined;
    const onCatalogChanged = vi.fn(async () => undefined);
    const onPluginContributionsRemoved = vi.fn();
    const registryStore = new PluginRegistryStore(path.join(rootDir, "registry.json"));
    const contributions = new PluginContributionRegistry();
    const manager = new PluginManager({
      rootDir,
      registryStore,
      contributionRegistry: contributions,
      installer: {
        preview: vi.fn(async () => manifest),
        install: vi.fn(async () => ({ manifest, installDir }))
      },
      getSettings: () => settings,
      replaceSettings: (next) => {
        settings = next;
      },
      onCatalogChanged,
      onPluginContributionsRemoved,
      createRuntime: vi.fn(async (input) => {
        onRuntimeExit = (input as { onRuntimeExit?: (error: Error) => void }).onRuntimeExit;
        return {
          getWordLookupProvider: () => ({
            lookup: async (token: string) => ({ token })
          }),
          getTranscriptionProvider: () => null,
          getMediaSourceAdapter: () => null,
          updateConfig: vi.fn(async () => undefined),
          stop: vi.fn(async () => undefined)
        };
      })
    });

      await manager.install("https://plugins.example.test/manifest.json", manifest);
    await manager.enable(PLUGIN_KEY);
    expect(onRuntimeExit).toBeTypeOf("function");

    onRuntimeExit?.(new Error("worker exited"));

    await vi.waitFor(async () => {
      await expect(registryStore.getPlugin(PLUGIN_KEY)).resolves.toMatchObject({
        enabled: false,
        status: "broken",
        error: "worker exited"
      });
    });
    await expect(contributions.lookupWord("hello")).rejects.toThrow("No enabled word lookup provider.");
    expect(onCatalogChanged).toHaveBeenCalledTimes(1);
    expect(onPluginContributionsRemoved).toHaveBeenCalledWith(PLUGIN_KEY);
  });

  it("notifies the catalog when enabling a plugin marks it broken", async () => {
    const rootDir = await createTempDir();
    const installDir = path.join(rootDir, "installed", "xiitang", manifest.id, manifest.version);
    await fs.mkdir(installDir, { recursive: true });
    await fs.writeFile(path.join(installDir, "manifest.json"), JSON.stringify(manifest), "utf-8");
    await fs.writeFile(path.join(installDir, "main.js"), "", "utf-8");
    let settings = createSettings();
    const onCatalogChanged = vi.fn(async () => undefined);
    const registryStore = new PluginRegistryStore(path.join(rootDir, "registry.json"));
    const manager = new PluginManager({
      rootDir,
      registryStore,
      installer: {
        install: vi.fn(async () => ({ manifest, installDir }))
      },
      getSettings: () => settings,
      replaceSettings: (next) => {
        settings = next;
      },
      onCatalogChanged,
      createRuntime: vi.fn(async () => {
        throw new Error("startup failed");
      })
    });

    await manager.install("https://plugins.example.test/manifest.json", manifest);

    await expect(manager.enable(PLUGIN_KEY)).rejects.toThrow("startup failed");

    await expect(registryStore.getPlugin(PLUGIN_KEY)).resolves.toMatchObject({
      enabled: false,
      status: "broken",
      error: "startup failed"
    });
    expect(onCatalogChanged).toHaveBeenCalledTimes(1);
  });

  it("pushes current plugin config and derived access grants into enabled runtimes", async () => {
    const rootDir = await createTempDir();
    const installDir = path.join(rootDir, "installed", "xiitang", manifest.id, manifest.version);
    await fs.mkdir(installDir, { recursive: true });
    await fs.writeFile(path.join(installDir, "manifest.json"), JSON.stringify({
      ...manifest,
      permissions: ["settingsSchema", "readSelectedFile", "wordLookupProvider"]
    }), "utf-8");
    await fs.writeFile(path.join(installDir, "main.js"), "", "utf-8");
    let settings = createSettings();
    const updateConfig = vi.fn(async () => undefined);
    const registryStore = new PluginRegistryStore(path.join(rootDir, "registry.json"));
    const manager = new PluginManager({
      rootDir,
      registryStore,
      installer: {
        install: vi.fn(async () => ({
          manifest: {
            ...manifest,
            permissions: ["settingsSchema", "readSelectedFile", "wordLookupProvider"]
          },
          installDir
        }))
      },
      getSettings: () => settings,
      replaceSettings: (next) => {
        settings = next;
      },
      createRuntime: vi.fn(async () => ({
        getWordLookupProvider: () => null,
        getTranscriptionProvider: () => null,
        getMediaSourceAdapter: () => null,
        updateConfig,
        stop: vi.fn(async () => undefined)
      }))
    });

    await manager.install("https://plugins.example.test/manifest.json", manifest);
    await manager.enable(PLUGIN_KEY);
    const wordListPath = path.join(rootDir, "words.jsonl");
    settings = {
      ...settings,
      plugins: {
        ...settings.plugins,
        [PLUGIN_KEY]: { config: { wordListPath } }
      }
    };

    await manager.refreshRuntimeConfigs();

    expect(updateConfig).toHaveBeenCalledWith({
      config: { wordListPath },
      allowedNetworkHosts: [],
      readableFiles: [wordListPath]
    });
  });

  it("registers plugin contributions that appear after runtime startup", async () => {
    const rootDir = await createTempDir();
    const installDir = path.join(rootDir, "installed", "xiitang", manifest.id, manifest.version);
    await fs.mkdir(installDir, { recursive: true });
    await fs.writeFile(path.join(installDir, "manifest.json"), JSON.stringify(manifest), "utf-8");
    await fs.writeFile(path.join(installDir, "main.js"), "", "utf-8");
    let settings = createSettings();
    let providerReady: (() => void) | undefined;
    let wordLookupProvider: { lookup(token: string): Promise<unknown> } | null = null;
    const registryStore = new PluginRegistryStore(path.join(rootDir, "registry.json"));
    const contributions = new PluginContributionRegistry();
    const manager = new PluginManager({
      rootDir,
      registryStore,
      contributionRegistry: contributions,
      installer: {
        install: vi.fn(async () => ({ manifest, installDir }))
      },
      getSettings: () => settings,
      replaceSettings: (next) => {
        settings = next;
      },
      createRuntime: vi.fn(async (input) => {
        providerReady = (input as { onContributionsChanged?: () => void }).onContributionsChanged;
        return {
          getWordLookupProvider: () => wordLookupProvider,
          getTranscriptionProvider: () => null,
          getMediaSourceAdapter: () => null,
          updateConfig: vi.fn(async () => undefined),
          stop: vi.fn(async () => undefined)
        };
      })
    });

    await manager.install("https://plugins.example.test/manifest.json", manifest);
    await manager.enable(PLUGIN_KEY);
    await expect(contributions.lookupWord("hello")).rejects.toThrow("No enabled word lookup provider.");

    wordLookupProvider = { lookup: async (token: string) => ({ token, source: "async" }) };
    expect(providerReady).toBeTypeOf("function");
    providerReady?.();

    await expect(contributions.lookupWord("hello")).resolves.toEqual({ token: "hello", source: "async" });
  });

  it("marks plugins broken and notifies the catalog when config refresh fails", async () => {
    const rootDir = await createTempDir();
    const installDir = path.join(rootDir, "installed", "xiitang", manifest.id, manifest.version);
    await fs.mkdir(installDir, { recursive: true });
    await fs.writeFile(path.join(installDir, "manifest.json"), JSON.stringify(manifest), "utf-8");
    await fs.writeFile(path.join(installDir, "main.js"), "", "utf-8");
    let settings = createSettings();
    const updateConfig = vi.fn(async () => {
      throw new Error("refresh failed");
    });
    const runtimeStop = vi.fn(async () => undefined);
    const onCatalogChanged = vi.fn(async () => undefined);
    const registryStore = new PluginRegistryStore(path.join(rootDir, "registry.json"));
    const manager = new PluginManager({
      rootDir,
      registryStore,
      installer: {
        install: vi.fn(async () => ({ manifest, installDir }))
      },
      getSettings: () => settings,
      replaceSettings: (next) => {
        settings = next;
      },
      onCatalogChanged,
      createRuntime: vi.fn(async () => ({
        getWordLookupProvider: () => null,
        getTranscriptionProvider: () => null,
        getMediaSourceAdapter: () => null,
        updateConfig,
        stop: runtimeStop
      }))
    });

    await manager.install("https://plugins.example.test/manifest.json", manifest);
    await manager.enable(PLUGIN_KEY);

    await manager.refreshRuntimeConfigs();

    await expect(registryStore.getPlugin(PLUGIN_KEY)).resolves.toMatchObject({
      enabled: false,
      status: "broken",
      error: "refresh failed"
    });
    expect(runtimeStop).toHaveBeenCalledTimes(1);
    expect(onCatalogChanged).toHaveBeenCalledTimes(1);
  });

  it("marks plugins broken when media-source settings refresh fails", async () => {
    const rootDir = await createTempDir();
    const installDir = path.join(rootDir, "installed", "xiitang", mediaManifest.id, mediaManifest.version);
    await fs.mkdir(installDir, { recursive: true });
    await fs.writeFile(path.join(installDir, "manifest.json"), JSON.stringify(mediaManifest), "utf-8");
    await fs.writeFile(path.join(installDir, "main.js"), "", "utf-8");
    let settings = createSettings();
    const updateConfig = vi.fn(async () => undefined);
    const handleSettingsUpdated = vi.fn(async () => {
      throw new Error("adapter refresh failed");
    });
    const runtimeStop = vi.fn(async () => undefined);
    const onCatalogChanged = vi.fn(async () => undefined);
    const registryStore = new PluginRegistryStore(path.join(rootDir, "registry.json"));
    const manager = new PluginManager({
      rootDir,
      registryStore,
      installer: {
        preview: vi.fn(async () => mediaManifest),
        install: vi.fn(async () => ({ manifest: mediaManifest, installDir }))
      },
      getSettings: () => settings,
      replaceSettings: (next) => {
        settings = next;
      },
      onCatalogChanged,
      createRuntime: vi.fn(async () => ({
        getWordLookupProvider: () => null,
        getTranscriptionProvider: () => null,
        getMediaSourceAdapter: () => ({
          handleSettingsUpdated
        }),
        updateConfig,
        stop: runtimeStop
      }))
    });

    await manager.install("https://plugins.example.test/manifest.json", mediaManifest);
    await manager.enable(MEDIA_PLUGIN_KEY);

    await manager.refreshRuntimeConfigs();

    expect(handleSettingsUpdated).toHaveBeenCalledWith(settings.plugins[MEDIA_PLUGIN_KEY]?.config ?? {});
    await expect(registryStore.getPlugin(MEDIA_PLUGIN_KEY)).resolves.toMatchObject({
      enabled: false,
      status: "broken",
      error: "adapter refresh failed"
    });
    expect(runtimeStop).toHaveBeenCalledTimes(1);
    expect(onCatalogChanged).toHaveBeenCalledTimes(1);
  });
});
