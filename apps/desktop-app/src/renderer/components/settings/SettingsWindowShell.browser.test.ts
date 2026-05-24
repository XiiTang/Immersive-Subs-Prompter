import { createPinia, setActivePinia } from "pinia";
import { shallowMount } from "@vue/test-utils";
import { defineComponent, h } from "vue";
import { beforeEach, describe, expect, it } from "vitest";
import SettingsWindowShell from "./SettingsWindowShell.vue";
import { useDesktopStore } from "../../stores/desktop";
import "../../style.css";

const sectionStub = (testId: string) =>
  defineComponent({
    name: `SectionStub${testId}`,
    render() {
      return h("section", { "data-testid": testId });
    }
  });

describe("SettingsWindowShell browser layout", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    document.body.innerHTML = "";
    document.body.style.margin = "0";
    document.body.style.padding = "0";
    const store = useDesktopStore();
    store.settings = {
      global: {
        closeBehavior: "tray",
        autoLaunch: false,
        toggleWindowShortcut: "CommandOrControl+Shift+S",
        gameProcessBlacklist: [],
        autoHidePanels: false,
        alwaysOnTop: "off",
        panelOpacity: 100,
        language: "en",
        appearance: { theme: "system" }
      },
      network: {
        endpoints: [{ id: "default", host: "127.0.0.1", port: 4312 }],
        authToken: "0123456789abcdef0123456789abcdef"
      },
      profiles: [],
      defaultProfileId: "",
      rules: [],
      plugins: { "official.jellyfinemby": { config: { servers: [] } } },
      cache: { enabled: false, path: "", retentionDays: 30 }
    } as never;
  });

  it("keeps a fixed nav and one active section column", async () => {
    const wrapper = shallowMount(SettingsWindowShell, {
      attachTo: document.body,
      global: {
        plugins: [createPinia()],
        stubs: {
          SettingsNav: sectionStub("settings-nav-content"),
          SettingsGlobal: sectionStub("settings-section-general-content"),
          SettingsAppearance: sectionStub("settings-section-appearance-content"),
          SettingsProfiles: sectionStub("settings-section-profiles-content"),
          SettingsCache: sectionStub("settings-section-cache-content"),
          SettingsPlugins: sectionStub("settings-section-plugins-content")
        }
      }
    });

    const shell = wrapper.get('[data-testid="settings-shell"]');
    const content = wrapper.get('[data-testid="settings-content"]');

    expect(shell.classes()).toContain("settings-window-shell");
    expect(content.attributes("data-scroll-mode")).toBeUndefined();
    expect(wrapper.get('[data-testid="settings-section-general-content"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="settings-section-appearance-content"]').exists()).toBe(false);
  });

  it("constrains the active settings content to the visible body row", async () => {
    const tallSectionStub = (testId: string) =>
      defineComponent({
        name: `TallSectionStub${testId}`,
        render() {
          return h("section", { "data-testid": testId, style: "height: 1200px;" });
        }
      });

    const wrapper = shallowMount(SettingsWindowShell, {
      attachTo: document.body,
      global: {
        plugins: [createPinia()],
        stubs: {
          SettingsNav: sectionStub("settings-nav-content"),
          SettingsGlobal: tallSectionStub("settings-section-general-content"),
          SettingsAppearance: tallSectionStub("settings-section-appearance-content"),
          SettingsProfiles: tallSectionStub("settings-section-profiles-content"),
          SettingsCache: tallSectionStub("settings-section-cache-content"),
          SettingsPlugins: tallSectionStub("settings-section-plugins-content")
        }
      }
    });

    const content = wrapper.get('[data-testid="settings-content"]').element as HTMLElement;
    const contentRect = content.getBoundingClientRect();
    const initialScrollTop = content.scrollTop;
    content.scrollTop = 300;
    await new Promise((resolve) => window.requestAnimationFrame(resolve));

    expect(contentRect.bottom).toBeLessThanOrEqual(window.innerHeight);
    expect(content.scrollHeight).toBeGreaterThan(content.clientHeight);
    expect(content.scrollTop).toBeGreaterThan(initialScrollTop);
  });

  it("keeps the main settings navigation compact", () => {
    const wrapper = shallowMount(SettingsWindowShell, {
      attachTo: document.body,
      global: {
        plugins: [createPinia()],
        stubs: {
          SettingsNav: sectionStub("settings-nav-content"),
          SettingsGlobal: sectionStub("settings-section-general-content"),
          SettingsAppearance: sectionStub("settings-section-appearance-content"),
          SettingsProfiles: sectionStub("settings-section-profiles-content"),
          SettingsCache: sectionStub("settings-section-cache-content"),
          SettingsPlugins: sectionStub("settings-section-plugins-content")
        }
      }
    });

    const bodyGrid = wrapper.get(".settings-window-shell__body").element;
    const navColumnWidth = Number.parseFloat(getComputedStyle(bodyGrid).gridTemplateColumns.split(" ")[0] ?? "0");

    expect(navColumnWidth).toBeLessThanOrEqual(192);
  });

  it("allows selecting text inside settings content while keeping the title bar non-selectable", () => {
    const wrapper = shallowMount(SettingsWindowShell, {
      attachTo: document.body,
      global: {
        plugins: [createPinia()],
        stubs: {
          SettingsNav: sectionStub("settings-nav-content"),
          SettingsGlobal: sectionStub("settings-section-general-content"),
          SettingsAppearance: sectionStub("settings-section-appearance-content"),
          SettingsProfiles: sectionStub("settings-section-profiles-content"),
          SettingsCache: sectionStub("settings-section-cache-content"),
          SettingsPlugins: sectionStub("settings-section-plugins-content")
        }
      }
    });

    expect(getComputedStyle(wrapper.get('[data-testid="settings-content"]').element).userSelect).toBe("text");
    expect(getComputedStyle(wrapper.get(".settings-window-shell__header").element).userSelect).toBe("none");
  });
});
