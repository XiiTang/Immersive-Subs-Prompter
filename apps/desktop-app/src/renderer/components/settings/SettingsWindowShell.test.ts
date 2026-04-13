import { createPinia, setActivePinia } from "pinia";
import { mount } from "@vue/test-utils";
import { defineComponent, h } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SettingsWindowShell from "./SettingsWindowShell.vue";
import { useDesktopStore } from "../../stores/desktop";
import type { AppSettings } from "../../../main/types";

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
      autoHideActiveZoneHeight: 80,
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
    transcription: {
      enabled: false,
      activeConfigId: null,
      configs: []
    },
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

  it("renders every top-level section in one scrollable document", () => {
    const wrapper = mount(SettingsWindowShell, {
      attachTo: document.body,
      global: {
        stubs: {
          SettingsGlobal: sectionStub("settings-section-general-content"),
          SettingsProfiles: sectionStub("settings-section-profiles-content"),
          SettingsRules: sectionStub("settings-section-rules-content"),
          SettingsTranscription: sectionStub("settings-section-transcription-content"),
          SettingsMediaServer: sectionStub("settings-section-media-server-content"),
          SettingsCache: sectionStub("settings-section-cache-content")
        }
      }
    });

    expect(wrapper.get('[data-testid="settings-content"]').attributes("data-scroll-mode")).toBe("document");
    expect(wrapper.get('[data-testid="settings-nav"]').exists()).toBe(true);
    expect(wrapper.get('[data-testid="settings-section-general"]').exists()).toBe(true);
    expect(wrapper.get('[data-testid="settings-section-profiles"]').exists()).toBe(true);
    expect(wrapper.get('[data-testid="settings-section-rules"]').exists()).toBe(true);
    expect(wrapper.get('[data-testid="settings-section-transcription"]').exists()).toBe(true);
    expect(wrapper.get('[data-testid="settings-section-media-server"]').exists()).toBe(true);
    expect(wrapper.get('[data-testid="settings-section-cache"]').exists()).toBe(true);
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
          SettingsTranscription: sectionStub("settings-section-transcription-content"),
          SettingsMediaServer: sectionStub("settings-section-media-server-content"),
          SettingsCache: sectionStub("settings-section-cache-content")
        }
      }
    });

    await wrapper.get('[data-testid="settings-nav-item-profiles"]').trigger("click");

    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "start" });
    expect(wrapper.get('[data-testid="settings-section-general"]').exists()).toBe(true);
    expect(wrapper.get('[data-testid="settings-section-profiles"]').exists()).toBe(true);
  });

  it("shows top-level settings chrome in Chinese only when language is zh", () => {
    const store = useDesktopStore();
    store.settings = createSettings("zh");
    store.editingProfileId = "profile-1";

    const wrapper = mount(SettingsWindowShell);
    const text = wrapper.text();
    const shellHeaderText = wrapper.get(".settings-window-shell__header").text();

    expect(text).toContain("设置");
    expect(text).toContain("全局设置");
    expect(text).toContain("配置文件");
    expect(text).toContain("URL 规则");
    expect(text).toContain("语音转录");
    expect(text).toContain("媒体服务器集成");
    expect(text).toContain("字幕缓存");
    expect(text).not.toContain("Preferences");
    expect(text).not.toContain("Settings");
    expect(text).not.toContain("General");
    expect(text).not.toContain("Profiles");
    expect(text).not.toContain("Rules");
    expect(text).not.toContain("Transcription");
    expect(text).not.toContain("Media Server");
    expect(text).not.toContain("Cache");
    expect(shellHeaderText).toBe("设置");
    expect(wrapper.find(".settings-nav__meta").exists()).toBe(false);
    expect(wrapper.find(".settings-document__intro").exists()).toBe(false);
  });
});
