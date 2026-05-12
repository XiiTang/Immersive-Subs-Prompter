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
      language
    },
    network: {
      host: "127.0.0.1",
      port: 44501
    },
    profiles: [
      {
        id: "profile-1",
        name: "默认配置",
        description: null,
        settings: {
          subtitleFontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
          subtitleFontSize: 14,
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
    mediaServer: {
      enabled: false,
      configs: []
    },
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

  it("renders every top-level section in one scrollable document", () => {
    const wrapper = mount(SettingsWindowShell, {
      attachTo: document.body,
      global: {
        stubs: {
          SettingsGlobal: sectionStub("settings-section-general-content"),
          SettingsProfiles: sectionStub("settings-section-profiles-content"),
          SettingsRules: sectionStub("settings-section-rules-content"),
          SettingsMediaServer: sectionStub("settings-section-media-server-content"),
          SettingsCache: sectionStub("settings-section-cache-content"),
          SettingsPlugins: sectionStub("settings-section-plugins-content")
        }
      }
    });

    expect(wrapper.get('[data-testid="settings-content"]').attributes("data-scroll-mode")).toBe("document");
    expect(wrapper.get('[data-testid="settings-nav"]').exists()).toBe(true);
    expect(wrapper.get('[data-testid="settings-section-general"]').exists()).toBe(true);
    expect(wrapper.get('[data-testid="settings-section-profiles"]').exists()).toBe(true);
    expect(wrapper.get('[data-testid="settings-section-rules"]').exists()).toBe(true);
    expect(wrapper.get('[data-testid="settings-section-media-server"]').exists()).toBe(true);
    expect(wrapper.get('[data-testid="settings-section-cache"]').exists()).toBe(true);
    expect(wrapper.get('[data-testid="settings-section-plugins"]').exists()).toBe(true);
  });

  it("scrolls to a section instead of swapping the rendered page", async () => {
    const scrollIntoView = vi.fn();
    vi.stubGlobal("scrollIntoView", scrollIntoView);
    Element.prototype.scrollIntoView = scrollIntoView;

    const wrapper = mount(SettingsWindowShell, {
      attachTo: document.body,
      global: {
        stubs: {
          SettingsGlobal: sectionStub("settings-section-general-content"),
          SettingsProfiles: sectionStub("settings-section-profiles-content"),
          SettingsRules: sectionStub("settings-section-rules-content"),
          SettingsMediaServer: sectionStub("settings-section-media-server-content"),
          SettingsCache: sectionStub("settings-section-cache-content"),
          SettingsPlugins: sectionStub("settings-section-plugins-content")
        }
      }
    });

    await wrapper.get('[data-testid="settings-nav-item-profiles"]').trigger("click");

    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "start" });
    expect(wrapper.get('[data-testid="settings-section-general"]').exists()).toBe(true);
    expect(wrapper.get('[data-testid="settings-section-profiles"]').exists()).toBe(true);
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
    expect(text).toContain("全局设置");
    expect(text).toContain("配置文件");
    expect(text).toContain("URL 规则");
    expect(text).toContain("媒体服务器集成");
    expect(text).toContain("字幕缓存");
    expect(text).toContain("插件");
    expect(text).not.toContain("Preferences");
    expect(text).not.toContain("Settings");
    expect(text).not.toContain("General");
    expect(text).not.toContain("Profiles");
    expect(text).not.toContain("Rules");
    expect(text).not.toContain("Media Server");
    expect(text).not.toContain("Cache");
    expect(shellHeaderText).toBe("设置");
    expect(wrapper.find(".settings-nav__meta").exists()).toBe(false);
    expect(wrapper.find(".settings-document__intro").exists()).toBe(false);
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
            title: "Speech Transcription",
            anchorId: "settings-section-plugin-official-transcription"
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
          SettingsRules: sectionStub("settings-section-rules-content"),
          SettingsMediaServer: sectionStub("settings-section-media-server-content"),
          SettingsCache: sectionStub("settings-section-cache-content"),
          SettingsPlugins: sectionStub("settings-section-plugins-content"),
          SettingsTranscription: sectionStub("settings-section-plugin-official-transcription-content")
        }
      }
    });

    expect(wrapper.find('[data-testid="settings-section-plugin-official-transcription"]').exists()).toBe(false);

    store.pluginCatalog = [
      {
        ...store.pluginCatalog[0]!,
        status: "enabled",
        enabled: true
      }
    ];

    await nextTick();

    expect(wrapper.get('[data-testid="settings-section-plugin-official-transcription"]').exists()).toBe(true);
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
});
