import { createPinia, setActivePinia } from "pinia";
import { shallowMount } from "@vue/test-utils";
import { defineComponent, h } from "vue";
import { beforeEach, describe, expect, it } from "vitest";
import { createDefaultAppSettings } from "../../../common/defaultSettings";
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

function seedStore() {
  const store = useDesktopStore();
  store.settings = createDefaultAppSettings({
    networkAuthToken: "0123456789abcdef0123456789abcdef"
  });
  store.settings.global.language = "en";
}

describe("SettingsWindowShell browser layout", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    document.body.innerHTML = "";
    document.body.style.margin = "0";
    document.body.style.padding = "0";
    seedStore();
  });

  it("keeps a fixed nav and one active section column", () => {
    const wrapper = shallowMount(SettingsWindowShell, {
      attachTo: document.body,
      global: {
        stubs: {
          SettingsNav: sectionStub("settings-nav-content"),
          SettingsGlobal: sectionStub("settings-section-general-content"),
          SettingsProfiles: sectionStub("settings-section-profiles-content"),
          SettingsFeatures: sectionStub("settings-section-features-content")
        }
      }
    });

    const shell = wrapper.get('[data-testid="settings-shell"]');
    const content = wrapper.get('[data-testid="settings-content"]');

    expect(shell.classes()).toContain("settings-window-shell");
    expect(content.attributes("data-scroll-mode")).toBeUndefined();
    expect(wrapper.get('[data-testid="settings-section-general-content"]').exists()).toBe(true);
  });

  it("renders settings with a transparent host and clipped rounded shell", () => {
    const wrapper = shallowMount(SettingsWindowShell, {
      attachTo: document.body,
      global: {
        stubs: {
          SettingsNav: sectionStub("settings-nav-content"),
          SettingsGlobal: sectionStub("settings-section-general-content"),
          SettingsProfiles: sectionStub("settings-section-profiles-content"),
          SettingsFeatures: sectionStub("settings-section-features-content")
        }
      }
    });

    const host = document.createElement("div");
    host.className = "settings-window";
    host.appendChild(wrapper.element);
    document.body.appendChild(host);

    const hostStyle = getComputedStyle(host);
    const shellStyle = getComputedStyle(wrapper.get('[data-testid="settings-shell"]').element);

    expect(hostStyle.backgroundColor).toBe("rgba(0, 0, 0, 0)");
    expect(hostStyle.borderTopLeftRadius).toBe("10px");
    expect(hostStyle.overflow).toBe("hidden");
    expect(shellStyle.borderTopLeftRadius).toBe("10px");
    expect(shellStyle.borderTopRightRadius).toBe("10px");
    expect(shellStyle.borderBottomLeftRadius).toBe("10px");
    expect(shellStyle.borderBottomRightRadius).toBe("10px");
    expect(shellStyle.overflow).toBe("hidden");

    wrapper.unmount();
    host.remove();
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
        stubs: {
          SettingsNav: sectionStub("settings-nav-content"),
          SettingsGlobal: tallSectionStub("settings-section-general-content"),
          SettingsProfiles: tallSectionStub("settings-section-profiles-content"),
          SettingsFeatures: tallSectionStub("settings-section-features-content")
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
        stubs: {
          SettingsNav: sectionStub("settings-nav-content"),
          SettingsGlobal: sectionStub("settings-section-general-content"),
          SettingsProfiles: sectionStub("settings-section-profiles-content"),
          SettingsFeatures: sectionStub("settings-section-features-content")
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
        stubs: {
          SettingsNav: sectionStub("settings-nav-content"),
          SettingsGlobal: sectionStub("settings-section-general-content"),
          SettingsProfiles: sectionStub("settings-section-profiles-content"),
          SettingsFeatures: sectionStub("settings-section-features-content")
        }
      }
    });

    expect(getComputedStyle(wrapper.get('[data-testid="settings-content"]').element).userSelect).toBe("text");
    expect(getComputedStyle(wrapper.get(".settings-window-shell__header").element).userSelect).toBe("none");
  });
});
