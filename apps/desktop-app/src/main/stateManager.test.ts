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
        profileId: broadProfile.id,
        isEnabled: true
      },
      {
        id: "rule-music-youtube",
        name: "Music YouTube",
        pattern: "music.youtube.com",
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

  it("matches plain host rules against URL hosts instead of arbitrary URL text", () => {
    const base = DEFAULT_SETTINGS_FACTORY();
    const defaultProfile = {
      ...base.profiles[0]!,
      id: "profile-default",
      name: "Default"
    };
    const youtubeProfile = {
      ...base.profiles[0]!,
      id: "profile-youtube",
      name: "YouTube"
    };
    const settings = {
      ...base,
      defaultProfileId: defaultProfile.id,
      profiles: [youtubeProfile, defaultProfile],
      rules: [
        {
          id: "rule-youtube",
          name: "YouTube",
          pattern: "youtube.com",
          profileId: youtubeProfile.id,
          isEnabled: true
        }
      ]
    } as AppSettings;
    const manager = new StateManager(new AppEventBus(), () => settings);

    expect(manager.selectProfileForUrl("https://music.youtube.com/watch?v=demo").profile.id).toBe(
      youtubeProfile.id
    );
    expect(
      manager.selectProfileForUrl("https://evil.example/watch?redirect=https%3A%2F%2Fyoutube.com%2Fwatch")
        .profile.id
    ).toBe(defaultProfile.id);
  });

  it("supports exact, regex, contains, and URL glob syntax in rule input", () => {
    const base = DEFAULT_SETTINGS_FACTORY();
    const defaultProfile = {
      ...base.profiles[0]!,
      id: "profile-default",
      name: "Default"
    };
    const exactProfile = {
      ...base.profiles[0]!,
      id: "profile-exact",
      name: "Exact"
    };
    const regexProfile = {
      ...base.profiles[0]!,
      id: "profile-regex",
      name: "Regex"
    };
    const containsProfile = {
      ...base.profiles[0]!,
      id: "profile-contains",
      name: "Contains"
    };
    const globProfile = {
      ...base.profiles[0]!,
      id: "profile-glob",
      name: "Glob"
    };
    const settings = {
      ...base,
      defaultProfileId: defaultProfile.id,
      profiles: [exactProfile, regexProfile, containsProfile, globProfile, defaultProfile],
      rules: [
        {
          id: "rule-exact",
          name: "Exact",
          pattern: "=https://example.com/watch?v=1",
          profileId: exactProfile.id,
          isEnabled: true
        },
        {
          id: "rule-regex",
          name: "Regex",
          pattern: "re:^https://video\\.example/(watch|shorts)/\\d+$",
          profileId: regexProfile.id,
          isEnabled: true
        },
        {
          id: "rule-contains",
          name: "Contains",
          pattern: "contains:player_state=active",
          profileId: containsProfile.id,
          isEnabled: true
        },
        {
          id: "rule-glob",
          name: "Glob",
          pattern: "*.bilibili.com/video/*",
          profileId: globProfile.id,
          isEnabled: true
        }
      ]
    } as AppSettings;
    const manager = new StateManager(new AppEventBus(), () => settings);

    expect(manager.selectProfileForUrl("https://example.com/watch?v=1").profile.id).toBe(exactProfile.id);
    expect(manager.selectProfileForUrl("https://example.com/watch?v=1&extra=1").profile.id).toBe(
      defaultProfile.id
    );
    expect(manager.selectProfileForUrl("https://video.example/watch/123").profile.id).toBe(
      regexProfile.id
    );
    expect(manager.selectProfileForUrl("https://app.example/?player_state=active").profile.id).toBe(
      containsProfile.id
    );
    expect(manager.selectProfileForUrl("https://www.bilibili.com/video/BV1xx411c7mD").profile.id).toBe(
      globProfile.id
    );
    expect(manager.selectProfileForUrl("https://www.bilibili.com/bangumi/BV1xx411c7mD").profile.id).toBe(
      defaultProfile.id
    );
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
