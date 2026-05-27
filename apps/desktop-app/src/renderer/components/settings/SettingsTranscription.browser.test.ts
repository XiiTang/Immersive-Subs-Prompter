import { createPinia, setActivePinia } from "pinia";
import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppSettings } from "../../../main/types.js";
import SettingsTranscription from "./SettingsTranscription.vue";
import { useDesktopStore } from "../../stores/desktop";
import "../../style.css";

function createSettings(): AppSettings {
  return {
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
    plugins: {
      "official.transcription": {
        config: {
          activeConfigId: "transcription-fast",
          configs: [
            {
              id: "transcription-fast",
              name: "Local Faster Whisper",
              provider: "faster-whisper",
              baseUrl: "https://api.openai.com/v1",
              apiKey: "",
              model: "whisper-1",
              language: "",
              prompt: "Prefer source language punctuation",
              enableWordTimestamps: false,
              extraParams: {},
              ytDlpArgs: "--extract-audio --audio-format wav --cookies-from-browser firefox",
              fasterWhisperBinary: "faster-whisper",
              fasterWhisperModel: "large-v3-turbo",
              fasterWhisperModelDir: "",
              fasterWhisperDevice: "cpu",
              fasterWhisperVadFilter: true,
              fasterWhisperVadThreshold: 0.5,
              fasterWhisperVadMethod: "silero",
              fasterWhisperUseKim2: false
            }
          ]
        }
      }
    },
    cache: { enabled: false, path: "", retentionDays: 30 }
  };
}

async function flushLayout() {
  await nextTick();
  await nextTick();
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}

function expectContainedBy(container: HTMLElement, element: HTMLElement) {
  const containerRect = container.getBoundingClientRect();
  const elementRect = element.getBoundingClientRect();
  expect(elementRect.left).toBeGreaterThanOrEqual(containerRect.left - 1);
  expect(elementRect.right).toBeLessThanOrEqual(containerRect.right + 1);
}

describe("SettingsTranscription browser layout", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    document.body.innerHTML = "";
    document.body.style.margin = "0";
    document.body.style.padding = "0";
    document.body.style.width = "616px";
    document.body.style.background = "#101418";

    const store = useDesktopStore();
    store.settings = createSettings();

    Object.defineProperty(window, "usp", {
      configurable: true,
      value: {
        updateSettings: vi.fn(async () => store.settings),
        onFasterWhisperDownloadProgress: vi.fn(() => vi.fn()),
        getFasterWhisperPaths: vi.fn(async () => ({
          binaryDir: "/Users/demo/.immersive-subs/faster-whisper/bin",
          modelsDir: "/Users/demo/.immersive-subs/faster-whisper/models",
          cpuBinaryPath: "/Users/demo/.immersive-subs/faster-whisper/bin/faster-whisper",
          gpuBinaryPath: "/Users/demo/.immersive-subs/faster-whisper/bin/faster-whisper-cuda"
        })),
        getFasterWhisperStatus: vi.fn(async () => ({
          ok: true,
          paths: {
            binaryDir: "/Users/demo/.immersive-subs/faster-whisper/bin",
            modelsDir: "/Users/demo/.immersive-subs/faster-whisper/models",
            cpuBinaryPath: "/Users/demo/.immersive-subs/faster-whisper/bin/faster-whisper",
            gpuBinaryPath: "/Users/demo/.immersive-subs/faster-whisper/bin/faster-whisper-cuda"
          },
          binaries: {
            cpu: { exists: true, path: "/Users/demo/.immersive-subs/faster-whisper/bin/faster-whisper" },
            gpu: { exists: false, path: "/Users/demo/.immersive-subs/faster-whisper/bin/faster-whisper-cuda" }
          },
          models: [
            {
              name: "large-v3-turbo",
              path: "/Users/demo/.immersive-subs/faster-whisper/models/faster-whisper-large-v3-turbo",
              folder: "faster-whisper-large-v3-turbo"
            }
          ],
          modelsBaseDir: "/Users/demo/.immersive-subs/faster-whisper/models"
        })),
        downloadFasterWhisperBinary: vi.fn(),
        downloadFasterWhisperModel: vi.fn(),
        openPath: vi.fn()
      }
    });
  });

  it("keeps faster-whisper controls inside the fixed settings content width", async () => {
    const wrapper = mount(SettingsTranscription, {
      attachTo: document.body,
      global: {
        stubs: {
          IconAdd: true,
          IconDelete: true,
          IconFolder: true
        }
      }
    });
    await flushLayout();

    const split = wrapper.get<HTMLElement>(".settings-split").element;
    const sidebar = wrapper.get<HTMLElement>(".settings-split__sidebar").element;
    const editor = wrapper.get<HTMLElement>(".settings-split__editor").element;
    const resourceCards = wrapper.findAll<HTMLElement>(".settings-grid--two > .ui-group").map((node) => node.element);
    const vadFilter = wrapper.get("#fw-vad-filter-label").element.closest(".ui-field") as HTMLElement;
    const vadMethod = wrapper.get("#fw-vad-method-label").element.closest(".ui-field") as HTMLElement;

    expect(Math.round(split.getBoundingClientRect().width)).toBeLessThanOrEqual(616);
    expect(Math.round(sidebar.getBoundingClientRect().width)).toBeLessThanOrEqual(184);
    expect(editor.getBoundingClientRect().width).toBeGreaterThanOrEqual(420);
    expect(resourceCards).toHaveLength(2);
    expect(resourceCards[1]!.getBoundingClientRect().top).toBeGreaterThanOrEqual(
      resourceCards[0]!.getBoundingClientRect().bottom
    );
    expect(vadMethod.getBoundingClientRect().top).toBeGreaterThanOrEqual(vadFilter.getBoundingClientRect().bottom);

    [
      ...Array.from(editor.querySelectorAll<HTMLElement>(".ui-group")),
      ...Array.from(editor.querySelectorAll<HTMLElement>(".settings-list-row")),
      ...Array.from(editor.querySelectorAll<HTMLElement>(".settings-inline")),
      ...Array.from(editor.querySelectorAll<HTMLElement>(".ui-field"))
    ].forEach((element) => expectContainedBy(editor, element));
  });
});
