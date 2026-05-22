<template>
  <div class="playback-row">
    <UiTooltip :text="isPlaying ? t('pause-button', 'Pause') : t('play-button', 'Play')">
      <UiIconButton
        class="playback-toggle-btn"
        variant="secondary"
        :disabled="!hasActiveVideo"
        :label="isPlaying ? t('pause-button', 'Pause') : t('play-button', 'Play')"
        @click="$emit('toggle-playback')"
      >
        <IconPause v-if="isPlaying" size="md" />
        <IconPlay v-else size="md" />
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
        :label="t('playback-position-label', 'Playback Position')"
        @pointerdown="$emit('scrub-start')"
        @pointercancel="$emit('scrub-cancel')"
        @input="$emit('scrub-input', $event)"
        @change="$emit('scrub-end', $event)"
      />
      <span class="playback-progress__time">{{ formatTime(playbackDuration || 0) }}</span>
    </div>
    <UiTooltip text="Toggle auto hide panels">
      <UiIconButton
        class="auto-hide-toggle"
        :pressed="autoHideEnabled"
        :active="autoHideEnabled"
        label="Toggle auto hide panels"
        @click="$emit('toggle-auto-hide')"
      >
        <IconChevronUp v-if="autoHideEnabled" size="md" />
        <IconChevronDown v-else size="md" />
      </UiIconButton>
    </UiTooltip>
  </div>
</template>

<script setup lang="ts">
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
  t: (key: string, fallback?: string, params?: Record<string, any>) => string;
}>();

defineEmits<{
  (e: "toggle-playback"): void;
  (e: "scrub-start"): void;
  (e: "scrub-input", event: Event): void;
  (e: "scrub-end", event?: Event): void;
  (e: "scrub-cancel"): void;
  (e: "toggle-auto-hide"): void;
}>();
</script>
