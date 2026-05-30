import type { WordLookupModifierKey } from "../../plugins/official/wordLookup/wordLookupTypes.js";
import { WORD_LOOKUP_PANEL_SIZE_LIMITS } from "../../../common/wordLookupDefaults.js";
import { assertNoUnknownKeys } from "../utils.js";

const MODIFIER_KEYS: WordLookupModifierKey[] = ["alt", "ctrl", "shift"];
const WORD_LOOKUP_CONFIG_KEYS = ["wordListPath", "modifierKey", "panelSize"] as const;
const WORD_LOOKUP_PANEL_SIZE_KEYS = ["width", "height"] as const;

function isModifierKey(value: unknown): value is WordLookupModifierKey {
  return MODIFIER_KEYS.includes(value as WordLookupModifierKey);
}

function validatePanelSizeNumber(value: unknown, field: "width" | "height", min: number, max: number): void {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`wordLookup.panelSize.${field} must use the current finite number setting`);
  }
  if (value < min || value > max) {
    throw new Error(`wordLookup.panelSize.${field} must be between ${min} and ${max}`);
  }
}

export function validateWordLookupPluginConfigForUpdate(input: unknown): void {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("wordLookup config must use the current object setting");
  }

  const source = input as Record<string, unknown>;
  assertNoUnknownKeys(source, WORD_LOOKUP_CONFIG_KEYS, "wordLookup");
  if (typeof source.wordListPath !== "string") {
    throw new Error("wordLookup.wordListPath must use the current string setting");
  }
  if (!isModifierKey(source.modifierKey)) {
    throw new Error("wordLookup.modifierKey must use the current string setting");
  }
  if (!source.panelSize || typeof source.panelSize !== "object" || Array.isArray(source.panelSize)) {
    throw new Error("wordLookup.panelSize must use the current object setting");
  }
  const panelSize = source.panelSize as Record<string, unknown>;
  assertNoUnknownKeys(panelSize, WORD_LOOKUP_PANEL_SIZE_KEYS, "wordLookup.panelSize");
  validatePanelSizeNumber(
    panelSize.width,
    "width",
    WORD_LOOKUP_PANEL_SIZE_LIMITS.minWidth,
    WORD_LOOKUP_PANEL_SIZE_LIMITS.maxWidth
  );
  validatePanelSizeNumber(
    panelSize.height,
    "height",
    WORD_LOOKUP_PANEL_SIZE_LIMITS.minHeight,
    WORD_LOOKUP_PANEL_SIZE_LIMITS.maxHeight
  );
}
