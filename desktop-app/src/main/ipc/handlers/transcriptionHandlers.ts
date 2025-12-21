import { ipcMain } from "electron";
import { createHash } from "crypto";
import { SubtitleTrack, TranscriptionConfig } from "../../types.js";
import { IpcContext } from "../ipcRouter.js";

export function registerTranscriptionHandlers(context: IpcContext) {
  ipcMain.handle("usp:start-transcription", async () => {
    const config = resolveActiveTranscriptionConfig(context);
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
        applyTrackToState(
          cachedTrack,
          `Transcription completed (${cachedTrack.cues.length} lines).`
        );
        return { ok: true, trackId: cachedTrack.id, cached: true };
      }
      await context.cacheManager.set(cacheKey, "transcription", { tracks: [cachedTrack] });
      context.logger.info(
        "Cached transcription available for previous video, storing silently",
        { videoUrl: targetVideoUrl }
      );
      context.stateManager.setTranscriptionStatus(
        "success",
        "Transcription cached for previous video.",
        config.name
      );
      return { ok: true, trackId: cachedTrack.id, cached: true };
    }

    try {
      const track = await context.transcriptionService.transcribe(targetVideoUrl, config);
      await context.cacheManager.set(cacheKey, "transcription", { tracks: [track] });

      const latestState = context.stateManager.getState();
      if (latestState.videoUrl !== targetVideoUrl) {
        context.logger.info("Transcription finished for a previous video, cached silently", {
          targetVideoUrl,
          currentVideoUrl: latestState.videoUrl
        });
        context.stateManager.setTranscriptionStatus(
          "success",
          "Transcription cached for previous video.",
          config.name
        );
        return { ok: true, trackId: track.id, cached: true };
      }

      applyTrackToState(track, `Transcription completed (${track.cues.length} lines).`);
      return { ok: true, trackId: track.id };
    } catch (error) {
      const message =
        error && typeof error === "object" && "message" in error ? (error as Error).message : String(error);
      context.stateManager.setTranscriptionStatus("error", message, config.name);
      return { ok: false, error: message };
    }
  });
}

function resolveActiveTranscriptionConfig(context: IpcContext): TranscriptionConfig | null {
  const transcription = context.getSettings().transcription;
  if (!transcription || !Array.isArray(transcription.configs) || !transcription.configs.length) {
    return null;
  }
  const active =
    transcription.configs.find((config) => config.id === transcription.activeConfigId) ??
    transcription.configs[0];
  return active;
}

function buildTranscriptionCacheKey(videoUrl: string, config: TranscriptionConfig): string {
  const provider = config.provider === "faster-whisper" ? "faster-whisper" : "whisper-api";
  const signaturePayload = {
    id: config.id,
    provider,
    model: provider === "faster-whisper" ? config.fasterWhisperModel : config.model,
    language: config.language,
    prompt: config.prompt,
    enableWordTimestamps: config.enableWordTimestamps,
    ytDlpArgs: config.ytDlpArgs,
    baseUrl: provider === "whisper-api" ? config.baseUrl : "",
    extraParams: provider === "whisper-api" ? config.extraParams : undefined,
    fasterWhisper:
      provider === "faster-whisper"
        ? {
            device: config.fasterWhisperDevice,
            modelDir: config.fasterWhisperModelDir,
            vadFilter: config.fasterWhisperVadFilter,
            vadThreshold: config.fasterWhisperVadThreshold,
            vadMethod: config.fasterWhisperVadMethod,
            useKim2: config.fasterWhisperUseKim2
          }
        : undefined
  };
  const signature = createHash("sha256").update(JSON.stringify(signaturePayload)).digest("hex").slice(0, 12);
  return `${videoUrl}#${signature}`;
}
