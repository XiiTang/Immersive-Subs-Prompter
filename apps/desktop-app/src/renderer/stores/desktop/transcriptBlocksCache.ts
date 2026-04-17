import type { SubtitleCue } from "../../../main/types";
import { buildTranscriptBlocks } from "../../components/subtitle/transcript/buildTranscriptBlocks";
import type { TranscriptBlock } from "../../components/subtitle/transcript/types";

export function createTranscriptBlocksCache() {
  let lastPrimaryCues: SubtitleCue[] | null = null;
  let lastSecondaryCues: SubtitleCue[] | null = null;
  let lastBlocks: TranscriptBlock[] = [];

  return {
    get(primaryCues: SubtitleCue[], secondaryCues: SubtitleCue[]): TranscriptBlock[] {
      if (primaryCues === lastPrimaryCues && secondaryCues === lastSecondaryCues) {
        return lastBlocks;
      }
      lastPrimaryCues = primaryCues;
      lastSecondaryCues = secondaryCues;
      lastBlocks = buildTranscriptBlocks({ primaryCues, secondaryCues });
      return lastBlocks;
    },
    clear() {
      lastPrimaryCues = null;
      lastSecondaryCues = null;
      lastBlocks = [];
    }
  };
}
