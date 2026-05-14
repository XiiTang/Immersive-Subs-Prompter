import type { Component } from "vue";
import SettingsTranscription from "../components/settings/SettingsTranscription.vue";
import SettingsWordLookup from "../components/settings/SettingsWordLookup.vue";
import SettingsMediaServer from "../components/settings/SettingsMediaServer.vue";

const pluginSettingsRegistry = new Map<string, Component>([
  ["official.transcription.settings", SettingsTranscription],
  ["official.word-lookup.settings", SettingsWordLookup],
  ["official.jellyfinemby.settings", SettingsMediaServer]
]);

export function resolvePluginSettingsComponent(sectionId: string): Component | null {
  return pluginSettingsRegistry.get(sectionId) ?? null;
}
