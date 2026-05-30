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

  it("rejects boolean alwaysOnTop updates", async () => {
    const store = await loadStore();
    const previous = store.get();

    expect(() =>
      store.update({
        global: {
          ...previous.global,
          alwaysOnTop: true
        }
      } as never)
    ).toThrow("global.alwaysOnTop must use the current string setting");

    expect(store.get()).toBe(previous);
  });

  it("rejects invalid global field updates instead of sanitizing them", async () => {
    const store = await loadStore();
    const previous = store.get();

    expect(() =>
      store.update({
        global: {
          ...previous.global,
          autoLaunch: "yes"
        }
      } as never)
    ).toThrow("global.autoLaunch must use the current boolean setting");

    expect(store.get()).toBe(previous);
  });

  it("rejects incomplete appearance updates instead of filling defaults", async () => {
    const store = await loadStore();
    const previous = store.get();

    expect(() =>
      store.update({
        global: {
          ...previous.global,
          appearance: {}
        }
      } as never)
    ).toThrow("global.appearance.theme must use the current string setting");

    expect(store.get()).toBe(previous);
  });

  it("rejects global values that would otherwise be normalized", async () => {
    const store = await loadStore();
    const previous = store.get();

    expect(() =>
      store.update({
        global: {
          ...previous.global,
          language: " en "
        }
      } as never)
    ).toThrow("global.language must use the current supported language setting");

    expect(store.get()).toBe(previous);
  });

  it("rejects unknown global fields instead of writing removed settings", async () => {
    const store = await loadStore();
    const previous = store.get();

    expect(() =>
      store.update({
        global: {
          ...previous.global,
          closeBehavior: "tray"
        }
      } as never)
    ).toThrow("global contains unknown setting: closeBehavior");

    expect(store.get()).toBe(previous);
  });

  it("rejects string transcription extraParams updates", async () => {
    const store = await loadStore();
    const previous = store.get();
    const transcriptionConfig = previous.plugins["official.transcription"]!.config as any;

    expect(() =>
      store.update({
        plugins: {
          "official.transcription": {
            config: {
              activeConfigId: transcriptionConfig.activeConfigId,
              configs: [
                {
                  ...transcriptionConfig.configs[0],
                  extraParams: "{\"temperature\":\"0\"}"
                }
              ]
            }
          }
        }
      } as never)
    ).toThrow("transcription.extraParams must use the current object setting");

    expect(store.get()).toBe(previous);
  });

  it("rejects transcription extraParams values that are not current strings", async () => {
    const store = await loadStore();
    const previous = store.get();
    const transcriptionConfig = previous.plugins["official.transcription"]!.config as any;

    expect(() =>
      store.update({
        plugins: {
          "official.transcription": {
            config: {
              activeConfigId: transcriptionConfig.activeConfigId,
              configs: [
                {
                  ...transcriptionConfig.configs[0],
                  extraParams: { temperature: 0 }
                }
              ]
            }
          }
        }
      } as never)
    ).toThrow("transcription.extraParams values must use the current string setting");

    expect(store.get()).toBe(previous);
  });

  it("rejects incomplete transcription plugin config updates", async () => {
    const store = await loadStore();
    const previous = store.get();

    expect(() =>
      store.update({
        plugins: {
          "official.transcription": {
            config: {
              activeConfigId: "default-transcription",
              configs: []
            }
          }
        }
      } as never)
    ).toThrow("transcription.configs must include at least one current config");

    expect(store.get()).toBe(previous);
  });

  it("rejects invalid Word Lookup plugin config updates", async () => {
    const store = await loadStore();
    const previous = store.get();

    expect(() =>
      store.update({
        plugins: {
          "official.word-lookup": {
            config: {
              wordListPath: "/tmp/words.jsonl",
              modifierKey: "alt",
              panelSize: {
                width: "wide",
                height: 300
              }
            }
          }
        }
      } as never)
    ).toThrow("wordLookup.panelSize.width must use the current finite number setting");

    expect(store.get()).toBe(previous);
  });

  it("rejects incomplete Word Lookup plugin config updates", async () => {
    const store = await loadStore();
    const previous = store.get();

    expect(() =>
      store.update({
        plugins: {
          "official.word-lookup": {
            config: {
              panelSize: {
                width: 360,
                height: 300
              }
            }
          }
        }
      } as never)
    ).toThrow("wordLookup.wordListPath must use the current string setting");

    expect(store.get()).toBe(previous);
  });

  it("rejects invalid Jellyfin / Emby plugin config updates", async () => {
    const store = await loadStore();
    const previous = store.get();

    expect(() =>
      store.update({
        plugins: {
          "official.jellyfinemby": {
            config: {
              servers: "server-1"
            }
          }
        }
      } as never)
    ).toThrow("jellyfinemby.servers must use the current array setting");

    expect(store.get()).toBe(previous);
  });

  it("rejects incomplete Jellyfin / Emby plugin config updates", async () => {
    const store = await loadStore();
    const previous = store.get();

    expect(() =>
      store.update({
        plugins: {
          "official.jellyfinemby": {
            config: {}
          }
        }
      } as never)
    ).toThrow("jellyfinemby.servers must use the current array setting");

    expect(store.get()).toBe(previous);
  });

  it("rejects Jellyfin / Emby server values that would otherwise be normalized", async () => {
    const store = await loadStore();
    const previous = store.get();

    expect(() =>
      store.update({
        plugins: {
          "official.jellyfinemby": {
            config: {
              servers: [
                {
                  id: "server-1",
                  name: "Home",
                  serverUrl: "http://server.local",
                  apiKey: "key",
                  webSocketPath: "socket",
                  enabled: true
                }
              ]
            }
          }
        }
      })
    ).toThrow("jellyfinemby.server.webSocketPath must start with /");

    expect(store.get()).toBe(previous);
  });

  it("rejects invalid profile updates instead of sanitizing them", async () => {
    const store = await loadStore();
    const previous = store.get();

    expect(() =>
      store.update({
        profiles: [
          {
            ...previous.profiles[0]!,
            settings: {
              ...previous.profiles[0]!.settings,
              primarySubtitleFontSize: "large"
            }
          }
        ]
      } as never)
    ).toThrow("profile.primarySubtitleFontSize must use the current finite number setting");

    expect(store.get()).toBe(previous);
  });

  it("rejects profile values that would otherwise be defaulted by the read sanitizer", async () => {
    const store = await loadStore();
    const previous = store.get();

    expect(() =>
      store.update({
        profiles: previous.profiles.map((profile, index) =>
          index === 0
            ? {
                ...profile,
                settings: {
                  ...profile.settings,
                  subtitlePrimaryColor: ""
                }
              }
            : profile
        )
      })
    ).toThrow("profile.subtitlePrimaryColor must use the current non-empty string setting");

    expect(store.get()).toBe(previous);
  });

  it("rejects profile updates that do not keep the fixed fallback profile last", async () => {
    const store = await loadStore();
    const previous = store.get();
    const fallback = previous.profiles.find((profile) => profile.id === previous.defaultProfileId)!;
    const nonFallback = previous.profiles.find((profile) => profile.id !== previous.defaultProfileId)!;

    expect(() =>
      store.update({
        profiles: [fallback, nonFallback]
      })
    ).toThrow("profiles must keep the current fallback profile last");

    expect(store.get()).toBe(previous);
  });

  it("rejects unsupported profile font family updates instead of defaulting them", async () => {
    const store = await loadStore();
    const previous = store.get();

    expect(() =>
      store.update({
        profiles: previous.profiles.map((profile, index) =>
          index === 0
            ? {
                ...profile,
                settings: {
                  ...profile.settings,
                  primarySubtitleFontFamily: "Papyrus"
                }
              }
            : profile
        )
      })
    ).toThrow("profile.primarySubtitleFontFamily must use a supported current font setting");

    expect(store.get()).toBe(previous);
  });

  it("rejects transcription activeConfigId updates that do not reference a config", async () => {
    const store = await loadStore();
    const previous = store.get();
    const transcriptionConfig = previous.plugins["official.transcription"]!.config as any;

    expect(() =>
      store.update({
        plugins: {
          "official.transcription": {
            config: {
              ...transcriptionConfig,
              activeConfigId: "missing-config"
            }
          }
        }
      } as never)
    ).toThrow("transcription.activeConfigId must reference an existing config");

    expect(store.get()).toBe(previous);
  });

  it("rejects invalid rule updates instead of dropping them", async () => {
    const store = await loadStore();
    const previous = store.get();

    expect(() =>
      store.update({
        rules: [
          {
            id: "rule-invalid",
            name: "Invalid",
            pattern: "example.com",
            profileId: previous.defaultProfileId
          }
        ]
      })
    ).toThrow("rule.profileId must reference a non-fallback profile");

    expect(store.get()).toBe(previous);
  });

  it("rejects invalid cache setting updates", async () => {
    const store = await loadStore();
    const previous = store.get();

    expect(() =>
      store.update({
        cache: {
          ...previous.cache,
          retentionDays: "7"
        }
      } as never)
    ).toThrow("cache.retentionDays must use the current finite number setting");

    expect(store.get()).toBe(previous);
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

  it("recovers to defaults if settings file is corrupted", async () => {
    const filePath = path.join(userDataDir, "settings.json");
    await fsp.mkdir(userDataDir, { recursive: true });
    await fsp.writeFile(filePath, "{not valid json", "utf-8");

    const store = await loadStore();
    expect(store.get().profiles.length).toBeGreaterThan(0);
  });

  it("rejects defaultProfileId updates", async () => {
    const store = await loadStore();
    const current = store.get();
    expect(() => store.update({ defaultProfileId: "does-not-exist" })).toThrow(
      "defaultProfileId cannot be changed through settings updates"
    );
    expect(store.get().defaultProfileId).toBe(current.defaultProfileId);
  });

  it("does not change the fallback profile through settings updates", async () => {
    const store = await loadStore();
    const current = store.get();
    const nonFallback = current.profiles.find((profile) => profile.id !== current.defaultProfileId);

    expect(() => store.update({ defaultProfileId: nonFallback?.id ?? "does-not-exist" })).toThrow(
      "defaultProfileId cannot be changed through settings updates"
    );

    expect(store.get().defaultProfileId).toBe(current.defaultProfileId);
    expect(store.get().profiles.at(-1)?.id).toBe(current.defaultProfileId);
  });
});
