import type { WordLookupPluginConfig } from "../main/plugins/official/wordLookup/wordLookupTypes.js";

export const DEFAULT_WORD_LOOKUP_PANEL_SIZE = {
  width: 360,
  height: 300
};

export const DEFAULT_WORD_LOOKUP_PLUGIN_CONFIG: WordLookupPluginConfig = {
  wordListPath: "",
  modifierKey: "alt",
  panelSize: DEFAULT_WORD_LOOKUP_PANEL_SIZE
};

export const WORD_LOOKUP_PANEL_SIZE_LIMITS = {
  minWidth: 260,
  maxWidth: 720,
  minHeight: 180,
  maxHeight: 640
};
