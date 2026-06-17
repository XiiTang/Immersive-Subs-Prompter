import { createHash } from "node:crypto";
import type { StateManager } from "../stateManager.js";
import type { SubtitleCacheManager } from "../subtitleCacheManager.js";
import type { TranscriptionService } from "../transcriptionService.js";
import type { SubtitleTrack, TranscriptionConfig, TranscriptionFeatureSettings } from "../types.js";
import { buildFeatureTranscriptionConfig } from "./transcriptionFeatureConfig.js";

export interface TranscriptionFeatureServiceOptions {
  stateManager: StateManager;
  cacheManager: SubtitleCacheManager;
  transcriptionService: TranscriptionService;
  getSettings: () => TranscriptionFeatureSettings;
}

let isTranscribing = false;
const TRANSCRIPTION_FEATURE_NAME = "Speech Transcription";

export async function startFeatureTranscription(
  options: TranscriptionFeatureServiceOptions
): Promise<{ ok: boolean; error?: string; trackId?: string; cached?: boolean }> {
  const settings = options.getSettings();
  if (!settings.enabled) {
    const message = "Speech Transcription feature is disabled.";
    options.stateManager.setTranscriptionStatus("error", message, TRANSCRIPTION_FEATURE_NAME);
    return { ok: false, error: message };
  }

  const state = options.stateManager.getState();
  if (state.activeSource === "mediaserver") {
    const message = "Transcription is not supported in MediaServer mode.";
    options.stateManager.setTranscriptionStatus("error", message, TRANSCRIPTION_FEATURE_NAME);
    return { ok: false, error: message };
  }
  if (!state.videoUrl) {
    const message = "No active video to transcribe.";
    options.stateManager.setTranscriptionStatus("error", message, TRANSCRIPTION_FEATURE_NAME);
    return { ok: false, error: message };
  }
  if (isTranscribing) {
    const message = "Transcription already in progress.";
    options.stateManager.setTranscriptionStatus("running", message, TRANSCRIPTION_FEATURE_NAME);
    return { ok: false, error: message };
  }

  const targetVideoUrl = state.videoUrl;
  let runtimeConfig: TranscriptionConfig;
  try {
    runtimeConfig = buildFeatureTranscriptionConfig(settings);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    options.stateManager.setTranscriptionStatus("error", message, TRANSCRIPTION_FEATURE_NAME);
    return { ok: false, error: message };
  }

  const cacheVariant = buildFeatureTranscriptionCacheVariant(runtimeConfig);
  isTranscribing = true;
  try {
    options.stateManager.setTranscriptionStatus("running", null, runtimeConfig.name);
    const cached = await options.cacheManager.get(targetVideoUrl, "transcription", cacheVariant);
    if (cached?.tracks?.length) {
      const cachedTrack = cached.tracks[0];
      applyTrackToState(options.stateManager, cachedTrack, runtimeConfig.name);
      return { ok: true, trackId: cachedTrack.id, cached: true };
    }

    const track = await options.transcriptionService.transcribe(targetVideoUrl, runtimeConfig);
    await options.cacheManager.set(targetVideoUrl, "transcription", { tracks: [track] }, cacheVariant);

    const latestState = options.stateManager.getState();
    if (latestState.videoUrl !== targetVideoUrl) {
      options.stateManager.setTranscriptionStatus(
        "success",
        "Transcription cached for previous video.",
        runtimeConfig.name
      );
      return { ok: true, trackId: track.id, cached: true };
    }

    applyTrackToState(options.stateManager, track, runtimeConfig.name);
    return { ok: true, trackId: track.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    options.stateManager.setTranscriptionStatus("error", message, runtimeConfig.name);
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

function buildFeatureTranscriptionCacheVariant(config: TranscriptionConfig): string {
  const hash = createHash("sha256").update(JSON.stringify(config)).digest("hex");
  return `feature-transcription:${hash}`;
}
