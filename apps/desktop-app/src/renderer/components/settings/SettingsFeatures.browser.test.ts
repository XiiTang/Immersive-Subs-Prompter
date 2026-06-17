import { createPinia, setActivePinia } from "pinia";
import { mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDefaultAppSettings } from "../../../common/defaultSettings";
import type { TranscriptionConfig } from "../../../main/types";
import { useDesktopStore } from "../../stores/desktop";
import JellyfinEmbyFeatureSettings from "./JellyfinEmbyFeatureSettings.vue";
import TranscriptionFeatureSettings from "./TranscriptionFeatureSettings.vue";
import WordLookupFeatureSettings from "./WordLookupFeatureSettings.vue";
import "../../style.css";

function createTranscriptionConfig(patch: Partial<TranscriptionConfig>): TranscriptionConfig {
  return {
    id: "config-a",
    name: "Whisper A",
    provider: "whisper-api",
    baseUrl: "https://api.openai.com/v1",
    apiKey: "",
    model: "whisper-1",
    language: "",
    prompt: "",
    enableWordTimestamps: false,
    extraParams: {},
    ytDlpArgs: "--extract-audio",
    fasterWhisperBinary: "faster-whisper",
    fasterWhisperModel: "base",
    fasterWhisperModelDir: "",
    fasterWhisperDevice: "cpu",
    fasterWhisperVadFilter: true,
    fasterWhisperVadThreshold: 0.5,
    fasterWhisperVadMethod: "",
    fasterWhisperUseKim2: false,
    ...patch
  };
}

function seedStore() {
  const store = useDesktopStore();
  const configA = createTranscriptionConfig({ id: "config-a", name: "Whisper A" });
  const configB = createTranscriptionConfig({ id: "config-b", name: "Local B" });
  store.settings = createDefaultAppSettings({
    networkAuthToken: "0123456789abcdef0123456789abcdef"
  });
  store.settings.global.language = "en";
  store.settings.features.transcription.activeConfigId = configA.id;
  store.settings.features.transcription.configs = [configA, configB];
}

describe("SettingsFeatures browser layout", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    document.body.innerHTML = "";
    document.body.style.margin = "0";
    document.body.style.padding = "0";
    seedStore();
    const store = useDesktopStore();
    Object.defineProperty(window, "usp", {
      configurable: true,
      value: {
        updateSettings: vi.fn(async () => store.settings),
        getWordLookupStatus: vi.fn().mockResolvedValue(null),
        refreshWordLookup: vi.fn().mockResolvedValue(null),
        selectWordListFile: vi.fn(),
        getFasterWhisperStatus: vi.fn().mockResolvedValue({
          ok: true,
          paths: {
            binaryDir: "/tmp/fw/bin",
            modelsDir: "/tmp/fw/models",
            cpuBinaryPath: "/tmp/fw/bin/faster-whisper",
            gpuBinaryPath: "/tmp/fw/bin/faster-whisper-xxl"
          },
          binaries: {
            cpu: {
              exists: false,
              path: "/tmp/fw/bin/faster-whisper",
              downloadSupported: false,
              downloadUnavailableReason: null
            },
            gpu: {
              exists: false,
              path: "/tmp/fw/bin/faster-whisper-xxl",
              downloadSupported: false,
              downloadUnavailableReason: null
            }
          },
          models: [],
          modelsBaseDir: "/tmp/fw/models"
        }),
        onFasterWhisperDownloadProgress: vi.fn(() => vi.fn())
      }
    });
  });

  it("reuses the profile list name action and inline input sizing for transcription configs", async () => {
    const wrapper = mount(TranscriptionFeatureSettings, { attachTo: document.body });
    const nameActions = wrapper.findAll<HTMLButtonElement>('[data-testid="feature-transcription-config-name-action"]');

    expect(wrapper.get(".profile-list-sidebar").exists()).toBe(true);
    expect(nameActions).toHaveLength(2);
    const statusActions = wrapper.findAll<HTMLElement>(".profile-list__status-action");
    expect(statusActions).toHaveLength(2);
    expect(statusActions[1]!.text()).toBe("");
    expect(Math.round(statusActions[1]!.element.getBoundingClientRect().width)).toBe(16);
    expect(Math.round(statusActions[1]!.element.getBoundingClientRect().height)).toBe(16);

    const nameActionStyle = getComputedStyle(nameActions[1]!.element);
    const actionTextLeftOffset =
      Number.parseFloat(nameActionStyle.borderLeftWidth) + Number.parseFloat(nameActionStyle.paddingLeft);
    const actionTextTopOffset =
      Number.parseFloat(nameActionStyle.borderTopWidth) + Number.parseFloat(nameActionStyle.paddingTop);
    const configMeta = wrapper.findAll<HTMLElement>(".profile-list__meta")[1]!;
    expect(configMeta.element.getBoundingClientRect().left - nameActions[1]!.element.getBoundingClientRect().left).toBe(
      actionTextLeftOffset
    );
    const configItemHeightBeforeEdit = wrapper
      .findAll<HTMLElement>(".profile-list__item")[1]!
      .element.getBoundingClientRect().height;
    const nameActionRectBeforeEdit = nameActions[1]!.element.getBoundingClientRect();

    await nameActions[1]!.trigger("click");

    const nameInput = wrapper.get<HTMLInputElement>('[data-testid="feature-transcription-config-name"]');
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
      configItemHeightBeforeEdit
    );
    expect(Math.round(nameInputRect.width)).toBe(Math.round(nameActionRectBeforeEdit.width));
    expect(Math.round(nameInputRect.height)).toBe(Math.round(nameActionRectBeforeEdit.height));

    wrapper.unmount();
  });

  it("reuses the profile list name action and inline input sizing for Jellyfin / Emby servers", async () => {
    const store = useDesktopStore();
    store.settings!.features.jellyfinEmby.config.servers = [
      {
        id: "server-a",
        name: "Home",
        serverUrl: "https://home.example.test",
        apiKey: "token",
        enabled: true
      },
      {
        id: "server-b",
        name: "Office",
        serverUrl: "",
        apiKey: "",
        enabled: false
      }
    ];
    const wrapper = mount(JellyfinEmbyFeatureSettings, { attachTo: document.body });
    const nameActions = wrapper.findAll<HTMLButtonElement>('[data-testid="feature-jellyfin-emby-server-name-action"]');

    expect(wrapper.get(".profile-list-sidebar").exists()).toBe(true);
    expect(nameActions).toHaveLength(2);
    const statusActions = wrapper.findAll<HTMLElement>(".profile-list__status-action");
    expect(statusActions).toHaveLength(2);
    expect(statusActions[1]!.text()).toBe("");
    expect(Math.round(statusActions[1]!.element.getBoundingClientRect().width)).toBe(16);
    expect(Math.round(statusActions[1]!.element.getBoundingClientRect().height)).toBe(16);

    const nameActionStyle = getComputedStyle(nameActions[1]!.element);
    const actionTextLeftOffset =
      Number.parseFloat(nameActionStyle.borderLeftWidth) + Number.parseFloat(nameActionStyle.paddingLeft);
    const actionTextTopOffset =
      Number.parseFloat(nameActionStyle.borderTopWidth) + Number.parseFloat(nameActionStyle.paddingTop);
    const serverMeta = wrapper.findAll<HTMLElement>(".profile-list__meta")[1]!;
    expect(serverMeta.text()).toBe("No server URL");
    expect(serverMeta.element.getBoundingClientRect().left - nameActions[1]!.element.getBoundingClientRect().left).toBe(
      actionTextLeftOffset
    );
    const serverItemHeightBeforeEdit = wrapper
      .findAll<HTMLElement>(".profile-list__item")[1]!
      .element.getBoundingClientRect().height;
    const nameActionRectBeforeEdit = nameActions[1]!.element.getBoundingClientRect();

    await nameActions[1]!.trigger("click");

    const nameInput = wrapper.get<HTMLInputElement>('[data-testid="feature-jellyfin-emby-server-name"]');
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
      serverItemHeightBeforeEdit
    );
    expect(Math.round(nameInputRect.width)).toBe(Math.round(nameActionRectBeforeEdit.width));
    expect(Math.round(nameInputRect.height)).toBe(Math.round(nameActionRectBeforeEdit.height));

    wrapper.unmount();
  });

  it("renders Word Lookup dimensions with the compact profile-style control grid", () => {
    const wrapper = mount(WordLookupFeatureSettings, { attachTo: document.body });
    const dimensions = wrapper.get<HTMLElement>('[data-testid="feature-word-lookup-dimensions"]');
    const fields = dimensions.findAll(".ui-field--compact");
    const sliders = dimensions.findAll<HTMLInputElement>('input[type="range"]');

    expect(dimensions.classes()).toContain("word-lookup-dimensions");
    expect(fields).toHaveLength(2);
    expect(sliders).toHaveLength(2);
    expect(sliders[0]!.attributes("aria-labelledby")).toBe("feature-word-lookup-width-label");
    expect(sliders[1]!.attributes("aria-labelledby")).toBe("feature-word-lookup-height-label");

    wrapper.unmount();
  });
});
