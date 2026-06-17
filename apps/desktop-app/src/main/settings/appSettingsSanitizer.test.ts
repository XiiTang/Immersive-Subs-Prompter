import { describe, expect, it } from "vitest";
import {
  DEFAULT_SETTINGS_FACTORY,
  mergeSettings,
  sanitizeSettings,
  validateSettingsForUpdate
} from "./appSettingsSanitizer.js";
import { DEFAULT_SUBTITLE_FONT_FAMILY } from "../../common/subtitleFonts.js";
import {
  DEFAULT_GLOBAL_SETTINGS,
  DEFAULT_PROFILE_ID,
  DEFAULT_PROFILE_SETTINGS
} from "../../common/defaultSettings.js";
import { DEFAULT_TRANSCRIPTION_YTDLP_ARGS } from "../../common/transcriptionDefaults.js";
import { DEFAULT_YTDLP_ARGS } from "../../common/ytdlpDefaults.js";

describe("appSettingsSanitizer", () => {
  describe("sanitizeSettings", () => {
    it("accepts the current complete settings shape", () => {
      const settings = DEFAULT_SETTINGS_FACTORY();

      expect(sanitizeSettings(settings)).toEqual(settings);
    });

    it("rejects missing saved settings snapshots", () => {
      expect(() => sanitizeSettings(null)).toThrow(
        "saved settings must use the current object setting"
      );
    });

    it("rejects saved settings snapshots that do not match the current shape", () => {
      const settings = DEFAULT_SETTINGS_FACTORY();

      expect(() => sanitizeSettings({ ...settings, defaultProfileId: "profile-default" })).toThrow(
        "settings.defaultProfileId must use the fixed current fallback profile"
      );
    });

    it("keeps fixed built-in feature settings", () => {
      const settings = DEFAULT_SETTINGS_FACTORY();

      expect(sanitizeSettings(settings).features).toEqual({
        wordLookup: {
          enabled: false,
          config: {
            wordListPath: "",
            modifierKey: "alt",
            panelWidth: 360,
            panelHeight: 300
          }
        },
        transcription: {
          enabled: false,
          activeConfigId: "default-transcription",
          configs: [
            expect.objectContaining({
              id: "default-transcription",
              name: "Default Whisper API",
              provider: "whisper-api",
              baseUrl: "https://api.openai.com/v1",
              model: "whisper-1",
              extraParams: {},
              ytDlpArgs: expect.stringContaining("--extract-audio"),
              fasterWhisperBinary: "faster-whisper"
            })
          ]
        },
        jellyfinEmby: {
          enabled: false,
          config: { servers: [] }
        }
      });
    });

    it("requires enablement only on non-fallback profiles", () => {
      const settings = DEFAULT_SETTINGS_FACTORY();
      const fallbackProfile = settings.profiles.find((profile) => profile.id === DEFAULT_PROFILE_ID);
      const ruleProfile = settings.profiles.find((profile) => profile.id !== DEFAULT_PROFILE_ID);

      expect(ruleProfile?.enabled).toBe(true);
      expect(Object.prototype.hasOwnProperty.call(fallbackProfile ?? {}, "enabled")).toBe(false);

      expect(() =>
        sanitizeSettings({
          ...settings,
          profiles: settings.profiles.map((profile) => {
            if (profile.id === ruleProfile?.id) {
              const { enabled: _enabled, ...withoutEnabled } = profile;
              return withoutEnabled;
            }
            return profile;
          })
        })
      ).toThrow("profile.enabled must use the current boolean setting");

      expect(() =>
        sanitizeSettings({
          ...settings,
          profiles: settings.profiles.map((profile) =>
            profile.id === DEFAULT_PROFILE_ID ? { ...profile, enabled: true } : profile
          )
        })
      ).toThrow("fallback profile must not include enabled setting");
    });

    it("keeps multi-config transcription feature settings", () => {
      const settings = DEFAULT_SETTINGS_FACTORY();

      expect(settings.features.transcription).toEqual({
        enabled: false,
        activeConfigId: "default-transcription",
        configs: [
          expect.objectContaining({
            id: "default-transcription",
            name: "Default Whisper API",
            provider: "whisper-api",
            baseUrl: "https://api.openai.com/v1",
            model: "whisper-1",
            extraParams: {},
            ytDlpArgs: expect.stringContaining("--extract-audio"),
            fasterWhisperBinary: "faster-whisper"
          })
        ]
      });
      expect(sanitizeSettings(settings).features.transcription).toEqual(settings.features.transcription);
    });

    it("rejects removed plugin settings", () => {
      const settings = DEFAULT_SETTINGS_FACTORY();
      const input = {
        ...settings,
        plugins: {}
      };

      expect(() => sanitizeSettings(input)).toThrow("settings contains unknown setting: plugins");
    });

    it("rejects arbitrary feature keys", () => {
      const settings = DEFAULT_SETTINGS_FACTORY();

      expect(() =>
        validateSettingsForUpdate(
          {
            features: {
              ...settings.features,
              customFeature: { enabled: true, config: {} }
            } as never
          },
          settings
        )
      ).toThrow("features contains unknown setting: customFeature");
    });

    it("accepts final Jellyfin / Emby server URL lists including local network URLs", () => {
      const settings = DEFAULT_SETTINGS_FACTORY();

      expect(() =>
        validateSettingsForUpdate(
          {
            features: {
              jellyfinEmby: {
                enabled: true,
                config: {
                  servers: [
                    {
                      id: "server-1",
                      name: "Home",
                      serverUrls: "http://localhost:8096, http://127.0.0.1:8096, http://192.168.1.45:8096",
                      apiKey: "token",
                      enabled: true
                    }
                  ]
                }
              }
            }
          } as never,
          settings
        )
      ).not.toThrow();
    });

    it("rejects enabled Jellyfin / Emby rows without a URL list or API key", () => {
      const settings = DEFAULT_SETTINGS_FACTORY();

      expect(() =>
        validateSettingsForUpdate(
          {
            features: {
              jellyfinEmby: {
                enabled: true,
                config: {
                  servers: [{ id: "server-1", name: "Home", serverUrls: "", apiKey: "token", enabled: true }]
                }
              }
            }
          } as never,
          settings
        )
      ).toThrow("features.jellyfinEmby.config.servers.0.serverUrls must include at least one URL when enabled");

      expect(() =>
        validateSettingsForUpdate(
          {
            features: {
              jellyfinEmby: {
                enabled: true,
                config: {
                  servers: [{ id: "server-1", name: "Home", serverUrls: ", ,", apiKey: "token", enabled: true }]
                }
              }
            }
          } as never,
          settings
        )
      ).toThrow("features.jellyfinEmby.config.servers.0.serverUrls must include at least one URL when enabled");

      expect(() =>
        validateSettingsForUpdate(
          {
            features: {
              jellyfinEmby: {
                enabled: true,
                config: {
                  servers: [
                    { id: "server-1", name: "Home", serverUrls: "http://localhost:8096", apiKey: "", enabled: true }
                  ]
                }
              }
            }
          } as never,
          settings
        )
      ).toThrow("features.jellyfinEmby.config.servers.0.apiKey must be a non-empty string when enabled");
    });

    it("rejects invalid entries inside Jellyfin / Emby server URL lists", () => {
      const settings = DEFAULT_SETTINGS_FACTORY();

      expect(() =>
        validateSettingsForUpdate(
          {
            features: {
              jellyfinEmby: {
                enabled: true,
                config: {
                  servers: [
                    {
                      id: "server-1",
                      name: "Home",
                      serverUrls: "http://localhost:8096, not a url",
                      apiKey: "token",
                      enabled: true
                    }
                  ]
                }
              }
            }
          } as never,
          settings
        )
      ).toThrow("features.jellyfinEmby.config.servers.0.serverUrls entry 2 must be a valid HTTP(S) URL");
    });

    it("rejects out-of-range feature numbers before runtime use", () => {
      const settings = DEFAULT_SETTINGS_FACTORY();

      expect(() =>
        validateSettingsForUpdate(
          {
            features: {
              wordLookup: {
                enabled: true,
                config: {
                  panelWidth: 0
                }
              }
            }
          } as never,
          settings
        )
      ).toThrow("features.wordLookup.config.panelWidth must be between 260 and 720");

      expect(() =>
        validateSettingsForUpdate(
          {
            features: {
              transcription: {
                enabled: true,
                activeConfigId: settings.features.transcription.activeConfigId,
                configs: []
              }
            }
          } as never,
          settings
        )
      ).toThrow("features.transcription.configs must include at least one config");
    });

    it("rejects a transcription active config id that does not exist", () => {
      const settings = DEFAULT_SETTINGS_FACTORY();

      expect(() =>
        validateSettingsForUpdate(
          {
            features: {
              transcription: {
                enabled: true,
                activeConfigId: "missing-config",
                configs: settings.features.transcription.configs
              }
            }
          } as never,
          settings
        )
      ).toThrow("features.transcription.activeConfigId must reference an existing config");
    });

    it("rejects missing or invalid active transcription config ids after merging partial updates", () => {
      const settings = DEFAULT_SETTINGS_FACTORY();
      const config = settings.features.transcription.configs[0]!;

      expect(() =>
        validateSettingsForUpdate(
          {
            features: {
              transcription: {
                activeConfigId: null
              }
            }
          } as never,
          settings
        )
      ).toThrow("features.transcription.activeConfigId must reference an existing config");

      expect(() =>
        validateSettingsForUpdate(
          {
            features: {
              transcription: {
                activeConfigId: "missing-config"
              }
            }
          } as never,
          settings
        )
      ).toThrow("features.transcription.activeConfigId must reference an existing config");

      expect(() =>
        validateSettingsForUpdate(
          {
            features: {
              transcription: {
                configs: [{ ...config, id: "replacement-config" }]
              }
            }
          } as never,
          settings
        )
      ).toThrow("features.transcription.activeConfigId must reference an existing config");
    });

    it("rejects invalid transcription config fields in the final settings model", () => {
      const settings = DEFAULT_SETTINGS_FACTORY();
      const config = settings.features.transcription.configs[0]!;

      expect(() =>
        validateSettingsForUpdate(
          {
            features: {
              transcription: {
                enabled: true,
                activeConfigId: config.id,
                configs: [
                  {
                    ...config,
                    extraParams: []
                  }
                ]
              }
            }
          } as never,
          settings
        )
      ).toThrow("features.transcription.configs.0.extraParams must use the current object setting");

      expect(() =>
        validateSettingsForUpdate(
          {
            features: {
              transcription: {
                enabled: true,
                activeConfigId: config.id,
                configs: [
                  {
                    ...config,
                    name: "   "
                  }
                ]
              }
            }
          } as never,
          settings
        )
      ).toThrow("features.transcription.configs.0.name must be a non-empty string");

      expect(() =>
        validateSettingsForUpdate(
          {
            features: {
              transcription: {
                enabled: true,
                activeConfigId: config.id,
                configs: [
                  {
                    ...config,
                    fasterWhisperVadThreshold: 2
                  }
                ]
              }
            }
          } as never,
          settings
        )
      ).toThrow("features.transcription.configs.0.fasterWhisperVadThreshold must be between 0 and 1");
    });

    it("rejects unsafe yt-dlp arguments before settings are persisted", () => {
      const settings = DEFAULT_SETTINGS_FACTORY();
      const profile = settings.profiles[0]!;
      const config = settings.features.transcription.configs[0]!;
      const deniedArgs = [
        ['--exec "sh -c whoami"', "--exec"],
        ['--exec-before-download "sh -c whoami"', "--exec-before-download"],
        ["--config-location /tmp/yt-dlp.conf", "--config-location"],
        ["--output /tmp/pwned", "--output"],
        ["-o /tmp/pwned", "-o"],
        ["--paths /tmp/pwned", "--paths"],
        ["--external-downloader curl", "--external-downloader"],
        ["--cookies-from-browser chrome", "--cookies-from-browser"],
        ["--unknown-option value", "--unknown-option"]
      ] as const;

      for (const [argLine, option] of deniedArgs) {
        expect(() =>
          validateSettingsForUpdate(
            {
              profiles: settings.profiles.map((item) =>
                item.id === profile.id
                  ? {
                      ...item,
                      settings: {
                        ...item.settings,
                        ytDlpArgs: argLine
                      }
                    }
                  : item
              )
            },
            settings
          )
        ).toThrow(
          option === "--unknown-option"
            ? `profile.settings.ytDlpArgs cannot use unrecognized yt-dlp option ${option}`
            : `profile.settings.ytDlpArgs cannot use yt-dlp option ${option}`
        );

        expect(() =>
          validateSettingsForUpdate(
            {
              features: {
                transcription: {
                  activeConfigId: config.id,
                  configs: [
                    {
                      ...config,
                      ytDlpArgs: argLine
                    }
                  ]
                }
              }
            } as never,
            settings
          )
        ).toThrow(
          option === "--unknown-option"
            ? `features.transcription.configs.0.ytDlpArgs cannot use unrecognized yt-dlp option ${option}`
            : `features.transcription.configs.0.ytDlpArgs cannot use yt-dlp option ${option}`
        );
      }
    });

    it("accepts current yt-dlp defaults before settings are persisted", () => {
      const settings = DEFAULT_SETTINGS_FACTORY();
      const profile = settings.profiles[0]!;
      const config = settings.features.transcription.configs[0]!;

      expect(() =>
        validateSettingsForUpdate(
          {
            profiles: settings.profiles.map((item) =>
              item.id === profile.id
                ? {
                    ...item,
                    settings: {
                      ...item.settings,
                      ytDlpArgs: DEFAULT_YTDLP_ARGS
                    }
                  }
                : item
            ),
            features: {
              transcription: {
                activeConfigId: config.id,
                configs: [
                  {
                    ...config,
                    ytDlpArgs: DEFAULT_TRANSCRIPTION_YTDLP_ARGS
                  }
                ]
              }
            }
          } as never,
          settings
        )
      ).not.toThrow();
    });

    it("merges fixed feature config patches", () => {
      const settings = DEFAULT_SETTINGS_FACTORY();
      const next = mergeSettings(settings, {
        features: {
          wordLookup: {
            enabled: true,
            config: { wordListPath: "/tmp/words.jsonl" }
          }
        }
      } as never);

      expect(next.features.wordLookup.enabled).toBe(true);
      expect(next.features.wordLookup.config).toEqual({
        wordListPath: "/tmp/words.jsonl",
        modifierKey: "alt",
        panelWidth: 360,
        panelHeight: 300
      });
    });

    it("uses explicit product defaults from the factory", () => {
      const result = DEFAULT_SETTINGS_FACTORY();
      const settings = result.profiles.find((profile) => profile.id === DEFAULT_PROFILE_ID)!.settings;

      expect(DEFAULT_GLOBAL_SETTINGS).toEqual({
        autoLaunch: true,
        toggleWindowShortcut: "CommandOrControl+Shift+S",
        gameProcessBlacklist: ["r5apex_dx12.exe"],
        autoHidePanels: true,
        alwaysOnTop: "screen-saver",
        panelOpacity: 0,
        language: "zh",
        appearance: {
          theme: "system"
        },
        autoCheckUpdates: true,
        lastUpdateCheckAt: null
      });
      expect(result.global).toEqual(DEFAULT_GLOBAL_SETTINGS);
      expect(DEFAULT_PROFILE_SETTINGS.primarySubtitleFontFamily).toBe(DEFAULT_SUBTITLE_FONT_FAMILY);
      expect(DEFAULT_PROFILE_SETTINGS.secondarySubtitleFontFamily).toBe(DEFAULT_SUBTITLE_FONT_FAMILY);
      expect(DEFAULT_PROFILE_SETTINGS.primarySubtitleFontSize).toBe(26);
      expect(DEFAULT_PROFILE_SETTINGS.secondarySubtitleFontSize).toBe(25);
      expect(DEFAULT_PROFILE_SETTINGS.subtitleTimestampFontSize).toBe(11);
      expect(DEFAULT_YTDLP_ARGS.split(/\s+/)).toContain("--write-auto-subs");
      expect(DEFAULT_PROFILE_SETTINGS.ytDlpArgs).toBe(DEFAULT_YTDLP_ARGS);
      expect(settings.primarySubtitleFontFamily).toBe(DEFAULT_SUBTITLE_FONT_FAMILY);
      expect(settings.secondarySubtitleFontFamily).toBe(DEFAULT_SUBTITLE_FONT_FAMILY);
      expect(settings.primarySubtitleFontSize).toBe(26);
      expect(settings.secondarySubtitleFontSize).toBe(25);
      expect(settings.subtitleTimestampFontSize).toBe(11);
      expect(settings.ytDlpArgs).toBe(DEFAULT_YTDLP_ARGS);
      expect(result.cache.enabled).toBe(true);
      expect(result.cache.retentionDays).toBe(7);
      expect(result.features.wordLookup.enabled).toBe(false);
      expect(result.features.transcription.enabled).toBe(false);
      expect(result.features.jellyfinEmby.enabled).toBe(false);
    });

    it("returns a fresh object on each factory invocation", () => {
      const a = DEFAULT_SETTINGS_FACTORY();
      const b = DEFAULT_SETTINGS_FACTORY();
      expect(a).not.toBe(b);
      expect(a.profiles).not.toBe(b.profiles);
      a.features.wordLookup.config.wordListPath = "a";
      expect(b.features.wordLookup.config.wordListPath).toBe("");
    });
  });
});
