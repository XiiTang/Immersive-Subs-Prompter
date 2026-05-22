<template>
  <UiField id="transcription-base-url" :label="t('transcription-base-url-label', 'API Base URL')">
    <UiInput v-model="baseUrl" placeholder="https://api.openai.com/v1" />
  </UiField>
  <UiField id="transcription-api-key" :label="t('transcription-api-key-label', 'API Key')">
    <UiInput v-model="apiKey" placeholder="sk-..." />
  </UiField>
  <div class="settings-fields-grid settings-fields-grid--two-col">
    <UiField id="transcription-model" :label="t('transcription-model-label', 'Model')">
      <UiInput v-model="model" placeholder="whisper-1" />
    </UiField>
    <UiField id="transcription-language" :label="t('transcription-language-label', 'Language')">
      <UiInput v-model="languageField" placeholder="auto" />
    </UiField>
  </div>
  <UiField id="transcription-prompt" :label="t('transcription-prompt-label', 'Prompt')">
    <UiInput v-model="prompt" />
  </UiField>
</template>

<script setup lang="ts">
import { UiField, UiInput } from "../../ui";

defineProps<{
  t: (key: string, fallback: string) => string;
}>();

const baseUrl = defineModel<string>("baseUrl", { required: true });
const apiKey = defineModel<string>("apiKey", { required: true });
const model = defineModel<string>("model", { required: true });
const languageField = defineModel<string>("languageField", { required: true });
const prompt = defineModel<string>("prompt", { required: true });
</script>
