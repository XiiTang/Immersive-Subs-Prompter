<template>
  <section class="subtitle-scroll-section" :style="subtitlePanelStyle">
    <section
      class="subtitle-list"
      :class="{ 'subtitle-list--scrollbar-active': isScrollbarActive }"
      ref="subtitleListEl"
    >
      <template v-if="cues.length">
        <SubtitleItem
          v-for="(cue, index) in cues"
          :key="`${cue.start}-${index}`"
          :cue="cue"
          :index="index"
          :is-active="index === activeCueIndex"
          :is-looping="loopCueIndex === index"
          :auto-hide-timestamps="autoHideTimestamps"
          :ab-loop-start-index="abLoopStartIndex"
          :ref="(component: any) => setCueRef(component?.el?.value ?? component?.el ?? null, index)"
          @play="$emit('play-cue', index)"
          @loop="$emit('loop-cue', index)"
          @loop-range="$emit('loop-range', index)"
        />
      </template>
    </section>
  </section>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { CombinedCue } from "../../stores/desktop";
import SubtitleItem from "./SubtitleItem.vue";
import { useAutoScroll } from "./composables/useAutoScroll";

const props = defineProps<{
  cues: CombinedCue[];
  activeCueIndex: number | null;
  loopCueIndex: number | null;
  autoHideTimestamps: boolean;
  abLoopStartIndex: number | null;
  subtitlePanelStyle: Record<string, string>;
  autoScrollDelayMs: number;
  scrollPositionRatio: number;
}>();

defineEmits<{
  (e: "play-cue", index: number): void;
  (e: "loop-cue", index: number): void;
  (e: "loop-range", index: number): void;
}>();

const { subtitleListEl, setCueRef, isScrollbarActive } = useAutoScroll({
  cues: computed(() => props.cues),
  activeCueIndex: computed(() => props.activeCueIndex),
  autoScrollDelayMs: computed(() => props.autoScrollDelayMs),
  scrollPositionRatio: computed(() => props.scrollPositionRatio)
});
</script>
