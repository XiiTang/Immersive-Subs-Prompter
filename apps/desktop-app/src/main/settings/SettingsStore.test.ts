import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { promises as fsp } from "node:fs";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Override electron.app.getPath to point at a fresh tmp dir per test so the
// SettingsStore writes don't collide with parallel suites.
let userDataDir: string;

vi.mock("electron", async () => {
  const os = await import("node:os");
  const path = await import("node:path");
  return {
    app: {
      isReady: () => true,
      whenReady: async () => undefined,
      getPath: (_name: string) =>
        (globalThis as any).__SETTINGS_STORE_USERDATA__ ??
        path.join(os.tmpdir(), "usp-settings-fallback"),
      getVersion: () => "0.0.0-test",
      getAppPath: () => os.tmpdir()
    }
  };
});

beforeEach(async () => {
  userDataDir = await fsp.mkdtemp(path.join(os.tmpdir(), "usp-settings-"));
  (globalThis as any).__SETTINGS_STORE_USERDATA__ = userDataDir;
});

afterEach(async () => {
  await fsp.rm(userDataDir, { recursive: true, force: true });
  delete (globalThis as any).__SETTINGS_STORE_USERDATA__;
  vi.resetModules();
});

async function loadStore() {
  const mod = await import("./SettingsStore.js");
  return new mod.SettingsStore();
}

describe("SettingsStore", () => {
  it("initializes with defaults when no file exists", async () => {
    const store = await loadStore();
    const settings = store.get();
    expect(settings.profiles.length).toBeGreaterThan(0);
    expect(settings.defaultProfileId).toBe(settings.profiles.at(-1)?.id);
    expect(settings.network.endpoints).toEqual([
      { id: "default", host: "127.0.0.1", port: 44501 }
    ]);
    expect(settings.network.authToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("preserves current network settings when an update contains invalid endpoints", async () => {
    const store = await loadStore();
    const currentNetwork = store.get().network;

    expect(() =>
      store.update({
        network: {
          ...currentNetwork,
          endpoints: []
        }
      })
    ).toThrow("At least one network endpoint is required");

    expect(store.get().network).toEqual(currentNetwork);
  });

  it("persists updates to disk and survives a reload", async () => {
    const first = await loadStore();
    first.update({
      global: { ...first.get().global, language: "en" }
    });

    // Fresh instance should read the written state.
    vi.resetModules();
    const second = await loadStore();
    expect(second.get().global.language).toBe("en");
  });

  it("keeps previous settings in memory when persistence fails", async () => {
    const store = await loadStore();
    const previous = store.get();
    const writeFileSync = vi.spyOn(fs, "writeFileSync").mockImplementationOnce(() => {
      throw new Error("disk full");
    });

    expect(() =>
      store.update({
        global: { ...previous.global, language: "en" }
      })
    ).toThrow("disk full");

    expect(writeFileSync).toHaveBeenCalledTimes(1);
    expect(store.get()).toBe(previous);
    expect(store.get().global.language).toBe(previous.global.language);
  });

  it("loads defaults when the settings file is corrupted", async () => {
    const filePath = path.join(userDataDir, "settings.json");
    await fsp.mkdir(userDataDir, { recursive: true });
    await fsp.writeFile(filePath, "{not valid json", "utf-8");

    const store = await loadStore();

    expect(store.get().network.endpoints).toEqual([
      { id: "default", host: "127.0.0.1", port: 44501 }
    ]);
    expect(store.get().network.authToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("rejects defaultProfileId updates", async () => {
    const store = await loadStore();
    const current = store.get();
    expect(() => store.update({ defaultProfileId: "does-not-exist" })).toThrow(
      "defaultProfileId cannot be changed through settings updates"
    );
    expect(store.get().defaultProfileId).toBe(current.defaultProfileId);
  });

});
