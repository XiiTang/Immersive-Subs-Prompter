import { describe, expect, it } from "vitest";
import { AppEventBus } from "./appEventBus.js";
import { DEFAULT_SETTINGS_FACTORY } from "./settings/appSettingsSanitizer.js";
import { StateManager } from "./stateManager.js";
import type { AppSettings } from "./types.js";

function makeSettings(): AppSettings {
  const base = DEFAULT_SETTINGS_FACTORY();
  const defaultProfile = {
    ...base.profiles[0]!,
    id: "profile-default",
    name: "Default"
  };
  const specificProfile = {
    ...base.profiles[0]!,
    id: "profile-music-youtube",
    name: "Music YouTube"
  };
  const broadProfile = {
    ...base.profiles[0]!,
    id: "profile-youtube",
    name: "YouTube"
  };

  return {
    ...base,
    defaultProfileId: defaultProfile.id,
    profiles: [defaultProfile, specificProfile, broadProfile],
    rules: [
      {
        id: "rule-youtube",
        name: "YouTube",
        pattern: "youtube.com",
        matchType: "contains",
        profileId: broadProfile.id,
        isEnabled: true
      },
      {
        id: "rule-music-youtube",
        name: "Music YouTube",
        pattern: "music.youtube.com",
        matchType: "contains",
        profileId: specificProfile.id,
        isEnabled: true
      }
    ]
  };
}

describe("StateManager profile URL matching", () => {
  it("prioritizes profile order before rule storage order", () => {
    const settings = makeSettings();
    const manager = new StateManager(new AppEventBus(), () => settings);

    const selection = manager.selectProfileForUrl("https://music.youtube.com/watch?v=demo");

    expect(selection.profile.id).toBe("profile-music-youtube");
    expect(selection.rule?.id).toBe("rule-music-youtube");
  });

  it("uses the default profile only as fallback when no profile rule matches", () => {
    const settings = makeSettings();
    const manager = new StateManager(new AppEventBus(), () => settings);

    const selection = manager.selectProfileForUrl("https://example.com/watch");

    expect(selection.profile.id).toBe("profile-default");
    expect(selection.rule).toBeNull();
  });

  it("tracks network listener statuses", () => {
    const settings = makeSettings();
    const manager = new StateManager(new AppEventBus(), () => settings);

    manager.setNetworkListenerStatuses([
      {
        endpointId: "default",
        host: "127.0.0.1",
        port: 44501,
        status: "listening",
        error: null
      },
      {
        endpointId: "lan",
        host: "192.168.1.2",
        port: 44501,
        status: "error",
        error: "listen EADDRNOTAVAIL"
      }
    ]);

    expect(manager.getState().networkListeners).toEqual([
      {
        endpointId: "default",
        host: "127.0.0.1",
        port: 44501,
        status: "listening",
        error: null
      },
      {
        endpointId: "lan",
        host: "192.168.1.2",
        port: 44501,
        status: "error",
        error: "listen EADDRNOTAVAIL"
      }
    ]);
  });
});
