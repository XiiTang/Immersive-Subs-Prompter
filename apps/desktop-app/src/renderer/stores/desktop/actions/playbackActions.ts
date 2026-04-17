import type { VideoControlCommand } from "../../../../main/types";
import { reportError } from "../../../utils/errorBus";
import type { DesktopStoreThis } from "../types";

export async function selectSubtitleTrack(
  this: DesktopStoreThis,
  trackId: string | null,
  role: "primary" | "secondary" = "primary"
) {
  await window.usp.selectSubtitleTrack(trackId, role);
  if (!this.desktopState) {
    return;
  }
  const nextState =
    role === "primary"
      ? { ...this.desktopState, selectedPrimarySubtitleId: trackId }
      : { ...this.desktopState, selectedSecondarySubtitleId: trackId };
  this.desktopState = nextState;
}

export async function controlVideo(this: DesktopStoreThis, command: VideoControlCommand) {
  try {
    await window.usp.controlVideo(command);
  } catch (error) {
    reportError(error, "playback.controlVideo");
  }
}

export async function toggleFullscreen(this: DesktopStoreThis) {
  try {
    await window.usp.toggleDisplayFullscreen();
  } catch (error) {
    reportError(error, "playback.toggleFullscreen");
  }
}

export async function startTranscription(this: DesktopStoreThis) {
  try {
    const result = await window.usp.startTranscription();
    if (!result?.ok && result?.error) {
      reportError(new Error(result.error), "transcription.start");
    }
  } catch (error) {
    reportError(error, "transcription.startIpc");
  }
}

export const playbackActions = {
  selectSubtitleTrack,
  controlVideo,
  toggleFullscreen,
  startTranscription
};
