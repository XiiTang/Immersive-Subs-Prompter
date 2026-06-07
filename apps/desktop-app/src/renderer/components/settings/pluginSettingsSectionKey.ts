const PLUGIN_SETTINGS_SECTION_SEPARATOR = "::";

export interface PluginSettingsSectionKey {
  pluginKey: string;
  sectionId: string;
}

export function encodePluginSettingsSectionKey(pluginKey: string, sectionId: string): string {
  return `${pluginKey}${PLUGIN_SETTINGS_SECTION_SEPARATOR}${sectionId}`;
}

export function decodePluginSettingsSectionKey(value: string): PluginSettingsSectionKey | null {
  const separatorIndex = value.indexOf(PLUGIN_SETTINGS_SECTION_SEPARATOR);
  if (separatorIndex <= 0) {
    return null;
  }
  const pluginKey = value.slice(0, separatorIndex);
  const sectionId = value.slice(separatorIndex + PLUGIN_SETTINGS_SECTION_SEPARATOR.length);
  return pluginKey && sectionId ? { pluginKey, sectionId } : null;
}
