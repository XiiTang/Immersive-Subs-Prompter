import type { WordLookupPluginConfig, WordLookupModifierKey } from "../../plugins/official/wordLookup/wordLookupTypes.js";
import {
  DEFAULT_WORD_LOOKUP_PLUGIN_CONFIG,
  WORD_LOOKUP_PANEL_SIZE_LIMITS
} from "../../plugins/official/wordLookup/defaults.js";

const MODIFIER_KEYS: WordLookupModifierKey[] = ["alt", "ctrl", "shift"];

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(min, Math.min(max, Math.round(numeric)));
}

export function sanitizeWordLookupPluginConfig(
  input: Partial<WordLookupPluginConfig> | Record<string, unknown> | null | undefined
): WordLookupPluginConfig {
  if (!input || typeof input !== "object") {
    return DEFAULT_WORD_LOOKUP_PLUGIN_CONFIG;
  }

  const raw = input as Record<string, unknown>;
  const rawPanelSize = raw.panelSize && typeof raw.panelSize === "object"
    ? raw.panelSize as Record<string, unknown>
    : {};
  const defaultSize = DEFAULT_WORD_LOOKUP_PLUGIN_CONFIG.panelSize;

  return {
    wordListPath: typeof raw.wordListPath === "string" ? raw.wordListPath.trim() : "",
    modifierKey: MODIFIER_KEYS.includes(raw.modifierKey as WordLookupModifierKey)
      ? raw.modifierKey as WordLookupModifierKey
      : DEFAULT_WORD_LOOKUP_PLUGIN_CONFIG.modifierKey,
    panelSize: {
      width: clampNumber(
        rawPanelSize.width,
        WORD_LOOKUP_PANEL_SIZE_LIMITS.minWidth,
        WORD_LOOKUP_PANEL_SIZE_LIMITS.maxWidth,
        defaultSize.width
      ),
      height: clampNumber(
        rawPanelSize.height,
        WORD_LOOKUP_PANEL_SIZE_LIMITS.minHeight,
        WORD_LOOKUP_PANEL_SIZE_LIMITS.maxHeight,
        defaultSize.height
      )
    }
  };
}
