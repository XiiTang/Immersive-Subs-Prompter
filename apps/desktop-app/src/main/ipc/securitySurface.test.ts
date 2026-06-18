import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function readSource(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("renderer-to-main security surface", () => {
  it("exposes updater commands without renderer-controlled payloads", () => {
    const preload = readSource("src/preload.cts");
    const settingsHandlers = readSource("src/main/ipc/handlers/settingsHandlers.ts");
    const releaseHandlers = readSource("src/main/ipc/handlers/releaseHandlers.ts");

    expect(preload).not.toContain("openExternal");
    expect(preload).toContain("downloadReleaseUpdate: ()");
    expect(preload).toContain("installReleaseUpdate: ()");
    expect(preload).toContain('ipcRenderer.invoke("usp:download-release-update")');
    expect(preload).toContain('ipcRenderer.invoke("usp:install-release-update")');
    expect(preload).not.toContain('ipcRenderer.invoke("usp:download-release-update",');
    expect(preload).not.toContain('ipcRenderer.invoke("usp:install-release-update",');
    expect(settingsHandlers).not.toContain("usp:open-external");
    expect(releaseHandlers).not.toContain("payload");
    expect(releaseHandlers).toContain("context.releaseService.downloadUpdate()");
    expect(releaseHandlers).toContain("context.releaseService.installDownloadedUpdate()");
  });

  it("does not expose generic renderer-controlled path opening", () => {
    const preload = readSource("src/preload.cts");
    const settingsHandlers = readSource("src/main/ipc/handlers/settingsHandlers.ts");
    const fasterWhisperHandlers = readSource("src/main/ipc/handlers/fasterWhisperHandlers.ts");
    const transcriptionSettings = readSource("src/renderer/components/settings/TranscriptionFeatureSettings.vue");
    const fasterWhisperComposable = readSource(
      "src/renderer/components/settings/transcription/composables/useFasterWhisper.ts"
    );

    expect(preload).not.toContain("openPath:");
    expect(preload).not.toContain("usp:open-path");
    expect(settingsHandlers).not.toContain("usp:open-path");
    expect(transcriptionSettings).not.toContain("@open-path");
    expect(fasterWhisperComposable).not.toContain("window.usp.openPath");
    expect(preload).not.toContain("modelDir?: string");
    expect(preload).not.toContain("modelDir:");
    expect(preload).not.toContain("listFasterWhisperModels");
    expect(fasterWhisperHandlers).not.toContain("usp:faster-whisper-list-models");
    expect(fasterWhisperComposable).not.toContain("fasterWhisperModelDir || undefined");
    expect(fasterWhisperComposable).not.toContain("modelDir:");
    expect(preload).toContain("openFasterWhisperBinaryFolder");
    expect(preload).toContain("openFasterWhisperModelsFolder");
    expect(preload).toContain("downloadFasterWhisperBinary");
    expect(preload).not.toContain("binaryUrl");
    expect(preload).not.toContain("binaryPath");
    expect(fasterWhisperHandlers).toContain("BINARY_DOWNLOAD_PAYLOAD_KEYS");
    expect(fasterWhisperHandlers).not.toContain("url:");
  });
});
