import { mount } from "@vue/test-utils";
import { defineComponent, h } from "vue";
import { afterEach, describe, expect, it, vi } from "vitest";
import SettingsWindowShell from "./SettingsWindowShell.vue";

const sectionStub = (testId: string) =>
  defineComponent({
    name: `SectionStub${testId}`,
    render() {
      return h("section", { "data-testid": testId });
    }
  });

describe("SettingsWindowShell", () => {
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
});
