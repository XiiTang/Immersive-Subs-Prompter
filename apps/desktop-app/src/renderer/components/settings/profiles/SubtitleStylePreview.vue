<template>
  <section class="ui-group subtitle-style-preview" data-testid="subtitle-style-preview">
    <header class="ui-group__header">
      <h3 class="ui-group__title">{{ t("subtitle-preview-title", "Subtitle Preview") }}</h3>
    </header>
    <div class="subtitle-style-preview__canvas" data-testid="subtitle-preview-canvas" :style="canvasStyle">
      <TranscriptSurface
        class="subtitle-style-preview__surface"
        :blocks="previewBlocks"
        :current-time="activePreviewTime"
        :seek-request="null"
        :playback-loop="null"
        :ab-loop-selection-state="previewAbLoopSelectionState"
        :subtitle-panel-style="subtitlePanelStyle"
        :primary-font-family="primaryFontFamily"
        :primary-font-size="primaryFontSize"
        :secondary-font-family="secondaryFontFamily"
        :secondary-font-size="secondaryFontSize"
        :auto-hide-meta-row="settings.subtitleAutoHideMetaRow"
        :line-height="lineHeight"
        :primary-secondary-gap="primarySecondaryGap"
        :block-gap="blockGap"
        :primary-color="settings.subtitlePrimaryColor"
        :secondary-color="settings.subtitleSecondaryColor"
        :active-primary-color="settings.subtitleActivePrimaryColor"
        :active-secondary-color="settings.subtitleActiveSecondaryColor"
        :auto-scroll-delay-ms="0"
        :scroll-position-ratio="scrollPositionRatio"
        auto-follow-scroll-behavior="auto"
      />
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { normalizeSubtitleFontFamily } from "../../../../common/subtitleFonts.js";
import {
  MAIN_WINDOW_DEFAULT_HEIGHT,
  MAIN_WINDOW_DEFAULT_WIDTH
} from "../../../../common/windowDimensions.js";
import { DEFAULT_LANGUAGE, useI18n } from "../../../i18n";
import { DEFAULT_PROFILE_TEMPLATE, useDesktopStore } from "../../../stores/desktop";
import { createAbLoopSelectionState } from "../../subtitle/abLoopSelection";
import TranscriptSurface from "../../subtitle/TranscriptSurface.vue";
import type { TranscriptBlock } from "../../subtitle/transcript/types";

type PreviewBlockId = `before-${number}` | "active" | `after-${number}`;

type PreviewBlock = {
  id: PreviewBlockId;
  start: number;
  end: number;
  primary: string;
  secondary: string;
};

const BEFORE_BLOCKS: PreviewBlock[] = [
  {
    id: "before-1",
    start: 2,
    end: 6,
    primary: "Elizabeth took up the letter with a resolution of studying every sentence.",
    secondary: "伊丽莎白拿起那封信，决心细读其中每一句话。"
  },
  {
    id: "before-2",
    start: 7,
    end: 11,
    primary: "Its meaning was not entirely new, yet the arrangement of facts gave it a force she could not evade.",
    secondary: "信中的意思并非全然陌生，但事实的排列让她无法回避。"
  },
  {
    id: "before-3",
    start: 12,
    end: 16,
    primary: "She remembered the confidence with which she had judged, and the warmth with which she had condemned.",
    secondary: "她想起自己曾怎样自信地评判，又怎样热烈地责难。"
  },
  {
    id: "before-4",
    start: 17,
    end: 21,
    primary: "Every recollection brought some proof of prejudice, and every proof made the page heavier in her hand.",
    secondary: "每一段回忆都证明了偏见，每一个证明都让手中的纸页更沉。"
  },
  {
    id: "before-5",
    start: 22,
    end: 26,
    primary: "She had been blind, partial, prejudiced, absurd; the words seemed severe, but no milder ones would serve.",
    secondary: "她曾盲目、偏袒、偏见而荒唐；这些词很重，却没有更温和的词可用。"
  },
  {
    id: "before-6",
    start: 27,
    end: 31,
    primary: "The charm of easy manners had misled her, while quiet worth had appeared only as pride.",
    secondary: "轻松讨喜的举止误导了她，沉静的价值却只被她看作傲慢。"
  },
  {
    id: "before-7",
    start: 32,
    end: 36,
    primary: "She grew more serious as she read, and the walk around her seemed to fall into a profound stillness.",
    secondary: "她越读越沉静，周围的小路仿佛也陷入深深的寂静。"
  },
  {
    id: "before-8",
    start: 37,
    end: 41,
    primary: "Her former certainty deserted her, leaving only the difficult honesty of looking inward.",
    secondary: "从前的笃定离她而去，只剩下向内审视时艰难的诚实。"
  },
  {
    id: "before-9",
    start: 42,
    end: 46,
    primary: "How differently did everything now appear in the plain light of recollection and comparison.",
    secondary: "在回忆与比较的清光下，一切显得多么不同。"
  },
  {
    id: "before-10",
    start: 97,
    end: 101,
    primary: "She turned the first page again, tracing each admission with a more humbled attention.",
    secondary: "她又翻回第一页，以更加谦卑的注意力追索每一处承认。"
  },
  {
    id: "before-11",
    start: 102,
    end: 106,
    primary: "The sentences seemed to answer one another, gathering into a pattern she had refused to see.",
    secondary: "句子彼此呼应，逐渐组成她曾拒绝看见的图案。"
  },
  {
    id: "before-12",
    start: 107,
    end: 111,
    primary: "There was pain in the discovery, but there was also the stern comfort of truth.",
    secondary: "发现真相带来痛苦，却也带来真理严厉的安慰。"
  },
  {
    id: "before-13",
    start: 112,
    end: 116,
    primary: "She thought of conversations once dismissed, and found in them a meaning she had overlooked.",
    secondary: "她想起曾被轻易放过的谈话，发现其中有自己忽略的意义。"
  },
  {
    id: "before-14",
    start: 117,
    end: 121,
    primary: "A blush of shame returned whenever she remembered the satisfaction of her former certainty.",
    secondary: "每当想起过去那种自信的满足，她都会重新感到羞愧。"
  },
  {
    id: "before-15",
    start: 122,
    end: 126,
    primary: "No accusation in the letter was so hard to bear as the quiet accuracy of its proof.",
    secondary: "信中没有哪一句指责，比它平静而准确的证据更难承受。"
  },
  {
    id: "before-16",
    start: 127,
    end: 131,
    primary: "Her thoughts moved backward through the season, correcting one scene after another.",
    secondary: "她的思绪倒退穿过整个季节，一幕接一幕地修正过去。"
  },
  {
    id: "before-17",
    start: 132,
    end: 136,
    primary: "What had been wit now looked like haste; what had been confidence now looked like vanity.",
    secondary: "曾被看作机智的，如今像仓促；曾被看作自信的，如今像虚荣。"
  },
  {
    id: "before-18",
    start: 137,
    end: 141,
    primary: "The letter did not soften as she read it, but her resistance to it slowly gave way.",
    secondary: "信并没有因重读而变温和，但她对它的抗拒慢慢松动了。"
  }
];

const ACTIVE_BLOCK: PreviewBlock = {
  id: "active",
  start: 47,
  end: 51,
  primary: "Till this moment I never knew myself.",
  secondary: "直到这一刻，我才真正认识了自己。"
};

const AFTER_BLOCKS: PreviewBlock[] = [
  {
    id: "after-1",
    start: 52,
    end: 56,
    primary: "She grew absolutely ashamed of herself, and could think of neither man without a painful change of feeling.",
    secondary: "她开始为自己深深羞愧，想到任何一人，感情都痛苦地转变。"
  },
  {
    id: "after-2",
    start: 57,
    end: 61,
    primary: "The justice she had denied now pressed upon her with all the strength of evidence.",
    secondary: "她曾否认的公正，此刻带着证据的力量压向她。"
  },
  {
    id: "after-3",
    start: 62,
    end: 66,
    primary: "She read again, not to dispute, but to understand how much vanity had guided her opinion.",
    secondary: "她再次阅读，不再争辩，只想明白虚荣怎样左右了她的判断。"
  },
  {
    id: "after-4",
    start: 67,
    end: 71,
    primary: "The mortification was deep, yet it carried with it the first promise of clearer judgment.",
    secondary: "这种屈辱很深，却也带来了更清明判断的最初可能。"
  },
  {
    id: "after-5",
    start: 72,
    end: 76,
    primary: "Nothing remained but to acknowledge the error and bear the consequence of having trusted appearances.",
    secondary: "剩下的只有承认错误，并承受轻信表象所带来的结果。"
  },
  {
    id: "after-6",
    start: 77,
    end: 81,
    primary: "The letter was folded at last, but the thoughts it had awakened would not be folded away with it.",
    secondary: "信终于被折起，可它唤醒的思绪却无法一同收起。"
  },
  {
    id: "after-7",
    start: 82,
    end: 86,
    primary: "She walked on slowly, trying to reconcile wounded pride with a better knowledge of herself.",
    secondary: "她缓缓向前，努力让受伤的骄傲与新的自知相调和。"
  },
  {
    id: "after-8",
    start: 87,
    end: 91,
    primary: "What had seemed a triumph of discernment now stood before her as an education in humility.",
    secondary: "曾被她看成洞察力胜利的东西，如今成了谦卑的课程。"
  },
  {
    id: "after-9",
    start: 92,
    end: 96,
    primary: "The afternoon light remained unchanged, but the mind that looked upon it had altered completely.",
    secondary: "午后的光线并未改变，凝视它的心却已全然不同。"
  },
  {
    id: "after-10",
    start: 142,
    end: 146,
    primary: "She could not recover her old opinions, and she no longer wished to recover them.",
    secondary: "她无法找回旧日的看法，也不再希望找回它们。"
  },
  {
    id: "after-11",
    start: 147,
    end: 151,
    primary: "A clearer image of character rose before her, severe because it was no longer flattering.",
    secondary: "一个更清晰的人品形象浮现出来，严厉正因它不再讨好她。"
  },
  {
    id: "after-12",
    start: 152,
    end: 156,
    primary: "The shame of error remained, but it began to resemble the beginning of wisdom.",
    secondary: "错误的羞愧仍在，却开始像智慧的开端。"
  },
  {
    id: "after-13",
    start: 157,
    end: 161,
    primary: "She saw how quickly preference can become judgment when vanity is allowed to speak first.",
    secondary: "她看见，当虚荣先开口时，偏爱多快就会变成判断。"
  },
  {
    id: "after-14",
    start: 162,
    end: 166,
    primary: "Every step away from the place seemed also a step away from the self that had arrived there.",
    secondary: "离开那地方的每一步，也像是在离开到达那里时的自己。"
  },
  {
    id: "after-15",
    start: 167,
    end: 171,
    primary: "She could not undo what she had thought, but she might learn to think with greater care.",
    secondary: "她不能取消曾经的想法，却可以学会更谨慎地思考。"
  },
  {
    id: "after-16",
    start: 172,
    end: 176,
    primary: "The discovery humbled her, and in humbling her it opened a path to a truer generosity.",
    secondary: "这个发现使她谦卑，而正是在谦卑中，它打开了通向真诚宽厚的路。"
  },
  {
    id: "after-17",
    start: 177,
    end: 181,
    primary: "She folded the letter once more, not as an answer completed, but as a lesson begun.",
    secondary: "她再次折起信，不是因为答案已经完成，而是因为课程刚刚开始。"
  },
  {
    id: "after-18",
    start: 182,
    end: 186,
    primary: "The famous sentence remained at the center of her mind, bright and difficult to forget.",
    secondary: "那句有名的话留在她心的中央，清晰而难以忘记。"
  }
];

const MIN_SUBTITLE_FONT_SIZE = 3;
const MAX_SUBTITLE_FONT_SIZE = 96;

const store = useDesktopStore();
const language = computed(() => store.settings?.global.language ?? DEFAULT_LANGUAGE);
const { t } = useI18n(language);

const PREVIEW_TIME_SCALE = 1000;
const activePreviewTime = ACTIVE_BLOCK.start * PREVIEW_TIME_SCALE + 500;
const previewAbLoopSelectionState = createAbLoopSelectionState();
const subtitlePanelStyle = {
  "--panel-opacity-factor": "1"
};
const previewBlocks = createPreviewTranscriptBlocks();

const settings = computed(() => store.editingProfileSettings);
const primaryFontFamily = computed(() => normalizeSubtitleFontFamily(settings.value.primarySubtitleFontFamily));
const secondaryFontFamily = computed(() => normalizeSubtitleFontFamily(settings.value.secondarySubtitleFontFamily));
const primaryFontSize = computed(() =>
  normalizeSubtitleFontSize(
    settings.value.primarySubtitleFontSize,
    DEFAULT_PROFILE_TEMPLATE.primarySubtitleFontSize
  )
);
const secondaryFontSize = computed(() =>
  normalizeSubtitleFontSize(
    settings.value.secondarySubtitleFontSize,
    DEFAULT_PROFILE_TEMPLATE.secondarySubtitleFontSize
  )
);
const lineHeight = computed(() =>
  Math.max(Number(settings.value.subtitleLineHeight) || DEFAULT_PROFILE_TEMPLATE.subtitleLineHeight, 1)
);
const primarySecondaryGap = computed(() => Math.max(Number(settings.value.subtitlePrimarySecondaryGap) || 0, 0));
const blockGap = computed(() => Math.max(Number(settings.value.subtitleBlockGap) || 0, 0));
const scrollPositionRatio = computed(() =>
  clamp(
    Number(settings.value.subtitleScrollPosition ?? DEFAULT_PROFILE_TEMPLATE.subtitleScrollPosition),
    0,
    100
  ) / 100
);

const canvasStyle = {
  width: `${MAIN_WINDOW_DEFAULT_WIDTH}px`,
  height: `${MAIN_WINDOW_DEFAULT_HEIGHT}px`
};

function createPreviewTranscriptBlocks(): TranscriptBlock[] {
  return [...BEFORE_BLOCKS, ACTIVE_BLOCK, ...AFTER_BLOCKS]
    .sort((left, right) => left.start - right.start)
    .map((block, index) => ({
      id: block.id === "active" ? "preview-active" : `preview-${block.id}`,
      start: block.start * PREVIEW_TIME_SCALE,
      end: block.end * PREVIEW_TIME_SCALE,
      primaryText: block.primary,
      secondaryText: block.secondary,
      sourceCueRefs: {
        primaryCueIndex: index,
        secondaryCueIndex: index
      }
    }));
}

function normalizeSubtitleFontSize(value: number | null | undefined, fallback: number): number {
  const size = Number(value);
  const finiteSize = Number.isFinite(size) ? size : fallback;
  return Math.min(MAX_SUBTITLE_FONT_SIZE, Math.max(MIN_SUBTITLE_FONT_SIZE, Math.round(finiteSize)));
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.min(max, Math.max(min, value));
}
</script>
