<template>
  <div
    class="subtitle-item"
    :class="{
      'subtitle-item--active': isActive,
      'subtitle-item--auto-hide-time': autoHideTimestamps
    }"
    ref="rootRef"
  >
    <div class="subtitle-item__time">
      <span>{{ formatTime(cue.start) }} - {{ formatTime(cue.end) }}</span>
      <button
        class="subtitle-item__play-btn"
        type="button"
        :aria-label="`Play from cue ${index + 1}`"
        @click="$emit('play')"
      >
        ā–?
      </button>
      <button
        class="subtitle-item__loop-btn"
        type="button"
        :class="{ 'subtitle-item__loop-btn--active': isLooping }"
        :aria-label="`Loop cue ${index + 1}`"
        @click="$emit('loop')"
      >
        ā†?
      </button>
    </div>
    <div class="subtitle-item__text">
      <div class="subtitle-item__text-primary" v-html="formatCueText(cue.primaryText)"></div>
      <div
        v-if="cue.secondaryText"
        class="subtitle-item__text-secondary"
        v-html="formatCueText(cue.secondaryText)"
      ></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import type { CombinedCue } from "../../stores/desktop";
import { formatCueText, formatTime } from "../../utils/formatters";

defineProps<{
  cue: CombinedCue;
  index: number;
  isActive: boolean;
  isLooping: boolean;
  autoHideTimestamps: boolean;
}>();

defineEmits<{
  (e: "play"): void;
  (e: "loop"): void;
}>();

const rootRef = ref<HTMLElement | null>(null);

defineExpose({
  el: rootRef
});
</script>

<style scoped>
.subtitle-item--auto-hide-time .subtitle-item__time {
  opacity: 0;
  transition: opacity 0.2s ease;
}

.subtitle-item--auto-hide-time:hover .subtitle-item__time {
  opacity: 1;
}
</style>
