<template>
  <div class="fw-card">
    <div class="fw-card__header">
      <div class="fw-card__title">{{ t("transcription-faster-binary-status", "System Integration") }}</div>
    </div>

    <div class="fw-card__content">
      <div class="fw-row two-col">
        <div class="fw-status-row">
          <div class="fw-status-item">
            <span class="label">{{ t("transcription-faster-cpu-support", "CPU") }}</span>
            <UiBadge :tone="binaryStatus.cpu ? 'success' : 'danger'">
              {{
                binaryStatus.cpu
                  ? t("transcription-faster-binary-present", "Ready")
                  : t("transcription-faster-binary-missing", "Missing")
              }}
            </UiBadge>
          </div>
          <UiButton variant="secondary" :disabled="isBusy" @click="$emit('download-binary', 'cpu')">
            {{ binaryStatus.cpu ? t("button-redownload", "Redownload") : t("button-download", "Download") }}
          </UiButton>
        </div>

        <div class="fw-status-row">
          <div class="fw-status-item">
            <span class="label">{{ t("transcription-faster-gpu-cuda", "GPU") }}</span>
            <UiBadge :tone="binaryStatus.gpu ? 'success' : 'danger'">
              {{
                binaryStatus.gpu
                  ? t("transcription-faster-binary-present", "Ready")
                  : t("transcription-faster-binary-missing", "Missing")
              }}
            </UiBadge>
          </div>
          <UiButton variant="secondary" :disabled="isBusy" @click="$emit('download-binary', 'gpu')">
            {{ binaryStatus.gpu ? t("button-redownload", "Redownload") : t("button-download", "Download") }}
          </UiButton>
        </div>
      </div>

      <div class="fw-folder-input">
        <div class="fw-field-header">
          <span class="label">{{ t("transcription-faster-binary", "Binary Path") }}</span>
          <UiIconButton
            size="sm"
            @click="$emit('open-path', binaryDir)"
            :label="t('transcription-faster-open-bin', 'Open folder')"
          >
            <IconFolder size="sm" />
          </UiIconButton>
        </div>
        <UiInput v-model="fasterWhisperBinary" placeholder="faster-whisper" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { IconFolder } from "../../icons";
import { UiBadge, UiButton, UiIconButton, UiInput } from "../../ui";

defineProps<{
  t: (key: string, fallback: string) => string;
  binaryStatus: { cpu: boolean; gpu: boolean };
  isBusy: boolean;
  binaryDir: string | undefined;
}>();

defineEmits<{
  (event: "download-binary", variant: "cpu" | "gpu"): void;
  (event: "open-path", target: string | undefined): void;
}>();

const fasterWhisperBinary = defineModel<string>("fasterWhisperBinary", { required: true });
</script>
