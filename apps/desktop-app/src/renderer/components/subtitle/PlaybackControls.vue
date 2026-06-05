<template>
  <div class="playback-row">
    <UiTooltip :text="isPlaying ? t('pause-button') : t('play-button')">
      <UiIconButton
        class="playback-toggle-btn"
        variant="secondary"
        size="sm"
        :disabled="!hasActiveVideo"
        :label="isPlaying ? t('pause-button') : t('play-button')"
        @click="$emit('toggle-playback')"
      >
        <IconPause v-if="isPlaying" size="sm" />
        <IconPlay v-else size="sm" />
      </UiIconButton>
    </UiTooltip>
    <div class="playback-progress">
      <span class="playback-progress__time">{{ formatTime(displayedPlaybackTime) }}</span>
      <UiSlider
        class="playback-slider"
        :model-value="sliderValue"
        :min="0"
        :max="sliderMax"
        :step="sliderStep"
        :disabled="!sliderEnabled"
        :fill-style="sliderFillStyle"
        :label="t('playback-position-label')"
        @pointerdown="$emit('scrub-start')"
        @pointercancel="$emit('scrub-cancel')"
        @input="$emit('scrub-input', $event)"
        @change="$emit('scrub-end', $event)"
      />
      <span class="playback-progress__time">{{ formatTime(playbackDuration || 0) }}</span>
    </div>
    <UiTooltip :text="autoHideLabel">
      <UiIconButton
        class="auto-hide-toggle"
        variant="secondary"
        size="sm"
        :pressed="autoHideEnabled"
        :active="autoHideEnabled"
        :label="autoHideLabel"
        @click="$emit('toggle-auto-hide')"
      >
        <IconChevronUp v-if="autoHideEnabled" size="sm" />
        <IconChevronDown v-else size="sm" />
      </UiIconButton>
    </UiTooltip>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { formatTime } from "../../utils/formatters";
import { IconChevronDown, IconChevronUp, IconPause, IconPlay } from "../icons";
import { UiIconButton, UiSlider, UiTooltip } from "../ui";

const {
  isPlaying,
  hasActiveVideo,
  displayedPlaybackTime,
  playbackDuration,
  sliderMax,
  sliderStep,
  sliderValue,
  sliderEnabled,
  sliderFillStyle,
  autoHideEnabled,
  t
} = defineProps<{
  isPlaying: boolean;
  hasActiveVideo: boolean;
  displayedPlaybackTime: number;
  playbackDuration: number | null;
  sliderMax: number;
  sliderStep: number;
  sliderValue: number;
  sliderEnabled: boolean;
  sliderFillStyle: Record<string, string>;
  autoHideEnabled: boolean;
  t: (key: string, params?: Record<string, any>) => string;
}>();

defineEmits<{
  (e: "toggle-playback"): void;
  (e: "scrub-start"): void;
  (e: "scrub-input", event: Event): void;
  (e: "scrub-end", event?: Event): void;
  (e: "scrub-cancel"): void;
  (e: "toggle-auto-hide"): void;
}>();

const autoHideLabel = computed(() =>
  autoHideEnabled
    ? t("auto-hide-toggle-on")
    : t("auto-hide-toggle-off")
);
</script>
