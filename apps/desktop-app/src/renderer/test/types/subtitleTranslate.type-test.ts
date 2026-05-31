import CueAnchorRail from "../../components/subtitle/CueAnchorRail.vue";
import TranscriptBlock from "../../components/subtitle/TranscriptBlock.vue";
import TranscriptSurface from "../../components/subtitle/TranscriptSurface.vue";
import { createAbLoopSelectionState } from "../../components/subtitle/abLoopSelection";
import type { SubtitleTranslate } from "../../components/subtitle/transcript/translate";

type ComponentProps<T> = T extends new () => { $props: infer Props } ? Props : never;

const t: SubtitleTranslate = (key) => key;

const blockProps = {
  blockId: "block-0",
  start: 0,
  end: 1000,
  lines: [],
  metaRowHeight: 18,
  timestampFontSize: 11,
  actionFontSize: 12,
  autoHideMetaRow: false,
  isActive: false,
  isSingleLooping: false,
  abLabel: "AB",
  isAbPendingSelection: false,
  showSelectionActions: false,
  t
} satisfies ComponentProps<typeof TranscriptBlock>;

const surfaceProps = {
  blocks: [],
  currentTime: 0,
  playbackLoop: null,
  abLoopSelectionState: createAbLoopSelectionState(),
  subtitlePanelStyle: {},
  primaryFontFamily: "Arial",
  primaryFontSize: 16,
  secondaryFontFamily: "Arial",
  secondaryFontSize: 15,
  timestampFontSize: 11,
  lineHeight: 1.2,
  primarySecondaryGap: 4,
  blockGap: 12,
  primaryColor: "#fff",
  secondaryColor: "#ccc",
  activePrimaryColor: "#ff0",
  activeSecondaryColor: "#ee0",
  autoScrollDelayMs: 500,
  scrollPositionRatio: 0.4,
  t
} satisfies ComponentProps<typeof TranscriptSurface>;

const cueProps = {
  state: "quiet",
  start: 0,
  end: 1000,
  abLabel: "AB",
  isLooping: false,
  isAbPendingSelection: false,
  t
} satisfies ComponentProps<typeof CueAnchorRail>;

void blockProps;
void surfaceProps;
void cueProps;

const { t: blockTranslator, ...blockPropsWithoutTranslator } = blockProps;
const { t: surfaceTranslator, ...surfacePropsWithoutTranslator } = surfaceProps;
const { t: cueTranslator, ...cuePropsWithoutTranslator } = cueProps;

void blockTranslator;
void surfaceTranslator;
void cueTranslator;

// @ts-expect-error subtitle block rendering must receive the shared translator.
blockPropsWithoutTranslator satisfies ComponentProps<typeof TranscriptBlock>;

// @ts-expect-error transcript surface rendering must receive the shared translator.
surfacePropsWithoutTranslator satisfies ComponentProps<typeof TranscriptSurface>;

// @ts-expect-error cue action labels must receive the shared translator.
cuePropsWithoutTranslator satisfies ComponentProps<typeof CueAnchorRail>;
