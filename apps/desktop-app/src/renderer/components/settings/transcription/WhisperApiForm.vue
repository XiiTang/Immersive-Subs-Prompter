<template>
  <div class="whisper-api-form">
    <UiSettingRow id="feature-transcription-base-url" :label="t('feature-transcription-base-url')" control-width="wide">
      <UiInput :model-value="baseUrl" @update:model-value="$emit('update:baseUrl', String($event))" />
    </UiSettingRow>
    <UiSettingRow id="feature-transcription-api-key" :label="t('feature-transcription-api-key')" control-width="wide">
      <UiInput
        :model-value="apiKey"
        type="password"
        @update:model-value="$emit('update:apiKey', String($event))"
      />
    </UiSettingRow>
    <UiSettingRow id="feature-transcription-model" :label="t('feature-transcription-model')" control-width="field">
      <UiInput :model-value="model" @update:model-value="$emit('update:model', String($event))" />
    </UiSettingRow>
    <UiSettingRow id="feature-transcription-language" :label="t('feature-transcription-language')" control-width="field">
      <UiInput :model-value="languageField" @update:model-value="$emit('update:languageField', String($event))" />
    </UiSettingRow>
    <UiSettingRow id="feature-transcription-prompt" :label="t('feature-transcription-prompt')" control-width="editor" stacked>
      <UiTextarea :model-value="prompt" :rows="3" @update:model-value="$emit('update:prompt', $event)" />
    </UiSettingRow>
    <UiSettingRow id="feature-transcription-word-timestamps" :label="t('feature-transcription-word-timestamps')" control-width="compact">
      <UiSwitch
        :model-value="enableWordTimestamps"
        :label="t('feature-transcription-word-timestamps')"
        @update:model-value="$emit('update:enableWordTimestamps', $event)"
      />
    </UiSettingRow>
  </div>
</template>

<script setup lang="ts">
import { UiInput, UiSettingRow, UiSwitch, UiTextarea } from "../../ui";

defineProps<{
  t: (key: string) => string;
  baseUrl: string;
  apiKey: string;
  model: string;
  languageField: string;
  prompt: string;
  enableWordTimestamps: boolean;
}>();

defineEmits<{
  "update:baseUrl": [value: string];
  "update:apiKey": [value: string];
  "update:model": [value: string];
  "update:languageField": [value: string];
  "update:prompt": [value: string];
  "update:enableWordTimestamps": [value: boolean];
}>();
</script>

<style scoped>
.whisper-api-form {
  display: contents;
}
</style>
