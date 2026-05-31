<template>
  <div class="settings-split__sidebar">
    <div class="settings-split__sidebar-header">
      <span class="settings-field__label">{{ t("transcription-active-config") }}</span>
      <div class="settings-split__sidebar-buttons">
        <UiIconButton :label="t('button-add')" @click="$emit('add')">
          <IconAdd size="md" />
        </UiIconButton>
        <UiIconButton
          :disabled="transcriptionConfigs.length <= 1"
          variant="danger"
          :label="t('button-delete')"
          @click="$emit('delete')"
        >
          <IconDelete size="md" />
        </UiIconButton>
      </div>
    </div>
    <div class="transcription-config-list ui-list">
      <template v-if="transcriptionConfigs.length">
        <UiListItem
          v-for="config in transcriptionConfigs"
          :key="config.id"
          as="div"
          class="transcription-config-list__item"
          :selected="config.id === selectedConfigId"
          @click="$emit('select', config.id)"
        >
          <div class="transcription-config-list__content">
            <div class="transcription-config-list__name">
              <UiInput
                v-if="editingNameConfigId === config.id"
                class="settings-config-name-input transcription-config-list__name-input"
                data-testid="transcription-config-name-input"
                :data-config-id="config.id"
                v-model="draftConfigName"
                :aria-label="t('transcription-name-label')"
                @click.stop
                @mousedown.stop
                @dragstart.stop
                @keydown.enter.prevent.stop="($event.target as HTMLInputElement).blur()"
                @keydown.escape.prevent.stop="cancelConfigNameEdit"
                @blur="commitConfigName(config.id)"
              />
              <UiButton
                v-else
                variant="ghost"
                size="sm"
                class="settings-config-name-action transcription-config-list__name-action"
                data-testid="transcription-config-name-action"
                @click.stop="startConfigNameEdit(config)"
                @mousedown.stop
                @dragstart.stop
              >
                {{ config.name || config.id }}
              </UiButton>
            </div>
            <div class="transcription-config-list__meta">
              <UiBadge>
                {{ getProviderLabel(config.provider) }}
              </UiBadge>
              <span class="transcription-config-list__muted">
                {{ getModelLabel(config) }}
              </span>
            </div>
          </div>
          <UiCheckIndicator
            class="settings-config-state-indicator"
            :checked="config.id === activeConfigId"
            :label="getConfigStateLabel(config.id)"
            tone="info"
            test-id="transcription-config-state"
            @click.stop
            @update:checked="(checked) => handleConfigStateInput(config.id, checked)"
          />
        </UiListItem>
      </template>
      <UiEmptyState v-else :message="t('transcription-config-empty')" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { nextTick, ref } from "vue";
import type { TranscriptionConfig } from "../../../../main/types";
import { IconAdd, IconDelete } from "../../icons";
import { UiBadge, UiButton, UiCheckIndicator, UiEmptyState, UiIconButton, UiInput, UiListItem } from "../../ui";

const props = defineProps<{
  transcriptionConfigs: TranscriptionConfig[];
  activeConfigId: string;
  selectedConfigId: string;
  t: (key: string) => string;
}>();

const emit = defineEmits<{
  (event: "add"): void;
  (event: "delete"): void;
  (event: "select", id: string): void;
  (event: "activate", id: string): void;
  (event: "rename", id: string, name: string): void;
}>();

const editingNameConfigId = ref<string | null>(null);
const draftConfigName = ref("");

function getProviderLabel(provider: TranscriptionConfig["provider"] | undefined) {
  if (provider === "faster-whisper") {
    return props.t("transcription-provider-faster-short");
  }
  return props.t("transcription-provider-whisper-short");
}

function getModelLabel(config: TranscriptionConfig) {
  const languageLabel = (config.language || "auto").trim() || "auto";
  if (config.provider === "faster-whisper") {
    const modelName = (config.fasterWhisperModel || props.t("transcription-faster-model")).trim();
    return `${modelName} · ${languageLabel}`;
  }
  const modelName = (config.model || props.t("transcription-model-label")).trim();
  return `${modelName} · ${languageLabel}`;
}

function getConfigStateLabel(configId: string) {
  return configId === props.activeConfigId
    ? props.t("transcription-config-active-badge")
    : props.t("transcription-config-inactive-label");
}

function handleConfigStateInput(configId: string, checked: boolean) {
  if (checked) {
    emit("activate", configId);
  }
}

async function startConfigNameEdit(config: TranscriptionConfig) {
  editingNameConfigId.value = config.id;
  draftConfigName.value = config.name || config.id;
  await nextTick();
  const input = Array.from(document.querySelectorAll<HTMLInputElement>('[data-testid="transcription-config-name-input"]')).find(
    (element) => element.dataset.configId === config.id
  );
  input?.focus();
  input?.select();
}

function cancelConfigNameEdit() {
  editingNameConfigId.value = null;
  draftConfigName.value = "";
}

function commitConfigName(configId: string) {
  const name = draftConfigName.value.trim();
  editingNameConfigId.value = null;
  draftConfigName.value = "";
  if (!name.length) {
    return;
  }
  emit("rename", configId, name);
}
</script>
