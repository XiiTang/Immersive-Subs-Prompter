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
            <span class="fw-badge" :class="binaryStatus.cpu ? 'fw-badge--success' : 'fw-badge--error'">
              {{
                binaryStatus.cpu
                  ? t("transcription-faster-binary-present", "Ready")
                  : t("transcription-faster-binary-missing", "Missing")
              }}
            </span>
          </div>
          <button
            type="button"
            class="btn-secondary"
            @click="$emit('download-binary', 'cpu')"
            :disabled="isBusy"
          >
            {{ binaryStatus.cpu ? t("button-redownload", "Redownload") : t("button-download", "Download") }}
          </button>
        </div>

        <div class="fw-status-row">
          <div class="fw-status-item">
            <span class="label">{{ t("transcription-faster-gpu-cuda", "GPU") }}</span>
            <span class="fw-badge" :class="binaryStatus.gpu ? 'fw-badge--success' : 'fw-badge--error'">
              {{
                binaryStatus.gpu
                  ? t("transcription-faster-binary-present", "Ready")
                  : t("transcription-faster-binary-missing", "Missing")
              }}
            </span>
          </div>
          <button
            type="button"
            class="btn-secondary"
            @click="$emit('download-binary', 'gpu')"
            :disabled="isBusy"
          >
            {{ binaryStatus.gpu ? t("button-redownload", "Redownload") : t("button-download", "Download") }}
          </button>
        </div>
      </div>

      <div class="fw-folder-input">
        <div class="fw-field-header">
          <span class="label">{{ t("transcription-faster-binary", "Binary Path") }}</span>
          <button
            type="button"
            class="icon-text-button"
            @click="$emit('open-path', binaryDir)"
            :title="t('transcription-faster-open-bin', 'Open folder')"
          >
            <span class="icon">📂</span>
          </button>
        </div>
        <input type="text" v-model="fasterWhisperBinary" placeholder="faster-whisper" class="fw-input-sm" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
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
