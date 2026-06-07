import { createHash } from "node:crypto";
import type { PluginManager } from "./plugins/pluginManager.js";
import type { StateManager } from "./stateManager.js";
import type { SubtitleCacheManager } from "./subtitleCacheManager.js";
import type { SubtitleTrack } from "./types.js";

export interface PluginTranscriptionControllerOptions {
  stateManager: StateManager;
  cacheManager: SubtitleCacheManager;
  pluginManager: PluginManager;
  getPluginConfig: (pluginKey: string) => Record<string, unknown>;
}

let isTranscribing = false;

export async function startPluginTranscription(
  options: PluginTranscriptionControllerOptions
): Promise<{ ok: boolean; error?: string; trackId?: string; cached?: boolean }> {
  const provider = options.pluginManager.getTranscriptionProvider();
  if (!provider) {
    const message = "No enabled transcription provider.";
    options.stateManager.setTranscriptionStatus("error", message, null);
    return { ok: false, error: message };
  }

  const configName = provider.pluginKey;
  const state = options.stateManager.getState();
  if (state.activeSource === "mediaserver") {
    const message = "Transcription is not supported in MediaServer mode.";
    options.stateManager.setTranscriptionStatus("error", message, configName);
    return { ok: false, error: message };
  }
  if (!state.videoUrl) {
    const message = "No active video to transcribe.";
    options.stateManager.setTranscriptionStatus("error", message, configName);
    return { ok: false, error: message };
  }
  if (isTranscribing) {
    const message = "Transcription already in progress.";
    options.stateManager.setTranscriptionStatus("running", message, configName);
    return { ok: false, error: message };
  }

  const targetVideoUrl = state.videoUrl;
  const config = options.getPluginConfig(provider.pluginKey);
  const cacheVariant = buildPluginTranscriptionCacheVariant(provider.pluginKey, config);
  isTranscribing = true;
  try {
    options.stateManager.setTranscriptionStatus("running", null, configName);
    const cached = await options.cacheManager.get(targetVideoUrl, "transcription", cacheVariant);
    if (cached?.tracks?.length) {
      const cachedTrack = cached.tracks[0];
      applyTrackToState(options.stateManager, cachedTrack, configName);
      return { ok: true, trackId: cachedTrack.id, cached: true };
    }

    const track = await provider.provider.transcribe({ videoUrl: targetVideoUrl, config });
    await options.cacheManager.set(targetVideoUrl, "transcription", { tracks: [track] }, cacheVariant);

    const latestState = options.stateManager.getState();
    if (latestState.videoUrl !== targetVideoUrl) {
      options.stateManager.setTranscriptionStatus("success", "Transcription cached for previous video.", configName);
      return { ok: true, trackId: track.id, cached: true };
    }

    applyTrackToState(options.stateManager, track, configName);
    return { ok: true, trackId: track.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    options.stateManager.setTranscriptionStatus("error", message, configName);
    return { ok: false, error: message };
  } finally {
    isTranscribing = false;
  }
}

function applyTrackToState(stateManager: StateManager, track: SubtitleTrack, configName: string): void {
  stateManager.addOrReplaceSubtitleTrack(track, true);
  stateManager.updateState((draft) => {
    draft.status = "ready";
    draft.error = null;
  });
  stateManager.setTranscriptionStatus(
    "success",
    `Transcription completed (${track.cues.length} lines).`,
    configName
  );
}

function buildPluginTranscriptionCacheVariant(pluginKey: string, config: Record<string, unknown>): string {
  const hash = createHash("sha256").update(JSON.stringify(config)).digest("hex");
  return `${pluginKey}:${hash}`;
}
