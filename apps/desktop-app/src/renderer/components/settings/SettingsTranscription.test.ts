import { createPinia, setActivePinia } from "pinia";
import { mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SettingsTranscription from "./SettingsTranscription.vue";
import { useDesktopStore } from "../../stores/desktop";

describe("SettingsTranscription", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    const store = useDesktopStore();
    store.settings = {
      global: {
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
      plugins: {
        "official.transcription": {
          config: {
            activeConfigId: "transcription-1",
            configs: [
              {
                id: "transcription-1",
                name: "Lecture Whisper",
                provider: "whisper-api",
                baseUrl: "https://api.openai.com/v1",
                apiKey: "",
                model: "whisper-1",
                language: "",
                prompt: "",
                enableWordTimestamps: false,
                extraParams: {},
                ytDlpArgs: "",
                fasterWhisperBinary: "faster-whisper",
                fasterWhisperModel: "base",
                fasterWhisperModelDir: "",
                fasterWhisperDevice: "cpu",
                fasterWhisperVadFilter: true,
                fasterWhisperVadThreshold: 0.5,
                fasterWhisperVadMethod: "",
                fasterWhisperUseKim2: false
              },
              {
                id: "transcription-2",
                name: "Local Faster",
                provider: "whisper-api",
                baseUrl: "https://api.openai.com/v1",
                apiKey: "",
                model: "whisper-1",
                language: "",
                prompt: "",
                enableWordTimestamps: false,
                extraParams: {},
                ytDlpArgs: "",
                fasterWhisperBinary: "faster-whisper",
                fasterWhisperModel: "base",
                fasterWhisperModelDir: "",
                fasterWhisperDevice: "cpu",
                fasterWhisperVadFilter: true,
                fasterWhisperVadThreshold: 0.5,
                fasterWhisperVadMethod: "",
                fasterWhisperUseKim2: false
              }
            ]
          }
        }
      },
      cache: { enabled: false, path: "", retentionDays: 30 }
    } as never;
    Object.defineProperty(window, "usp", {
      configurable: true,
      value: {
        updateSettings: vi.fn(async () => store.settings),
        onFasterWhisperDownloadProgress: vi.fn(() => vi.fn()),
        getFasterWhisperPaths: vi.fn(async () => ({
          binaryDir: "",
          modelsDir: "",
          cpuBinaryPath: "",
          gpuBinaryPath: ""
        })),
        getFasterWhisperStatus: vi.fn(async () => ({
          ok: true,
          paths: {
            binaryDir: "",
            modelsDir: "",
            cpuBinaryPath: "",
            gpuBinaryPath: ""
          },
          binaryDownloadsSupported: true,
          binaryDownloadUnsupportedReason: null,
          binaries: {
            cpu: { exists: false, path: "" },
            gpu: { exists: false, path: "" }
          },
          models: [],
          modelsBaseDir: ""
        }))
      }
    });
  });

  it("uses a short non-default name for new transcription configs", async () => {
    const store = useDesktopStore();
    const wrapper = mount(SettingsTranscription, {
      global: {
        stubs: {
          IconAdd: true,
          IconDelete: true
        }
      }
    });

    await wrapper.get('[aria-label="Add"]').trigger("click");

    const newConfigName = store.getTranscriptionPluginConfig().configs.at(-1)?.name;
    expect(newConfigName).toBe("Whisper API");
  });

  it("renames the active transcription config directly from the config card", async () => {
    const store = useDesktopStore();
    const wrapper = mount(SettingsTranscription, {
      global: {
        stubs: {
          IconAdd: true,
          IconDelete: true
        }
      }
    });

    await wrapper.get('[data-testid="transcription-config-name-action"]').trigger("click");
    const input = wrapper.get<HTMLInputElement>('[data-testid="transcription-config-name-input"]');
    await input.setValue("Meeting Notes");
    await input.trigger("blur");

    expect(store.getTranscriptionPluginConfig().configs[0]?.name).toBe("Meeting Notes");
  });

  it("shows active and inactive transcription configs with check indicators", () => {
    const wrapper = mount(SettingsTranscription, {
      global: {
        stubs: {
          IconAdd: true,
          IconDelete: true
        }
      }
    });

    const indicators = wrapper.findAll('[data-testid="transcription-config-state"]');
    expect(indicators.map((indicator) => indicator.attributes("data-state"))).toEqual(["checked", "unchecked"]);
  });

  it("selects a transcription config from the card body without activating it", async () => {
    const store = useDesktopStore();
    const wrapper = mount(SettingsTranscription, {
      global: {
        stubs: {
          IconAdd: true,
          IconDelete: true
        }
      }
    });

    await wrapper.findAll(".transcription-config-list__item")[1]!.trigger("click");

    expect(store.getTranscriptionPluginConfig().activeConfigId).toBe("transcription-1");
    expect(wrapper.findAll(".transcription-config-list__item").map((item) => item.classes("is-selected"))).toEqual([
      false,
      true
    ]);

    const baseUrlInput = wrapper.get<HTMLInputElement>('[aria-labelledby="transcription-base-url-label"]');
    await baseUrlInput.setValue("https://example.test/v1");

    expect(store.getTranscriptionPluginConfig().activeConfigId).toBe("transcription-1");
    expect(store.getTranscriptionPluginConfig().configs[0]?.baseUrl).toBe("https://api.openai.com/v1");
    expect(store.getTranscriptionPluginConfig().configs[1]?.baseUrl).toBe("https://example.test/v1");
  });

  it("activates a transcription config from the card indicator", async () => {
    const store = useDesktopStore();
    const wrapper = mount(SettingsTranscription, {
      global: {
        stubs: {
          IconAdd: true,
          IconDelete: true
        }
      }
    });

    await wrapper.findAll('[data-testid="transcription-config-state"]')[1]!.trigger("click");

    expect(store.getTranscriptionPluginConfig().activeConfigId).toBe("transcription-2");
    expect(wrapper.findAll(".transcription-config-list__item").map((item) => item.classes("is-selected"))).toEqual([
      true,
      false
    ]);
    expect(wrapper.findAll('[data-testid="transcription-config-state"]').map((indicator) => indicator.attributes("data-state"))).toEqual([
      "unchecked",
      "checked"
    ]);
  });

  it("rejects non-string extra parameter values before persisting settings", async () => {
    const store = useDesktopStore();
    const wrapper = mount(SettingsTranscription, {
      global: {
        stubs: {
          IconAdd: true,
          IconDelete: true
        }
      }
    });

    await wrapper
      .get<HTMLTextAreaElement>('textarea[aria-labelledby="transcription-extra-params-label"]')
      .setValue('{"temperature":0}');

    expect(store.getTranscriptionPluginConfig().configs[0]?.extraParams).toEqual({});
    expect(wrapper.text()).toContain("Extra parameter values must be strings.");
  });
});
