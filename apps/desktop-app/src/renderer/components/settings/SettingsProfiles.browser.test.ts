import { createPinia, setActivePinia } from "pinia";
import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDefaultAppSettings, DEFAULT_PROFILE_ID, DEFAULT_PROFILE_SETTINGS } from "../../../common/defaultSettings.js";
import type { AppSettings, DesktopState, ProfileDefinition } from "../../../main/types.js";
import { SUBTITLE_FONT_OPTIONS } from "../../../common/subtitleFonts.js";
import SettingsProfiles from "./SettingsProfiles.vue";
import { useDesktopStore } from "../../stores/desktop";
import "../../style.css";

function createPointerEvent(type: string, init: Partial<PointerEvent>) {
  const event = new Event(type, { bubbles: true, cancelable: true }) as PointerEvent;
  for (const [key, value] of Object.entries(init)) {
    Object.defineProperty(event, key, {
      configurable: true,
      value
    });
  }
  return event;
}

async function selectOption(trigger: HTMLElement, value: string) {
  trigger.dispatchEvent(
    createPointerEvent("pointerdown", {
      button: 0,
      ctrlKey: false,
      pageX: 0,
      pageY: 0,
      pointerId: 1,
      pointerType: "mouse"
    })
  );
  await nextTick();

  const option = Array.from(document.body.querySelectorAll<HTMLElement>("[data-value]"))
    .find((element) => element.dataset.value === value);
  expect(option).toBeInstanceOf(HTMLElement);
  option!.focus();
  option!.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
  await nextTick();
  await nextTick();
}

async function flushPreviewSurface() {
  await nextTick();
  await nextTick();
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}

function createProfile(id = DEFAULT_PROFILE_ID, name = "Default"): ProfileDefinition {
  const profile = {
    id,
    name,
    description: null,
    settings: {
      primarySubtitleFontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
      primarySubtitleFontSize: 14,
      secondarySubtitleFontFamily: 'Georgia, "Times New Roman", serif',
      secondarySubtitleFontSize: 13,
      subtitleTimestampFontSize: 11,
      subtitleAutoHideMetaRow: true,
      subtitlePrimarySecondaryGap: 3,
      subtitleLineHeight: 1.45,
      subtitlePrimaryColor: "#f5f5f5",
      subtitleSecondaryColor: "#c7d2fe",
      subtitleActivePrimaryColor: "#fff8dc",
      subtitleActiveSecondaryColor: "#fff9c4",
      ytDlpArgs: DEFAULT_PROFILE_SETTINGS.ytDlpArgs,
      subtitleAutoScrollTimeout: 3,
      subtitleScrollPosition: 33,
      subtitleBlockGap: 12,
      primarySubtitlePriority: [],
      secondarySubtitlePriority: []
    }
  };
  return id === DEFAULT_PROFILE_ID ? profile : { ...profile, enabled: true };
}

function createSettings(): AppSettings {
  const base = createDefaultAppSettings({
    networkAuthToken: "0123456789abcdef0123456789abcdef"
  });

  return {
    ...base,
    global: {
      autoLaunch: false,
      toggleWindowShortcut: "CommandOrControl+Shift+S",
      gameProcessBlacklist: [],
      autoHidePanels: false,
      alwaysOnTop: "off",
      panelOpacity: 100,
      language: "en",
      appearance: {
        theme: "system"
      }
    },
    network: {
      endpoints: [{ id: "default", host: "127.0.0.1", port: 4312 }],
      authToken: "0123456789abcdef0123456789abcdef"
    },
    profiles: [createProfile()],
    defaultProfileId: DEFAULT_PROFILE_ID,
    rules: [],
    features: base.features,
    cache: {
      enabled: false,
      path: "",
      retentionDays: 30
    }
  };
}

function createDesktopState(appliedProfileId = DEFAULT_PROFILE_ID, appliedProfileName = "Default"): DesktopState {
  return {
    connectionCount: 1,
    networkListeners: [],
    activeTabId: 1,
    pageUrl: "https://example.com/watch",
    videoUrl: "https://example.com/watch",
    title: "Demo",
    site: "example",
    activeSource: "extension",
    status: "ready",
    error: null,
    playback: {
      currentTime: 0,
      duration: null,
      playbackRate: 1,
      lastUpdate: Date.now(),
      loop: null
    },
    subtitleTracks: [],
    selectedPrimarySubtitleId: null,
    selectedSecondarySubtitleId: null,
    primarySubtitles: null,
    secondarySubtitles: null,
    appliedProfileId,
    appliedProfileName,
    appliedRuleId: null,
    appliedRuleName: null,
    appliedRulePattern: null,
    appliedRuleMatchType: null,
    pendingMediaServerItemId: null,
    mediaServer: {
      connected: false,
      sessions: [],
      selectedSessionId: null,
      lastUpdated: null
    },
    isFullscreen: false,
    transcription: {
      status: "idle",
      message: null,
      configName: null,
      lastFinishedAt: null
    }
  };
}

describe("SettingsProfiles", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    document.body.innerHTML = "";
    document.body.style.margin = "0";
    document.body.style.padding = "24px";
    document.body.style.background = "#101418";
    document.body.style.width = "880px";
  });

  it("renders independent curated font selects for primary and secondary subtitles", () => {
    const store = useDesktopStore();
    store.settings = createSettings();
    store.editingProfileId = DEFAULT_PROFILE_ID;

    const wrapper = mount(SettingsProfiles, {
      global: {
        stubs: {
          IconAdd: true,
          IconDelete: true
        }
      }
    });

    const primaryFontSelect = wrapper.find('[data-testid="primary-subtitle-font-select"]');
    const secondaryFontSelect = wrapper.find('[data-testid="secondary-subtitle-font-select"]');

    expect(primaryFontSelect.exists()).toBe(true);
    expect(primaryFontSelect.element.tagName).toBe("BUTTON");
    expect(primaryFontSelect.attributes("role")).toBe("combobox");
    expect(primaryFontSelect.text()).toContain("Helvetica Neue");
    expect(secondaryFontSelect.exists()).toBe(true);
    expect(secondaryFontSelect.element.tagName).toBe("BUTTON");
    expect(secondaryFontSelect.attributes("role")).toBe("combobox");
    expect(secondaryFontSelect.text()).toContain("Georgia");
  });

  it("renders primary and secondary subtitle size sliders with 3 to 96 bounds", () => {
    const store = useDesktopStore();
    store.settings = createSettings();
    store.editingProfileId = DEFAULT_PROFILE_ID;

    const wrapper = mount(SettingsProfiles, {
      global: {
        stubs: {
          IconAdd: true,
          IconDelete: true
        }
      }
    });

    const primarySizeSlider = wrapper.get<HTMLInputElement>(
      'input[type="range"][aria-labelledby="primary-subtitle-font-size-label"]'
    );
    const secondarySizeSlider = wrapper.get<HTMLInputElement>(
      'input[type="range"][aria-labelledby="secondary-subtitle-font-size-label"]'
    );

    expect(primarySizeSlider.attributes("min")).toBe("3");
    expect(primarySizeSlider.attributes("max")).toBe("96");
    expect(primarySizeSlider.attributes("step")).toBe("1");
    expect(primarySizeSlider.element.value).toBe("14");
    expect(secondarySizeSlider.attributes("min")).toBe("3");
    expect(secondarySizeSlider.attributes("max")).toBe("96");
    expect(secondarySizeSlider.attributes("step")).toBe("1");
    expect(secondarySizeSlider.element.value).toBe("13");
  });

  it("renders the fallback profile timestamp size slider in the compact shared style panel", () => {
    const store = useDesktopStore();
    store.settings = {
      ...createSettings(),
      profiles: [createProfile("profile-youtube", "YouTube"), createProfile(DEFAULT_PROFILE_ID, "Fallback")],
      defaultProfileId: DEFAULT_PROFILE_ID,
      rules: []
    } as AppSettings;
    store.editingProfileId = DEFAULT_PROFILE_ID;

    const wrapper = mount(SettingsProfiles, {
      attachTo: document.body,
      global: {
        stubs: {
          IconAdd: true,
          IconDelete: true
        }
      }
    });

    const timestampSizeSlider = wrapper.get<HTMLInputElement>(
      'input[type="range"][aria-labelledby="subtitle-timestamp-font-size-label"]'
    );
    const timestampField = wrapper
      .get("#subtitle-timestamp-font-size-label")
      .element.closest(".subtitle-style-fields__field") as HTMLElement;

    expect(timestampSizeSlider.attributes("min")).toBe("6");
    expect(timestampSizeSlider.attributes("max")).toBe("24");
    expect(timestampSizeSlider.attributes("step")).toBe("1");
    expect(timestampSizeSlider.element.value).toBe("11");
    expect(timestampField.classList.contains("subtitle-style-fields__field--slider")).toBe(true);
    expect(wrapper.get('[data-testid="subtitle-style-compact-panel"]').element.contains(timestampField)).toBe(true);
  });

  it("keeps profile list action controls compact", () => {
    const store = useDesktopStore();
    store.settings = createSettings();
    store.editingProfileId = DEFAULT_PROFILE_ID;

    const wrapper = mount(SettingsProfiles, { attachTo: document.body });

    const sidebar = wrapper.get<HTMLElement>(".settings-split__sidebar").element;
    const buttonGroup = wrapper.get<HTMLElement>(".settings-split__sidebar-buttons").element;
    const actionButtons = wrapper.findAll<HTMLElement>(".settings-split__sidebar-buttons .ui-icon-button");

    expect(actionButtons).toHaveLength(3);
    expect(Number.parseFloat(getComputedStyle(sidebar).paddingTop)).toBeLessThanOrEqual(8);
    expect(Number.parseFloat(getComputedStyle(sidebar).gap)).toBeLessThanOrEqual(8);
    expect(Number.parseFloat(getComputedStyle(buttonGroup).gap)).toBeLessThanOrEqual(4);
    for (const button of actionButtons) {
      const rect = button.element.getBoundingClientRect();
      expect(rect.width).toBeLessThanOrEqual(24);
      expect(rect.height).toBeLessThanOrEqual(24);
    }
  });

  it("places timestamp size with compact auto-hide and restore controls", () => {
    const store = useDesktopStore();
    store.settings = createSettings();
    store.editingProfileId = DEFAULT_PROFILE_ID;

    const wrapper = mount(SettingsProfiles, { attachTo: document.body });
    const behaviorRow = wrapper.get<HTMLElement>('[data-testid="subtitle-style-behavior-row"]').element;
    const timestampField = wrapper
      .get("#subtitle-timestamp-font-size-label")
      .element.closest(".subtitle-style-fields__field") as HTMLElement;
    const autoHideField = wrapper
      .get("#subtitle-meta-auto-hide-label")
      .element.closest(".subtitle-style-fields__field") as HTMLElement;
    const restoreField = wrapper
      .get("#subtitle-autoscroll-label")
      .element.closest(".subtitle-style-fields__field") as HTMLElement;

    expect(behaviorRow.contains(timestampField)).toBe(true);
    expect(behaviorRow.contains(autoHideField)).toBe(true);
    expect(behaviorRow.contains(restoreField)).toBe(true);
    expect(Math.round(timestampField.getBoundingClientRect().top)).toBe(
      Math.round(autoHideField.getBoundingClientRect().top)
    );
    expect(Math.round(restoreField.getBoundingClientRect().top)).toBe(
      Math.round(autoHideField.getBoundingClientRect().top)
    );
    expect(Math.round(timestampField.getBoundingClientRect().left)).toBe(Math.round(behaviorRow.getBoundingClientRect().left));
    expect(Math.round(timestampField.getBoundingClientRect().width)).toBeGreaterThanOrEqual(
      Math.round(behaviorRow.getBoundingClientRect().width * 0.48)
    );
    expect(Math.round(timestampField.getBoundingClientRect().right)).toBeLessThanOrEqual(
      Math.round(autoHideField.getBoundingClientRect().left)
    );
    expect(Math.round(restoreField.getBoundingClientRect().left)).toBeGreaterThan(
      Math.round(timestampField.getBoundingClientRect().right)
    );
    expect(Math.round(restoreField.getBoundingClientRect().left - autoHideField.getBoundingClientRect().right)).toBeLessThanOrEqual(0);
    expect(Math.round(restoreField.getBoundingClientRect().right)).toBeLessThanOrEqual(
      Math.round(behaviorRow.getBoundingClientRect().right)
    );
    expect(wrapper.get("#subtitle-meta-auto-hide-label").text()).toBe("Auto-hide");
    expect(wrapper.get("#subtitle-autoscroll-label").text()).toBe("Restore (s)");
  });

  it("keeps restore seconds as a narrow spinner-free number input", () => {
    const store = useDesktopStore();
    store.settings = createSettings();
    store.editingProfileId = DEFAULT_PROFILE_ID;

    const wrapper = mount(SettingsProfiles, { attachTo: document.body });
    const restoreInput = wrapper.get<HTMLInputElement>(".subtitle-style-fields__autoscroll-input");
    const style = getComputedStyle(restoreInput.element);
    const restoreField = restoreInput.element.closest(".subtitle-style-fields__field") as HTMLElement;
    const restoreLabel = wrapper.get("#subtitle-autoscroll-label").element as HTMLElement;

    expect(restoreInput.attributes("type")).toBe("number");
    expect(Number.parseFloat(style.width)).toBe(18);
    expect(style.appearance).toBe("textfield");
    expect(style.borderTopWidth).toBe("0px");
    expect(style.backgroundColor).toBe("rgba(0, 0, 0, 0)");
    expect(Math.round(restoreInput.element.getBoundingClientRect().left - restoreLabel.getBoundingClientRect().right)).toBeLessThanOrEqual(4);
    expect(Math.round(restoreInput.element.getBoundingClientRect().right)).toBeLessThanOrEqual(
      Math.round(restoreField.getBoundingClientRect().right)
    );
  });

  it("updates independent typography settings from the profile editor", async () => {
    const store = useDesktopStore();
    const arialFont = SUBTITLE_FONT_OPTIONS.find((option) => option.label === "Arial")!.value;
    const timesFont = SUBTITLE_FONT_OPTIONS.find((option) => option.label === "Times New Roman")!.value;
    store.settings = createSettings();
    store.editingProfileId = DEFAULT_PROFILE_ID;
    Object.defineProperty(window, "usp", {
      configurable: true,
      value: {
        updateSettings: vi.fn(async () => store.settings!)
      }
    });

    const wrapper = mount(SettingsProfiles, {
      global: {
        stubs: {
          IconAdd: true,
          IconDelete: true
        }
      }
    });

    await selectOption(wrapper.get<HTMLElement>('[data-testid="primary-subtitle-font-select"]').element, timesFont);
    await selectOption(wrapper.get<HTMLElement>('[data-testid="secondary-subtitle-font-select"]').element, arialFont);
    await wrapper
      .get<HTMLInputElement>('input[type="range"][aria-labelledby="primary-subtitle-font-size-label"]')
      .setValue("22");
    await wrapper
      .get<HTMLInputElement>('input[type="range"][aria-labelledby="secondary-subtitle-font-size-label"]')
      .setValue("18");
    await wrapper
      .get<HTMLInputElement>('input[type="range"][aria-labelledby="subtitle-timestamp-font-size-label"]')
      .setValue("16");

    expect(store.editingProfileSettings.primarySubtitleFontFamily).toBe(timesFont);
    expect(store.editingProfileSettings.secondarySubtitleFontFamily).toBe(arialFont);
    expect(store.editingProfileSettings.primarySubtitleFontSize).toBe(22);
    expect(store.editingProfileSettings.secondarySubtitleFontSize).toBe(18);
    expect(store.editingProfileSettings.subtitleTimestampFontSize).toBe(16);
  });

  it("edits profile names inline in the profile list", async () => {
    const store = useDesktopStore();
    store.settings = {
      ...createSettings(),
      profiles: [createProfile(DEFAULT_PROFILE_ID, "Default"), createProfile("profile-2", "Bilibili")]
    };
    store.editingProfileId = DEFAULT_PROFILE_ID;
    Object.defineProperty(window, "usp", {
      configurable: true,
      value: {
        updateSettings: vi.fn(async () => store.settings)
      }
    });

    const wrapper = mount(SettingsProfiles, {
      attachTo: document.body,
      global: {
        stubs: {
          IconAdd: true,
          IconDelete: true
        }
      }
    });

    const nameActions = wrapper.findAll<HTMLButtonElement>('[data-testid="profile-list-name-action"]');

    expect(nameActions).toHaveLength(2);

    const nameActionStyle = getComputedStyle(nameActions[1]!.element);
    const actionTextLeftOffset =
      Number.parseFloat(nameActionStyle.borderLeftWidth) + Number.parseFloat(nameActionStyle.paddingLeft);
    const actionTextTopOffset =
      Number.parseFloat(nameActionStyle.borderTopWidth) + Number.parseFloat(nameActionStyle.paddingTop);
    const profileMeta = wrapper.findAll<HTMLElement>(".profile-list__meta")[1]!;
    expect(profileMeta.element.getBoundingClientRect().left - nameActions[1]!.element.getBoundingClientRect().left).toBe(
      actionTextLeftOffset
    );
    const profileItemHeightBeforeEdit = wrapper
      .findAll<HTMLElement>(".profile-list__item")[1]!
      .element.getBoundingClientRect().height;
    const nameActionRectBeforeEdit = nameActions[1]!.element.getBoundingClientRect();

    await nameActions[1]!.trigger("click");

    const nameInput = wrapper.get<HTMLInputElement>('[data-testid="profile-list-name-input"]');
    const nameInputStyle = getComputedStyle(nameInput.element);
    const nameInputRect = nameInput.element.getBoundingClientRect();
    expect(Number.parseFloat(nameInputStyle.height)).toBeLessThanOrEqual(24);
    expect(nameInputStyle.borderTopWidth).toBe("1px");
    expect(nameInputStyle.backgroundColor).not.toBe("rgba(0, 0, 0, 0)");
    expect(Number.parseFloat(nameInputStyle.borderLeftWidth) + Number.parseFloat(nameInputStyle.paddingLeft)).toBe(
      actionTextLeftOffset
    );
    expect(Number.parseFloat(nameInputStyle.borderTopWidth) + Number.parseFloat(nameInputStyle.paddingTop)).toBe(
      actionTextTopOffset
    );
    expect(wrapper.findAll<HTMLElement>(".profile-list__item")[1]!.element.getBoundingClientRect().height).toBe(
      profileItemHeightBeforeEdit
    );
    expect(Math.round(nameInputRect.width)).toBe(Math.round(nameActionRectBeforeEdit.width));
    expect(Math.round(nameInputRect.height)).toBe(Math.round(nameActionRectBeforeEdit.height));

    await nameInput.setValue("Streaming");
    await nameInput.trigger("blur");

    expect(store.settings.profiles[1]?.name).toBe("Streaming");
    expect(store.editingProfileId).toBe("profile-2");
    expect(wrapper.find('[data-testid="profile-list-name-input"]').exists()).toBe(false);
  });

  it("renders a profile-level toggle for auto-hiding transcript timestamps and actions", () => {
    const store = useDesktopStore();
    store.settings = createSettings();
    store.editingProfileId = DEFAULT_PROFILE_ID;

    const wrapper = mount(SettingsProfiles, {
      global: {
        stubs: {
          IconAdd: true,
          IconDelete: true
        }
      }
    });

    const toggle = wrapper.get('[data-testid="subtitle-meta-auto-hide-toggle"]');

    expect(toggle.element.tagName).toBe("BUTTON");
    expect(toggle.attributes("role")).toBe("switch");
    expect(toggle.attributes("aria-checked")).toBe("true");
  });

  it("renders the subtitle preview through the real transcript surface", async () => {
    const store = useDesktopStore();
    store.settings = createSettings();
    store.editingProfileId = DEFAULT_PROFILE_ID;

    const wrapper = mount(SettingsProfiles, {
      attachTo: document.body,
      global: {
        stubs: {
          IconAdd: true,
          IconDelete: true
        }
      }
    });

    await flushPreviewSurface();

    const previewSurface = wrapper.get('[data-testid="subtitle-preview-canvas"] [data-testid="transcript-surface"]');
    const activeBlock = previewSurface.get(".transcript-block--active");
    const activePrimaryLine = activeBlock.get(".transcript-block__line--primary");

    expect(activeBlock.attributes("data-transcript-block-id")).toBe("preview-active");
    expect(activePrimaryLine.text()).toContain("Till this moment I never knew myself.");
    expect(activeBlock.get('[data-testid="cue-action-play"]').attributes("aria-label")).toBe(
      "Play from cue 00:47 - 00:51"
    );
  });

  it("keeps subtitle style slider input local until the slider commits", async () => {
    const store = useDesktopStore();
    store.settings = createSettings();
    store.editingProfileId = DEFAULT_PROFILE_ID;
    const updateSettings = vi.fn(async (partial: Partial<AppSettings>) => ({
      ...store.settings!,
      ...partial
    }));
    Object.defineProperty(window, "usp", {
      configurable: true,
      value: {
        updateSettings
      }
    });

    const wrapper = mount(SettingsProfiles, { attachTo: document.body });
    const slider = wrapper.get<HTMLInputElement>('input[aria-labelledby="subtitle-scroll-position-label"]');

    slider.element.value = "76";
    await slider.trigger("input");

    expect(slider.element.value).toBe("76");
    expect(store.editingProfileSettings.subtitleScrollPosition).toBe(33);
    expect(updateSettings).not.toHaveBeenCalled();

    await slider.trigger("change");

    expect(updateSettings).toHaveBeenCalledTimes(1);
    expect(updateSettings.mock.calls[0]?.[0].profiles?.[0]?.settings.subtitleScrollPosition).toBe(76);
  });

  it("keeps subtitle font size slider local until the slider commits", async () => {
    const store = useDesktopStore();
    store.settings = createSettings();
    store.editingProfileId = DEFAULT_PROFILE_ID;
    const updateSettings = vi.fn(async (partial: Partial<AppSettings>) => ({
      ...store.settings!,
      ...partial
    }));
    Object.defineProperty(window, "usp", {
      configurable: true,
      value: {
        updateSettings
      }
    });

    const wrapper = mount(SettingsProfiles, { attachTo: document.body });
    const slider = wrapper.get<HTMLInputElement>(
      'input[type="range"][aria-labelledby="primary-subtitle-font-size-label"]'
    );

    slider.element.value = "28";
    await slider.trigger("input");

    expect(slider.element.value).toBe("28");
    expect(store.editingProfileSettings.primarySubtitleFontSize).toBe(14);
    expect(updateSettings).not.toHaveBeenCalled();

    await slider.trigger("change");

    expect(updateSettings).toHaveBeenCalledTimes(1);
    expect(updateSettings.mock.calls[0]?.[0].profiles?.[0]?.settings.primarySubtitleFontSize).toBe(28);
  });

  it("keeps timestamp font size slider local until the slider commits", async () => {
    const store = useDesktopStore();
    store.settings = createSettings();
    store.editingProfileId = DEFAULT_PROFILE_ID;
    const updateSettings = vi.fn(async (partial: Partial<AppSettings>) => ({
      ...store.settings!,
      ...partial
    }));
    Object.defineProperty(window, "usp", {
      configurable: true,
      value: {
        updateSettings
      }
    });

    const wrapper = mount(SettingsProfiles, { attachTo: document.body });
    const slider = wrapper.get<HTMLInputElement>(
      'input[type="range"][aria-labelledby="subtitle-timestamp-font-size-label"]'
    );

    slider.element.value = "18";
    await slider.trigger("input");

    expect(slider.element.value).toBe("18");
    expect(store.editingProfileSettings.subtitleTimestampFontSize).toBe(11);
    expect(updateSettings).not.toHaveBeenCalled();

    await slider.trigger("change");

    expect(updateSettings).toHaveBeenCalledTimes(1);
    expect(updateSettings.mock.calls[0]?.[0].profiles?.[0]?.settings.subtitleTimestampFontSize).toBe(18);
  });

  it("keeps subtitle color palette drag live locally until the palette commits", async () => {
    const store = useDesktopStore();
    store.settings = createSettings();
    store.editingProfileId = DEFAULT_PROFILE_ID;
    const updateSettings = vi.fn(async (partial: Partial<AppSettings>) => ({
      ...store.settings!,
      ...partial
    }));
    Object.defineProperty(window, "usp", {
      configurable: true,
      value: {
        updateSettings
      }
    });

    const wrapper = mount(SettingsProfiles, { attachTo: document.body });
    const primaryColorTrigger = wrapper.findAll('[data-testid="color-label-trigger"]')[0]!;

    await primaryColorTrigger.trigger("click");
    await nextTick();

    const colorArea = document.body.querySelector<HTMLElement>('[data-testid="color-area"]');
    expect(colorArea).toBeInstanceOf(HTMLElement);
    const rect = colorArea!.getBoundingClientRect();
    colorArea!.dispatchEvent(new PointerEvent("pointerdown", {
      bubbles: true,
      clientX: rect.left + rect.width * 0.6,
      clientY: rect.top + rect.height * 0.8,
      pointerId: 1,
      pointerType: "mouse"
    }));
    await nextTick();

    expect(store.editingProfileSettings.subtitlePrimaryColor).toBe("#f5f5f5");
    expect(updateSettings).not.toHaveBeenCalled();

    colorArea!.dispatchEvent(new PointerEvent("pointerup", {
      bubbles: true,
      clientX: rect.left + rect.width * 0.6,
      clientY: rect.top + rect.height * 0.8,
      pointerId: 1,
      pointerType: "mouse"
    }));
    await nextTick();

    expect(updateSettings).toHaveBeenCalledTimes(1);
    expect(updateSettings.mock.calls[0]?.[0].profiles?.[0]?.settings.subtitlePrimaryColor).toBe("#331414");
  });

  it("updates subtitle preview styles from the edited profile settings", async () => {
    const store = useDesktopStore();
    const arialFont = SUBTITLE_FONT_OPTIONS.find((option) => option.label === "Arial")!.value;
    const timesFont = SUBTITLE_FONT_OPTIONS.find((option) => option.label === "Times New Roman")!.value;
    store.settings = createSettings();
    store.editingProfileId = DEFAULT_PROFILE_ID;

    const wrapper = mount(SettingsProfiles, {
      attachTo: document.body,
      global: {
        stubs: {
          IconAdd: true,
          IconDelete: true
        }
      }
    });

    store.settings = {
      ...store.settings,
      profiles: [
        {
          ...store.settings.profiles[0]!,
          settings: {
            ...store.settings.profiles[0]!.settings,
            primarySubtitleFontFamily: timesFont,
            primarySubtitleFontSize: 22,
            secondarySubtitleFontFamily: arialFont,
            secondarySubtitleFontSize: 18,
            subtitlePrimaryColor: "#112233",
            subtitleSecondaryColor: "#445566",
            subtitleActivePrimaryColor: "#aa5500",
            subtitleActiveSecondaryColor: "#227744",
            subtitleLineHeight: 1.8,
            subtitlePrimarySecondaryGap: 11,
            subtitleBlockGap: 24,
            subtitleScrollPosition: 80,
            subtitleAutoHideMetaRow: false
          }
        }
      ]
    };
    await flushPreviewSurface();

    const previewSurface = wrapper.get('[data-testid="subtitle-preview-canvas"] [data-testid="transcript-surface"]');
    const viewport = previewSurface.get<HTMLElement>(".transcript-surface__viewport").element;
    const activeBlock = previewSurface.get(".transcript-block--active");
    const inactiveBlock = previewSurface
      .findAll(".transcript-block")
      .find((block) => !block.classes().includes("transcript-block--active"))!;
    const normalPrimary = inactiveBlock.get<HTMLElement>(".transcript-block__line--primary").element;
    const normalSecondary = inactiveBlock.get<HTMLElement>(".transcript-block__line--secondary").element;
    const activePrimary = activeBlock.get<HTMLElement>(".transcript-block__line--primary").element;
    const activeSecondary = activeBlock.get<HTMLElement>(".transcript-block__line--secondary").element;
    const normalMeta = inactiveBlock.get<HTMLElement>('[data-testid="transcript-meta-row"]').element;
    const primaryBottom =
      Number.parseFloat(activePrimary.style.top) + Number.parseFloat(activePrimary.style.height);
    const secondaryGap = Number.parseFloat(activeSecondary.style.top) - primaryBottom;

    expect(activePrimary.style.fontFamily).toContain("Times New Roman");
    expect(activePrimary.style.fontSize).toBe("22px");
    expect(activeSecondary.style.fontFamily).toContain("Arial");
    expect(activeSecondary.style.fontSize).toBe("18px");
    expect(activePrimary.style.lineHeight).toBe("39.6px");
    expect(secondaryGap).toBeCloseTo(11, 1);
    expect(getComputedStyle(normalPrimary).color).toBe("rgb(17, 34, 51)");
    expect(getComputedStyle(normalSecondary).color).toBe("rgb(68, 85, 102)");
    expect(getComputedStyle(activePrimary).color).toBe("rgb(170, 85, 0)");
    expect(getComputedStyle(activeSecondary).color).toBe("rgb(34, 119, 68)");
    expect(viewport.scrollTop).toBeGreaterThan(0);
    expect(normalMeta.dataset.autoHideQuiet).toBe("false");

    store.settings = {
      ...store.settings,
      profiles: [
        {
          ...store.settings.profiles[0]!,
          settings: {
            ...store.settings.profiles[0]!.settings,
            subtitleAutoHideMetaRow: true
          }
        }
      ]
    };
    await flushPreviewSurface();

    expect(normalMeta.dataset.autoHideQuiet).toBe("true");
  });

  it("renders the default profile editor with the applied profile selected", () => {
    const store = useDesktopStore();
    store.settings = {
      ...createSettings(),
      profiles: [createProfile(DEFAULT_PROFILE_ID, "Default"), createProfile("profile-2", "Bilibili")]
    };
    store.desktopState = createDesktopState("profile-2", "Bilibili");
    store.editingProfileId = "profile-2";

    const wrapper = mount(SettingsProfiles, {
      attachTo: document.body,
      global: {
        stubs: {
          IconAdd: true,
          IconDelete: true
        }
      }
    });

    expect(wrapper.findAll(".profile-list__item")).toHaveLength(2);
    expect(wrapper.find('[data-testid="primary-subtitle-font-select"]').exists()).toBe(true);
    expect(
      wrapper
        .findAll<HTMLButtonElement>('[data-testid="profile-list-name-action"]')
        .some((button) => button.text() === "Bilibili")
    ).toBe(true);
  });

  it("shows URL rules inside the selected profile and summarizes them in the profile list", () => {
    const store = useDesktopStore();
    store.settings = {
      ...createSettings(),
      profiles: [createProfile(DEFAULT_PROFILE_ID, "Default"), createProfile("profile-youtube", "YouTube")],
      defaultProfileId: DEFAULT_PROFILE_ID,
      rules: [
        {
          id: "rule-youtube",
          name: "YouTube",
          pattern: "youtube.com",
          profileId: "profile-youtube"
        },
        {
          id: "rule-youtu-be",
          name: "youtu.be",
          pattern: "youtu.be",
          profileId: "profile-youtube"
        }
      ]
    };
    store.editingProfileId = "profile-youtube";

    const wrapper = mount(SettingsProfiles, {
      attachTo: document.body,
      global: {
        stubs: {
          IconAdd: true,
          IconDelete: true
        }
      }
    });

    expect(wrapper.get('[data-testid="profile-url-rules"]').exists()).toBe(true);
    expect(wrapper.text()).toContain("URL Rules");
    expect(wrapper.text()).toContain("Match top to bottom; profile order breaks ties.");
    expect(wrapper.text()).toContain("youtube.com");
    expect(wrapper.text()).toContain("youtu.be");
  });

  it("renders the fallback profile as a fixed bottom row", () => {
    const store = useDesktopStore();
    store.settings = {
      ...createSettings(),
      profiles: [createProfile("profile-youtube", "YouTube"), createProfile(DEFAULT_PROFILE_ID, "Fallback")],
      defaultProfileId: DEFAULT_PROFILE_ID,
      rules: []
    };
    store.editingProfileId = "profile-youtube";

    const wrapper = mount(SettingsProfiles, {
      attachTo: document.body,
      global: {
        stubs: {
          IconAdd: true,
          IconDelete: true
        }
      }
    });

    const items = wrapper.findAll(".profile-list__item");

    expect(items).toHaveLength(2);
    expect(items[0]?.attributes("draggable")).toBe("true");
    expect(items[1]?.attributes("draggable")).toBe("false");
    expect(items[1]?.text()).toContain("Fallback");
    expect(wrapper.find('[data-testid="profile-list-enabled-default-profile"]').exists()).toBe(false);

    const enabledAction = wrapper.get<HTMLElement>('[data-testid="profile-list-enabled-profile-youtube"]');
    expect(Math.round(enabledAction.element.getBoundingClientRect().width)).toBe(16);
    expect(Math.round(enabledAction.element.getBoundingClientRect().height)).toBe(16);
  });

  it("renders URL rules as sortable pill chips", () => {
    const store = useDesktopStore();
    store.settings = {
      ...createSettings(),
      profiles: [createProfile(DEFAULT_PROFILE_ID, "Default"), createProfile("profile-youtube", "YouTube")],
      defaultProfileId: DEFAULT_PROFILE_ID,
      rules: [
        {
          id: "rule-youtube",
          name: "YouTube",
          pattern: "youtube.com",
          profileId: "profile-youtube"
        },
        {
          id: "rule-youtu-be",
          name: "youtu.be",
          pattern: "youtu.be",
          profileId: "profile-youtube"
        }
      ]
    };
    store.editingProfileId = "profile-youtube";

    const wrapper = mount(SettingsProfiles, {
      attachTo: document.body,
      global: {
        stubs: {
          IconAdd: true,
          IconDelete: true
        }
      }
    });

    const firstRule = wrapper.get('[data-testid="profile-url-rule-display-rule-youtube"]');

    expect(firstRule.attributes("draggable")).toBe("true");
  });

  it("adds a URL rule from the draft pill on blur", async () => {
    const store = useDesktopStore();
    store.settings = {
      ...createSettings(),
      profiles: [createProfile(DEFAULT_PROFILE_ID, "Default"), createProfile("profile-youtube", "YouTube")],
      defaultProfileId: DEFAULT_PROFILE_ID,
      rules: []
    };
    store.editingProfileId = "profile-youtube";
    Object.defineProperty(window, "usp", {
      configurable: true,
      value: {
        updateSettings: vi.fn(async () => store.settings)
      }
    });

    const wrapper = mount(SettingsProfiles, {
      attachTo: document.body,
      global: {
        stubs: {
          IconAdd: true,
          IconDelete: true
        }
      }
    });

    const draftInput = wrapper.get<HTMLInputElement>('[data-testid="profile-url-rule-draft"]');
    await draftInput.setValue("music.youtube.com");
    await draftInput.trigger("blur");

    expect(store.settings.rules).toEqual([
      expect.objectContaining({
        pattern: "music.youtube.com",
        profileId: "profile-youtube"
      })
    ]);
    expect(store.settings.rules[0]).toEqual({
      id: expect.any(String),
      name: "music.youtube.com",
      pattern: "music.youtube.com",
      profileId: "profile-youtube"
    });
    expect(draftInput.element.value).toBe("");
  });

  it("removes URL rules through the pill close button", async () => {
    const store = useDesktopStore();
    store.settings = {
      ...createSettings(),
      profiles: [createProfile(DEFAULT_PROFILE_ID, "Default"), createProfile("profile-youtube", "YouTube")],
      defaultProfileId: DEFAULT_PROFILE_ID,
      rules: [
        {
          id: "rule-youtube",
          name: "YouTube",
          pattern: "youtube.com",
          profileId: "profile-youtube"
        }
      ]
    };
    store.editingProfileId = "profile-youtube";
    Object.defineProperty(window, "usp", {
      configurable: true,
      value: {
        updateSettings: vi.fn(async () => store.settings)
      }
    });

    const wrapper = mount(SettingsProfiles, {
      attachTo: document.body,
      global: {
        stubs: {
          IconAdd: true,
          IconCheck: true,
          IconDelete: true
        }
      }
    });

    await wrapper.get('[data-testid="profile-url-rule-remove-rule-youtube"]').trigger("click");

    expect(store.settings.rules).toEqual([]);
  });

  it("renders subtitle priorities as wrapping pill chips with close buttons", () => {
    const store = useDesktopStore();
    store.settings = {
      ...createSettings(),
      profiles: [
        {
          ...createProfile(DEFAULT_PROFILE_ID, "Default"),
          settings: {
            ...createProfile(DEFAULT_PROFILE_ID, "Default").settings,
            primarySubtitlePriority: ["eng.*", "en", "ai-en", "English"],
            secondarySubtitlePriority: ["zh-Hans", "zh", "cmn-Hans"]
          }
        }
      ],
      defaultProfileId: DEFAULT_PROFILE_ID
    };
    store.editingProfileId = DEFAULT_PROFILE_ID;

    const wrapper = mount(SettingsProfiles, {
      attachTo: document.body,
      global: {
        stubs: {
          IconAdd: true,
          IconDelete: true
        }
      }
    });

    const list = wrapper.get(".priority-editor__list");
    const firstChip = wrapper.get(".priority-editor__item");
    const listStyle = getComputedStyle(list.element);
    const chipStyle = getComputedStyle(firstChip.element);

    expect(listStyle.display).toBe("flex");
    expect(listStyle.flexWrap).toBe("wrap");
    expect(chipStyle.borderRadius).toBe("999px");
    expect(firstChip.attributes("draggable")).toBe("true");
    expect(wrapper.find(".priority-editor__item [aria-label='Remove priority']").exists()).toBe(true);
  });

  it("removes subtitle priorities only through the pill close button", async () => {
    const store = useDesktopStore();
    store.settings = {
      ...createSettings(),
      profiles: [
        {
          ...createProfile(DEFAULT_PROFILE_ID, "Default"),
          settings: {
            ...createProfile(DEFAULT_PROFILE_ID, "Default").settings,
            primarySubtitlePriority: ["en", "ja"],
            secondarySubtitlePriority: []
          }
        }
      ],
      defaultProfileId: DEFAULT_PROFILE_ID
    };
    store.editingProfileId = DEFAULT_PROFILE_ID;
    const removeSpy = vi.spyOn(store, "removePriority").mockImplementation(() => undefined);

    const wrapper = mount(SettingsProfiles, { attachTo: document.body });

    await wrapper.get('[data-testid="priority-primary-remove-en"]').trigger("click");

    expect(removeSpy).toHaveBeenCalledWith("primary", "en");
  });

  it("reorders subtitle priorities within the same list and does not delete on drag end", async () => {
    const store = useDesktopStore();
    store.settings = {
      ...createSettings(),
      profiles: [
        {
          ...createProfile(DEFAULT_PROFILE_ID, "Default"),
          settings: {
            ...createProfile(DEFAULT_PROFILE_ID, "Default").settings,
            primarySubtitlePriority: ["en", "ja", "zh"],
            secondarySubtitlePriority: ["fr"]
          }
        }
      ],
      defaultProfileId: DEFAULT_PROFILE_ID
    };
    store.editingProfileId = DEFAULT_PROFILE_ID;
    const reorderSpy = vi.spyOn(store, "reorderPriority").mockImplementation(() => undefined);
    const removeSpy = vi.spyOn(store, "removePriority").mockImplementation(() => undefined);
    const dataTransfer = new DataTransfer();

    const wrapper = mount(SettingsProfiles, { attachTo: document.body });

    await wrapper.get('[data-testid="priority-primary-display-en"]').trigger("dragstart", { dataTransfer });
    await wrapper.get('[data-testid="priority-primary-display-zh"]').trigger("dragenter");
    await wrapper.get('[data-testid="priority-primary-display-zh"]').trigger("drop");
    await wrapper.get('[data-testid="priority-primary-display-en"]').trigger("dragend");

    expect(reorderSpy).toHaveBeenCalledWith("primary", 0, 2);
    expect(removeSpy).not.toHaveBeenCalled();
  });

  it("ignores subtitle priority drops outside the source list", async () => {
    const store = useDesktopStore();
    store.settings = {
      ...createSettings(),
      profiles: [
        {
          ...createProfile(DEFAULT_PROFILE_ID, "Default"),
          settings: {
            ...createProfile(DEFAULT_PROFILE_ID, "Default").settings,
            primarySubtitlePriority: ["en", "ja"],
            secondarySubtitlePriority: ["fr"]
          }
        }
      ],
      defaultProfileId: DEFAULT_PROFILE_ID
    };
    store.editingProfileId = DEFAULT_PROFILE_ID;
    const reorderSpy = vi.spyOn(store, "reorderPriority").mockImplementation(() => undefined);
    const removeSpy = vi.spyOn(store, "removePriority").mockImplementation(() => undefined);
    const dataTransfer = new DataTransfer();

    const wrapper = mount(SettingsProfiles, { attachTo: document.body });

    await wrapper.get('[data-testid="priority-primary-display-en"]').trigger("dragstart", { dataTransfer });
    await wrapper.get('[data-testid="priority-primary-display-en"]').trigger("dragend");

    expect(reorderSpy).not.toHaveBeenCalled();
    expect(removeSpy).not.toHaveBeenCalled();
  });

  it("adds subtitle priorities from the trailing blank pill on blur", async () => {
    const store = useDesktopStore();
    store.settings = {
      ...createSettings(),
      profiles: [
        {
          ...createProfile(DEFAULT_PROFILE_ID, "Default"),
          settings: {
            ...createProfile(DEFAULT_PROFILE_ID, "Default").settings,
            primarySubtitlePriority: ["en"],
            secondarySubtitlePriority: []
          }
        }
      ],
      defaultProfileId: DEFAULT_PROFILE_ID
    };
    store.editingProfileId = DEFAULT_PROFILE_ID;
    Object.defineProperty(window, "usp", {
      configurable: true,
      value: {
        updateSettings: vi.fn(async () => store.settings)
      }
    });

    const wrapper = mount(SettingsProfiles, {
      attachTo: document.body,
      global: {
        stubs: {
          IconAdd: true,
          IconDelete: true
        }
      }
    });

    const primaryEditor = wrapper.findAll(".priority-editor")[0]!;
    const draftPill = primaryEditor.get(".priority-editor__draft");
    const draftInput = draftPill.get<HTMLInputElement>('[data-testid="priority-draft-input"]');

    expect(draftPill.attributes("draggable")).toBeUndefined();

    await draftInput.setValue("ai-en");
    await draftInput.trigger("blur");

    expect(store.settings.profiles[0]?.settings.primarySubtitlePriority).toEqual(["en", "ai-en"]);
    expect(primaryEditor.findAll(".priority-editor__draft")).toHaveLength(1);
    expect(primaryEditor.get<HTMLInputElement>('[data-testid="priority-draft-input"]').element.value).toBe("");
  });

});
