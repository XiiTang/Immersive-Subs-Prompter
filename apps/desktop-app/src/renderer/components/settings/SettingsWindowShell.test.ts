import { createPinia, setActivePinia } from "pinia";
import { mount } from "@vue/test-utils";
import { defineComponent, h, nextTick } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createDefaultAppSettings } from "../../../common/defaultSettings";
import SettingsWindowShell from "./SettingsWindowShell.vue";
import { useDesktopStore } from "../../stores/desktop";

const rendererStylesheet = readFileSync(resolve(process.cwd(), "src/renderer/style.css"), "utf8");

const sectionStub = (testId: string) =>
  defineComponent({
    name: `SectionStub${testId}`,
    render() {
      return h("section", { "data-testid": testId });
    }
  });

function seedSettings(language: "en" | "zh" = "en") {
  const store = useDesktopStore();
  store.settings = createDefaultAppSettings({
    networkAuthToken: "0123456789abcdef0123456789abcdef"
  });
  store.settings.global.language = language;
  store.editingProfileId = store.settings.defaultProfileId;
  return store;
}

describe("SettingsWindowShell", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows top-level settings chrome in Chinese only when language is zh", async () => {
    seedSettings("zh");

    const wrapper = mount(SettingsWindowShell);
    await nextTick();
    const text = wrapper.text();
    const shellHeaderText = wrapper.get(".settings-window-shell__header").text();

    expect(text).toContain("设置");
    expect(text).toContain("全局");
    expect(text).toContain("主题");
    expect(text).toContain("功能");
    expect(shellHeaderText).toBe("设置");
  });

  it("routes the fixed Features section without dynamic sections", async () => {
    seedSettings("en");

    const wrapper = mount(SettingsWindowShell, {
      attachTo: document.body,
      global: {
        stubs: {
          SettingsGlobal: sectionStub("settings-section-general-content"),
          SettingsProfiles: sectionStub("settings-section-profiles-content"),
          SettingsFeatures: sectionStub("settings-section-features-content")
        }
      }
    });

    expect(wrapper.get('[data-testid="settings-nav-item-general"]').exists()).toBe(true);
    expect(wrapper.get('[data-testid="settings-nav-item-profiles"]').exists()).toBe(true);
    expect(wrapper.get('[data-testid="settings-nav-item-features"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid*="transcription.settings"]').exists()).toBe(false);

    await wrapper.get('[data-testid="settings-nav-item-features"]').trigger("click");

    expect(wrapper.get('[data-testid="settings-section-features-content"]').exists()).toBe(true);
  });

  it("shows icons for fixed navigation items", () => {
    seedSettings("en");

    const wrapper = mount(SettingsWindowShell, {
      attachTo: document.body,
      global: {
        stubs: {
          SettingsGlobal: sectionStub("settings-section-general-content"),
          SettingsProfiles: sectionStub("settings-section-profiles-content"),
          SettingsFeatures: sectionStub("settings-section-features-content")
        }
      }
    });

    expect(wrapper.get('[data-testid="settings-nav-item-general"] .settings-nav__icon').exists()).toBe(true);
    expect(wrapper.get('[data-testid="settings-nav-item-profiles"] .settings-nav__icon').exists()).toBe(true);
    expect(wrapper.get('[data-testid="settings-nav-item-features"] .settings-nav__icon').exists()).toBe(true);
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
