import type { Component } from "vue";
import SettingsTranscription from "../components/settings/SettingsTranscription.vue";

const pluginSettingsRegistry = new Map<string, Component>([
  ["official.transcription.settings", SettingsTranscription]
]);

export function resolvePluginSettingsComponent(sectionId: string): Component | null {
  return pluginSettingsRegistry.get(sectionId) ?? null;
}
