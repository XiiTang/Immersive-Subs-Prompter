<template>
  <section class="ui-group">
    <header class="ui-group__header">
      <h3 class="ui-group__title">{{ t("transcription-faster-binary-status") }}</h3>
    </header>

    <div class="ui-group__body">
      <div class="settings-row settings-row--two">
        <div class="settings-list-row">
          <div class="settings-list-row__main">
            <span class="ui-field__label">{{ t("transcription-faster-cpu-support") }}</span>
            <UiBadge :tone="binaryStatus.cpu ? 'success' : 'danger'">
              {{
                binaryStatus.cpu
                  ? t("transcription-faster-binary-present")
                : t("transcription-faster-binary-missing")
              }}
            </UiBadge>
          </div>
          <UiButton variant="secondary" :disabled="isBusy || !binaryDownloadsSupported" @click="$emit('download-binary', 'cpu')">
            {{ binaryStatus.cpu ? t("button-redownload") : t("button-download") }}
          </UiButton>
        </div>

        <div class="settings-list-row">
          <div class="settings-list-row__main">
            <span class="ui-field__label">{{ t("transcription-faster-gpu-cuda") }}</span>
            <UiBadge :tone="binaryStatus.gpu ? 'success' : 'danger'">
              {{
                binaryStatus.gpu
                  ? t("transcription-faster-binary-present")
                  : t("transcription-faster-binary-missing")
              }}
            </UiBadge>
          </div>
          <UiButton variant="secondary" :disabled="isBusy || !binaryDownloadsSupported" @click="$emit('download-binary', 'gpu')">
            {{ binaryStatus.gpu ? t("button-redownload") : t("button-download") }}
          </UiButton>
        </div>
      </div>

      <p v-if="!binaryDownloadsSupported" class="ui-message ui-message--info">
        {{ unsupportedReason || t("transcription-faster-binary-download-windows-only") }}
      </p>

      <div class="settings-field-stack">
        <div class="settings-row settings-row--between">
          <span class="ui-field__label">{{ t("transcription-faster-binary") }}</span>
          <UiIconButton
            size="sm"
            @click="$emit('open-path', binaryDir)"
            :label="t('transcription-faster-open-bin')"
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
  t: (key: string) => string;
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
