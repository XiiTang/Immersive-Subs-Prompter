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
      <UiButton
        size="sm"
        data-testid="feature-transcription-download-cpu"
        :disabled="isBusy || !canDownload('cpu')"
        @click="$emit('downloadBinary', 'cpu')"
      >
        <IconDownload size="sm" />
        {{ t("button-download") }}
      </UiButton>
    </div>
    <p v-if="binaryStatus?.cpu.downloadUnavailableReason" class="fw-card__hint">
      {{ binaryStatus.cpu.downloadUnavailableReason }}
    </p>
    <div class="fw-card__row">
      <span>GPU</span>
      <UiBadge :tone="binaryStatus?.gpu.exists ? 'success' : 'warning'">
        {{ binaryStatus?.gpu.exists ? t("feature-transcription-ready") : t("feature-transcription-missing") }}
      </UiBadge>
      <UiButton
        size="sm"
        data-testid="feature-transcription-download-gpu"
        :disabled="isBusy || !canDownload('gpu')"
        @click="$emit('downloadBinary', 'gpu')"
      >
        <IconDownload size="sm" />
        {{ t("button-download") }}
      </UiButton>
    </div>
    <p v-if="binaryStatus?.gpu.downloadUnavailableReason" class="fw-card__hint">
      {{ binaryStatus.gpu.downloadUnavailableReason }}
    </p>
  </UiSurface>
</template>

<script setup lang="ts">
import { IconDownload, IconFolder } from "../../icons";
import { UiBadge, UiButton, UiSurface } from "../../ui";

const props = defineProps<{
  t: (key: string) => string;
  paths: { binaryDir: string } | null;
  binaryStatus: {
    cpu: {
      exists: boolean;
      path: string;
      downloadSupported: boolean;
      downloadUnavailableReason: string | null;
    };
    gpu: {
      exists: boolean;
      path: string;
      downloadSupported: boolean;
      downloadUnavailableReason: string | null;
    };
  } | null;
  isBusy: boolean;
}>();

defineEmits<{
  downloadBinary: [variant: "cpu" | "gpu"];
  openBinaryFolder: [];
}>();

function canDownload(variant: "cpu" | "gpu"): boolean {
  return Boolean(props.binaryStatus?.[variant].downloadSupported);
}
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

.fw-card__hint {
  margin: -2px 0 0;
  color: var(--ui-text-muted);
  font-size: var(--ui-font-sm);
}
</style>
