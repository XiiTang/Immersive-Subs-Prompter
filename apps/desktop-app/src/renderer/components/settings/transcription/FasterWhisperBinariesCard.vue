<template>
  <section class="ui-group">
    <header class="ui-group__header">
      <h3 class="ui-group__title">{{ t("transcription-faster-binary-status", "System Integration") }}</h3>
    </header>

    <div class="ui-group__body">
      <div class="settings-row settings-row--two">
        <div class="settings-list-row">
          <div class="settings-list-row__main">
            <span class="ui-field__label">{{ t("transcription-faster-cpu-support", "CPU") }}</span>
            <UiBadge :tone="binaryStatus.cpu ? 'success' : 'danger'">
              {{
                binaryStatus.cpu
                  ? t("transcription-faster-binary-present", "Ready")
                : t("transcription-faster-binary-missing", "Missing")
              }}
            </UiBadge>
          </div>
          <UiButton variant="secondary" :disabled="isBusy || !binaryDownloadsSupported" @click="$emit('download-binary', 'cpu')">
            {{ binaryStatus.cpu ? t("button-redownload", "Redownload") : t("button-download", "Download") }}
          </UiButton>
        </div>

        <div class="settings-list-row">
          <div class="settings-list-row__main">
            <span class="ui-field__label">{{ t("transcription-faster-gpu-cuda", "GPU") }}</span>
            <UiBadge :tone="binaryStatus.gpu ? 'success' : 'danger'">
              {{
                binaryStatus.gpu
                  ? t("transcription-faster-binary-present", "Ready")
                  : t("transcription-faster-binary-missing", "Missing")
              }}
            </UiBadge>
          </div>
          <UiButton variant="secondary" :disabled="isBusy || !binaryDownloadsSupported" @click="$emit('download-binary', 'gpu')">
            {{ binaryStatus.gpu ? t("button-redownload", "Redownload") : t("button-download", "Download") }}
          </UiButton>
        </div>
      </div>

      <p v-if="!binaryDownloadsSupported" class="ui-message ui-message--info">
        {{ unsupportedReason || t("transcription-faster-binary-download-windows-only", "Managed binary downloads are only available on Windows.") }}
      </p>

      <div class="settings-field-stack">
        <div class="settings-row settings-row--between">
          <span class="ui-field__label">{{ t("transcription-faster-binary", "Binary Path") }}</span>
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
  </section>
</template>

<script setup lang="ts">
import { IconFolder } from "../../icons";
import { UiBadge, UiButton, UiIconButton, UiInput } from "../../ui";

defineProps<{
  t: (key: string, fallback: string) => string;
  binaryStatus: { cpu: boolean; gpu: boolean };
  binaryDownloadsSupported: boolean;
  unsupportedReason: string | null;
  isBusy: boolean;
  binaryDir: string | undefined;
}>();

defineEmits<{
  (event: "download-binary", variant: "cpu" | "gpu"): void;
  (event: "open-path", target: string | undefined): void;
}>();

const fasterWhisperBinary = defineModel<string>("fasterWhisperBinary", { required: true });
</script>
