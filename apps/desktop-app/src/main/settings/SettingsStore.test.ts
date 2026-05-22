import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { promises as fsp } from "node:fs";
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
    expect(settings.network.host).toBe("127.0.0.1");
    expect(settings.network.authToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
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

  it("recovers to defaults if settings file is corrupted", async () => {
    const filePath = path.join(userDataDir, "settings.json");
    await fsp.mkdir(userDataDir, { recursive: true });
    await fsp.writeFile(filePath, "{not valid json", "utf-8");

    const store = await loadStore();
    expect(store.get().profiles.length).toBeGreaterThan(0);
  });

  it("rejects unknown defaultProfileId on sanitize", async () => {
    const store = await loadStore();
    const current = store.get();
    store.update({ defaultProfileId: "does-not-exist" });
    expect(store.get().defaultProfileId).toBe(current.defaultProfileId);
  });

  it("does not change the fallback profile through settings updates", async () => {
    const store = await loadStore();
    const current = store.get();
    const nonFallback = current.profiles.find((profile) => profile.id !== current.defaultProfileId);

    store.update({ defaultProfileId: nonFallback?.id ?? "does-not-exist" });

    expect(store.get().defaultProfileId).toBe(current.defaultProfileId);
    expect(store.get().profiles.at(-1)?.id).toBe(current.defaultProfileId);
  });
});
