import type { BuildTranscriptBlocksInput, TranscriptBlock } from "./types";

function normalizeText(text: string): string {
  return text.trim();
}

function getOverlap(startA: number, endA: number, startB: number, endB: number): number {
  return Math.min(endA, endB) - Math.max(startA, startB);
}

export function buildTranscriptBlocks({ primaryCues, secondaryCues }: BuildTranscriptBlocksInput): TranscriptBlock[] {
  const blocks: TranscriptBlock[] = [];
  let secondaryIndex = 0;

  primaryCues.forEach((primaryCue, primaryCueIndex) => {
    const primaryText = normalizeText(primaryCue.text);
    if (!primaryText) {
      return;
    }

    while (secondaryIndex < secondaryCues.length && secondaryCues[secondaryIndex]!.end <= primaryCue.start) {
      secondaryIndex += 1;
    }

    let bestSecondaryIndex: number | null = null;
    let bestOverlap = -1;

    for (let i = secondaryIndex; i < secondaryCues.length; i += 1) {
      const candidate = secondaryCues[i]!;
      if (candidate.start >= primaryCue.end) {
        break;
      }

      const overlap = getOverlap(primaryCue.start, primaryCue.end, candidate.start, candidate.end);
      if (overlap > bestOverlap) {
        bestOverlap = overlap;
        bestSecondaryIndex = i;
      }
    }

    const secondaryText =
      bestSecondaryIndex === null ? null : normalizeText(secondaryCues[bestSecondaryIndex]!.text) || null;

    blocks.push({
      id: `block-${blocks.length}`,
      start: primaryCue.start,
      end: primaryCue.end,
      primaryText,
      secondaryText,
      sourceCueRefs: {
        primaryCueIndex,
        secondaryCueIndex: bestSecondaryIndex
      }
    });
  });

  return blocks;
}
