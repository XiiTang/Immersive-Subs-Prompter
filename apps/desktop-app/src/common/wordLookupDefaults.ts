import type { WordLookupFeatureConfig } from "./wordLookupTypes.js";

export const DEFAULT_WORD_LOOKUP_FEATURE_CONFIG: WordLookupFeatureConfig = {
  wordListPath: "",
  modifierKey: "alt",
  panelWidth: 360,
  panelHeight: 300
};

export const WORD_LOOKUP_PANEL_SIZE_LIMITS = {
  minWidth: 260,
  maxWidth: 720,
  minHeight: 180,
  maxHeight: 640
};
