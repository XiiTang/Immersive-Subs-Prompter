<template>
  <UiSurface as="section" class="fw-card">
    <header>
      <h3>{{ t("feature-transcription-fw-binaries") }}</h3>
      <UiButton v-if="paths" size="sm" variant="ghost" @click="$emit('openBinaryFolder')">
        <IconFolder size="sm" />
        {{ t("button-open-cache") }}
      </UiButton>
    </header>
    <div class="fw-card__row">
      <span>CPU</span>
      <UiBadge :tone="binaryStatus?.cpu.exists ? 'success' : 'warning'">
        {{ binaryStatus?.cpu.exists ? t("feature-transcription-ready") : t("feature-transcription-missing") }}
      </UiBadge>
    </div>
    <div class="fw-card__row">
      <span>GPU</span>
      <UiBadge :tone="binaryStatus?.gpu.exists ? 'success' : 'warning'">
        {{ binaryStatus?.gpu.exists ? t("feature-transcription-ready") : t("feature-transcription-missing") }}
      </UiBadge>
    </div>
  </UiSurface>
</template>

<script setup lang="ts">
import { IconFolder } from "../../icons";
import { UiBadge, UiButton, UiSurface } from "../../ui";

defineProps<{
  t: (key: string) => string;
  paths: { binaryDir: string } | null;
  binaryStatus: {
    cpu: {
      exists: boolean;
      path: string;
    };
    gpu: {
      exists: boolean;
      path: string;
    };
  } | null;
}>();

defineEmits<{
  openBinaryFolder: [];
}>();
</script>

<style scoped>
.fw-card {
  display: grid;
  gap: 8px;
}

.fw-card header,
.fw-card__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.fw-card h3 {
  margin: 0;
  font-size: 13px;
}
</style>
