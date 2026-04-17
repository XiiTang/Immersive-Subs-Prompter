<template>
  <div class="fw-card">
    <div class="fw-card__header">
      <div class="fw-card__title">{{ t("transcription-runtime-config", "Runtime Configuration") }}</div>
    </div>

    <div class="fw-card__content">
      <div class="fw-row two-col">
        <div class="fw-field">
          <span class="label">{{ t("transcription-faster-model", "Active Model") }}</span>
          <div class="fw-select-group">
            <select class="fw-select" v-model="selectedDownloadedModel">
              <option v-if="!availableModels.length" value="custom">
                {{ t("transcription-faster-model-missing", "No downloaded models detected") }}
              </option>
              <option v-for="m in availableModels" :key="m.path" :value="m.name">
                {{ m.name }}
              </option>
              <option value="custom">{{ t("transcription-faster-model-custom", "Custom value") }}</option>
            </select>
            <input
              v-if="selectedDownloadedModel === 'custom'"
              type="text"
              v-model="customModelInput"
              placeholder="medium"
              class="fw-input-sm"
            />
          </div>
        </div>

        <div class="fw-field">
          <span class="label">{{ t("transcription-faster-device", "Device") }}</span>
          <select v-model="fasterWhisperDevice" class="fw-select">
            <option value="cpu">CPU</option>
            <option value="cuda">CUDA (GPU)</option>
          </select>
        </div>
      </div>

      <div class="fw-row three-col">
        <div class="fw-field">
          <div class="fw-field-header">
            <span class="label">{{ t("transcription-faster-vad-filter", "VAD Filter") }}</span>
            <label class="toggle toggle--sm">
              <input type="checkbox" v-model="fasterWhisperVadFilter" />
              <span class="toggle__text"></span>
            </label>
          </div>
        </div>

        <div class="fw-field">
          <span class="label">{{ t("transcription-faster-vad-threshold", "Threshold") }}</span>
          <input type="number" min="0" max="1" step="0.05" v-model.number="fasterWhisperVadThreshold" class="fw-input-sm" />
        </div>

        <div class="fw-field">
          <span class="label">{{ t("transcription-faster-vad-method", "VAD Method") }}</span>
          <input type="text" v-model="fasterWhisperVadMethod" placeholder="silero" class="fw-input-sm" />
        </div>
      </div>

      <div class="fw-row two-col">
        <div class="fw-field">
          <span class="label">{{ t("transcription-language-label", "Language") }}</span>
          <input type="text" v-model="languageField" placeholder="auto" class="fw-input-sm" />
        </div>

        <div class="fw-field">
          <span class="label">{{ t("transcription-prompt-label", "Prompt") }}</span>
          <input type="text" v-model="prompt" class="fw-input-sm" />
        </div>
      </div>

      <div class="fw-row">
        <div class="fw-field fw-field--inline">
          <span class="label">{{ t("transcription-faster-kim2", "Voice Separation (Kim2)") }}</span>
          <label class="toggle toggle--sm">
            <input type="checkbox" v-model="fasterWhisperUseKim2" />
            <span class="toggle__text">{{ t("toggle-enable", "Enable") }}</span>
          </label>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { AvailableModel } from "./composables/useFasterWhisper";

defineProps<{
  t: (key: string, fallback: string) => string;
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
</script>
