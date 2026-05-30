import type { PluginManifest } from "../../pluginManifest.js";

export const TRANSCRIPTION_MANIFEST: PluginManifest = {
  id: "official.transcription",
  version: "1.0.0",
  displayName: "Speech Transcription",
  description: "Transcribe video audio using Whisper API or Faster-Whisper local CLI.",
  settings: [
    {
      id: "official.transcription.settings",
      title: "Speech Transcription"
    }
  ]
};
