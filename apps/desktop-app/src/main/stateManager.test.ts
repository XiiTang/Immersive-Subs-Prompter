import { describe, expect, it, vi } from "vitest";
import { DEFAULT_PROFILE_ID } from "../common/defaultSettings.js";
import { AppEventBus } from "./appEventBus.js";
import { DEFAULT_SETTINGS_FACTORY } from "./settings/appSettingsSanitizer.js";
import { StateManager } from "./stateManager.js";
import type { AppSettings } from "./types.js";

function createProfile(base: AppSettings, id: string, name: string) {
  const template = base.profiles.find((profile) => profile.id === DEFAULT_PROFILE_ID)!;
  const profile = {
    ...template,
    id,
    name
  };
  if (id !== DEFAULT_PROFILE_ID) {
    return {
      ...profile,
      enabled: true
    };
  }
  const { enabled: _enabled, ...fallbackProfile } = profile;
  return fallbackProfile;
}

function makeSettings(): AppSettings {
  const base = DEFAULT_SETTINGS_FACTORY();
  const defaultProfile = createProfile(base, DEFAULT_PROFILE_ID, "Default");
  const specificProfile = createProfile(base, "profile-music-youtube", "Music YouTube");
  const broadProfile = createProfile(base, "profile-youtube", "YouTube");

  return {
    ...base,
    defaultProfileId: DEFAULT_PROFILE_ID,
    profiles: [defaultProfile, specificProfile, broadProfile],
    rules: [
      {
        id: "rule-youtube",
        name: "YouTube",
        pattern: "youtube.com",
        profileId: broadProfile.id
      },
      {
        id: "rule-music-youtube",
        name: "Music YouTube",
        pattern: "music.youtube.com",
        profileId: specificProfile.id
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

    expect(selection.profile.id).toBe(DEFAULT_PROFILE_ID);
    expect(selection.rule).toBeNull();
  });

  it("skips disabled URL-rule profiles and uses the fallback profile", () => {
    const settings = makeSettings();
    settings.profiles = settings.profiles.map((profile) =>
      profile.id === "profile-music-youtube" ? { ...profile, enabled: false } : profile
    );
    const manager = new StateManager(new AppEventBus(), () => settings);

    const selection = manager.selectProfileForUrl("https://music.youtube.com/watch?v=demo");

    expect(selection.profile.id).toBe("profile-youtube");
    expect(selection.rule?.id).toBe("rule-youtube");
  });

  it("matches plain host rules against URL hosts instead of arbitrary URL text", () => {
    const base = DEFAULT_SETTINGS_FACTORY();
    const defaultProfile = createProfile(base, DEFAULT_PROFILE_ID, "Default");
    const youtubeProfile = createProfile(base, "profile-youtube", "YouTube");
    const settings = {
      ...base,
      defaultProfileId: DEFAULT_PROFILE_ID,
      profiles: [youtubeProfile, defaultProfile],
      rules: [
        {
          id: "rule-youtube",
          name: "YouTube",
          pattern: "youtube.com",
          profileId: youtubeProfile.id
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
    const defaultProfile = createProfile(base, DEFAULT_PROFILE_ID, "Default");
    const exactProfile = createProfile(base, "profile-exact", "Exact");
    const regexProfile = createProfile(base, "profile-regex", "Regex");
    const containsProfile = createProfile(base, "profile-contains", "Contains");
    const globProfile = createProfile(base, "profile-glob", "Glob");
    const settings = {
      ...base,
      defaultProfileId: DEFAULT_PROFILE_ID,
      profiles: [exactProfile, regexProfile, containsProfile, globProfile, defaultProfile],
      rules: [
        {
          id: "rule-exact",
          name: "Exact",
          pattern: "=https://example.com/watch?v=1",
          profileId: exactProfile.id
        },
        {
          id: "rule-regex",
          name: "Regex",
          pattern: "re:^https://video\\.example/(watch|shorts)/\\d+$",
          profileId: regexProfile.id
        },
        {
          id: "rule-contains",
          name: "Contains",
          pattern: "contains:player_state=active",
          profileId: containsProfile.id
        },
        {
          id: "rule-glob",
          name: "Glob",
          pattern: "*.bilibili.com/video/*",
          profileId: globProfile.id
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

  it("preserves an explicit playback lastUpdate supplied by a projected source", () => {
    const settings = makeSettings();
    const manager = new StateManager(new AppEventBus(), () => settings);

    manager.updatePlayback({
      currentTime: 4200,
      playbackRate: 1,
      lastUpdate: 12_345
    });

    expect(manager.getState().playback).toEqual(
      expect.objectContaining({
        currentTime: 4200,
        playbackRate: 1,
        lastUpdate: 12_345
      })
    );
  });

  it("uses local time as playback lastUpdate when callers do not provide one", () => {
    vi.useFakeTimers();
    vi.setSystemTime(23_456);
    try {
      const settings = makeSettings();
      const manager = new StateManager(new AppEventBus(), () => settings);

      manager.updatePlayback({
        currentTime: 1000,
        playbackRate: 1
      });

      expect(manager.getState().playback.lastUpdate).toBe(23_456);
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps playback baseline when clearing subtitle state", () => {
    const settings = makeSettings();
    const manager = new StateManager(new AppEventBus(), () => settings);

    manager.updatePlayback({
      currentTime: 4200,
      duration: 20_000,
      playbackRate: 1.25,
      lastUpdate: 12_345
    });
    manager.setSubtitleTracks([
      {
        id: "track-1",
        sourceFile: "episode.srt",
        cues: [{ start: 0, end: 1000, text: "hello" }]
      }
    ]);

    manager.resetSubtitleState(true);

    expect(manager.getState().subtitleTracks).toEqual([]);
    expect(manager.getState().playback).toEqual({
      currentTime: 4200,
      duration: 20_000,
      playbackRate: 1.25,
      lastUpdate: 12_345,
      loop: null
    });
  });
});
