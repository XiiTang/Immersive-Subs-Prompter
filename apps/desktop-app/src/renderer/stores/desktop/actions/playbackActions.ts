import type { VideoControlCommand } from "../../../../main/types";
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
    console.error("[Renderer] Failed to send control command", error);
  }
}

export async function toggleFullscreen(this: DesktopStoreThis) {
  try {
    await window.usp.toggleDisplayFullscreen();
  } catch (error) {
    console.error("[Renderer] Failed to toggle fullscreen", error);
  }
}

export async function startTranscription(this: DesktopStoreThis) {
  try {
    const result = await window.usp.startTranscription();
    if (!result?.ok && result?.error) {
      console.error("[Renderer] Transcription failed:", result.error);
    }
  } catch (error) {
    console.error("[Renderer] Transcription IPC failed", error);
  }
}

export const playbackActions = {
  selectSubtitleTrack,
  controlVideo,
  toggleFullscreen,
  startTranscription
};
