import { describe, expect, it, vi } from "vitest";
import { startPluginTranscription } from "./pluginTranscriptionController.js";
import type { PluginManager } from "./plugins/pluginManager.js";
import type { StateManager } from "./stateManager.js";
import type { SubtitleCacheManager } from "./subtitleCacheManager.js";

describe("startPluginTranscription", () => {
  it("keeps state/cache ownership in the host while using the enabled provider for track creation", async () => {
    const track = {
      id: "track-1",
      sourceFile: "provider.srt",
      cues: [{ start: 0, end: 1000, text: "hello" }]
    };
    const state = {
      activeSource: "extension",
      videoUrl: "https://video.example.test/watch",
      status: "ready"
    };
    const stateManager = {
      getState: vi.fn(() => state),
      setTranscriptionStatus: vi.fn(),
      addOrReplaceSubtitleTrack: vi.fn(),
      updateState: vi.fn((mutator: (draft: any) => void) => {
        mutator(state);
        return state;
      })
    } as unknown as StateManager;
    const cacheManager = {
      get: vi.fn(async () => null),
      set: vi.fn(async () => undefined)
    } as unknown as SubtitleCacheManager;
    const pluginManager = {
      getTranscriptionProvider: vi.fn(() => ({
        pluginKey: "xiitang/transcription",
        provider: {
          transcribe: vi.fn(async () => track)
        }
      }))
    } as unknown as PluginManager;

    const result = await startPluginTranscription({
      stateManager,
      cacheManager,
      pluginManager,
      getPluginConfig: (pluginKey) => ({ model: pluginKey })
    });

    expect(result).toEqual({ ok: true, trackId: "track-1" });
    expect(cacheManager.set).toHaveBeenCalledWith(
      "https://video.example.test/watch",
      "transcription",
      { tracks: [track] },
      expect.stringContaining("xiitang/transcription:")
    );
    expect(stateManager.addOrReplaceSubtitleTrack).toHaveBeenCalledWith(track, true);
    expect(stateManager.setTranscriptionStatus).toHaveBeenCalledWith(
      "success",
      "Transcription completed (1 lines).",
      "xiitang/transcription"
    );
  });
});
