export type TranscriptCueRefs = {
  primaryCueIndex: number;
  secondaryCueIndex: number | null;
};

export type TranscriptBlock = {
  id: string;
  start: number;
  end: number;
  primaryText: string;
  secondaryText: string | null;
  sourceCueRefs: TranscriptCueRefs;
};

export type BuildTranscriptBlocksInput = {
  primaryCues: Array<{ start: number; end: number; text: string }>;
  secondaryCues: Array<{ start: number; end: number; text: string }>;
};

export type TranscriptLayoutLineKind = "primary" | "secondary";

export type TranscriptLayoutLine = {
  key: string;
  blockId: string;
  kind: TranscriptLayoutLineKind;
  text: string;
  top: number;
  height: number;
  relativeTop: number;
};

export type TranscriptPreparedTextKey = string;

export type TranscriptLayoutBlock = {
  blockId: string;
  start: number;
  end: number;
  top: number;
  height: number;
  lineStart: number;
  lineCount: number;
  primaryLineCount: number;
  secondaryLineCount: number;
  primaryLineHeight: number;
  secondaryLineHeight: number;
  metaRowHeight: number;
  primarySecondaryGap: number;
  primaryPreparedTextKey: TranscriptPreparedTextKey;
  secondaryPreparedTextKey: TranscriptPreparedTextKey | null;
};

export type TranscriptLayoutResult = {
  totalHeight: number;
  blocks: TranscriptLayoutBlock[];
};

export type TranscriptViewportAnchorReason =
  | "playback-follow"
  | "loop-wrap-follow"
  | "seek-recenter"
  | "resize-reproject";

export type TranscriptViewportAnchor = {
  blockId: string;
  reason: TranscriptViewportAnchorReason;
  anchorBias: number;
};

export type TranscriptWindowProjection = {
  startIndex: number;
  endIndex: number;
};

export type TranscriptViewportProjection = {
  activeBlockId: string | null;
  activeBlockIndex: number;
  focusOffset: number;
  targetScrollTop: number | null;
};

export type TranscriptSeekRequest = {
  token: number;
  time: number;
};

export type ActiveAbLoopRange = {
  startCueIndex: number;
  endCueIndex: number;
};
