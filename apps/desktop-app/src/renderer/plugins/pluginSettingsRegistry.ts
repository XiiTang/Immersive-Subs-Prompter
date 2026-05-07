import type { Component } from "vue";
import SettingsTranscription from "../components/settings/SettingsTranscription.vue";
import SettingsWordLookup from "../components/settings/SettingsWordLookup.vue";

const pluginSettingsRegistry = new Map<string, Component>([
  ["official.transcription.settings", SettingsTranscription],
  ["official.word-lookup.settings", SettingsWordLookup]
]);

export function resolvePluginSettingsComponent(sectionId: string): Component | null {
  return pluginSettingsRegistry.get(sectionId) ?? null;
}
