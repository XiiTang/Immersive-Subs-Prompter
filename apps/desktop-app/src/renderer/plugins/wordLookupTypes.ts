import type {
  WordLookupPluginConfig,
  WordLookupResult,
  WordLookupStatus
} from "../../common/wordLookupTypes";

export type { WordLookupPluginConfig, WordLookupResult, WordLookupStatus };

export interface WordHoverPayload {
  hoverId: string;
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

export interface WordLeavePayload {
  hoverId: string;
}
