import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { strToU8, zipSync } from "fflate";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PluginPackageInstaller } from "./pluginPackageInstaller.js";

const tempDirs: string[] = [];

async function createTempDir() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "plugin-package-installer-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

function sha256(buffer: Uint8Array) {
  return createHash("sha256").update(buffer).digest("hex");
}

function createPackage(manifest: Record<string, unknown>, main = "usp.registerWordLookupProvider({ lookup: async () => ({ matches: [] }) });") {
  return zipSync({
    "manifest.json": strToU8(JSON.stringify(manifest)),
    "main.js": strToU8(main)
  });
}

const XIITANG_AUTHOR = { id: "xiitang", name: "XiiTang", url: "https://github.com/XiiTang" };

describe("PluginPackageInstaller", () => {
  it("downloads, hashes, validates, and installs a plugin package", async () => {
    const root = await createTempDir();
    const packageManifest = {
      id: "word-lookup",
      author: XIITANG_AUTHOR,
      version: "1.0.0",
      displayName: "Community Word Lookup",
      description: "Looks up words.",
      appCompatibility: { minVersion: "1.0.0" },
      entry: { main: "main.js" },
      permissions: ["settingsSchema"],
      contributions: { settings: [] }
    };
    const archive = createPackage(packageManifest);
    const remoteManifest = {
      ...packageManifest,
      package: {
        url: "https://plugins.example.test/word-lookup.usp-plugin",
        sha256: sha256(archive)
      }
    };
    const installer = new PluginPackageInstaller({
      rootDir: root,
      fetchBytes: async (url) => {
        if (url === "https://plugins.example.test/manifest.json") {
          return Buffer.from(JSON.stringify(remoteManifest));
        }
        if (url === remoteManifest.package.url) {
          return Buffer.from(archive);
        }
        throw new Error(`unexpected url: ${url}`);
      }
    });

    const result = await installer.install("https://plugins.example.test/manifest.json", remoteManifest);

    expect(result.manifest.id).toBe("word-lookup");
    expect(result.installDir).toBe(path.join(root, "installed", "xiitang", "word-lookup", "1.0.0"));
    await expect(fs.readFile(path.join(result.installDir, "main.js"), "utf-8")).resolves.toContain("registerWordLookupProvider");
  });

  it("rejects install when the fetched manifest no longer matches the confirmed preview", async () => {
    const root = await createTempDir();
    const packageManifest = {
      id: "word-lookup",
      author: XIITANG_AUTHOR,
      version: "1.2.4",
      displayName: "Community Word Lookup",
      description: "Looks up words.",
      appCompatibility: { minVersion: "1.0.0" },
      entry: { main: "main.js" },
      permissions: ["settingsSchema"]
    };
    const archive = createPackage(packageManifest);
    const remoteManifest = {
      ...packageManifest,
      package: {
        url: "https://plugins.example.test/word-lookup.usp-plugin",
        sha256: sha256(archive)
      }
    };
    const confirmedManifest = {
      ...remoteManifest,
      version: "1.2.3"
    };
    const installer = new PluginPackageInstaller({
      rootDir: root,
      fetchBytes: async (url) => {
        if (url === "https://plugins.example.test/manifest.json") {
          return Buffer.from(JSON.stringify(remoteManifest));
        }
        if (url === remoteManifest.package.url) {
          return Buffer.from(archive);
        }
        throw new Error(`unexpected url: ${url}`);
      }
    });

    await expect(installer.install("https://plugins.example.test/manifest.json", confirmedManifest)).rejects.toThrow(
      "Plugin install manifest changed after confirmation"
    );
  });

  it("requires a confirmed preview manifest before installing", async () => {
    const root = await createTempDir();
    const packageManifest = {
      id: "word-lookup",
      author: XIITANG_AUTHOR,
      version: "1.0.0",
      displayName: "Community Word Lookup",
      description: "Looks up words.",
      appCompatibility: { minVersion: "1.0.0" },
      entry: { main: "main.js" },
      permissions: []
    };
    const archive = createPackage(packageManifest);
    const remoteManifest = {
      ...packageManifest,
      package: {
        url: "https://plugins.example.test/word-lookup.usp-plugin",
        sha256: sha256(archive)
      }
    };
    const installer = new PluginPackageInstaller({
      rootDir: root,
      fetchBytes: async (url) =>
        url.endsWith("manifest.json") ? Buffer.from(JSON.stringify(remoteManifest)) : Buffer.from(archive)
    });

    await expect(installer.install("https://plugins.example.test/manifest.json", undefined as any)).rejects.toThrow(
      "Plugin install requires a confirmed manifest"
    );
  });

  it("rejects a package when the sha256 does not match", async () => {
    const root = await createTempDir();
    const archive = createPackage({
      id: "bad",
      author: XIITANG_AUTHOR,
      version: "1.0.0",
      displayName: "Bad",
      description: "Bad plugin",
      appCompatibility: { minVersion: "1.0.0" },
      entry: { main: "main.js" },
      permissions: []
    });
    const remoteManifest = {
      id: "bad",
      author: XIITANG_AUTHOR,
      version: "1.0.0",
      displayName: "Bad",
      description: "Bad plugin",
      appCompatibility: { minVersion: "1.0.0" },
      package: {
        url: "https://plugins.example.test/bad.usp-plugin",
        sha256: "0".repeat(64)
      },
      entry: { main: "main.js" },
      permissions: []
    };
    const installer = new PluginPackageInstaller({
      rootDir: root,
      fetchBytes: async (url) =>
        url.endsWith("manifest.json") ? Buffer.from(JSON.stringify(remoteManifest)) : Buffer.from(archive)
    });

    await expect(installer.install("https://plugins.example.test/manifest.json", remoteManifest)).rejects.toThrow(
      "bad package sha256 mismatch"
    );
  });

  it("rejects local file install URLs", async () => {
    const root = await createTempDir();
    const manifestPath = path.join(root, "manifest.json");
    await fs.writeFile(manifestPath, "{}", "utf-8");
    const installer = new PluginPackageInstaller({ rootDir: root });

    await expect(installer.preview(pathToFileURL(manifestPath).toString())).rejects.toThrow(
      "Plugin download URLs must use https"
    );
  });

  it("rejects insecure http install URLs", async () => {
    const root = await createTempDir();
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}")));
    const installer = new PluginPackageInstaller({ rootDir: root });

    await expect(installer.preview("http://plugins.example.test/manifest.json")).rejects.toThrow(
      "Plugin download URLs must use https"
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it("restores an existing installed version when replacement fails", async () => {
    const root = await createTempDir();
    const packageManifest = {
      id: "word-lookup",
      author: XIITANG_AUTHOR,
      version: "1.0.0",
      displayName: "Community Word Lookup",
      description: "Looks up words.",
      appCompatibility: { minVersion: "1.0.0" },
      entry: { main: "main.js" },
      permissions: []
    };
    const archive = createPackage(packageManifest, "new plugin");
    const remoteManifest = {
      ...packageManifest,
      package: {
        url: "https://plugins.example.test/word-lookup.usp-plugin",
        sha256: sha256(archive)
      }
    };
    const installDir = path.join(root, "installed", "xiitang", packageManifest.id, packageManifest.version);
    await fs.mkdir(installDir, { recursive: true });
    await fs.writeFile(path.join(installDir, "manifest.json"), JSON.stringify(remoteManifest), "utf-8");
    await fs.writeFile(path.join(installDir, "main.js"), "old plugin", "utf-8");
    const originalRename = fs.rename;
    let renameCalls = 0;
    vi.spyOn(fs, "rename").mockImplementation(async (from, to) => {
      renameCalls += 1;
      if (renameCalls === 2) {
        throw new Error("rename failed");
      }
      return originalRename(from, to);
    });
    const installer = new PluginPackageInstaller({
      rootDir: root,
      fetchBytes: async (url) =>
        url.endsWith("manifest.json") ? Buffer.from(JSON.stringify(remoteManifest)) : Buffer.from(archive)
    });

    await expect(installer.install("https://plugins.example.test/manifest.json", remoteManifest)).rejects.toThrow("rename failed");

    await expect(fs.readFile(path.join(installDir, "main.js"), "utf-8")).resolves.toBe("old plugin");
  });
});
