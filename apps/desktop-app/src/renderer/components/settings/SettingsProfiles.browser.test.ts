import { createPinia, setActivePinia } from "pinia";
import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";
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

function createProfile(id = "profile-1", name = "Default"): ProfileDefinition {
  return {
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
      ytDlpArgs: "",
      subtitleAutoScrollTimeout: 3,
      subtitleScrollPosition: 33,
      subtitleBlockGap: 12,
      primarySubtitlePriority: [],
      secondarySubtitlePriority: []
    }
  };
}

function createSettings(): AppSettings {
  return {
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
    defaultProfileId: "profile-1",
    rules: [],
    plugins: { "official.jellyfinemby": { config: { servers: [] } } },
    cache: {
      enabled: false,
      path: "",
      retentionDays: 30
    }
  };
}

function createDesktopState(appliedProfileId = "profile-1", appliedProfileName = "Default"): DesktopState {
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
    store.editingProfileId = "profile-1";

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
    expect(wrapper.find('[data-testid="subtitle-font-select"]').exists()).toBe(false);
  });

  it("renders primary and secondary subtitle size sliders with 3 to 96 bounds", () => {
    const store = useDesktopStore();
    store.settings = createSettings();
    store.editingProfileId = "profile-1";

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
      profiles: [createProfile("profile-youtube", "YouTube"), createProfile("profile-default", "Fallback")],
      defaultProfileId: "profile-default",
      rules: []
    } as AppSettings;
    store.editingProfileId = "profile-default";

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

  it("updates independent typography settings from the profile editor", async () => {
    const store = useDesktopStore();
    const arialFont = SUBTITLE_FONT_OPTIONS.find((option) => option.label === "Arial")!.value;
    const timesFont = SUBTITLE_FONT_OPTIONS.find((option) => option.label === "Times New Roman")!.value;
    store.settings = createSettings();
    store.editingProfileId = "profile-1";
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
      profiles: [createProfile("profile-1", "Default"), createProfile("profile-2", "Bilibili")]
    };
    store.editingProfileId = "profile-1";
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

    expect(wrapper.find("#profile-name").exists()).toBe(false);
    expect(wrapper.find('[data-testid="profile-list-name-input"]').exists()).toBe(false);
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
    store.editingProfileId = "profile-1";

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
    store.editingProfileId = "profile-1";

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
    expect(wrapper.find(".subtitle-style-preview__line").exists()).toBe(false);
  });

  it("keeps subtitle style slider input local until the slider commits", async () => {
    const store = useDesktopStore();
    store.settings = createSettings();
    store.editingProfileId = "profile-1";
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

    expect(store.editingProfileSettings.subtitleScrollPosition).toBe(76);
    expect(updateSettings).not.toHaveBeenCalled();

    await slider.trigger("change");

    expect(updateSettings).toHaveBeenCalledTimes(1);
    expect(updateSettings.mock.calls[0]?.[0].profiles?.[0]?.settings.subtitleScrollPosition).toBe(76);
  });

  it("updates the subtitle preview scroll position without smooth-scroll lag while dragging", async () => {
    const store = useDesktopStore();
    store.settings = createSettings();
    store.editingProfileId = "profile-1";
    Object.defineProperty(window, "usp", {
      configurable: true,
      value: {
        updateSettings: vi.fn(async () => store.settings!)
      }
    });

    const wrapper = mount(SettingsProfiles, { attachTo: document.body });
    await flushPreviewSurface();

    const viewport = wrapper.get<HTMLElement>('[data-testid="subtitle-preview-canvas"] .transcript-surface__viewport')
      .element;
    const scrollTo = vi.spyOn(viewport, "scrollTo").mockImplementation((options) => {
      Object.defineProperty(viewport, "scrollTop", {
        configurable: true,
        value: typeof options === "object" ? options.top ?? 0 : 0,
        writable: true
      });
    });
    const slider = wrapper.get<HTMLInputElement>('input[aria-labelledby="subtitle-scroll-position-label"]');

    slider.element.value = "76";
    await slider.trigger("input");
    await flushPreviewSurface();

    expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ behavior: "auto" }));
    expect(scrollTo).not.toHaveBeenCalledWith(expect.objectContaining({ behavior: "smooth" }));

    scrollTo.mockRestore();
  });

  it("keeps subtitle font size slider local until the slider commits", async () => {
    const store = useDesktopStore();
    store.settings = createSettings();
    store.editingProfileId = "profile-1";
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

    expect(store.editingProfileSettings.primarySubtitleFontSize).toBe(28);
    expect(updateSettings).not.toHaveBeenCalled();

    await slider.trigger("change");

    expect(updateSettings).toHaveBeenCalledTimes(1);
    expect(updateSettings.mock.calls[0]?.[0].profiles?.[0]?.settings.primarySubtitleFontSize).toBe(28);
  });

  it("keeps timestamp font size slider local until the slider commits", async () => {
    const store = useDesktopStore();
    store.settings = createSettings();
    store.editingProfileId = "profile-1";
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

    expect(store.editingProfileSettings.subtitleTimestampFontSize).toBe(18);
    expect(updateSettings).not.toHaveBeenCalled();

    await slider.trigger("change");

    expect(updateSettings).toHaveBeenCalledTimes(1);
    expect(updateSettings.mock.calls[0]?.[0].profiles?.[0]?.settings.subtitleTimestampFontSize).toBe(18);
  });

  it("keeps subtitle color palette drag live locally until the palette commits", async () => {
    const store = useDesktopStore();
    store.settings = createSettings();
    store.editingProfileId = "profile-1";
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

    const colorAreaRoot = wrapper.findComponent({ name: "ColorAreaRoot" });
    expect(colorAreaRoot.exists()).toBe(true);

    colorAreaRoot.vm.$emit("update:modelValue", "#112233");
    await nextTick();

    expect(store.editingProfileSettings.subtitlePrimaryColor).toBe("#112233");
    expect(updateSettings).not.toHaveBeenCalled();

    colorAreaRoot.vm.$emit("changeEnd", "#112233");
    await nextTick();

    expect(updateSettings).toHaveBeenCalledTimes(1);
    expect(updateSettings.mock.calls[0]?.[0].profiles?.[0]?.settings.subtitlePrimaryColor).toBe("#112233");
  });

  it("updates subtitle preview styles from the edited profile settings", async () => {
    const store = useDesktopStore();
    const arialFont = SUBTITLE_FONT_OPTIONS.find((option) => option.label === "Arial")!.value;
    const timesFont = SUBTITLE_FONT_OPTIONS.find((option) => option.label === "Times New Roman")!.value;
    store.settings = createSettings();
    store.editingProfileId = "profile-1";

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
      profiles: [createProfile("profile-1", "Default"), createProfile("profile-2", "Bilibili")]
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
      profiles: [createProfile("profile-default", "Default"), createProfile("profile-youtube", "YouTube")],
      defaultProfileId: "profile-default",
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
    expect(wrapper.text()).not.toContain("Applies to these URLs");
    expect(wrapper.text()).not.toContain("Rules match in listed order. Profile order controls cross-profile priority.");
    expect(wrapper.text()).toContain("youtube.com");
    expect(wrapper.text()).toContain("youtu.be");
  });

  it("renders the fallback profile as a fixed bottom row", () => {
    const store = useDesktopStore();
    store.settings = {
      ...createSettings(),
      profiles: [createProfile("profile-youtube", "YouTube"), createProfile("profile-default", "Fallback")],
      defaultProfileId: "profile-default",
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
    expect(wrapper.text()).not.toContain("Set as Default");
  });

  it("renders URL rules as sortable pill chips", () => {
    const store = useDesktopStore();
    store.settings = {
      ...createSettings(),
      profiles: [createProfile("profile-default", "Default"), createProfile("profile-youtube", "YouTube")],
      defaultProfileId: "profile-default",
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
    expect(wrapper.find(".profile-url-rule").exists()).toBe(false);
    expect(wrapper.find(".profile-url-rule__toggle").exists()).toBe(false);
    expect(wrapper.find(".profile-url-rule__actions").exists()).toBe(false);
    expect(wrapper.find('[data-testid="profile-url-rule-type"]').exists()).toBe(false);
  });

  it("adds a URL rule from the draft pill on blur without an add button or enabled flag", async () => {
    const store = useDesktopStore();
    store.settings = {
      ...createSettings(),
      profiles: [createProfile("profile-default", "Default"), createProfile("profile-youtube", "YouTube")],
      defaultProfileId: "profile-default",
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

    expect(wrapper.text()).not.toContain("Add URL Rule");
    expect(wrapper.find('[aria-label="Confirm URL Rule"]').exists()).toBe(false);
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
      profiles: [createProfile("profile-default", "Default"), createProfile("profile-youtube", "YouTube")],
      defaultProfileId: "profile-default",
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

    expect(wrapper.find(".profile-url-rule__actions").exists()).toBe(false);
    await wrapper.get('[data-testid="profile-url-rule-remove-rule-youtube"]').trigger("click");

    expect(store.settings.rules).toEqual([]);
  });

  it("renders subtitle priorities as wrapping pill chips with close buttons", () => {
    const store = useDesktopStore();
    store.settings = {
      ...createSettings(),
      profiles: [
        {
          ...createProfile("profile-default", "Default"),
          settings: {
            ...createProfile("profile-default", "Default").settings,
            primarySubtitlePriority: ["eng.*", "en", "ai-en", "English"],
            secondarySubtitlePriority: ["zh-Hans", "zh", "cmn-Hans"]
          }
        }
      ],
      defaultProfileId: "profile-default"
    };
    store.editingProfileId = "profile-default";

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
          ...createProfile("profile-default", "Default"),
          settings: {
            ...createProfile("profile-default", "Default").settings,
            primarySubtitlePriority: ["en", "ja"],
            secondarySubtitlePriority: []
          }
        }
      ],
      defaultProfileId: "profile-default"
    };
    store.editingProfileId = "profile-default";
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
          ...createProfile("profile-default", "Default"),
          settings: {
            ...createProfile("profile-default", "Default").settings,
            primarySubtitlePriority: ["en", "ja", "zh"],
            secondarySubtitlePriority: ["fr"]
          }
        }
      ],
      defaultProfileId: "profile-default"
    };
    store.editingProfileId = "profile-default";
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
          ...createProfile("profile-default", "Default"),
          settings: {
            ...createProfile("profile-default", "Default").settings,
            primarySubtitlePriority: ["en", "ja"],
            secondarySubtitlePriority: ["fr"]
          }
        }
      ],
      defaultProfileId: "profile-default"
    };
    store.editingProfileId = "profile-default";
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
          ...createProfile("profile-default", "Default"),
          settings: {
            ...createProfile("profile-default", "Default").settings,
            primarySubtitlePriority: ["en"],
            secondarySubtitlePriority: []
          }
        }
      ],
      defaultProfileId: "profile-default"
    };
    store.editingProfileId = "profile-default";
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

    expect(primaryEditor.find('[aria-label="Add priority"]').exists()).toBe(false);
    expect(draftPill.attributes("draggable")).toBeUndefined();

    await draftInput.setValue("ai-en");
    await draftInput.trigger("blur");

    expect(store.settings.profiles[0]?.settings.primarySubtitlePriority).toEqual(["en", "ai-en"]);
    expect(primaryEditor.findAll(".priority-editor__draft")).toHaveLength(1);
    expect(primaryEditor.get<HTMLInputElement>('[data-testid="priority-draft-input"]').element.value).toBe("");
  });

});
