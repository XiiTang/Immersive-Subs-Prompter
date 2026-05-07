import type {
  WordLookupPluginConfig,
  WordLookupResult,
  WordLookupStatus
} from "../../main/plugins/official/wordLookup/wordLookupTypes";

export type { WordLookupPluginConfig, WordLookupResult, WordLookupStatus };

export interface WordHoverPayload {
  token: string;
  clientX: number;
  clientY: number;
  anchorRect: {
    left: number;
    top: number;
    right: number;
    bottom: number;
    width: number;
    height: number;
  };
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
}
