import type { PluginMainContribution } from "@immersive-subs/plugin-sdk";
import type { TranscriptionConfig, TranscriptionPluginConfig, SubtitleTrack } from "../../../types.js";
import type { StateManager } from "../../../stateManager.js";
import type { TranscriptionService } from "../../../transcriptionService.js";
import type { SubtitleCacheManager } from "../../../subtitleCacheManager.js";
import type { createLogger } from "../../../logger.js";
import { buildTranscriptionCacheKey } from "../../../transcriptionCache.js";

export interface TranscriptionPluginContext {
  stateManager: StateManager;
  transcriptionService: TranscriptionService;
  cacheManager: SubtitleCacheManager;
  getTranscriptionSettings: () => TranscriptionPluginConfig;
  logger: ReturnType<typeof createLogger>;
}

export function registerTranscriptionPluginMain(context: TranscriptionPluginContext): PluginMainContribution {
  let isTranscribing = false;

  function resolveActiveConfig(settings: TranscriptionPluginConfig): TranscriptionConfig | null {
    if (!settings.configs.length) return null;
    return settings.configs.find((c) => c.id === settings.activeConfigId) ?? null;
  }

  async function startTranscription(): Promise<{ ok: boolean; error?: string; trackId?: string; cached?: boolean }> {
    const transcriptionSettings = context.getTranscriptionSettings();
    const config = resolveActiveConfig(transcriptionSettings);
    if (!config) {
      const message = "No transcription configuration available.";
      context.stateManager.setTranscriptionStatus("error", message, null);
      return { ok: false, error: message };
    }

    const state = context.stateManager.getState();
    if (state.activeSource === "mediaserver") {
      const message = "Transcription is not supported in MediaServer mode.";
      context.stateManager.setTranscriptionStatus("error", message, config.name);
      return { ok: false, error: message };
    }

    if (!state.videoUrl) {
      const message = "No active video to transcribe.";
      context.stateManager.setTranscriptionStatus("error", message, config.name);
      return { ok: false, error: message };
    }

    if (isTranscribing) {
      const message = "Transcription already in progress.";
      context.stateManager.setTranscriptionStatus("running", message, config.name);
      return { ok: false, error: message };
    }

    isTranscribing = true;
    try {
      const targetVideoUrl = state.videoUrl;
      context.stateManager.setTranscriptionStatus("running", null, config.name);
      const cacheKey = buildTranscriptionCacheKey(targetVideoUrl, config);

      const applyTrackToState = (track: SubtitleTrack, message: string) => {
        context.stateManager.addOrReplaceSubtitleTrack(track, true);
        context.stateManager.updateState((draft) => {
          draft.status = "ready";
          draft.error = null;
        });
        context.stateManager.setTranscriptionStatus("success", message, config.name);
      };

      const cached = await context.cacheManager.get(cacheKey, "transcription");
      if (cached?.tracks?.length) {
        const cachedTrack = cached.tracks[0];
        const latestState = context.stateManager.getState();
        if (latestState.videoUrl === targetVideoUrl) {
          applyTrackToState(cachedTrack, `Transcription completed (${cachedTrack.cues.length} lines).`);
          return { ok: true, trackId: cachedTrack.id, cached: true };
        }
        await context.cacheManager.set(cacheKey, "transcription", { tracks: [cachedTrack] });
        context.logger.info("Cached transcription available for previous video, storing silently", { videoUrl: targetVideoUrl });
        context.stateManager.setTranscriptionStatus("success", "Transcription cached for previous video.", config.name);
        return { ok: true, trackId: cachedTrack.id, cached: true };
      }

      const track = await context.transcriptionService.transcribe(targetVideoUrl, config);
      await context.cacheManager.set(cacheKey, "transcription", { tracks: [track] });

      const latestState = context.stateManager.getState();
      if (latestState.videoUrl !== targetVideoUrl) {
        context.logger.info("Transcription finished for a previous video, cached silently", {
          targetVideoUrl,
          currentVideoUrl: latestState.videoUrl
        });
        context.stateManager.setTranscriptionStatus("success", "Transcription cached for previous video.", config.name);
        return { ok: true, trackId: track.id, cached: true };
      }

      applyTrackToState(track, `Transcription completed (${track.cues.length} lines).`);
      return { ok: true, trackId: track.id };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      context.stateManager.setTranscriptionStatus("error", message, config.name);
      return { ok: false, error: message };
    } finally {
      isTranscribing = false;
    }
  }

  return {
    commands: {
      startTranscription
    }
  };
}
