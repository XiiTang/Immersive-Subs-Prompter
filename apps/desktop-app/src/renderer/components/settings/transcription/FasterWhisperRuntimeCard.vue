<template>
  <section class="ui-group">
    <header class="ui-group__header">
      <h3 class="ui-group__title">{{ t("transcription-runtime-config") }}</h3>
    </header>

    <div class="ui-group__body">
      <div class="settings-row settings-row--two">
        <UiField id="fw-active-model" :label="t('transcription-faster-model')">
          <div class="settings-inline">
            <UiSelect v-model="selectedDownloadedModel" :options="downloadedModelOptions" />
            <UiInput
              v-if="selectedDownloadedModel === 'custom'"
              v-model="customModelInput"
              placeholder="medium"
            />
          </div>
        </UiField>

        <UiField id="fw-device" :label="t('transcription-faster-device')">
          <UiSelect v-model="fasterWhisperDevice" :options="deviceOptions" />
        </UiField>
      </div>

      <div class="settings-row settings-row--three">
        <UiField id="fw-vad-filter" :label="t('transcription-faster-vad-filter')" inline>
          <UiSwitch v-model="fasterWhisperVadFilter" :label="fasterWhisperVadFilter ? t('toggle-on') : t('toggle-off')" />
        </UiField>

        <UiField id="fw-vad-threshold" :label="t('transcription-faster-vad-threshold')">
          <UiInput v-model="fasterWhisperVadThreshold" type="number" min="0" max="1" step="0.05" />
        </UiField>

        <UiField id="fw-vad-method" :label="t('transcription-faster-vad-method')">
          <UiInput v-model="fasterWhisperVadMethod" placeholder="silero" />
        </UiField>
      </div>

      <div class="settings-row settings-row--two">
        <UiField id="fw-language" :label="t('transcription-language-label')">
          <UiInput v-model="languageField" placeholder="auto" />
        </UiField>

        <UiField id="fw-prompt" :label="t('transcription-prompt-label')">
          <UiInput v-model="prompt" />
        </UiField>
      </div>

      <div class="settings-row">
        <UiField id="fw-kim2" :label="t('transcription-faster-kim2')" inline>
          <UiSwitch v-model="fasterWhisperUseKim2" :label="fasterWhisperUseKim2 ? t('toggle-on') : t('toggle-off')" />
        </UiField>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { AvailableModel } from "./composables/useFasterWhisper";
import { UiField, UiInput, UiSelect, UiSwitch } from "../../ui";

const { t, availableModels } = defineProps<{
  t: (key: string) => string;
  availableModels: AvailableModel[];
}>();

const selectedDownloadedModel = defineModel<string>("selectedDownloadedModel", { required: true });
const customModelInput = defineModel<string>("customModelInput", { required: true });
const fasterWhisperDevice = defineModel<"cpu" | "cuda">("fasterWhisperDevice", { required: true });
const fasterWhisperVadFilter = defineModel<boolean>("fasterWhisperVadFilter", { required: true });
const fasterWhisperVadThreshold = defineModel<number>("fasterWhisperVadThreshold", { required: true });
const fasterWhisperVadMethod = defineModel<string>("fasterWhisperVadMethod", { required: true });
const fasterWhisperUseKim2 = defineModel<boolean>("fasterWhisperUseKim2", { required: true });
const languageField = defineModel<string>("languageField", { required: true });
const prompt = defineModel<string>("prompt", { required: true });

const downloadedModelOptions = computed(() => [
  ...(!availableModels.length
    ? [{ value: "custom", label: t("transcription-faster-model-missing") }]
    : []),
  ...availableModels.map((model) => ({ value: model.name, label: model.name })),
  { value: "custom", label: t("transcription-faster-model-custom") }
]);

const deviceOptions = [
  { value: "cpu", label: "CPU" },
  { value: "cuda", label: "CUDA (GPU)" }
];
</script>
