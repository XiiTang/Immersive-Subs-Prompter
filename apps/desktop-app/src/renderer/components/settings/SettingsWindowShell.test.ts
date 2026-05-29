import { createPinia, setActivePinia } from "pinia";
import { mount } from "@vue/test-utils";
import { defineComponent, h, nextTick } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import SettingsWindowShell from "./SettingsWindowShell.vue";
import { useDesktopStore } from "../../stores/desktop";
import { loadLocale } from "../../i18n";
import type { AppSettings } from "../../../main/types";

const rendererStylesheet = readFileSync(resolve(process.cwd(), "src/renderer/style.css"), "utf8");

const sectionStub = (testId: string) =>
  defineComponent({
    name: `SectionStub${testId}`,
    render() {
      return h("section", { "data-testid": testId });
    }
  });

function createSettings(language: "en" | "zh" = "en"): AppSettings {
  return {
    global: {
      closeBehavior: "tray",
      autoLaunch: false,
      toggleWindowShortcut: "CommandOrControl+Shift+S",
      gameProcessBlacklist: [],
      autoHidePanels: false,
      alwaysOnTop: "off",
      panelOpacity: 100,
      language,
      appearance: {
        theme: "system"
      }
    },
    network: {
      endpoints: [{ id: "default", host: "127.0.0.1", port: 44501 }],
      authToken: "0123456789abcdef0123456789abcdef"
    },
    profiles: [
      {
        id: "profile-1",
        name: "默认配置",
        description: null,
        settings: {
          primarySubtitleFontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
          primarySubtitleFontSize: 14,
          secondarySubtitleFontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
          secondarySubtitleFontSize: 13,
          subtitleTimestampFontSize: 11,
          subtitleAutoHideMetaRow: true,
          subtitlePrimarySecondaryGap: 3,
          subtitleLineHeight: 1.45,
          subtitlePrimaryColor: "#f5f5f5",
          subtitleSecondaryColor: "#c7d2fe",
          subtitleActivePrimaryColor: "#fff8dc",
          subtitleActiveSecondaryColor: "#fff9c4",
          ytDlpArgs: "",
          subtitleAutoScrollTimeout: 3,
          subtitleScrollPosition: 33,
          subtitleBlockGap: 12,
          primarySubtitlePriority: [],
          secondarySubtitlePriority: []
        }
      }
    ],
    defaultProfileId: "profile-1",
    rules: [],
    plugins: {},
    cache: {
      enabled: false,
      path: "",
      retentionDays: 30
    }
  };
}

describe("SettingsWindowShell", () => {
  beforeEach(async () => {
    setActivePinia(createPinia());
    // i18n loads locale dictionaries via dynamic import; preload them so
    // synchronous mount() calls render real translations instead of fallbacks.
    await Promise.all([loadLocale("en"), loadLocale("zh")]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("keeps appearance and subtitle cache inside global settings instead of separate nav sections", async () => {
    const wrapper = mount(SettingsWindowShell, {
      attachTo: document.body,
      global: {
        stubs: {
          SettingsGlobal: sectionStub("settings-section-general-content"),
          SettingsProfiles: sectionStub("settings-section-profiles-content"),
          SettingsPlugins: sectionStub("settings-section-plugins-content")
        }
      }
    });

    expect(wrapper.get('[data-testid="settings-nav"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="settings-nav-item-appearance"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="settings-nav-item-cache"]').exists()).toBe(false);
    expect(wrapper.get('[data-testid="settings-section-general-content"]').exists()).toBe(true);

    await wrapper.get('[data-testid="settings-nav-item-profiles"]').trigger("click");

    expect(wrapper.get('[data-testid="settings-section-profiles-content"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="settings-section-general-content"]').exists()).toBe(false);
  });

  it("shows top-level settings chrome in Chinese only when language is zh", async () => {
    const store = useDesktopStore();
    store.settings = createSettings("zh");
    store.editingProfileId = "profile-1";

    const wrapper = mount(SettingsWindowShell);
    await nextTick();
    const text = wrapper.text();
    const shellHeaderText = wrapper.get(".settings-window-shell__header").text();

    expect(text).toContain("设置");
    expect(text).toContain("全局");
    expect(text).toContain("主题");
    expect(text).toContain("插件");
    expect(text).not.toContain("Preferences");
    expect(text).not.toContain("Settings");
    expect(text).not.toContain("General");
    expect(text).not.toContain("Profiles");
    expect(text).not.toContain("Rules");
    expect(text).not.toContain("Media Server");
    expect(text).not.toContain("Cache");
    expect(shellHeaderText).toBe("设置");
  });

  it("only mounts transcription settings when the transcription plugin is enabled", async () => {
    const store = useDesktopStore();
    store.settings = createSettings("en");
    store.editingProfileId = "profile-1";
    store.pluginCatalog = [
      {
        id: "official.transcription",
        version: "1.0.0",
        displayName: "Speech Transcription",
        description: "Transcribe video audio.",
        status: "disabled",
        enabled: false,
        error: null,
        settings: [
          {
            id: "official.transcription.settings",
            title: "Speech Transcription"
          }
        ]
      }
    ];

    const wrapper = mount(SettingsWindowShell, {
      attachTo: document.body,
      global: {
        stubs: {
          SettingsGlobal: sectionStub("settings-section-general-content"),
          SettingsProfiles: sectionStub("settings-section-profiles-content"),
          SettingsPlugins: sectionStub("settings-section-plugins-content"),
          SettingsTranscription: sectionStub("settings-section-plugin-official-transcription-content")
        }
      }
    });

    expect(wrapper.find('[data-testid="settings-nav-item-official.transcription.settings"]').exists()).toBe(false);

    store.pluginCatalog = [
      {
        ...store.pluginCatalog[0]!,
        status: "enabled",
        enabled: true
      }
    ];

    await nextTick();

    expect(wrapper.get('[data-testid="settings-nav-item-official.transcription.settings"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="settings-section-plugin-official-transcription-content"]').exists()).toBe(false);

    await wrapper.get('[data-testid="settings-nav-item-official.transcription.settings"]').trigger("click");

    expect(wrapper.get('[data-testid="settings-section-plugin-official-transcription-content"]').exists()).toBe(true);
  });

  it("shows Jellyfin / Emby settings only when the plugin is enabled", async () => {
    const store = useDesktopStore();
    store.settings = createSettings("en");
    store.editingProfileId = "profile-1";
    store.pluginCatalog = [
      {
        id: "official.jellyfinemby",
        version: "1.0.0",
        displayName: "Jellyfin / Emby",
        description: "Sync playback and subtitles from Jellyfin or Emby media servers.",
        status: "disabled",
        enabled: false,
        error: null,
        settings: [
          {
            id: "official.jellyfinemby.settings",
            title: "Jellyfin / Emby"
          }
        ]
      }
    ];

    const wrapper = mount(SettingsWindowShell, {
      attachTo: document.body,
      global: {
        stubs: {
          SettingsGlobal: sectionStub("settings-section-general-content"),
          SettingsProfiles: sectionStub("settings-section-profiles-content"),
          SettingsPlugins: sectionStub("settings-section-plugins-content"),
          SettingsMediaServer: sectionStub("settings-section-plugin-official-jellyfinemby-content")
        }
      }
    });

    expect(wrapper.find('[data-testid="settings-nav-item-official.jellyfinemby.settings"]').exists()).toBe(false);

    store.pluginCatalog = [
      {
        ...store.pluginCatalog[0]!,
        status: "enabled",
        enabled: true
      }
    ];

    await nextTick();

    expect(wrapper.get('[data-testid="settings-nav-item-official.jellyfinemby.settings"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="settings-section-plugin-official-jellyfinemby-content"]').exists()).toBe(false);

    await wrapper.get('[data-testid="settings-nav-item-official.jellyfinemby.settings"]').trigger("click");

    expect(wrapper.get('[data-testid="settings-section-plugin-official-jellyfinemby-content"]').exists()).toBe(true);
  });

  it("localizes official plugin navigation titles in Chinese", async () => {
    const store = useDesktopStore();
    store.settings = createSettings("zh");
    store.editingProfileId = "profile-1";
    store.pluginCatalog = [
      {
        id: "official.transcription",
        version: "1.0.0",
        displayName: "Speech Transcription",
        description: "Transcribe video audio.",
        status: "enabled",
        enabled: true,
        error: null,
        settings: [
          {
            id: "official.transcription.settings",
            title: "Speech Transcription"
          }
        ]
      }
    ];

    const wrapper = mount(SettingsWindowShell, {
      attachTo: document.body,
      global: {
        stubs: {
          SettingsGlobal: sectionStub("settings-section-general-content"),
          SettingsProfiles: sectionStub("settings-section-profiles-content"),
          SettingsPlugins: sectionStub("settings-section-plugins-content"),
          SettingsTranscription: sectionStub("settings-section-plugin-official-transcription-content")
        }
      }
    });

    await vi.waitFor(() => {
      expect(wrapper.get('[data-testid="settings-nav-item-official.transcription.settings"]').text()).toContain("语音转写");
    });
    expect(wrapper.text()).not.toContain("Speech Transcription");
  });

  it("shows icons for built-in and known official plugin navigation items", async () => {
    const store = useDesktopStore();
    store.settings = createSettings("en");
    store.editingProfileId = "profile-1";
    store.pluginCatalog = [
      {
        id: "official.transcription",
        version: "1.0.0",
        displayName: "Speech Transcription",
        description: "Transcribe video audio.",
        status: "enabled",
        enabled: true,
        error: null,
        settings: [
          {
            id: "official.transcription.settings",
            title: "Speech Transcription"
          }
        ]
      },
      {
        id: "custom.unknown",
        version: "1.0.0",
        displayName: "Custom Unknown",
        description: "Unknown third-party plugin.",
        status: "enabled",
        enabled: true,
        error: null,
        settings: [
          {
            id: "custom.unknown.settings",
            title: "Custom Unknown"
          }
        ]
      }
    ];

    const wrapper = mount(SettingsWindowShell, {
      attachTo: document.body,
      global: {
        stubs: {
          SettingsGlobal: sectionStub("settings-section-general-content"),
          SettingsProfiles: sectionStub("settings-section-profiles-content"),
          SettingsPlugins: sectionStub("settings-section-plugins-content"),
          SettingsTranscription: sectionStub("settings-section-plugin-official-transcription-content")
        }
      }
    });

    expect(wrapper.get('[data-testid="settings-nav-item-general"] .settings-nav__icon').exists()).toBe(true);
    expect(wrapper.get('[data-testid="settings-nav-item-profiles"] .settings-nav__icon').exists()).toBe(true);
    expect(wrapper.get('[data-testid="settings-nav-item-plugins"] .settings-nav__icon').exists()).toBe(true);
    expect(wrapper.get('[data-testid="settings-nav-item-official.transcription.settings"] .settings-nav__icon').exists()).toBe(true);
    expect(wrapper.find('[data-testid="settings-nav-item-custom.unknown.settings"] .settings-nav__icon').exists()).toBe(false);
  });

  it("keeps settings controls outside Electron drag regions", () => {
    expect(rendererStylesheet).toContain(".settings-window button,");
    expect(rendererStylesheet).toContain(".settings-window input,");
    expect(rendererStylesheet).toContain(".settings-window select,");
    expect(rendererStylesheet).toContain(".settings-window textarea,");
    expect(rendererStylesheet).toContain(".settings-window-shell__content,");
    expect(rendererStylesheet).toContain("-webkit-app-region: no-drag;");
    expect(rendererStylesheet).toContain(".settings-window-shell__header {\n");
    expect(rendererStylesheet).toContain("-webkit-app-region: drag;");
  });

  it("auto-hides settings scrollbars until users interact with scroll regions", () => {
    expect(rendererStylesheet).not.toContain("scrollbar-gutter: stable both-edges;");
    expect(rendererStylesheet).toContain("--settings-scrollbar-thumb: transparent;");
    expect(rendererStylesheet).toContain("scrollbar-color: var(--settings-scrollbar-thumb) transparent;");
    expect(rendererStylesheet).toContain("--settings-scrollbar-thumb: var(--ui-border);");
    expect(rendererStylesheet).toContain(".settings-window-shell__content::-webkit-scrollbar-thumb,");
    expect(rendererStylesheet).toContain("background: var(--settings-scrollbar-thumb);");
  });
});
