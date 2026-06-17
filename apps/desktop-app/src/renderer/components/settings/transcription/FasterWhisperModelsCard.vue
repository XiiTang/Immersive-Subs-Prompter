<template>
  <UiSurface as="section" class="fw-card">
    <header>
      <h3>{{ t("feature-transcription-fw-models") }}</h3>
      <UiButton v-if="paths" size="sm" variant="ghost" @click="$emit('openPath', modelsBaseDir || paths.modelsDir)">
        <IconFolder size="sm" />
        {{ t("button-open-cache") }}
      </UiButton>
    </header>
    <p class="fw-card__meta">
      {{ t("feature-transcription-downloaded-models") }}: {{ availableModels.length }}
    </p>
    <div v-if="downloadMessage || downloadError" class="fw-card__progress">
      <span>{{ downloadError || downloadMessage }}</span>
      <span>{{ downloadProgress }}%</span>
      <UiProgress :value="downloadProgress" :label="t('feature-transcription-download-selected-model')" />
    </div>
    <UiButton size="sm" :disabled="isBusy" @click="$emit('downloadModel')">
      <IconDownload size="sm" />
      {{ t("feature-transcription-download-selected-model") }}
    </UiButton>
  </UiSurface>
</template>

<script setup lang="ts">
import { IconDownload, IconFolder } from "../../icons";
import { UiButton, UiProgress, UiSurface } from "../../ui";

defineProps<{
  t: (key: string) => string;
  paths: { modelsDir: string } | null;
  availableModels: Array<{ name: string; path: string; folder: string }>;
  modelsBaseDir: string;
  isBusy: boolean;
  downloadProgress: number;
  downloadMessage: string;
  downloadError: string | null;
}>();

defineEmits<{
  downloadModel: [];
  openPath: [targetPath: string];
}>();
</script>

<style scoped>
.fw-card {
  display: grid;
  gap: 8px;
}

.fw-card header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.fw-card__progress {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 6px 8px;
  align-items: center;
  color: var(--ui-text-muted);
  font-size: var(--ui-font-sm);
}

.fw-card__progress :deep(.ui-progress) {
  grid-column: 1 / -1;
}

.fw-card h3,
.fw-card__meta {
  margin: 0;
  font-size: 13px;
}

.fw-card__meta {
  color: var(--ui-text-muted);
}
</style>
