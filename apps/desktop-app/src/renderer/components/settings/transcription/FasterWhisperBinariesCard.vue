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
      <div class="fw-card__identity">
        <span>Faster-Whisper-XXL</span>
        <small v-if="binaryStatus?.asset">{{ binaryStatus.asset.version }}</small>
      </div>
      <UiBadge :tone="binaryStatus?.exists ? 'success' : binaryStatus?.downloadable ? 'warning' : 'neutral'">
        {{
          binaryStatus?.exists
            ? t("feature-transcription-ready")
            : binaryStatus?.downloadable
              ? t("feature-transcription-missing")
              : t("feature-transcription-unsupported")
        }}
      </UiBadge>
    </div>
    <p v-if="binaryStatus?.path" class="fw-card__path">{{ binaryStatus.path }}</p>
    <p v-if="binaryStatus?.reason" class="fw-card__meta">{{ binaryStatus.reason }}</p>
    <div v-if="downloadMessage || downloadError" class="fw-card__progress">
      <span>{{ downloadError || downloadMessage }}</span>
      <span>{{ downloadProgress }}%</span>
      <UiProgress :value="downloadProgress" :label="t('feature-transcription-download-xxl')" />
    </div>
    <UiButton
      v-if="binaryStatus?.downloadable && !binaryStatus.exists"
      data-testid="feature-transcription-download-xxl"
      size="sm"
      :disabled="isBusy"
      @click="$emit('downloadBinary')"
    >
      <IconDownload size="sm" />
      {{ t("feature-transcription-download-xxl") }}
    </UiButton>
  </UiSurface>
</template>

<script setup lang="ts">
import { IconDownload, IconFolder } from "../../icons";
import { UiBadge, UiButton, UiProgress, UiSurface } from "../../ui";

defineProps<{
  t: (key: string) => string;
  paths: { binaryDir: string } | null;
  binaryStatus: {
    variant: "xxl";
    exists: boolean;
    path: string;
    downloadable: boolean;
    reason?: string;
    asset?: {
      name: string;
      version: string;
      sizeBytes: number;
    };
  } | null;
  isBusy: boolean;
  downloadProgress: number;
  downloadMessage: string;
  downloadError: string | null;
}>();

defineEmits<{
  openBinaryFolder: [];
  downloadBinary: [];
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

.fw-card__identity {
  display: grid;
  gap: 2px;
}

.fw-card__identity small,
.fw-card__meta,
.fw-card__path {
  color: var(--ui-text-muted);
  font-size: var(--ui-font-sm);
}

.fw-card__path {
  overflow-wrap: anywhere;
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
.fw-card__meta,
.fw-card__path {
  margin: 0;
  font-size: 13px;
}
</style>
