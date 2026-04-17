<template>
  <label class="settings-field">
    <span class="settings-field__label">{{ t("transcription-base-url-label", "API Base URL") }}</span>
    <input type="text" v-model="baseUrl" placeholder="https://api.openai.com/v1" />
  </label>
  <label class="settings-field">
    <span class="settings-field__label">{{ t("transcription-api-key-label", "API Key") }}</span>
    <input type="text" v-model="apiKey" placeholder="sk-..." />
  </label>
  <div class="settings-field settings-field--inline">
    <div class="settings-field__inline">
      <span class="settings-field__label">{{ t("transcription-model-label", "Model") }}</span>
      <input type="text" v-model="model" placeholder="whisper-1" />
    </div>
  </div>
  <div class="settings-field settings-field--inline">
    <div class="settings-field__inline">
      <span class="settings-field__label">{{ t("transcription-language-label", "Language") }}</span>
      <input type="text" v-model="languageField" placeholder="auto" />
    </div>
  </div>
  <label class="settings-field">
    <span class="settings-field__label">{{ t("transcription-prompt-label", "Prompt") }}</span>
    <input type="text" v-model="prompt" />
  </label>
</template>

<script setup lang="ts">
defineProps<{
  t: (key: string, fallback: string) => string;
}>();

const baseUrl = defineModel<string>("baseUrl", { required: true });
const apiKey = defineModel<string>("apiKey", { required: true });
const model = defineModel<string>("model", { required: true });
const languageField = defineModel<string>("languageField", { required: true });
const prompt = defineModel<string>("prompt", { required: true });
</script>
