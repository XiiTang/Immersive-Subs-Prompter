import { createPinia, setActivePinia } from "pinia";
import { mount } from "@vue/test-utils";
import { defineComponent, h, nextTick } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import SettingsWindowShell from "./SettingsWindowShell.vue";
import { useDesktopStore } from "../../stores/desktop";
import type { AppSettings } from "../../../main/types";

const rendererStylesheet = readFileSync(resolve(process.cwd(), "src/renderer/style.css"), "utf8");
const AUTHOR = { id: "xiitang", name: "XiiTang", url: "https://github.com/XiiTang" };

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
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  afterEach(() => {
    vi.restoreAllMocks();
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
    expect(shellHeaderText).toBe("设置");
  });

  it("only mounts transcription schema settings when the transcription plugin is enabled", async () => {
    const store = useDesktopStore();
    store.settings = createSettings("en");
    store.editingProfileId = "profile-1";
    store.pluginCatalog = [
      {
        pluginKey: "xiitang/transcription",
        id: "transcription",
        author: AUTHOR,
        version: "1.0.0",
        displayName: "Speech Transcription",
        description: "Transcribe video audio.",
        sourceUrl: "https://plugins.example.test/transcription.json",
        status: "disabled",
        enabled: false,
        error: null,
        permissions: ["settingsSchema", "transcriptionProvider"],
        settings: [
          {
            id: "transcription.settings",
            title: "Speech Transcription",
            schema: [{ id: "model", label: "Model", type: "string", defaultValue: "whisper-1" }]
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
          SettingsPlugins: sectionStub("settings-section-plugins-content")
        }
      }
    });

    expect(wrapper.find('[data-testid="settings-nav-item-xiitang/transcription::transcription.settings"]').exists()).toBe(false);

    store.pluginCatalog = [
      {
        ...store.pluginCatalog[0]!,
        status: "enabled",
        enabled: true
      }
    ];

    await nextTick();

    expect(wrapper.get('[data-testid="settings-nav-item-xiitang/transcription::transcription.settings"]').exists()).toBe(true);
    expect(wrapper.find('input[value="whisper-1"]').exists()).toBe(false);

    await wrapper.get('[data-testid="settings-nav-item-xiitang/transcription::transcription.settings"]').trigger("click");

    expect(wrapper.text()).toContain("Model");
  });

  it("shows Jellyfin / Emby settings only when the plugin is enabled", async () => {
    const store = useDesktopStore();
    store.settings = createSettings("en");
    store.editingProfileId = "profile-1";
    store.pluginCatalog = [
      {
        pluginKey: "xiitang/jellyfinemby",
        id: "jellyfinemby",
        author: AUTHOR,
        version: "1.0.0",
        displayName: "Jellyfin / Emby",
        description: "Sync playback and subtitles from Jellyfin or Emby media servers.",
        sourceUrl: "https://plugins.example.test/jellyfinemby.json",
        status: "disabled",
        enabled: false,
        error: null,
        permissions: ["settingsSchema", "mediaSourceAdapter"],
        settings: [
          {
            id: "jellyfinemby.settings",
            title: "Jellyfin / Emby",
            schema: [{ id: "serverUrl", label: "Server URL", type: "string", defaultValue: "" }]
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
          SettingsPlugins: sectionStub("settings-section-plugins-content")
        }
      }
    });

    expect(wrapper.find('[data-testid="settings-nav-item-xiitang/jellyfinemby::jellyfinemby.settings"]').exists()).toBe(false);

    store.pluginCatalog = [
      {
        ...store.pluginCatalog[0]!,
        status: "enabled",
        enabled: true
      }
    ];

    await nextTick();

    expect(wrapper.get('[data-testid="settings-nav-item-xiitang/jellyfinemby::jellyfinemby.settings"]').exists()).toBe(true);
    expect(wrapper.text()).not.toContain("Server URL");

    await wrapper.get('[data-testid="settings-nav-item-xiitang/jellyfinemby::jellyfinemby.settings"]').trigger("click");

    expect(wrapper.text()).toContain("Server URL");
  });

  it("uses plugin-provided navigation titles without official localization", async () => {
    const store = useDesktopStore();
    store.settings = createSettings("zh");
    store.editingProfileId = "profile-1";
    store.pluginCatalog = [
      {
        pluginKey: "xiitang/transcription",
        id: "transcription",
        author: AUTHOR,
        version: "1.0.0",
        displayName: "Speech Transcription",
        description: "Transcribe video audio.",
        sourceUrl: "https://plugins.example.test/transcription.json",
        status: "enabled",
        enabled: true,
        error: null,
        permissions: ["settingsSchema", "transcriptionProvider"],
        settings: [
          {
            id: "transcription.settings",
            title: "Speech Transcription",
            schema: []
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
          SettingsPlugins: sectionStub("settings-section-plugins-content")
        }
      }
    });

    await vi.waitFor(() => {
      expect(wrapper.get('[data-testid="settings-nav-item-xiitang/transcription::transcription.settings"]').text()).toContain("Speech Transcription");
    });
  });

  it("shows icons for built-in and known plugin navigation items", async () => {
    const store = useDesktopStore();
    store.settings = createSettings("en");
    store.editingProfileId = "profile-1";
    store.pluginCatalog = [
      {
        pluginKey: "xiitang/transcription",
        id: "transcription",
        author: AUTHOR,
        version: "1.0.0",
        displayName: "Speech Transcription",
        description: "Transcribe video audio.",
        sourceUrl: "https://plugins.example.test/transcription.json",
        status: "enabled",
        enabled: true,
        error: null,
        permissions: ["settingsSchema", "transcriptionProvider"],
        settings: [
          {
            id: "transcription.settings",
            title: "Speech Transcription",
            schema: []
          }
        ]
      },
      {
        pluginKey: "custom/unknown",
        id: "unknown",
        author: { id: "custom", name: "Custom" },
        version: "1.0.0",
        displayName: "Custom Unknown",
        description: "Unknown third-party plugin.",
        sourceUrl: "https://plugins.example.test/custom.json",
        status: "enabled",
        enabled: true,
        error: null,
        permissions: ["settingsSchema"],
        settings: [
          {
            id: "unknown.settings",
            title: "Custom Unknown",
            schema: []
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
          SettingsPlugins: sectionStub("settings-section-plugins-content")
        }
      }
    });

    expect(wrapper.get('[data-testid="settings-nav-item-general"] .settings-nav__icon').exists()).toBe(true);
    expect(wrapper.get('[data-testid="settings-nav-item-profiles"] .settings-nav__icon').exists()).toBe(true);
    expect(wrapper.get('[data-testid="settings-nav-item-plugins"] .settings-nav__icon').exists()).toBe(true);
    expect(wrapper.get('[data-testid="settings-nav-item-xiitang/transcription::transcription.settings"] .settings-nav__icon').exists()).toBe(true);
    expect(wrapper.find('[data-testid="settings-nav-item-custom/unknown::unknown.settings"] .settings-nav__icon').exists()).toBe(false);
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
    expect(rendererStylesheet).toContain("--settings-scrollbar-thumb: transparent;");
    expect(rendererStylesheet).toContain("scrollbar-color: var(--settings-scrollbar-thumb) transparent;");
    expect(rendererStylesheet).toContain("--settings-scrollbar-thumb: var(--ui-border);");
    expect(rendererStylesheet).toContain(".settings-window-shell__content::-webkit-scrollbar-thumb,");
    expect(rendererStylesheet).toContain("background: var(--settings-scrollbar-thumb);");
  });
});
