import { mount } from "@vue/test-utils";
import { defineComponent, h } from "vue";
import { describe, expect, it } from "vitest";
import SettingsWindowShell from "./SettingsWindowShell.vue";

const sectionStub = (testId: string) =>
  defineComponent({
    name: `SectionStub${testId}`,
    render() {
      return h("section", { "data-testid": testId });
    }
  });

describe("SettingsWindowShell browser layout", () => {
  it("keeps a fixed nav and a padded document column with visible scrollbar gutter", async () => {
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

    const shell = wrapper.get('[data-testid="settings-shell"]');
    const content = wrapper.get('[data-testid="settings-content"]');

    expect(shell.classes()).toContain("settings-window-shell--document");
    expect(content.attributes("data-scroll-mode")).toBe("document");
    await expect.element(shell.element).toMatchScreenshot("settings-window-shell-document.png");
  });
});
