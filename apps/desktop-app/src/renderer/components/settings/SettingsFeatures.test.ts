import { flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDefaultAppSettings } from "../../../common/defaultSettings";
import SettingsFeatures from "./SettingsFeatures.vue";
import JellyfinEmbyFeatureSettings from "./JellyfinEmbyFeatureSettings.vue";
import TranscriptionFeatureSettings from "./TranscriptionFeatureSettings.vue";
import WordLookupFeatureSettings from "./WordLookupFeatureSettings.vue";
import FasterWhisperBinariesCard from "./transcription/FasterWhisperBinariesCard.vue";
import FasterWhisperModelsCard from "./transcription/FasterWhisperModelsCard.vue";
import FasterWhisperRuntimeCard from "./transcription/FasterWhisperRuntimeCard.vue";
import { useDesktopStore } from "../../stores/desktop";
import type { TranscriptionConfig } from "../../../main/types";

function seedStore(language = "en") {
  const store = useDesktopStore();
  store.settings = createDefaultAppSettings({
    networkAuthToken: "0123456789abcdef0123456789abcdef"
  });
  store.settings.global.language = language;
  vi.spyOn(store, "setFeatureEnabled").mockResolvedValue();
  vi.spyOn(store, "setFeatureConfig").mockResolvedValue();
  return store;
}

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

describe("SettingsFeatures", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    setActivePinia(createPinia());
    Object.defineProperty(window, "usp", {
      configurable: true,
      value: {
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
            cpu: { exists: false, path: "/tmp/fw/bin/faster-whisper" },
            gpu: { exists: false, path: "/tmp/fw/bin/faster-whisper-xxl" }
          },
          models: [],
          modelsBaseDir: "/tmp/fw/models"
        }),
        downloadFasterWhisperBinary: vi.fn(),
        downloadFasterWhisperModel: vi.fn(),
        onFasterWhisperDownloadProgress: vi.fn(() => vi.fn()),
        openPath: vi.fn()
      }
    });
  });

  it("renders fixed built-in features without plugin lifecycle controls", async () => {
    const store = seedStore();
    const wrapper = mount(SettingsFeatures);

    expect(wrapper.text()).toContain("Word Lookup");
    expect(wrapper.text()).toContain("Speech Transcription");
    expect(wrapper.text()).toContain("Jellyfin / Emby");
    expect(wrapper.text()).not.toContain("Install");
    expect(wrapper.text()).not.toContain("Update");
    expect(wrapper.text()).not.toContain("Delete");
    expect(wrapper.text()).not.toContain("Permissions");

    await wrapper.get('[data-testid="feature-enabled-wordLookup"]').trigger("click");
    expect(store.setFeatureEnabled).toHaveBeenCalledWith("wordLookup", true);
  });

  it("labels feature switches with current state", async () => {
    const store = seedStore();
    store.settings!.features.wordLookup.enabled = false;
    const wrapper = mount(SettingsFeatures);

    expect(wrapper.get('[data-testid="feature-enabled-wordLookup"]').attributes("aria-label")).toBe("Disabled");

    store.settings!.features.wordLookup.enabled = true;
    await wrapper.vm.$nextTick();

    expect(wrapper.get('[data-testid="feature-enabled-wordLookup"]').attributes("aria-label")).toBe("Enabled");
  });

  it("renders feature enablement only without feature configuration controls", () => {
    seedStore();
    const wrapper = mount(SettingsFeatures);

    expect(wrapper.find('[data-testid^="feature-detail-"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="feature-word-lookup-path"]').exists()).toBe(false);
    expect(wrapper.find("#feature-transcription-provider-label").exists()).toBe(false);
    expect(wrapper.find('[data-testid="feature-jellyfin-emby-add-server"]').exists()).toBe(false);
  });

  it("updates Word Lookup config through explicit controls", async () => {
    const store = seedStore();
    const wrapper = mount(WordLookupFeatureSettings);

    await wrapper.get('[data-testid="feature-word-lookup-path"]').setValue("/tmp/words.jsonl");

    expect(store.setFeatureConfig).toHaveBeenCalledWith("wordLookup", { wordListPath: "/tmp/words.jsonl" });
  });

  it("renders Word Lookup panel dimensions with compact slider controls", async () => {
    const store = seedStore();
    const setFeatureConfig = vi.spyOn(store, "setFeatureConfig").mockResolvedValue();
    const wrapper = mount(WordLookupFeatureSettings);
    const dimensions = wrapper.get('[data-testid="feature-word-lookup-dimensions"]');
    const widthSlider = dimensions.get<HTMLInputElement>(
      'input[type="range"][aria-labelledby="feature-word-lookup-width-label"]'
    );
    const heightSlider = dimensions.get<HTMLInputElement>(
      'input[type="range"][aria-labelledby="feature-word-lookup-height-label"]'
    );

    expect(dimensions.classes()).toContain("word-lookup-dimensions");
    expect(widthSlider.element.min).toBe("260");
    expect(widthSlider.element.max).toBe("720");
    expect(heightSlider.element.min).toBe("180");
    expect(heightSlider.element.max).toBe("640");

    await widthSlider.setValue("420");

    expect(setFeatureConfig).toHaveBeenCalledWith("wordLookup", { panelWidth: 420 });
  });

  it("refreshes and displays Word Lookup status", async () => {
    seedStore();
    const refreshWordLookup = vi.fn().mockResolvedValue({
      ok: true,
      wordListPath: "/tmp/words.jsonl",
      entryCount: 2,
      fileMtimeMs: 1000,
      loadedAt: 2000,
      error: null
    });
    Object.defineProperty(window, "usp", {
      configurable: true,
      value: {
        ...window.usp,
        getWordLookupStatus: vi.fn().mockResolvedValue(null),
        refreshWordLookup,
        selectWordListFile: vi.fn()
      }
    });
    const wrapper = mount(WordLookupFeatureSettings);

    await wrapper.get('[data-testid="feature-word-lookup-refresh"]').trigger("click");
    await refreshWordLookup.mock.results[0]!.value;
    await wrapper.vm.$nextTick();

    expect(refreshWordLookup).toHaveBeenCalled();
    expect(wrapper.get('[data-testid="feature-word-lookup-status"]').text()).toContain("2");
  });

  it("adds and edits Jellyfin / Emby servers through the split editor", async () => {
    const store = seedStore();
    vi.spyOn(store, "addJellyfinEmbyServer").mockImplementation(async () => {
      store.settings!.features.jellyfinEmby.config.servers.push({
        id: "server-1",
        name: "Server 1",
        serverUrl: "",
        apiKey: "",
        enabled: true
      });
      return "server-1";
    });
    vi.spyOn(store, "updateJellyfinEmbyServer").mockResolvedValue();
    const wrapper = mount(JellyfinEmbyFeatureSettings);

    await wrapper.get('[data-testid="feature-jellyfin-emby-add-server"]').trigger("click");
    await wrapper.vm.$nextTick();
    await wrapper.get("#feature-jellyfin-emby-server-url").setValue("https://media.example.test");

    expect(store.updateJellyfinEmbyServer).toHaveBeenCalledWith("server-1", expect.objectContaining({
      serverUrl: "https://media.example.test"
    }));
  });

  it("keeps invalid Jellyfin / Emby server URLs in a local draft until they are saveable", async () => {
    const store = seedStore();
    store.settings!.features.jellyfinEmby.config.servers = [
      {
        id: "server-1",
        name: "Home",
        serverUrl: "",
        apiKey: "",
        enabled: true
      }
    ];
    const updateServer = vi.spyOn(store, "updateJellyfinEmbyServer").mockResolvedValue();
    const wrapper = mount(JellyfinEmbyFeatureSettings);
    const urlInput = wrapper.get<HTMLInputElement>("#feature-jellyfin-emby-server-url");

    await urlInput.setValue("h");

    expect(urlInput.element.value).toBe("h");
    expect(updateServer).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain("Server URL must be HTTP(S)");

    await urlInput.setValue("https://media.example.test");

    expect(updateServer).toHaveBeenCalledWith("server-1", expect.objectContaining({
      serverUrl: "https://media.example.test"
    }));
  });

  it("uses the profile list layout and inline name editor for Jellyfin / Emby servers", async () => {
    const store = seedStore();
    store.settings!.features.jellyfinEmby.config.servers = [
      {
        id: "server-1",
        name: "Home",
        serverUrl: "https://home.example.test",
        apiKey: "token",
        enabled: true
      },
      {
        id: "server-2",
        name: "Office",
        serverUrl: "",
        apiKey: "",
        enabled: false
      }
    ];
    const updateServer = vi.spyOn(store, "updateJellyfinEmbyServer").mockResolvedValue();
    const wrapper = mount(JellyfinEmbyFeatureSettings, { attachTo: document.body });

    expect(wrapper.get(".profile-list-sidebar").exists()).toBe(true);
    expect(wrapper.findAll(".profile-list__item")).toHaveLength(2);
    expect(wrapper.find("#feature-jellyfin-emby-server-name").exists()).toBe(false);
    expect(wrapper.findAll(".profile-list__meta")[0]!.text()).toBe("https://home.example.test");
    expect(wrapper.findAll(".profile-list__meta")[1]!.text()).toBe("No server URL");

    await wrapper.findAll('[data-testid="feature-jellyfin-emby-server-name-action"]')[1]!.trigger("click");
    let nameInput = wrapper.get<HTMLInputElement>('[data-testid="feature-jellyfin-emby-server-name"]');

    expect(nameInput.element.dataset.serverId).toBe("server-2");
    expect(document.activeElement).toBe(nameInput.element);

    await nameInput.setValue("");
    await nameInput.trigger("blur");

    expect(updateServer).not.toHaveBeenCalled();

    await wrapper.findAll('[data-testid="feature-jellyfin-emby-server-name-action"]')[1]!.trigger("click");
    nameInput = wrapper.get<HTMLInputElement>('[data-testid="feature-jellyfin-emby-server-name"]');
    await nameInput.setValue("Office Server");
    await nameInput.trigger("keydown", { key: "Enter" });

    expect(updateServer).toHaveBeenCalledWith("server-2", expect.objectContaining({
      name: "Office Server"
    }));

    wrapper.unmount();
  });

  it("duplicates the selected Jellyfin / Emby server from the profile-style toolbar", async () => {
    const store = seedStore();
    store.settings!.features.jellyfinEmby.config.servers = [
      {
        id: "server-a",
        name: "Home",
        serverUrl: "https://home.example.test",
        apiKey: "token-a",
        enabled: true
      },
      {
        id: "server-b",
        name: "Office",
        serverUrl: "https://office.example.test",
        apiKey: "token-b",
        enabled: false
      }
    ];
    const duplicateServer = vi.spyOn(store, "duplicateJellyfinEmbyServer").mockImplementation(async (serverId) => {
      expect(serverId).toBe("server-b");
      store.settings!.features.jellyfinEmby.config.servers.push({
        id: "server-b-copy",
        name: "Office Copy",
        serverUrl: "https://office.example.test",
        apiKey: "token-b",
        enabled: false
      });
      return "server-b-copy";
    });
    const wrapper = mount(JellyfinEmbyFeatureSettings);

    await wrapper.get('[data-testid="feature-jellyfin-emby-server-server-b"]').trigger("click");
    await wrapper.get('[data-testid="feature-jellyfin-emby-duplicate-server"]').trigger("click");
    await wrapper.vm.$nextTick();

    expect(duplicateServer).toHaveBeenCalledWith("server-b");
    expect(wrapper.get('[data-testid="feature-jellyfin-emby-server-server-b-copy"]').classes()).toContain("is-selected");
  });

  it("toggles Jellyfin / Emby server enablement from the list row circle without selecting the row for editing", async () => {
    const store = seedStore();
    store.settings!.features.jellyfinEmby.config.servers = [
      {
        id: "server-a",
        name: "Home",
        serverUrl: "https://home.example.test",
        apiKey: "token-a",
        enabled: true
      },
      {
        id: "server-b",
        name: "Office",
        serverUrl: "https://office.example.test",
        apiKey: "token-b",
        enabled: false
      }
    ];
    const updateServer = vi.spyOn(store, "updateJellyfinEmbyServer").mockResolvedValue();
    const wrapper = mount(JellyfinEmbyFeatureSettings);

    const serverBEnabled = wrapper.get('[data-testid="feature-jellyfin-emby-server-enabled-server-b"]');
    expect(serverBEnabled.attributes("aria-pressed")).toBe("false");

    await serverBEnabled.trigger("click");

    expect(updateServer).toHaveBeenCalledWith("server-b", expect.objectContaining({ enabled: true }));
    expect(wrapper.get('[data-testid="feature-jellyfin-emby-server-server-a"]').classes()).toContain("is-selected");
    expect(wrapper.get('[data-testid="feature-jellyfin-emby-server-server-b"]').classes()).not.toContain("is-selected");
  });

  it("shows Jellyfin / Emby server validation errors under their fields", () => {
    const store = seedStore();
    store.settings!.features.jellyfinEmby.config.servers = [
      {
        id: "server-1",
        name: "",
        serverUrl: "not a url",
        apiKey: "",
        enabled: true
      }
    ];

    const wrapper = mount(JellyfinEmbyFeatureSettings);

    expect(wrapper.find(".server-errors").exists()).toBe(false);
    expect(wrapper.get("#feature-jellyfin-emby-server-url-row .ui-setting-row__error").text()).toBe(
      "Server URL must be HTTP(S)"
    );
    expect(wrapper.get("#feature-jellyfin-emby-api-key-row .ui-setting-row__error").text()).toBe(
      "API key is required"
    );
  });

  it("localizes transcription settings labels", () => {
    seedStore("zh");
    const wrapper = mount(TranscriptionFeatureSettings);

    expect(wrapper.text()).toContain("提供方");
    expect(wrapper.text()).toContain("基础 URL");
    expect(wrapper.text()).toContain("API 密钥");
    expect(wrapper.text()).toContain("单词时间戳");
    expect(wrapper.text()).not.toContain("Provider");
    expect(wrapper.text()).not.toContain("Word timestamps");
  });

  it("adds speech transcription configs without changing the active runtime config", async () => {
    const store = seedStore();
    vi.spyOn(store, "setTranscriptionConfigs").mockResolvedValue();
    const wrapper = mount(TranscriptionFeatureSettings);

    await wrapper.get('[data-testid="feature-transcription-add-config"]').trigger("click");

    expect(store.setTranscriptionConfigs).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ name: "Default Whisper API" })]),
      store.settings!.features.transcription.activeConfigId
    );
  });

  it("edits active speech transcription config fields", async () => {
    const store = seedStore();
    store.settings!.features.transcription.enabled = true;
    vi.spyOn(store, "setTranscriptionConfigs").mockResolvedValue();
    const wrapper = mount(TranscriptionFeatureSettings);

    await wrapper.get('[data-testid="feature-transcription-config-name-action"]').trigger("click");
    await wrapper.get('[data-testid="feature-transcription-config-name"]').setValue("Fast local");
    await wrapper.get('[data-testid="feature-transcription-config-name"]').trigger("blur");

    expect(store.setTranscriptionConfigs).toHaveBeenCalledWith(
      [expect.objectContaining({ name: "Fast local" })],
      store.settings!.features.transcription.activeConfigId
    );
  });

  it("keeps transcription config name edits local until the name is non-empty", async () => {
    const store = seedStore();
    const setTranscriptionConfigs = vi.spyOn(store, "setTranscriptionConfigs").mockResolvedValue();
    const wrapper = mount(TranscriptionFeatureSettings);
    await wrapper.get('[data-testid="feature-transcription-config-name-action"]').trigger("click");
    const nameInput = wrapper.get<HTMLInputElement>('[data-testid="feature-transcription-config-name"]');

    await nameInput.setValue("");

    expect(nameInput.element.value).toBe("");
    expect(setTranscriptionConfigs).not.toHaveBeenCalled();

    await nameInput.setValue("Fast local");
    await nameInput.trigger("blur");

    expect(setTranscriptionConfigs).toHaveBeenCalledWith(
      [expect.objectContaining({ name: "Fast local" })],
      store.settings!.features.transcription.activeConfigId
    );
  });

  it("selects a transcription config for editing without changing the active runtime config", async () => {
    const store = seedStore();
    const configA = createTranscriptionConfig({ id: "config-a", name: "Whisper A" });
    const configB = createTranscriptionConfig({ id: "config-b", name: "Local B" });
    store.settings!.features.transcription.activeConfigId = configA.id;
    store.settings!.features.transcription.configs = [configA, configB];
    const setActiveTranscriptionConfig = vi.spyOn(store, "setActiveTranscriptionConfig").mockResolvedValue();
    vi.spyOn(store, "setTranscriptionConfigs").mockResolvedValue();
    const wrapper = mount(TranscriptionFeatureSettings);

    await wrapper.get('[data-testid="feature-transcription-config-config-b"]').trigger("click");

    expect(setActiveTranscriptionConfig).not.toHaveBeenCalled();
    expect(wrapper.get('[data-testid="feature-transcription-config-config-b"]').classes()).toContain("is-selected");
    expect(wrapper.find('[data-testid="feature-transcription-config-name"]').exists()).toBe(false);
  });

  it("activates a speech transcription config from the list row circle without selecting it for editing", async () => {
    const store = seedStore();
    const configA = createTranscriptionConfig({ id: "config-a", name: "Whisper A" });
    const configB = createTranscriptionConfig({ id: "config-b", name: "Local B" });
    store.settings!.features.transcription.activeConfigId = configA.id;
    store.settings!.features.transcription.configs = [configA, configB];
    const setActiveTranscriptionConfig = vi.spyOn(store, "setActiveTranscriptionConfig").mockResolvedValue();
    const setTranscriptionConfigs = vi.spyOn(store, "setTranscriptionConfigs").mockResolvedValue();
    const wrapper = mount(TranscriptionFeatureSettings);

    const activeAction = wrapper.get('[data-testid="feature-transcription-config-active-config-b"]');
    expect(activeAction.attributes("aria-pressed")).toBe("false");

    await activeAction.trigger("click");

    expect(setActiveTranscriptionConfig).toHaveBeenCalledWith("config-b");
    expect(setTranscriptionConfigs).not.toHaveBeenCalled();
    expect(wrapper.get('[data-testid="feature-transcription-config-config-a"]').classes()).toContain("is-selected");
    expect(wrapper.get('[data-testid="feature-transcription-config-config-b"]').classes()).not.toContain("is-selected");
  });

  it("edits the selected transcription config while keeping the existing active config", async () => {
    const store = seedStore();
    const configA = createTranscriptionConfig({ id: "config-a", name: "Whisper A" });
    const configB = createTranscriptionConfig({ id: "config-b", name: "Local B" });
    store.settings!.features.transcription.activeConfigId = configA.id;
    store.settings!.features.transcription.configs = [configA, configB];
    vi.spyOn(store, "setActiveTranscriptionConfig").mockResolvedValue();
    const setTranscriptionConfigs = vi.spyOn(store, "setTranscriptionConfigs").mockResolvedValue();
    const wrapper = mount(TranscriptionFeatureSettings);

    await wrapper.get('[data-testid="feature-transcription-config-config-b"]').trigger("click");
    const configNameActions = wrapper.findAll('[data-testid="feature-transcription-config-name-action"]');
    await configNameActions.find((action) => action.text() === "Local B")!.trigger("click");
    await wrapper.get('[data-testid="feature-transcription-config-name"]').setValue("Local renamed");
    await wrapper.get('[data-testid="feature-transcription-config-name"]').trigger("blur");

    expect(setTranscriptionConfigs).toHaveBeenCalledWith(
      [
        expect.objectContaining({ id: "config-a", name: "Whisper A" }),
        expect.objectContaining({ id: "config-b", name: "Local renamed" })
      ],
      "config-a"
    );
  });

  it("uses the profile list layout and inline name editor for transcription configs", async () => {
    const store = seedStore();
    const configA = createTranscriptionConfig({ id: "config-a", name: "Whisper A" });
    const configB = createTranscriptionConfig({ id: "config-b", name: "Local B", provider: "faster-whisper" });
    store.settings!.features.transcription.activeConfigId = configA.id;
    store.settings!.features.transcription.configs = [configA, configB];
    const setTranscriptionConfigs = vi.spyOn(store, "setTranscriptionConfigs").mockResolvedValue();
    const wrapper = mount(TranscriptionFeatureSettings, { attachTo: document.body });

    expect(wrapper.get(".profile-list-sidebar").exists()).toBe(true);
    expect(wrapper.findAll(".profile-list__item")).toHaveLength(2);
    expect(wrapper.find('[data-testid="feature-transcription-config-name"]').exists()).toBe(false);

    await wrapper.findAll('[data-testid="feature-transcription-config-name-action"]')[1]!.trigger("click");
    let input = wrapper.get<HTMLInputElement>('[data-testid="feature-transcription-config-name"]');

    expect(input.element.dataset.configId).toBe("config-b");
    expect(document.activeElement).toBe(input.element);

    await input.setValue("Cancelled");
    await input.trigger("keydown", { key: "Escape" });

    expect(setTranscriptionConfigs).not.toHaveBeenCalled();
    expect(wrapper.find('[data-testid="feature-transcription-config-name"]').exists()).toBe(false);

    await wrapper.findAll('[data-testid="feature-transcription-config-name-action"]')[1]!.trigger("click");
    input = wrapper.get<HTMLInputElement>('[data-testid="feature-transcription-config-name"]');
    await input.setValue("Local C");
    await input.trigger("keydown", { key: "Enter" });

    expect(setTranscriptionConfigs).toHaveBeenCalledWith(
      [
        expect.objectContaining({ id: "config-a", name: "Whisper A" }),
        expect.objectContaining({ id: "config-b", name: "Local C" })
      ],
      "config-a"
    );

    wrapper.unmount();
  });

  it("duplicates the selected speech transcription config without changing the active runtime config", async () => {
    const store = seedStore();
    const configA = createTranscriptionConfig({ id: "config-a", name: "Whisper A" });
    const configB = createTranscriptionConfig({
      id: "config-b",
      name: "Local B",
      provider: "faster-whisper",
      extraParams: { temperature: "0" }
    });
    store.settings!.features.transcription.activeConfigId = configA.id;
    store.settings!.features.transcription.configs = [configA, configB];
    const setTranscriptionConfigs = vi.spyOn(store, "setTranscriptionConfigs").mockResolvedValue();
    const wrapper = mount(TranscriptionFeatureSettings);

    await wrapper.get('[data-testid="feature-transcription-config-config-b"]').trigger("click");
    await wrapper.get('[data-testid="feature-transcription-duplicate-config"]').trigger("click");

    expect(setTranscriptionConfigs).toHaveBeenCalledWith(
      [
        expect.objectContaining({ id: "config-a", name: "Whisper A" }),
        expect.objectContaining({ id: "config-b", name: "Local B" }),
        expect.objectContaining({
          name: "Local B Copy",
          provider: "faster-whisper",
          extraParams: { temperature: "0" }
        })
      ],
      "config-a"
    );
  });

  it("does not render Whisper API extra params for Faster-Whisper configs", () => {
    const store = seedStore();
    store.settings!.features.transcription.activeConfigId = "config-a";
    store.settings!.features.transcription.configs = [
      createTranscriptionConfig({ id: "config-a", provider: "faster-whisper", name: "Local A" })
    ];

    const wrapper = mount(TranscriptionFeatureSettings);

    expect(wrapper.find('[aria-labelledby="feature-transcription-extra-params-label"]').exists()).toBe(false);
    expect(wrapper.text()).not.toContain("Extra params");
  });

  it("resets Faster-Whisper model editor state when switching selected configs", async () => {
    const store = seedStore();
    const configA = createTranscriptionConfig({
      id: "config-a",
      name: "Local A",
      provider: "faster-whisper",
      fasterWhisperModel: "base"
    });
    const configB = createTranscriptionConfig({
      id: "config-b",
      name: "Local B",
      provider: "faster-whisper",
      fasterWhisperModel: "large-v3"
    });
    store.settings!.features.transcription.activeConfigId = configA.id;
    store.settings!.features.transcription.configs = [configA, configB];
    Object.defineProperty(window, "usp", {
      configurable: true,
      value: {
        ...window.usp,
        updateSettings: vi.fn(async () => store.settings)
      }
    });
    const wrapper = mount(TranscriptionFeatureSettings);
    await flushPromises();

    await wrapper.get('[aria-labelledby="feature-transcription-fw-model-label"]').setValue("custom-a");
    await wrapper.get('[data-testid="feature-transcription-config-config-b"]').trigger("click");
    await wrapper.vm.$nextTick();

    expect(wrapper.get<HTMLInputElement>('[aria-labelledby="feature-transcription-fw-model-label"]').element.value).toBe("large-v3");
  });

  it("downloads Faster-Whisper models into the selected config model directory", async () => {
    const store = seedStore();
    store.settings!.features.transcription.activeConfigId = "config-a";
    store.settings!.features.transcription.configs = [
      createTranscriptionConfig({
        id: "config-a",
        provider: "faster-whisper",
        fasterWhisperModel: "base",
        fasterWhisperModelDir: "/custom/models"
      })
    ];
    const downloadFasterWhisperModel = vi.fn().mockResolvedValue({
      ok: true,
      path: "/custom/models/faster-whisper-base",
      baseDir: "/custom/models",
      files: ["config.json", "model.bin", "tokenizer.json", "vocabulary.txt"]
    });
    Object.defineProperty(window, "usp", {
      configurable: true,
      value: {
        ...window.usp,
        getFasterWhisperStatus: vi.fn().mockResolvedValue({
          ok: true,
          paths: {
            binaryDir: "/tmp/fw/bin",
            modelsDir: "/tmp/fw/models",
            cpuBinaryPath: "/tmp/fw/bin/faster-whisper",
            gpuBinaryPath: "/tmp/fw/bin/faster-whisper-xxl"
          },
          binaries: {
            cpu: { exists: false, path: "/tmp/fw/bin/faster-whisper" },
            gpu: { exists: false, path: "/tmp/fw/bin/faster-whisper-xxl" }
          },
          models: [],
          modelsBaseDir: "/custom/models"
        }),
        downloadFasterWhisperModel,
        updateSettings: vi.fn(async () => store.settings)
      }
    });
    const wrapper = mount(TranscriptionFeatureSettings);
    await flushPromises();

    await wrapper.getComponent(FasterWhisperModelsCard).findAll('[data-slot="button"]')[1]!.trigger("click");
    await flushPromises();

    expect(downloadFasterWhisperModel).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "base",
        modelDir: "/custom/models"
      })
    );
  });

  it("writes the detected model base directory when selecting a downloaded Faster-Whisper model", async () => {
    const updateConfig = vi.fn();
    const wrapper = mount(FasterWhisperRuntimeCard, {
      attachTo: document.body,
      props: {
        t: (key: string) => key,
        activeConfig: createTranscriptionConfig({
          provider: "faster-whisper",
          fasterWhisperModel: "base",
          fasterWhisperModelDir: ""
        }),
        availableModels: [
          {
            name: "large-v3",
            folder: "faster-whisper-large-v3",
            path: "/tmp/fw/models/faster-whisper-large-v3"
          }
        ],
        modelsBaseDir: "/tmp/fw/models",
        selectedDownloadedModel: "",
        customModelInput: "",
        "onUpdate:config": updateConfig
      }
    });

    await wrapper.get('[aria-labelledby="feature-transcription-fw-downloaded-model-label"]').trigger("keydown", {
      key: "ArrowDown"
    });
    await wrapper.vm.$nextTick();
    (document.body.querySelector('[data-slot="select-item"][data-value="large-v3"]') as HTMLButtonElement).click();

    expect(updateConfig).toHaveBeenCalledWith({
      fasterWhisperModel: "large-v3",
      fasterWhisperModelDir: "/tmp/fw/models"
    });

    wrapper.unmount();
  });

  it("keeps empty Faster-Whisper VAD threshold local until it is a valid number", async () => {
    const updateConfig = vi.fn();
    const wrapper = mount(FasterWhisperRuntimeCard, {
      props: {
        t: (key: string) => key,
        activeConfig: createTranscriptionConfig({
          provider: "faster-whisper",
          fasterWhisperVadThreshold: 0.5
        }),
        availableModels: [],
        modelsBaseDir: "/tmp/fw/models",
        selectedDownloadedModel: "",
        customModelInput: "",
        "onUpdate:config": updateConfig
      }
    });
    const thresholdInput = wrapper.get<HTMLInputElement>('[aria-labelledby="feature-transcription-fw-vad-threshold-label"]');

    await thresholdInput.setValue("");

    expect(thresholdInput.element.value).toBe("");
    expect(updateConfig).not.toHaveBeenCalled();

    await thresholdInput.setValue("0.7");

    expect(updateConfig).toHaveBeenCalledWith({ fasterWhisperVadThreshold: 0.7 });
  });

  it("disables unsupported Faster-Whisper binary download buttons", () => {
    const wrapper = mount(FasterWhisperBinariesCard, {
      props: {
        t: (key: string) => key,
        paths: { binaryDir: "/tmp/fw/bin" },
        binaryStatus: {
          cpu: {
            exists: false,
            path: "/tmp/fw/bin/faster-whisper",
            downloadSupported: false,
            downloadUnavailableReason: "App-managed binary download is only available on Windows."
          },
          gpu: {
            exists: false,
            path: "/tmp/fw/bin/faster-whisper-xxl",
            downloadSupported: false,
            downloadUnavailableReason: "GPU binary installation is manual."
          }
        },
        isBusy: false
      }
    });

    expect(wrapper.get('[data-testid="feature-transcription-download-cpu"]').attributes("disabled")).toBeDefined();
    expect(wrapper.get('[data-testid="feature-transcription-download-gpu"]').attributes("disabled")).toBeDefined();
  });
});
