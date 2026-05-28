import { DEFAULT_GLOBAL_SETTINGS, DEFAULT_PROFILE_SETTINGS } from "../../../common/defaultSettings.js";

export const DEFAULT_PROFILE_TEMPLATE = DEFAULT_PROFILE_SETTINGS;
export const DEFAULT_PANEL_OPACITY = DEFAULT_GLOBAL_SETTINGS.panelOpacity;

export type CacheStats = {
  totalEntries: number;
  totalSize: number;
  oldestEntry: number | null;
  newestEntry: number | null;
};
