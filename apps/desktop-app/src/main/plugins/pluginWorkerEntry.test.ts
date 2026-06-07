import { afterEach, describe, expect, it, vi } from "vitest";
import { startPluginSandbox } from "./pluginSandbox.js";

vi.mock("./pluginSandbox.js", () => ({
  startPluginSandbox: vi.fn(async () => ({
    getWordLookupProvider: () => null,
    getTranscriptionProvider: () => null,
    getMediaSourceAdapter: () => null,
    updateConfig: vi.fn(async () => undefined),
    stop: vi.fn(async () => undefined)
  }))
}));

describe("plugin worker entry", () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    delete (process as NodeJS.Process & { parentPort?: unknown }).parentPort;
  });

  it("handles Electron parentPort MessageEvent payloads", async () => {
    let onMessage: ((message: unknown) => void) | undefined;
    const parentPort = {
      on: vi.fn((event: string, listener: (message: unknown) => void) => {
        if (event === "message") {
          onMessage = listener;
        }
      }),
      postMessage: vi.fn()
    };
    (process as NodeJS.Process & { parentPort?: unknown }).parentPort = parentPort;
    await import("./pluginWorkerEntry.js");

    onMessage?.({
      data: {
        type: "start",
        pluginId: "xiitang/word-lookup",
        entryPath: "/plugins/xiitang/word-lookup/main.js",
        permissions: ["wordLookupProvider"],
        config: {}
      }
    });

    await vi.waitFor(() => {
      expect(startPluginSandbox).toHaveBeenCalledWith(expect.objectContaining({
        pluginId: "xiitang/word-lookup",
        entryPath: "/plugins/xiitang/word-lookup/main.js"
      }));
      expect(parentPort.postMessage).toHaveBeenCalledWith({ type: "ready" });
    });
  });
});
